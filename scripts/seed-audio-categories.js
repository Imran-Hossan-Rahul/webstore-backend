import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MarketCategory from '../models/MarketCategory.model.js';
import { connectToDatabase } from '../config/db.js';

dotenv.config();

const seedCategories = async () => {
  try {
    await connectToDatabase();
    
    console.log("Connected to DB, seeding categories...");

    // Create Parent Category: Audio
    const audioParent = await MarketCategory.create({
      name: 'Audio',
      isSubcategory: false,
      isActive: true
    });
    console.log(`Created parent: ${audioParent.name}`);

    // Create Subcategory: Headphones
    const headphones = await MarketCategory.create({
      name: 'Headphones',
      isSubcategory: true,
      parentCategory: audioParent._id,
      isActive: true
    });
    console.log(`Created subcategory: ${headphones.name}`);

    // Create Children for Headphones
    const headphoneChildren = ['Over-Ear Headphones', 'On-Ear Headphones', 'Gaming Headsets'];
    for (const child of headphoneChildren) {
      await MarketCategory.create({
        name: child,
        isSubcategory: true,
        parentCategory: headphones._id,
        isActive: true
      });
      console.log(`  Created child: ${child}`);
    }

    // Create Subcategory: Earphones & Earbuds
    const earphones = await MarketCategory.create({
      name: 'Earphones & Earbuds',
      isSubcategory: true,
      parentCategory: audioParent._id,
      isActive: true
    });
    console.log(`Created subcategory: ${earphones.name}`);

    // Create Children for Earphones & Earbuds
    const earphoneChildren = ['Wired Earphones / IEMs', 'TWS – True Wireless Earbuds', 'Neckband', 'Open-Ear — Bone/Air Conduction'];
    for (const child of earphoneChildren) {
      await MarketCategory.create({
        name: child,
        isSubcategory: true,
        parentCategory: earphones._id,
        isActive: true
      });
      console.log(`  Created child: ${child}`);
    }

    // Create Subcategory: Speakers & Soundboxes
    const speakers = await MarketCategory.create({
      name: 'Speakers & Soundboxes',
      isSubcategory: true,
      parentCategory: audioParent._id,
      isActive: true
    });
    console.log(`Created subcategory: ${speakers.name}`);

    // Create Children for Speakers & Soundboxes
    const speakerChildren = ['Bluetooth / Portable Speakers', 'Smart Speakers', 'Soundbars', 'Home Theater Systems'];
    for (const child of speakerChildren) {
      await MarketCategory.create({
        name: child,
        isSubcategory: true,
        parentCategory: speakers._id,
        isActive: true
      });
      console.log(`  Created child: ${child}`);
    }

    // Create Subcategory: Audio Accessories
    const accessories = await MarketCategory.create({
      name: 'Audio Accessories',
      isSubcategory: true,
      parentCategory: audioParent._id,
      isActive: true
    });
    console.log(`Created subcategory: ${accessories.name}`);

    // Create Children for Audio Accessories
    const accessoryChildren = ['Ear Tips & Cushions', 'Cables & Adapters', 'Cases & Pouches', 'DAC / Amplifiers'];
    for (const child of accessoryChildren) {
      await MarketCategory.create({
        name: child,
        isSubcategory: true,
        parentCategory: accessories._id,
        isActive: true
      });
      console.log(`  Created child: ${child}`);
    }

    console.log("Successfully seeded audio categories!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding categories:", error);
    process.exit(1);
  }
};

seedCategories();
