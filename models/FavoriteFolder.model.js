import mongoose from "mongoose";

const favoriteFolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    itemType: {
      type: String,
      required: true,
      enum: ["Post", "Codex", "Artifact", "Job", "Challenge", "Note"]
    }
  }],
  color: {
    type: String,
    default: "#4f46e5"
  },
  isPublic: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Ensure unique folder names per user
favoriteFolderSchema.index({ name: 1, user: 1 }, { unique: true });

const FavoriteFolder = mongoose.models.FavoriteFolder || mongoose.model("FavoriteFolder", favoriteFolderSchema);

export default FavoriteFolder;

