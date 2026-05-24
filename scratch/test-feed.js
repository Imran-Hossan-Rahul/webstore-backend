import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import RecommendationService from "../services/RecommendationService.js";

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/Codalina")
  .then(async () => {
    console.log("Connected to MongoDB");
    try {
      const feed = await RecommendationService.getFeed("69eca62e6cc47b43588142c5");
      console.log("Feed fetched successfully, count:", feed.data.length);
    } catch (err) {
      console.error("Failed to fetch feed:", err);
    } finally {
      mongoose.disconnect();
    }
  })
  .catch(console.error);
