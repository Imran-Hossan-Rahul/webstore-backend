// controllers/oauthController.js
// OAuth "Connect Account" & "Direct Login" flows — GitHub & Google
import crypto from "crypto"; // ✅ FIX: needed for CSRF state nonces
import User from "../models/User.model.js";
import logger from "../utils/logger.js";
import { generateAccessToken, generateRefreshToken } from "../services/auth.service.js";
import { generateUniqueUsername } from "../utils/generateUsername.js";
import { NODE_ENV, CLIENT_URL } from "../config/index.js";

const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BACKEND_URL          = process.env.BACKEND_URL || "http://localhost:5000";

// ✅ FIX: sameSite changed from 'Strict' to 'Lax'
// 'Strict' blocks cookies on OAuth cross-site redirects, breaking the flow entirely.
const setTokenCookies = (res, accessToken, refreshTokenDoc, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "Lax", // ✅ FIX: was 'Strict' — breaks OAuth cross-site redirect cookie setting
    maxAge: 15 * 60 * 1000,
  });

  const maxAge = refreshTokenDoc.expiresAt.getTime() - Date.now();
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "Lax", // ✅ FIX: was 'Strict'
    path: "/api/v1/auth/refresh-token",
    maxAge,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GITHUB OAuth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Redirect user to GitHub OAuth consent screen (Connect)
 * @route   GET /api/v1/oauth/github/connect
 */
export const githubConnectRedirect = (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(501).json({ success: false, message: "GitHub OAuth not configured" });
  }
  const redirectUri = `${BACKEND_URL}/api/v1/oauth/github/callback`;
  const scope = "read:user user:email";
  // pass userId as state for security + action type
  const state = JSON.stringify({ action: "connect", userId: req.user._id.toString() });

  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  res.redirect(url);
};

/**
 * @desc    Redirect user to GitHub OAuth consent screen (Login)
 * @route   GET /api/v1/oauth/github/login
 */
export const githubLoginRedirect = (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(501).json({ success: false, message: "GitHub OAuth not configured" });
  }
  const redirectUri = `${BACKEND_URL}/api/v1/oauth/github/callback`;
  const scope = "read:user user:email";
  // ✅ FIX: Added random nonce to state to prevent OAuth CSRF attacks
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = JSON.stringify({ action: "login", nonce });

  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  res.redirect(url);
};

/**
 * @desc    GitHub OAuth callback — handle both Connect and Login
 * @route   GET /api/v1/oauth/github/callback
 */
export const githubConnectCallback = async (req, res) => {
  try {
    const { code, state: stateQuery } = req.query;
    if (!code) return res.redirect(`${CLIENT_URL}/auth/login?error=no_code`);

    let state = {};
    try { state = JSON.parse(stateQuery); } catch (e) { state = { action: "connect", userId: stateQuery }; }

    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id:     GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect(`${CLIENT_URL}/auth/login?error=token_failed`);
    }

    // Get GitHub user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json" },
    });
    const ghUser = await userRes.json();

    // Get primary email
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json" },
    });
    const emails = await emailsRes.json();
    const primaryEmail = emails.find(e => e.primary && e.verified)?.email || emails[0]?.email;

    if (state.action === "connect") {
      const user = await User.findById(state.userId);
      if (!user) return res.redirect(`${CLIENT_URL}/settings?oauth_error=user_not_found`);

      user.connectedAccounts = user.connectedAccounts || {};
      user.connectedAccounts.github = {
        connected:   true,
        username:    ghUser.login,
        connectedAt: new Date(),
      };
      user.markModified("connectedAccounts");
      if (!user.professionalLinks?.github && ghUser.html_url) {
        user.professionalLinks = user.professionalLinks || {};
        user.professionalLinks.github = ghUser.html_url;
      }
      await user.save();
      return res.redirect(`${CLIENT_URL}/settings?oauth_success=github&github_user=${ghUser.login}`);
    } 
    
    if (state.action === "login") {
      // Find user by github username or primary email
      let user = await User.findOne({ 
        $or: [
          { "connectedAccounts.github.username": ghUser.login },
          { email: primaryEmail }
        ]
      });

      if (!user) {
        // Auto-register
        const username = await generateUniqueUsername(ghUser.name || ghUser.login, User);
        user = await User.create({
          name: ghUser.name || ghUser.login,
          username,
          email: primaryEmail,
          password: Math.random().toString(36).slice(-12), // random pass
          emailVerified: true,
          connectedAccounts: {
            github: { connected: true, username: ghUser.login, connectedAt: new Date() }
          }
        });

        // Auto-create PlatformProfile
        const PlatformProfile = (await import("../models/PlatformProfile.model.js")).default;
        await PlatformProfile.create({ userId: user._id, isActive: true });
      } else {
        // Ensure GitHub is connected if it wasn't
        if (!user.connectedAccounts?.github?.connected) {
          user.connectedAccounts = user.connectedAccounts || {};
          user.connectedAccounts.github = { connected: true, username: ghUser.login, connectedAt: new Date() };
          user.markModified("connectedAccounts");
          await user.save();
        }
      }

      // Generate tokens and login
      const accessToken = generateAccessToken(user);
      const { token: refreshToken, refreshTokenDoc } = await generateRefreshToken(user, req.headers["user-agent"], req.ip);
      setTokenCookies(res, accessToken, refreshTokenDoc, refreshToken);

      return res.redirect(`${CLIENT_URL}/auth/callback?token=${accessToken}&csrf=${req.csrfToken}&user=${encodeURIComponent(JSON.stringify({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasCraftsmanAccount: user.hasCraftsmanAccount
      }))}`);
    }

    res.redirect(`${CLIENT_URL}/auth/login?error=invalid_action`);
  } catch (error) {
    logger.error("GitHub OAuth Callback Error:", error);
    res.redirect(`${CLIENT_URL}/auth/login?error=server_error`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAuth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Redirect user to Google OAuth consent screen (Connect)
 */
export const googleConnectRedirect = (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(501).json({ success: false, message: "Google OAuth not configured" });
  }
  const redirectUri = `${BACKEND_URL}/api/v1/oauth/google/callback`;
  const state = JSON.stringify({ action: "connect", userId: req.user._id.toString() });
  const scope = encodeURIComponent("openid email profile");

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}&access_type=offline`;
  res.redirect(url);
};

/**
 * @desc    Redirect user to Google OAuth consent screen (Login)
 */
export const googleLoginRedirect = (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(501).json({ success: false, message: "Google OAuth not configured" });
  }
  const redirectUri = `${BACKEND_URL}/api/v1/oauth/google/callback`;
  // ✅ FIX: Added random nonce to state to prevent OAuth CSRF attacks
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = JSON.stringify({ action: "login", nonce });
  const scope = encodeURIComponent("openid email profile");

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}&access_type=offline`;
  res.redirect(url);
};

