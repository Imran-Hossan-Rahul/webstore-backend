import MarketProduct from '../models/MarketProduct.model.js';
import { clearCache } from '../utils/cache.js';
import cloudinary from '../services/cloudinary.js';
import fs from 'fs';
import { postLikeQueue } from '../queues/postLikeQueue.js';
import logger from '../utils/logger.js';

export const getProducts = async (req, res) => {
  try {
    // We use .lean() for maximum performance and .populate for joins
    const products = await MarketProduct.find()
      .populate('wholesaler_id')
      .lean();
    
    // Map _id to id for frontend compatibility
    const mappedProducts = products.map(p => ({
      ...p,
      id: p._id,
      wholesaler: p.wholesaler_id ? { ...p.wholesaler_id, id: p.wholesaler_id._id } : null
    }));
    
    res.json(mappedProducts);
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
    if (product.wholesaler_id) {
      product.wholesaler = { ...product.wholesaler_id, id: product.wholesaler_id._id };
    }
    
    let isLiked = false;
    if (req.user && req.user._id && product.likedBy) {
      const favoriteSet = new Set(product.likedBy.map(id => id.toString()));
      isLiked = favoriteSet.has(req.user._id.toString());
    }
    
    res.json({ ...product, isLiked });
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
        
        // Clean up temp file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
      
      // If we already had photos in the payload (maybe from previous flow), merge them or just use the newly uploaded ones.
      // Usually, it's just the new uploads.
      const existingPhotos = data.photos ? JSON.parse(data.photos) : [];
      const combinedPhotos = [...existingPhotos, ...uploadedUrls];
      
      data.photos = JSON.stringify(combinedPhotos);
    } else if (!data.photos) {
      // Ensure photos is at least an empty array string
      data.photos = "[]";
    }

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
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
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
        
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      
      const existingPhotos = data.photos ? JSON.parse(data.photos) : [];
      const combinedPhotos = [...existingPhotos, ...uploadedUrls];
      
      data.photos = JSON.stringify(combinedPhotos);
    }
    
    // DO NOT parse specifications back to array! The model expects a String (JSON stringified).

    const product = await MarketProduct.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!product) return res.status(404).json({ error: 'Not found' });

    const result = product.toObject();
    result.id = result._id;
    
    clearCache('/market/products');
    
    res.json(result);
  } catch (error) {
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
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
    
    await postLikeQueue.add("post-like", {
        postId: id,
        userId: userId,
        action: action,
        itemType: "product"
    }, {
        removeOnComplete: true,
        attempts: 3
    });

    res.status(200).json({
      success: true,
      likes: newLikes,
      isLiked: !isLiked,
      queued: true
    });

  } catch (error) {
    logger.error("Like Product Error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle like" });
  }
};
