import MarketWholesaler from '../models/MarketWholesaler.model.js';
import MarketProduct from '../models/MarketProduct.model.js';
import MarketProcurementRun from '../models/MarketProcurementRun.model.js';
import MarketWholesalerTransaction from '../models/MarketWholesalerTransaction.model.js';
import { clearCache } from '../utils/cache.js';
import cloudinary from '../services/cloudinary.js';
import fs from 'fs';

export const getWholesalers = async (req, res) => {
  try {
    const wholesalers = await MarketWholesaler.aggregate([
      {
        $lookup: {
          from: "marketproducts",
          localField: "_id",
          foreignField: "wholesaler_id",
          as: "products"
        }
      },
      {
        $lookup: {
          from: "marketprocurementruns",
          localField: "_id",
          foreignField: "wholesaler_id",
          as: "runs"
        }
      },
      {
        $addFields: {
          _count: {
            products: { $size: "$products" },
            runs: { $size: "$runs" }
          },
          id: "$_id"
        }
      },
      {
        $project: {
          products: 0,
          runs: 0
        }
      }
    ]);
    res.json(wholesalers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createWholesaler = async (req, res) => {
  try {
    const data = req.body;
    
    // Process files if they exist
    const uploadFiles = async (filesArray) => {
      if (!filesArray || filesArray.length === 0) return "[]";
      
      const urls = [];
      for (const file of filesArray) {
        const isImage = file.mimetype.startsWith('image/');
        const uploadOptions = {
          folder: "market/wholesalers",
          resource_type: isImage ? "image" : "video"
        };
        
        if (isImage) {
          uploadOptions.format = "webp";
        }
        
        try {
          const uploaded = await cloudinary.uploader.upload(file.path, uploadOptions);
          urls.push(uploaded.secure_url);
        } catch (err) {
          console.error("Cloudinary upload error:", err);
        }
        
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
      return JSON.stringify(urls);
    };

    if (req.files) {
      data.shopPhotos = await uploadFiles(req.files['shopPhotos']);
      data.idPhotos = await uploadFiles(req.files['idPhotos']);
    } else {
      data.shopPhotos = "[]";
      data.idPhotos = "[]";
    }

    // Determine verification status
    const hasNidOrTradeLicenseText = data.nidOrTradeLicense && data.nidOrTradeLicense.trim() !== "";
    const hasIdPhotos = data.idPhotos && data.idPhotos !== "[]";
    data.isVerified = hasNidOrTradeLicenseText || hasIdPhotos;

    const wholesaler = await MarketWholesaler.create(data);
    // Frontend expects id field
    const result = wholesaler.toObject();
    result.id = result._id;
    
    // Clear wholesaler cache
    clearCache('/market/wholesalers');
    
    res.status(201).json(result);
  } catch (error) {
    if (req.files) {
      if (req.files['shopPhotos']) req.files['shopPhotos'].forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      if (req.files['idPhotos']) req.files['idPhotos'].forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    }
    res.status(400).json({ error: error.message });
  }
};

export const getWholesalerById = async (req, res) => {
  try {
    const wholesaler = await MarketWholesaler.findById(req.params.id).lean();
    if (!wholesaler) return res.status(404).json({ error: 'Not found' });
    
    wholesaler.id = wholesaler._id;
    
    // Fetch related docs manually for .lean() performance
    wholesaler.products = await MarketProduct.find({ wholesaler_id: wholesaler._id }).lean();
    wholesaler.runs = await MarketProcurementRun.find({ wholesaler_id: wholesaler._id }).sort({ date: -1 }).lean();
    wholesaler.transactions = await MarketWholesalerTransaction.find({ wholesaler_id: wholesaler._id }).sort({ date: -1 }).lean();

    res.json(wholesaler);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
