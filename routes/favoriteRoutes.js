import express from "express";
import {
  toggleFavorite,
  getFavorites,
  clearFavorites,
  getPublicUserFavorites,
  toggleFolderVisibility
} from "../controllers/favoriteController.js";
import {
  createFolder,
  getFolders,
  deleteFolder,
  addItemToFolder,
  removeItemFromFolder,
  renameFolder
} from "../controllers/favoriteFolderController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// General favorites
router.post("/toggle", protect, toggleFavorite);
router.get("/", protect, getFavorites);
router.delete("/clear", protect, clearFavorites);

// Public User Favorites
router.get("/user/:username/public", getPublicUserFavorites);

// Folders
router.post("/folders", protect, createFolder);
router.get("/folders", protect, getFolders);
router.delete("/folders/:id", protect, deleteFolder);
router.patch("/folders/:id/rename", protect, renameFolder);
router.patch("/folders/:id/visibility", protect, toggleFolderVisibility);
router.post("/folders/add-item", protect, addItemToFolder);
router.post("/folders/remove-item", protect, removeItemFromFolder);

export default router;
