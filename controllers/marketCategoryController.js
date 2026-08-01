import MarketCategory from '../models/MarketCategory.model.js';
import MarketProduct from '../models/MarketProduct.model.js';
import path from 'path';

// @desc    Get all categories with their subcategories
// @route   GET /api/market/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    // 1. Fetch active products to determine which categories are in use
    const activeProducts = await MarketProduct.find({ 
      status: { $in: ['Live', 'Threshold reached'] } 
    }).select('category_id subCategory_id childCategory_id').lean();

    const populatedCategoryIds = new Set();
    activeProducts.forEach(product => {
      if (product.category_id) populatedCategoryIds.add(product.category_id.toString());
      if (product.subCategory_id) populatedCategoryIds.add(product.subCategory_id.toString());
      if (product.childCategory_id) populatedCategoryIds.add(product.childCategory_id.toString());
    });

    // 2. Fetch all active categories
    const allCategories = await MarketCategory.find({ isActive: true }).lean();
    
    // Convert ObjectIds to strings for easy comparison
    const categoryMap = {};
    allCategories.forEach(cat => {
      cat._idStr = cat._id.toString();
      cat.subcategories = [];
      categoryMap[cat._idStr] = cat;
    });

    // 3. Build the initial tree
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

    // 4. Bottom-up recursive filter
    const filterTree = (nodes) => {
      return nodes.filter(node => {
        // First filter all children
        node.subcategories = filterTree(node.subcategories);
        
        // Keep this node if it directly has products OR if any valid children remain
        const hasProducts = populatedCategoryIds.has(node._idStr);
        const hasValidChildren = node.subcategories.length > 0;
        
        return hasProducts || hasValidChildren;
      });
    };

    const filteredTree = filterTree(categoryTree);

    res.json({ success: true, data: filteredTree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all flat categories (Admin)
// @route   GET /api/market/categories/all
// @access  Private/Admin
export const getAllCategories = async (req, res) => {
  try {
    const categories = await MarketCategory.find({}).sort({ isSubcategory: 1, createdAt: -1 }).populate('parentCategory', 'name');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a category or subcategory
// @route   POST /api/market/categories
// @access  Private/Admin
export const createCategory = async (req, res) => {
  try {
    const { name, isSubcategory, parentCategory, isActive } = req.body;
    let image = '';

    if (req.file) {
      image = `${process.env.BACKEND_URL}/uploads/market/${path.basename(req.file.path)}`;
    }

    const category = new MarketCategory({
      name,
      image,
      isSubcategory: isSubcategory === 'true' || isSubcategory === true,
      parentCategory: parentCategory || null,
      isActive: isActive === 'true' || isActive === true,
    });

    const createdCategory = await category.save();
    res.status(201).json(createdCategory);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update a category
// @route   PUT /api/market/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res) => {
  try {
    const { name, isSubcategory, parentCategory, isActive } = req.body;
    const category = await MarketCategory.findById(req.params.id);

    if (category) {
      category.name = name !== undefined ? name : category.name;
      category.isSubcategory = isSubcategory !== undefined ? (isSubcategory === 'true' || isSubcategory === true) : category.isSubcategory;
      category.parentCategory = parentCategory !== undefined ? (parentCategory || null) : category.parentCategory;
      category.isActive = isActive !== undefined ? (isActive === 'true' || isActive === true) : category.isActive;

      if (req.file) {
        category.image = `${process.env.BACKEND_URL}/uploads/market/${path.basename(req.file.path)}`;
      }

      const updatedCategory = await category.save();
      res.json(updatedCategory);
    } else {
      res.status(404).json({ success: false, message: 'Category not found' });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a category
// @route   DELETE /api/market/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res) => {
  try {
    const category = await MarketCategory.findById(req.params.id);
    if (category) {
      // If it's a parent category, delete its subcategories too
      if (!category.isSubcategory) {
        await MarketCategory.deleteMany({ parentCategory: category._id });
      }
      await category.deleteOne();
      res.json({ success: true, message: 'Category removed' });
    } else {
      res.status(404).json({ success: false, message: 'Category not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
