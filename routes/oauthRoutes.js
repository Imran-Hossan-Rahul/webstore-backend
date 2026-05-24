import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  githubConnectRedirect,
  githubConnectCallback,
  githubLoginRedirect,
  googleConnectRedirect,
  googleConnectCallback,
  googleLoginRedirect,
  disconnectAccount,
  getConnectedAccounts,
  getGithubRepos,
} from "../controllers/oauthController.js";

const router = express.Router();

// GitHub OAuth
router.get("/github/connect",  protect, githubConnectRedirect);
router.get("/github/login",             githubLoginRedirect);
router.get("/github/callback",          githubConnectCallback); // generic callback

// Google OAuth
router.get("/google/connect",  protect, googleConnectRedirect);
router.get("/google/login",             googleLoginRedirect);
router.get("/google/callback",          googleConnectCallback); // generic callback

// Connected Accounts Management
router.get("/connected",        protect, getConnectedAccounts);
router.delete("/disconnect/:provider", protect, disconnectAccount);

// Public Resource Fetching
router.get("/github/repos/:username", getGithubRepos);

export default router;
