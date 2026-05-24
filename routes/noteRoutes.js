import express from "express";
import { createNote, getNotes, deleteNote, getPublicNotesForCodex, toggleNoteVisibility } from "../controllers/noteController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createNote);
router.get("/", protect, getNotes);
router.delete("/:id", protect, deleteNote);

// Public route for codex notes
router.get("/codex/:codexId/public", getPublicNotesForCodex);

// Visibility route
router.patch("/:id/visibility", protect, toggleNoteVisibility);

export default router;
