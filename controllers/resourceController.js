import Resource from "../models/Resource.model.js";
import logger from "../utils/logger.js";

export const getResources = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, sortBy = "recent" } = req.query;
    const skip = (page - 1) * limit;
    const query = { isActive: true };

    if (category && category !== "all") query.category = category;

    let sort = { createdAt: -1 };
    if (sortBy === "popular") sort = { downloads: -1 };
    if (sortBy === "liked") sort = { likesCount: -1 };

    const resources = await Resource.find(query)
      .populate("craftsman", "name avatar")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Resource.countDocuments(query);

    res.status(200).json({
      success: true,
      data: resources,
      pagination: { total, page: parseInt(page), hasMore: skip + resources.length < total }
    });
  } catch (error) {
    logger.error("Get Resources Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch resources" });
  }
};

export const createResource = async (req, res) => {
  try {
    const { title, description, category, type, fileUrl, externalLink, previewImage, tags, isPaid, price } = req.body;
    const userId = req.user._id || req.user.id;

    const resource = await Resource.create({
      craftsman: userId,
      title,
      description,
      category,
      type,
      fileUrl,
      externalLink,
      previewImage,
      tags: tags || [],
      isPaid: isPaid || false,
      price: price || 0
    });

    await resource.populate("craftsman", "name avatar");

    // Create activity
    const SocialActivity = (await import("../models/SocialActivity.model.js")).default;
    await SocialActivity.create({
      user: userId,
      type: "created_post",
      title: `shared a ${category} resource: ${title}`,
      description: description
    });

    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    logger.error("Create Resource Error:", error);
    res.status(500).json({ success: false, message: "Failed to create resource" });
  }
};

export const downloadResource = async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findByIdAndUpdate(
      id,
      { $inc: { downloads: 1 } },
      { new: true }
    );

    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    res.status(200).json({ success: true, data: resource });
  } catch (error) {
    logger.error("Download Resource Error:", error);
    res.status(500).json({ success: false, message: "Failed to download resource" });
  }
};

export const likeResource = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    const isLiked = resource.likes.includes(userId);
    if (isLiked) {
      resource.likes.pull(userId);
      resource.likesCount = Math.max(0, resource.likesCount - 1);
    } else {
      resource.likes.push(userId);
      resource.likesCount += 1;
    }

    await resource.save();
    res.status(200).json({ success: true, isLiked: !isLiked, likesCount: resource.likesCount });
  } catch (error) {
    logger.error("Like Resource Error:", error);
    res.status(500).json({ success: false, message: "Failed to like resource" });
  }
};
