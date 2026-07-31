import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "devlogRoutes.js placeholder endpoint" });
});

export default router;
