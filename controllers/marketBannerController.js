import MarketBanner from '../models/MarketBanner.model.js';
import path from 'path';

// @desc    Get all active market banners
// @route   GET /api/market/banners
// @access  Public
export const getBanners = async (req, res) => {
  try {
    const banners = await MarketBanner.find({ isActive: true }).sort({ order: 1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all market banners (admin)
// @route   GET /api/market/banners/all
// @access  Private/Admin
export const getAllBanners = async (req, res) => {
  try {
    const banners = await MarketBanner.find().sort({ order: 1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a market banner
// @route   POST /api/market/banners
// @access  Private/Admin
export const createBanner = async (req, res) => {
  try {
    const { titleTop, titleBottom, link, order, isActive } = req.body;
    let image = '';

    if (req.file) {
      image = `/uploads/market/${req.file.filename}`;
    }

    if (!image) {
      return res.status(400).json({ message: 'Image is required for a banner' });
    }

    const banner = new MarketBanner({
      titleTop,
      titleBottom,
      image,
      link,
      order: order ? Number(order) : 0,
      isActive: isActive === 'true' || isActive === true
    });

    const createdBanner = await banner.save();
    res.status(201).json(createdBanner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a market banner
// @route   PUT /api/market/banners/:id
// @access  Private/Admin
export const updateBanner = async (req, res) => {
  try {
    const { titleTop, titleBottom, link, order, isActive } = req.body;
    
    const banner = await MarketBanner.findById(req.params.id);

    if (banner) {
      banner.titleTop = titleTop || banner.titleTop;
      banner.titleBottom = titleBottom || banner.titleBottom;
      banner.link = link !== undefined ? link : banner.link;
      
      if (order !== undefined) banner.order = Number(order);
      if (isActive !== undefined) banner.isActive = isActive === 'true' || isActive === true;

      if (req.file) {
        banner.image = `/uploads/market/${req.file.filename}`;
      }

      const updatedBanner = await banner.save();
      res.json(updatedBanner);
    } else {
      res.status(404).json({ message: 'Banner not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a market banner
// @route   DELETE /api/market/banners/:id
// @access  Private/Admin
export const deleteBanner = async (req, res) => {
  try {
    const banner = await MarketBanner.findById(req.params.id);

    if (banner) {
      await banner.deleteOne();
      res.json({ message: 'Banner removed' });
    } else {
      res.status(404).json({ message: 'Banner not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