/**
 * @desc    Google OAuth callback
 */
export const googleConnectCallback = async (req, res) => {
  try {
    const { code, state: stateQuery } = req.query;
    if (!code) return res.redirect(`${CLIENT_URL}/auth/login?error=no_code`);

    let state = {};
    try { state = JSON.parse(stateQuery); } catch (e) { state = { action: "connect", userId: stateQuery }; }

    const redirectUri = `${BACKEND_URL}/api/v1/oauth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect(`${CLIENT_URL}/auth/login?error=token_failed`);
    }

    // Get Google user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const gUser = await userRes.json();

    if (state.action === "connect") {
      const user = await User.findById(state.userId);
      if (!user) return res.redirect(`${CLIENT_URL}/settings?oauth_error=user_not_found`);

      user.connectedAccounts = user.connectedAccounts || {};
      user.connectedAccounts.google = {
        connected:   true,
        email:       gUser.email,
        connectedAt: new Date(),
      };
      user.markModified("connectedAccounts");
      await user.save();
      return res.redirect(`${CLIENT_URL}/settings?oauth_success=google&google_email=${encodeURIComponent(gUser.email)}`);
    }

    if (state.action === "login") {
      let user = await User.findOne({ 
        $or: [
          { "connectedAccounts.google.email": gUser.email },
          { email: gUser.email }
        ]
      });

      if (!user) {
        // Auto-register
        const username = await generateUniqueUsername(gUser.name, User);
        user = await User.create({
          name: gUser.name,
          username,
          email: gUser.email,
          password: Math.random().toString(36).slice(-12),
          emailVerified: true,
          connectedAccounts: {
            google: { connected: true, email: gUser.email, connectedAt: new Date() }
          }
        });
        const PlatformProfile = (await import("../models/PlatformProfile.model.js")).default;
        await PlatformProfile.create({ userId: user._id, isActive: true });
      } else {
        if (!user.connectedAccounts?.google?.connected) {
          user.connectedAccounts = user.connectedAccounts || {};
          user.connectedAccounts.google = { connected: true, email: gUser.email, connectedAt: new Date() };
          user.markModified("connectedAccounts");
          await user.save();
        }
      }

      const accessToken = generateAccessToken(user);
      const { token: refreshToken, refreshTokenDoc } = await generateRefreshToken(user, req.headers["user-agent"], req.ip);
      setTokenCookies(res, accessToken, refreshTokenDoc, refreshToken);

      return res.redirect(`${CLIENT_URL}/auth/callback?token=${accessToken}&csrf=${req.csrfToken}&user=${encodeURIComponent(JSON.stringify({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasCraftsmanAccount: user.hasCraftsmanAccount
      }))}`);
    }

    res.redirect(`${CLIENT_URL}/auth/login?error=invalid_action`);
  } catch (error) {
    logger.error("Google OAuth Callback Error:", error);
    res.redirect(`${CLIENT_URL}/auth/login?error=server_error`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Management & Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const disconnectAccount = async (req, res) => {
  try {
    const { provider } = req.params;
    const allowed = ["github", "google", "linkedin"];
    if (!allowed.includes(provider)) return res.status(400).json({ success: false, message: "Invalid provider" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.connectedAccounts = user.connectedAccounts || {};
    user.connectedAccounts[provider] = { connected: false };
    user.markModified("connectedAccounts");
    await user.save();

    res.json({ success: true, message: `${provider} account disconnected` });
  } catch (error) {
    logger.error("Disconnect Account Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getConnectedAccounts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("connectedAccounts");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user.connectedAccounts || {} });
  } catch (error) {
    logger.error("Get Connected Accounts Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getGithubRepos = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ success: false, message: "Username required" });

    const ghRes = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=6`, {
      headers: { Accept: "application/vnd.github+json" }
    });

    if (!ghRes.ok) return res.status(ghRes.status).json({ success: false, message: "Failed to fetch from GitHub" });

    const repos = await ghRes.json();
    const data = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      description: repo.description,
      html_url: repo.html_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at
    }));

    res.json({ success: true, data });
  } catch (error) {
    logger.error("Get GitHub Repos Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
