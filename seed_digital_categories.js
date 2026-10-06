import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MarketCategory from './models/MarketCategory.model.js';
import MarketProduct from './models/MarketProduct.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codalina';

async function seedCategories() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    // 1. Clear old categories
    await MarketCategory.deleteMany({});
    console.log('Cleared old categories.');

    // 2. Create new digital categories
    const categoriesToCreate = [
      { name: 'SaaS Tool', slug: 'saas-tool', description: 'Production-ready SaaS boilerplates and tools', active: true },
      { name: 'Web Template', slug: 'web-template', description: 'Frontend templates and themes', active: true },
      { name: 'Script/Automation', slug: 'script-automation', description: 'Python, Node.js scripts and automations', active: true },
      { name: 'Source Code', slug: 'source-code', description: 'Full application source codes', active: true },
      { name: 'UI Kit/Plugin', slug: 'ui-kit-plugin', description: 'Design assets, UI kits, and plugins', active: true }
    ];

    const createdCategories = await MarketCategory.insertMany(categoriesToCreate);
    console.log('Created digital categories.');

    // 3. Map product types to category IDs
    const categoryMap = {};
    for (const cat of createdCategories) {
      categoryMap[cat.name] = cat._id.toString();
    }

    // 4. Update the products we seeded earlier to link to these categories
    const products = await MarketProduct.find({});
    for (const prod of products) {
      if (prod.productType && categoryMap[prod.productType]) {
        prod.category_id = categoryMap[prod.productType];
        await prod.save();
        console.log(`Updated product ${prod.title} with category ${prod.productType}`);
      }
    }

    console.log('Category seeding complete.');
  } catch (error) {
    console.error('Error seeding categories:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedCategories();
