import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    codex: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Codex",
    },
    sourceUrl: {
      type: String,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    highlightedText: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    noteContent: {
      type: String,
      trim: true,
      default: "",
    },
    color: {
      type: String,
      default: "#eab308", // Yellow highlighter default
    }
  },
  { timestamps: true }
);

// Indexes for faster queries
noteSchema.index({ user: 1 });
noteSchema.index({ codex: 1 });

const Note = mongoose.models.Note || mongoose.model("Note", noteSchema);

export default Note;
