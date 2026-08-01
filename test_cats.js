import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Codalina/codalina-backend/.env' });

import MarketCategory from './models/MarketCategory.model.js';
import MarketProduct from './models/MarketProduct.model.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const activeProducts = await MarketProduct.find({ 
    status: { $in: ['Live', 'Threshold reached'] } 
  }).select('title status category_id subCategory_id childCategory_id').lean();

  console.log(`Found ${activeProducts.length} active products`);

  const populatedCategoryIds = new Set();
  activeProducts.forEach(product => {
    if (product.category_id) populatedCategoryIds.add(product.category_id.toString());
    if (product.subCategory_id) populatedCategoryIds.add(product.subCategory_id.toString());
    if (product.childCategory_id) populatedCategoryIds.add(product.childCategory_id.toString());
  });

  const allCategories = await MarketCategory.find({ isActive: true }).lean();
  
  const categoryMap = {};
  allCategories.forEach(cat => {
    cat._idStr = cat._id.toString();
    cat.subcategories = [];
    categoryMap[cat._idStr] = cat;
  });

  const categoryTree = [];
  allCategories.forEach(cat => {
    if (cat.parentCategory) {
      const parentIdStr = cat.parentCategory.toString();
      if (categoryMap[parentIdStr]) {
        categoryMap[parentIdStr].subcategories.push(cat);
      }
    } else {
      categoryTree.push(cat);
    }
  });

  const filterTree = (nodes) => {
    return nodes.filter(node => {
      node.subcategories = filterTree(node.subcategories);
      const hasProducts = populatedCategoryIds.has(node._idStr);
      const hasValidChildren = node.subcategories.length > 0;
      
      if (node.name.includes('Gaming Headsets')) {
        console.log(`\nChecking node: ${node.name}`);
        console.log(`- hasProducts: ${hasProducts}`);
        console.log(`- hasValidChildren: ${hasValidChildren}`);
        if (hasProducts) {
          const productsForThis = activeProducts.filter(p => 
            p.category_id === node._idStr || 
            p.subCategory_id === node._idStr || 
            p.childCategory_id === node._idStr
          );
          console.log(`- Products tied to this category:`, productsForThis.map(p => p.title));
        }
      }

      return hasProducts || hasValidChildren;
    });
  };

  const filteredTree = filterTree(categoryTree);
  console.log('Done filtering');
  process.exit(0);
}

run().catch(console.error);
