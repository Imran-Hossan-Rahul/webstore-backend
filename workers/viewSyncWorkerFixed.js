// backend/workers/viewSyncWorkerFixed.js
import mongoose from "mongoose";
import cron from "node-cron";
import redis from "../config/redis.js";
import ButtonTemplate from "../models/Template.model.js";
import Blog from "../models/blog.model.js";
import Post from "../models/Post.model.js";

// -----------------------------
// MongoDB Connection
// -----------------------------



// -----------------------------
// Cron Job
// -----------------------------
const SYNC_INTERVAL = process.env.VIEWSYNC_CRON || "*/2 * * * *"; // every 2 min

cron.schedule(SYNC_INTERVAL, async () => {
  console.log("🔄 ViewSyncWorker cron started...");
  try {
    const keys = await redis.keys("views:*");
    if (keys.length === 0) {
      console.log("ℹ️ No view counts to sync");
      return;
    }

    let syncedTemplates = 0;
    let syncedBlogs = 0;

    for (const key of keys) {
      try {
        const parts = key.split(":");
        const type = parts[1]; // "count" or "blog"
        const id = parts[2];

        if (type === "count") {
          // Template view sync
          const viewDataStr = await redis.get(key);
          if (!viewDataStr) continue;

          const viewData = JSON.parse(viewDataStr);
          const count = viewData.count || 0;
          if (count === 0) continue;

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today.getTime() + 24*60*60*1000);

          const template = await ButtonTemplate.findById(id);
          if (!template) {
            console.log(`⚠️ Template not found: ${id}`);
            await redis.del(key);
            continue;
          }

          // Convert ISO timestamp strings to Date objects
          const viewers = (viewData.viewers || []).map(v => ({
            ...v,
            timestamp: new Date(v.timestamp)
          }));

          const existingEntry = template.viewHistory?.find(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === today.getTime();
          });

          if (existingEntry) {
            await ButtonTemplate.updateOne(
              { _id: id, 'viewHistory.date': { $gte: today, $lt: tomorrow } },
              { 
                $inc: { viewsCount: count, 'viewHistory.$.count': count },
                $push: { 'viewHistory.$.viewers': { $each: viewers } }
              }
            );
          } else {
            await ButtonTemplate.updateOne(
              { _id: id },
              { 
                $inc: { viewsCount: count },
                $push: { viewHistory: { date: today, count, viewers } }
              }
            );
          }

          await redis.del(key);
          syncedTemplates++;
          console.log(`✅ Template synced: ${id} += ${count} views`);
        } else if (type === "blog") {
          // Blog view sync
          const viewDataStr = await redis.get(key);
          if (!viewDataStr) continue;

          const viewData = JSON.parse(viewDataStr);
          const count = viewData.count || 0;
          if (count === 0) continue;

          const blog = await Blog.findById(id);
          if (!blog) {
            console.log(`⚠️ Blog not found: ${id}`);
            await redis.del(key);
            continue;
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today.getTime() + 24*60*60*1000);

          const existingEntry = blog.viewHistory?.find(entry => {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() === today.getTime();
          });

          if (existingEntry) {
            await Blog.updateOne(
              { _id: id, 'viewHistory.date': { $gte: today, $lt: tomorrow } },
              { 
                $inc: { views: count, 'viewHistory.$.count': count },
                $push: { 'viewHistory.$.viewers': { $each: viewData.viewers || [] } }
              }
            );
          } else {
            await Blog.updateOne(
              { _id: id },
              { 
                $inc: { views: count },
                $push: { viewHistory: { date: today, count, viewers: viewData.viewers || [] } }
              }
            );
          }

          await redis.del(key);
          syncedBlogs++;
          console.log(`✅ Blog synced: ${id} += ${count} views`);
        } else if (type === "post") {
          // Post view sync
          const viewDataStr = await redis.get(key);
          if (!viewDataStr) continue;

          const viewData = JSON.parse(viewDataStr);
          const count = viewData.count || 0;
          if (count === 0) continue;

          // Check if Post is imported? Needs model.
          const Post = mongoose.model("Post"); // Assuming registered
          // Actually better to import it at top.
          
          const post = await Post.findById(id);
          if (!post) {
             console.log(`⚠️ Post not found: ${id}`);
             await redis.del(key);
             continue;
          }
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today.getTime() + 24*60*60*1000);

          const existingEntry = post.viewHistory?.find(entry => {
             const entryDate = new Date(entry.date);
             entryDate.setHours(0, 0, 0, 0);
             return entryDate.getTime() === today.getTime();
          });

          if (existingEntry) {
              await Post.updateOne(
                  { _id: id, 'viewHistory.date': { $gte: today, $lt: tomorrow } },
                  {
                      $inc: { views: count, 'viewHistory.$.count': count },
                      $push: { 'viewHistory.$.viewers': { $each: viewData.viewers || [] } }
                  }
              );
          } else {
               await Post.updateOne(
                  { _id: id },
                  {
                      $inc: { views: count },
                      $push: { viewHistory: { date: today, count, viewers: viewData.viewers || [] } }
                  }
               );
          }
          
          await redis.del(key);
          console.log(`✅ Post synced: ${id} += ${count} views`);
        }
      } catch (err) {
        console.error(`❌ Failed to sync ${key}:`, err.message);
      }
    }

    console.log(`✅ ViewSyncWorker finished: ${syncedTemplates} templates, ${syncedBlogs} blogs synced`);
  } catch (err) {
    console.error("❌ ViewSyncWorker cron error:", err);
  }
});

console.log("🚀 ViewSyncWorker Started - Syncing every 2 minutes");
console.log(`📊 Sync Interval: ${SYNC_INTERVAL}`);
