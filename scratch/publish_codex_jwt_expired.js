import mongoose from "mongoose";
import dotenv from "dotenv";
import Codex from "../models/Codex.model.js";

dotenv.config();

const authorId = "69eca62e6cc47b43588142c5";

const article = {
  title: "How to Handle JWT Token Expired Error in Express",
  subtitle: "A practical, no-nonsense guide to understanding why JWTs expire, how to catch TokenExpiredError properly in your middleware, and how to build a refresh token flow that actually works in production.",
  tags: ["jwt", "expressjs", "nodejs", "authentication", "security", "backend", "token-refresh"],
  category: "development",
  readTime: "13 min read",
  content: `<div data-type="container"><div data-type="section"><h1 style="text-align: center;">How to Handle JWT Token Expired Error in Express</h1><p>You built your authentication system. Login works. Protected routes work. Everything is smooth. Then a user comes back the next morning, tries to do something, and your app either crashes with a 500 error or just silently fails. You check the logs and see this:</p><pre><code>JsonWebTokenError: jwt expired
    at /node_modules/jsonwebtoken/verify.js:89</code></pre><p>Or maybe your frontend is getting a 401 response with no clear explanation of what to do next. The user is logged out for no apparent reason and they have no idea why.</p><p>This is one of the most common pain points in JWT-based authentication. Not because it is hard to fix, but because most tutorials show you how to verify a token and stop there. They never show you what happens when the token dies. Let me fix that.</p><h2>Why JWTs Expire in the First Place</h2><p>Before jumping into the fix, it helps to understand why expiry exists at all. A JWT is a self-contained token. Once you sign it and hand it to the user, your server has no record of it. There is no session table, no database entry. The token just lives on the client side.</p><p>This is great for performance. But it creates a problem. If a token gets stolen — through an XSS attack, a compromised device, or a network interception — you have no way to invalidate it. The attacker can use it forever.</p><p>Expiry is the solution. You set a short lifespan on the access token, typically 15 minutes. Even if someone steals it, it stops working in 15 minutes. The damage is limited.</p><p>But now you have a new problem. Your legitimate users cannot stay logged in for more than 15 minutes without re-entering their password. That is terrible UX. This is exactly why the <strong>refresh token</strong> pattern exists, and we will get to that shortly.</p><h2>What Actually Happens When a Token Expires</h2><p>When you call <code>jwt.verify(token, secret)</code> and the token is expired, the jsonwebtoken library throws an error. It does not return null. It does not return false. It throws. If you are not catching it, your Express server will either crash or return a generic 500 error.</p><p>The error object has a <code>name</code> property set to <code>TokenExpiredError</code> and an <code>expiredAt</code> property telling you exactly when it expired. This is different from a token with an invalid signature, which throws <code>JsonWebTokenError</code>. These two are separate cases and you should handle them separately.</p><h2>The Right Way to Handle It in Your Middleware</h2><p>Here is what a proper auth middleware looks like. The key is the catch block — most developers write one generic catch and return 401 for everything. That works, but it loses information. Your frontend cannot tell the difference between "token expired, please refresh" and "token is completely invalid, please log out."</p><pre><code class="language-javascript">import jwt from "jsonwebtoken";

export const verifyAccessToken = (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token missing"
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET_ACCESS_TOKEN);
    req.user = payload;
    next();

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Access token expired",
        expired: true
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid access token",
      expired: false
    });
  }
};</code></pre><p>Notice the <code>expired: true</code> flag in the response. This is the signal your frontend needs. When it sees <code>expired: true</code>, it knows to attempt a token refresh. When it sees <code>expired: false</code>, it knows the token is genuinely invalid and the user should be logged out.</p><h2>The Refresh Token Pattern — How It Actually Works</h2><p>Here is the full picture of how a proper JWT authentication system works in production.</p><p>When a user logs in, you give them two tokens. The <strong>access token</strong> is short-lived — 15 minutes is standard. The <strong>refresh token</strong> is long-lived — 7 to 30 days. The access token is used for every API request. The refresh token is stored securely, usually in an HttpOnly cookie, and is only used for one purpose: getting a new access token when the old one expires.</p><p>The flow looks like this. User logs in, gets both tokens. They make API requests using the access token. After 15 minutes, the access token expires. The next API request returns 401 with <code>expired: true</code>. The frontend catches this, silently calls the refresh endpoint with the refresh token. The server validates the refresh token, issues a brand new access token, and returns it. The frontend retries the original request with the new token. The user never notices anything happened.</p><p>Here is the refresh endpoint on the backend:</p><pre><code class="language-javascript">import jwt from "jsonwebtoken";

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token missing" });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET_REFRESH_TOKEN);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Refresh token expired. Please log in again.",
          sessionExpired: true
        });
      }
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign(
      { id: payload.id, email: payload.email, role: payload.role },
      process.env.JWT_SECRET_ACCESS_TOKEN,
      { expiresIn: "15m" }
    );

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error during token refresh" });
  }
};</code></pre><p>Two important things here. First, when the refresh token itself is expired, you return <code>sessionExpired: true</code>. This tells the frontend the entire session is dead and the user needs to log in again. Second, you issue the new access token as an HttpOnly cookie. This means JavaScript on the page cannot read it, which protects against XSS attacks stealing the token.</p><h2>Handling It on the Frontend</h2><p>The backend work is only half the story. Your frontend needs to intercept 401 responses and automatically retry with a fresh token. If you are using Axios, you can do this cleanly with an interceptor:</p><pre><code class="language-javascript">import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.expired === true &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post("/auth/refresh-token");
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        window.location.href = "/auth/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);</code></pre><p>The <code>isRefreshing</code> flag and <code>failedQueue</code> are important. Without them, if five API requests fire at the same time and all get 401, your app would try to refresh the token five times simultaneously. The queue ensures only one refresh happens, and all the waiting requests retry once it completes.</p><h2>A Common Mistake — Treating All 401s the Same</h2><p>A lot of developers write their frontend like this:</p><pre><code class="language-javascript">if (error.response?.status === 401) {
  logout();
  redirect("/login");
}</code></pre><p>This seems reasonable but it is actually a bad experience. Every time an access token expires — which happens every 15 minutes — the user gets logged out and redirected to the login page. They lose whatever they were doing. They have to log in again. They get frustrated.</p><p>The 401 status code means "unauthenticated." It does not mean "session is permanently dead." You need to distinguish between an expired token that can be refreshed and a genuinely invalid token that cannot. That is exactly what the <code>expired: true</code> flag in your API response is for.</p><h2>Should You Store Tokens in localStorage or Cookies?</h2><p>This comes up in every JWT discussion. The short answer is: use HttpOnly cookies for both tokens in production.</p><p>localStorage is accessible by any JavaScript running on your page. If your app ever has an XSS vulnerability — even a small one from a third-party script — an attacker can read the token directly from localStorage and use it from anywhere. HttpOnly cookies cannot be read by JavaScript at all. The browser sends them automatically with every request, but no script can access them.</p><p>The tradeoff is that HttpOnly cookies require you to handle CSRF protection. But that is a solved problem — the double-submit cookie pattern or SameSite cookie attribute handles it cleanly. The security benefit of HttpOnly far outweighs the extra setup.</p><h2>Quick Reference — Error Names to Know</h2><p>When working with the jsonwebtoken library, these are the error names you will encounter in the catch block:</p><p><strong>TokenExpiredError</strong> — the token was valid but its expiry time has passed. This is the recoverable case. Attempt a refresh.</p><p><strong>JsonWebTokenError</strong> — the token signature is invalid, the token is malformed, or the secret does not match. This is not recoverable. Log the user out.</p><p><strong>NotBeforeError</strong> — the token has a <code>nbf</code> claim and it is being used before that time. Rare in most applications but worth knowing.</p><h2>Summary</h2><p>JWT expiry is not a bug — it is a security feature. The right way to handle it is to catch <code>TokenExpiredError</code> specifically in your middleware and return a response that tells the frontend the token is expired, not just invalid. On the frontend, intercept 401 responses, attempt a silent token refresh using the refresh token, and retry the original request. If the refresh token is also expired, then and only then do you log the user out. Store both tokens in HttpOnly cookies in production. And never treat all 401 responses as a reason to immediately redirect to the login page.</p></div></div>`
};

async function publish() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const exists = await Codex.exists({ title: article.title });
    if (exists) {
      console.log(`⚠️  Already exists: "${article.title}"`);
      process.exit(0);
    }

    const codex = new Codex({
      ...article,
      author: authorId,
      isPublished: true,
      isDeleted: false,
    });

    await codex.save();
    console.log(`🎉 Published: "${codex.title}"`);
    console.log(`🔗 Slug: "${codex.slug}"`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

publish();
