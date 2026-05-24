import Artifact from "../models/Artifact.model.js";
import { likeQueue } from "../queues/likeQueue.js";


export const toggleLike = async (req, res) => {
  try {
    const { artifactId } = req.params;

    // ✅ Protect middleware use করলে JWT আগেই verify হয়েছে
    const userId = req.user?.id || null; // login user
    const visitorId = req.body.visitorId || null; // visitor fallback

    if (!userId && !visitorId) {
      return res.status(400).json({ message: "Missing user/visitor ID" });
    }

    const uniqueId = userId || visitorId;

    const artifact = await Artifact.findById(artifactId);
    if (!artifact) {
      return res.status(404).json({ message: "Artifact not found" });
    }

    const alreadyLiked = artifact.likedBy.includes(uniqueId);

    await likeQueue.add("like-task", {
      artifactId,
      userId: uniqueId,
      action: alreadyLiked ? "unlike" : "like",
    });

    res.json({
      message: alreadyLiked ? "Unliked" : "Liked",
      liked: !alreadyLiked,
      queued: true,
    });
  } catch (err) {
    console.error("ToggleLike Error:", err);
    res.status(500).json({ message: err.message });
  }
};


