import MarketProduct from '../models/MarketProduct.model.js';
import MarketCategory from '../models/MarketCategory.model.js';
import { clearCache } from '../utils/cache.js';
import cloudinary from '../services/cloudinary.js';
import fs from 'fs';

import logger from '../utils/logger.js';

export const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    
    let query = {};
    if (req.query.ids) {
        const idArray = req.query.ids.split(',');
        if (idArray.length > 100) return res.status(400).json({ error: 'Too many IDs requested' });
        query._id = { $in: idArray };
    } else {
        if (req.query.search) {
            query.$or = [
                { title: { $regex: req.query.search, $options: 'i' } },
                { sku: { $regex: req.query.search, $options: 'i' } },
                { tags: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        if (req.query.category_id) query.category_id = req.query.category_id;
        if (req.query.subCategory_id) query.subCategory_id = req.query.subCategory_id;
        if (req.query.childCategory_id) query.childCategory_id = req.query.childCategory_id;
        if (req.query.isFeatured) query.isFeatured = req.query.isFeatured === 'true';
        if (req.query.isPopular) query.isPopular = req.query.isPopular === 'true';
        if (req.query.isLatest) query.isLatest = req.query.isLatest === 'true';
        if (req.query.status) query.status = req.query.status;
        
        if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
            query.selling_price = {};
            if (req.query.minPrice !== undefined && req.query.minPrice !== '') query.selling_price.$gte = Number(req.query.minPrice);
            if (req.query.maxPrice !== undefined && req.query.maxPrice !== '') query.selling_price.$lte = Number(req.query.maxPrice);
            if (Object.keys(query.selling_price).length === 0) delete query.selling_price;
        }
    }

    // We use .lean() for maximum performance and .populate for joins
    const [products, total] = await Promise.all([
        MarketProduct.find(query)
          .populate('wholesaler_id')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        MarketProduct.countDocuments(query)
    ]);
    
    // Map _id to id for frontend compatibility, and stringify arrays for frontend JSON.parse expectations
    const mappedProducts = products.map(p => ({
      ...p,
      id: p._id,
      photos: Array.isArray(p.photos) ? JSON.stringify(p.photos) : p.photos,
      specifications: Array.isArray(p.specifications) ? JSON.stringify(p.specifications) : p.specifications,
      variantGroups: Array.isArray(p.variantGroups) ? JSON.stringify(p.variantGroups) : p.variantGroups,
      wholesaler: p.wholesaler_id ? { ...p.wholesaler_id, id: p.wholesaler_id._id } : null
    }));
    
    res.json({
        data: mappedProducts,
        pagination: {
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await MarketProduct.findById(req.params.id)
      .populate('wholesaler_id')
      .lean();
      
    if (!product) return res.status(404).json({ error: 'Not found' });
    
    product.id = product._id;
    product.photos = Array.isArray(product.photos) ? JSON.stringify(product.photos) : product.photos;
    product.specifications = Array.isArray(product.specifications) ? JSON.stringify(product.specifications) : product.specifications;
    product.variantGroups = Array.isArray(product.variantGroups) ? JSON.stringify(product.variantGroups) : product.variantGroups;
    if (product.wholesaler_id) {
      product.wholesaler = { ...product.wholesaler_id, id: product.wholesaler_id._id };
    }
    
    let isLiked = false;
    if (req.user && req.user._id && product.likedBy) {
      const favoriteSet = new Set(product.likedBy.map(id => id.toString()));
      isLiked = favoriteSet.has(req.user._id.toString());
    }
    
    // Calculate weight based on category
    let weightInGrams = 0;
    try {
      let category = null;
      if (product.childCategory_id) category = await MarketCategory.findById(product.childCategory_id).lean();
      if (!category && product.subCategory_id) category = await MarketCategory.findById(product.subCategory_id).lean();
      if (!category && product.category_id) category = await MarketCategory.findById(product.category_id).lean();

      if (category && category.maxWeightPerPiece) {
        weightInGrams = category.maxWeightPerPiece;
      }
    } catch (err) {
      console.error("Error fetching category for weight:", err);
    }
    
    res.json({ ...product, isLiked, weightInGrams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const data = req.body;
    
    // Check if we have files to upload
    if (req.files && req.files.length > 0) {
      const uploadedUrls = [];
      
      for (const file of req.files) {
        // Determine options based on file type
        const isImage = file.mimetype.startsWith('image/');
        const uploadOptions = {
          folder: "market/products",
          resource_type: isImage ? "image" : "video"
        };
        
        // Optimize images automatically to webp
        if (isImage) {
          uploadOptions.format = "webp";
        }
        
        try {
          const uploaded = await cloudinary.uploader.upload(file.path, uploadOptions);
          uploadedUrls.push(uploaded.secure_url);
        } catch (uploadErr) {
          console.error("Cloudinary upload error:", uploadErr);
          // We continue to next file even if one fails
        }
        
        // Clean up temp file asynchronously
        fs.promises.unlink(file.path).catch(err => {
          if (err.code !== 'ENOENT') console.error("Temp file cleanup error:", err);
        });
      }
      
      const existingPhotos = data.photos ? (typeof data.photos === 'string' ? JSON.parse(data.photos) : data.photos) : [];
      data.photos = [...existingPhotos, ...uploadedUrls];
    } else if (!data.photos) {
      data.photos = [];
    } else if (typeof data.photos === 'string') {
      data.photos = JSON.parse(data.photos);
    }
    
    if (typeof data.specifications === 'string') data.specifications = JSON.parse(data.specifications);
    if (typeof data.variantGroups === 'string') data.variantGroups = JSON.parse(data.variantGroups);

    const product = await MarketProduct.create(data);
    const result = product.toObject();
    result.id = result._id;
    
    // Clear product cache so the new product shows up instantly
    clearCache('/market/products');
    
    res.status(201).json(result);
  } catch (error) {
    // If error happens before cleanup, try to cleanup files
    if (req.files) {
      req.files.forEach(file => {
        fs.promises.unlink(file.path).catch(err => { if (err.code !== 'ENOENT') console.error(err); });
      });
    }
    res.status(400).json({ error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const data = req.body;
    
    // Check if we have files to upload
    if (req.files && req.files.length > 0) {
      const uploadedUrls = [];
      
      for (const file of req.files) {
        const isImage = file.mimetype.startsWith('image/');
        const uploadOptions = {
          folder: "market/products",
          resource_type: isImage ? "image" : "video"
        };
        if (isImage) uploadOptions.format = "webp";
        
        try {
          const uploaded = await cloudinary.uploader.upload(file.path, uploadOptions);
          uploadedUrls.push(uploaded.secure_url);
        } catch (uploadErr) {
          console.error("Cloudinary upload error:", uploadErr);
        }
        
        fs.promises.unlink(file.path).catch(err => { if (err.code !== 'ENOENT') console.error(err); });
      }
      
      const existingPhotos = data.photos ? (typeof data.photos === 'string' ? JSON.parse(data.photos) : data.photos) : [];
      data.photos = [...existingPhotos, ...uploadedUrls];
    } else if (typeof data.photos === 'string') {
      data.photos = JSON.parse(data.photos);
    }
    
    if (typeof data.specifications === 'string') data.specifications = JSON.parse(data.specifications);
    if (typeof data.variantGroups === 'string') data.variantGroups = JSON.parse(data.variantGroups);

    const product = await MarketProduct.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!product) return res.status(404).json({ error: 'Not found' });

    const result = product.toObject();
    result.id = result._id;
    
    clearCache('/market/products');
    
    res.json(result);
  } catch (error) {
    if (req.files) {
      req.files.forEach(file => {
        fs.promises.unlink(file.path).catch(err => { if (err.code !== 'ENOENT') console.error(err); });
      });
    }
    res.status(400).json({ error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await MarketProduct.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    
    clearCache('/market/products');
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const likeProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const product = await MarketProduct.findById(id).select('_id likes').lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const isLiked = await MarketProduct.exists({ _id: id, likedBy: userId });
    const action = isLiked ? "unlike" : "like";

    const newLikes = isLiked ? Math.max(0, (product.likes || 0) - 1) : (product.likes || 0) + 1;
    
    if (action === "like") {
      await MarketProduct.findByIdAndUpdate(id, { $inc: { likes: 1 }, $addToSet: { likedBy: userId } });
    } else {
      await MarketProduct.findByIdAndUpdate(id, { $inc: { likes: -1 }, $pull: { likedBy: userId } });
    }

    res.status(200).json({
      success: true,
      likes: newLikes,
      isLiked: !isLiked
    });

  } catch (error) {
    logger.error("Like Product Error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle like" });
  }
};
