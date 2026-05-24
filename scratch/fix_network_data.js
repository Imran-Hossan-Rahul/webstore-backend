import mongoose from 'mongoose';
import { MONGODB_CONNECTION_STRING } from '../config/index.js';
import NetworkPerformance from '../models/NetworkPerformance.model.js';

async function fixData() {
  try {
    await mongoose.connect(MONGODB_CONNECTION_STRING);
    console.log('Connected to MongoDB');

    // Find all documents where quality is a number
    // In MongoDB, { quality: { $type: "number" } } finds them
    const result = await NetworkPerformance.updateMany(
      { quality: { $type: "number" } },
      [
        {
          $set: {
            quality: {
              score: "$quality",
              rating: {
                $cond: [
                  { $gte: ["$quality", 80] }, "excellent",
                  { $cond: [
                    { $gte: ["$quality", 60] }, "good",
                    { $cond: [
                      { $gte: ["$quality", 40] }, "fair",
                      { $cond: [
                        { $gte: ["$quality", 20] }, "poor", "critical"
                      ]}
                    ]}
                  ]}
                ]
              }
            }
          }
        }
      ]
    );

    console.log(`Fixed ${result.modifiedCount} documents`);
    process.exit(0);
  } catch (error) {
    console.error('Error fixing data:', error);
    process.exit(1);
  }
}

fixData();
