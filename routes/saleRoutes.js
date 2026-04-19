// routes/saleRoutes.js
import express from "express";
import {
  createSale,
  getAllSales,
  getSalesByDateRange,
  deleteSale,
} from "../controllers/saleController.js";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";

const router = express.Router();

router.post("/", verifyAccessToken, createSale);
router.get("/all-sale", verifyAccessToken, getAllSales); // Get all sales
router.get("/range", verifyAccessToken, getSalesByDateRange); // Get sales by date range
router.delete("/:id", verifyAccessToken, deleteSale); // Delete sale

export default router;
