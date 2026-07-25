import MarketCategory from '../models/MarketCategory.model.js';
import path from 'path';

// @desc    Get all categories with their subcategories
// @route   GET /api/market/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const categories = await MarketCategory.find({ isSubcategory: false, isActive: true }).lean();
    const subcategories = await MarketCategory.find({ isSubcategory: true, isActive: true }).lean();

    // Map subcategories to their parents
    const categoryTree = categories.map(cat => {
      cat.subcategories = subcategories.filter(sub => String(sub.parentCategory) === String(cat._id));
      return cat;
    });

    res.json({ success: true, data: categoryTree });
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
