import FavoriteFolder from "../models/FavoriteFolder.model.js";
import User from "../models/User.model.js";
import logger from "../utils/logger.js";

export const createFolder = async (req, res) => {
  try {
    const { name, color } = req.body;
    const userId = req.user._id;

    const folder = await FavoriteFolder.create({
      name,
      color,
      user: userId
    });

    res.status(201).json({ success: true, data: folder });
  } catch (error) {
    logger.error("Create Folder Error:", error);
    res.status(500).json({ success: false, message: error.code === 11000 ? "Folder already exists" : "Failed to create folder" });
  }
};

export const getFolders = async (req, res) => {
  try {
    const userId = req.user._id;
    const folders = await FavoriteFolder.find({ user: userId });
    res.status(200).json({ success: true, data: folders });
  } catch (error) {
    logger.error("Get Folders Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch folders" });
  }
};

export const addItemToFolder = async (req, res) => {
  try {
    const { folderId, itemId, itemType } = req.body;
    const userId = req.user._id;

    const folder = await FavoriteFolder.findOne({ _id: folderId, user: userId });
    if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

    // Check if already in folder
    const exists = folder.items.some(item => item.itemId.toString() === itemId);
    if (exists) return res.status(400).json({ success: false, message: "Item already in folder" });

    // Map frontend types to backend Enum types
    const normalizedType = (itemType || "").toLowerCase();
    let mappedType = "Post"; // default
    if (normalizedType === 'codex') mappedType = 'Codex';
    else if (normalizedType === 'artifact') mappedType = 'Artifact';
    else if (normalizedType === 'job') mappedType = 'Job';
    else if (normalizedType === 'challenge') mappedType = 'Challenge';
    else mappedType = 'Post';

    folder.items.push({ itemId, itemType: mappedType });
    await folder.save();

    res.status(200).json({ success: true, message: "Item added to folder" });
  } catch (error) {
    logger.error("Add Item to Folder Error:", error);
    res.status(500).json({ success: false, message: "Failed to add item to folder" });
  }
};

export const removeItemFromFolder = async (req, res) => {
  try {
    const { folderId, itemId } = req.body;
    const userId = req.user._id;

    const folder = await FavoriteFolder.findOne({ _id: folderId, user: userId });
    if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

    folder.items = folder.items.filter(item => item.itemId.toString() !== itemId);
    await folder.save();

    res.status(200).json({ success: true, message: "Item removed from folder" });
  } catch (error) {
    logger.error("Remove Item from Folder Error:", error);
    res.status(500).json({ success: false, message: "Failed to remove item from folder" });
  }
};

export const deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    await FavoriteFolder.findOneAndDelete({ _id: id, user: userId });
    res.status(200).json({ success: true, message: "Folder deleted" });
  } catch (error) {
    logger.error("Delete Folder Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete folder" });
  }
};

export const renameFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user._id;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Name is required" });

    const folder = await FavoriteFolder.findOneAndUpdate(
      { _id: id, user: userId },
      { name: name.trim() },
      { new: true }
    );
    if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

    res.status(200).json({ success: true, data: folder });
  } catch (error) {
    logger.error("Rename Folder Error:", error);
    res.status(500).json({ success: false, message: "Failed to rename folder" });
  }
};
