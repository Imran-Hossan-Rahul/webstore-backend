import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  // Github routes removed

  googleConnectRedirect,
  googleConnectCallback,
  googleLoginRedirect,
  disconnectAccount,
  getConnectedAccounts,
  // getGithubRepos removed
} from "../controllers/oauthController.js";

const router = express.Router();

// GitHub OAuth Removed

// Google OAuth
router.get("/google/connect",  protect, googleConnectRedirect);
router.get("/google/login",             googleLoginRedirect);
router.get("/google/callback",          googleConnectCallback); // generic callback

// Connected Accounts Management
router.get("/connected",        protect, getConnectedAccounts);
router.delete("/disconnect/:provider", protect, disconnectAccount);

// Public Resource Fetching
// GitHub repos endpoint removed

export default router;
