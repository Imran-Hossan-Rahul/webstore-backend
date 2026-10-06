import mongoose from 'mongoose';
import MarketCategory from './models/MarketCategory.model.js';
import dotenv from 'dotenv';
dotenv.config();

// The 5 service categories shown on the homepage
const SERVICE_CATEGORIES = [
  { name: 'Custom Web Platforms', isActive: true },
  { name: 'SaaS & Web Applications', isActive: true },
  { name: 'Enterprise E-Commerce', isActive: true },
  { name: 'Internal Tools & APIs', isActive: true },
  { name: 'Proactive Maintenance', isActive: true },
];

async function addServiceCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to DB');

    let added = 0;
    let skipped = 0;

    for (const cat of SERVICE_CATEGORIES) {
      const existing = await MarketCategory.findOne({ name: cat.name });
      if (existing) {
        console.log(`⏭️  Skipped (already exists): ${cat.name}`);
        skipped++;
      } else {
        await MarketCategory.create(cat);
        console.log(`✅ Added: ${cat.name}`);
        added++;
      }
    }

    console.log(`\n🎉 Done! Added: ${added}, Skipped: ${skipped}`);

    // Show all current categories
    const all = await MarketCategory.find({ isActive: true }).select('name');
    console.log('\n📋 All active categories:');
    all.forEach(c => console.log(`  - ${c.name}`));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

addServiceCategories();
