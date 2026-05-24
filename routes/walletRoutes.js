import express from "express";
import { depositFunds, getWalletBalance, getTransactions } from "../controllers/walletController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect); // All wallet routes require authentication

router.get("/balance", getWalletBalance);
router.get("/transactions", getTransactions);
router.post("/deposit", depositFunds);

export default router;
