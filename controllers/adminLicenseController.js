import MarketLicense from '../models/MarketLicense.model.js';
import LicenseActivation from '../models/LicenseActivation.model.js';
import AbuseFlag from '../models/AbuseFlag.model.js';
import BuildFingerprint from '../models/BuildFingerprint.model.js';
import MarketOrder from '../models/MarketOrder.model.js';
import MarketProduct from '../models/MarketProduct.model.js';
import User from '../models/User.model.js';

// Get all licenses with pagination and filtering
export const getAllLicenses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // 'active', 'suspended', 'revoked'

    const query = status ? { status } : {};

    const licenses = await MarketLicense.find(query)
      .populate('order_id')
      .populate('customer_id', 'name email')
      .populate('product_id', 'title')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await MarketLicense.countDocuments(query);

    res.status(200).json({ licenses, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update license status (suspend, revoke)
export const updateLicenseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended', 'revoked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const license = await MarketLicense.findByIdAndUpdate(id, { status }, { new: true });
    
    // If revoked/suspended, immediately deactivate all domain bindings
    if (status !== 'active') {
      await LicenseActivation.updateMany({ license_id: id }, { status: 'deactivated' });
    }

    res.status(200).json(license);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Identify Leak Tool
export const identifyLeak = async (req, res) => {
  try {
    const { code_snippet } = req.body; // The pasted leaked code

    if (!code_snippet) {
      return res.status(400).json({ error: 'Code snippet is required' });
    }

    // Extract potential UUIDs or watermark seeds using Regex
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
    const hexRegex = /[0-9a-fA-F]{32}/g; // Assuming 16-byte hex seeds

    const uuids = code_snippet.match(uuidRegex) || [];
    const hexes = code_snippet.match(hexRegex) || [];
    const tokens = [...uuids, ...hexes];

    if (tokens.length === 0) {
      return res.status(404).json({ message: 'No identifiable canary tokens found in snippet' });
    }

    // Search BuildFingerprints for matches
    const matches = await BuildFingerprint.find({
      $or: [
        { canary_token: { $in: tokens } },
        { watermark_seed: { $in: tokens } }
      ]
    }).populate({
      path: 'license_id',
      populate: { path: 'customer_id', select: 'name email phone' }
    });

    if (matches.length === 0) {
      return res.status(404).json({ message: 'Tokens found, but they do not match any known builds in the database.' });
    }

    res.status(200).json({ matches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Abuse Flags
export const getAbuseFlags = async (req, res) => {
  try {
    const flags = await AbuseFlag.find({ status: 'open' })
      .populate({
        path: 'license_id',
        populate: { path: 'customer_id', select: 'name email' }
      })
      .sort({ severity: -1, createdAt: -1 });

    res.status(200).json(flags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
