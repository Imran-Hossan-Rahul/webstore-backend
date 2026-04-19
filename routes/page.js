import { Router } from "express";
import {
  listPages,
  createPage,
  getFile,
  updateFile,
} from "../controllers/pageController.js";

const router = Router();

router.get("/:userId", listPages);
router.post("/:userId", createPage);

router.get("/:userId/file", getFile);
router.put("/:userId/file", updateFile);

export default router;
