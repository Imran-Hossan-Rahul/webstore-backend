import mongoose from 'mongoose';
import MarketCategory from './models/MarketCategory.model.js';
import dotenv from 'dotenv';
dotenv.config();

const weightMap = {
  "Wired Earphones / IEMs": 150,
  "Earphone": 150,
  "TWS – True Wireless Earbuds": 300,
  "Bluetooth / Portable Speakers": 1500,
  "Neckband": 350,
  "Data Cables": 100,
  "Adapter with Data Cable": 300,
  "Chargers & Cables": 300,
  "Smart Watches": 400,
  "Apple Watch": 400,
  "Samsung Galaxy Watch": 400,
  "Fitness Bands": 400,
  "Other Smart Watches": 400,
  "Power Banks": 700
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB.");

  let updatedCount = 0;
  for (const [name, weight] of Object.entries(weightMap)) {
    const res = await MarketCategory.updateMany(
      { name: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }, 
      { $set: { maxWeightPerPiece: weight } }
    );
    if (res.modifiedCount > 0) {
      console.log(`Updated ${name} to ${weight}g (${res.modifiedCount} matches)`);
      updatedCount += res.modifiedCount;
    } else {
      console.log(`No match or already updated for: ${name}`);
    }
  }

  console.log(`Total categories updated: ${updatedCount}`);
  process.exit(0);
}
run();
