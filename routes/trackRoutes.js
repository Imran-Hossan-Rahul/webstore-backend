import express from "express";
import Event from "../models/Event.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "trackRoutes.js placeholder endpoint" });
});

router.post("/batch", async (req, res) => {
  try {
    const events = req.body;
    
    if (events && Array.isArray(events)) {
      const validEvents = events
        .filter(e => e.eventType) // ensure eventType exists
        .map(e => ({
          sessionId: e.sessionId,
          visitorId: e.visitorId,
          eventType: e.eventType,
          page: e.page,
          timestamp: e.timestamp || Date.now(),
          value: e
        }));

      if (validEvents.length > 0) {
        // Save events to db without blocking the response
        Event.insertMany(validEvents).catch(err => {
          logger.error("Failed to insert telemetry events", err);
        });
      }
    }
    
    // Always return success quickly
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Telemetry batch error", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
