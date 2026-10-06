import MarketLicense from '../models/MarketLicense.model.js';
import LicenseActivation from '../models/LicenseActivation.model.js';
import AbuseFlag from '../models/AbuseFlag.model.js';
import { hashLicenseKey, signPayload } from '../utils/crypto.js';
import crypto from 'crypto';

/**
 * Checks for replay attacks using a nonce and timestamp (5 minute window).
 * In a real production env, nonces should be cached (e.g., Redis) and checked for duplicates.
 */
const validateNonceAndTimestamp = (nonce, timestamp) => {
  const reqTime = new Date(timestamp).getTime();
  const now = Date.now();
  if (Math.abs(now - reqTime) > 5 * 60 * 1000) {
    throw new Error('Request timestamp outside acceptable window (5 minutes)');
  }
  // TODO: Check if nonce has been seen in the last 5 minutes (requires Redis/cache)
};

export const activateLicense = async (req, res) => {
  try {
    const { license_key, domain, install_id, version, nonce, timestamp } = req.body;
    
    if (!license_key || !domain || !install_id || !nonce || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    validateNonceAndTimestamp(nonce, timestamp);

    const hashedKey = hashLicenseKey(license_key);
    const license = await MarketLicense.findOne({ license_key_hash: hashedKey });
    
    if (!license) {
      return res.status(404).json({ error: 'Invalid license key' });
    }

    if (license.status !== 'active') {
      return res.status(403).json({ error: `License is ${license.status}` });
    }

    // Check if domain is already activated for this license
    let activation = await LicenseActivation.findOne({ license_id: license._id, domain });
    
    if (!activation) {
      // Check activation limit based on tier
      const activeCount = await LicenseActivation.countDocuments({ license_id: license._id, status: 'active' });
      
      // Tier limits enforcement
      // Personal: 1 domain. Commercial: 1 per project (domain). Extended: Unlimited sub-licenses via API?
      // Let's rely on max_activations
      let isDevDomain = domain.includes('localhost') || domain.includes('.test') || domain.startsWith('staging.');
      
      if (!isDevDomain && activeCount >= license.max_activations) {
        return res.status(403).json({ error: 'Maximum domain activations reached for this license tier' });
      }

      activation = await LicenseActivation.create({
        license_id: license._id,
        domain,
        install_id,
        ip_address: req.ip,
        version
      });
    } else {
      // Update existing activation
      activation.install_id = install_id;
      activation.ip_address = req.ip;
      activation.version = version;
      activation.last_check_at = new Date();
      activation.status = 'active';
      await activation.save();
    }

    // Construct the payload to sign
    const payload = {
      license_id: license._id.toString(),
      tier: license.tier,
      domain: domain,
      expiry: license.support_expires_at, // Or updates_expires_at
      features: ['core_updates', 'premium_templates'], // Can be derived from tier/product
      issued_at: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex') // Server nonce for client to verify
    };

    const signature = signPayload(payload);

    res.status(200).json({
      payload,
      signature
    });

  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ error: error.message || 'Failed to activate license' });
  }
};

export const verifyLicense = async (req, res) => {
  try {
    const { license_key, domain, install_id, nonce, timestamp } = req.body;
    
    if (!license_key || !domain || !install_id || !nonce || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    validateNonceAndTimestamp(nonce, timestamp);

    const hashedKey = hashLicenseKey(license_key);
    const license = await MarketLicense.findOne({ license_key_hash: hashedKey });
    
    if (!license || license.status !== 'active') {
      return res.status(403).json({ valid: false, error: 'License invalid or suspended' });
    }

    const activation = await LicenseActivation.findOne({ license_id: license._id, domain, install_id, status: 'active' });
    
    if (!activation) {
      return res.status(403).json({ valid: false, error: 'Domain/Install not activated' });
    }

    // Update last check
    activation.last_check_at = new Date();
    activation.ip_address = req.ip;
    await activation.save();

    const payload = {
      license_id: license._id.toString(),
      tier: license.tier,
      domain: domain,
      expiry: license.support_expires_at,
      features: ['core_updates', 'premium_templates'],
      issued_at: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    const signature = signPayload(payload);

    res.status(200).json({ valid: true, payload, signature });

  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ valid: false, error: error.message || 'Failed to verify license' });
  }
};

export const deactivateLicense = async (req, res) => {
  try {
    const { license_key, domain, install_id, nonce, timestamp } = req.body;
    
    validateNonceAndTimestamp(nonce, timestamp);

    const hashedKey = hashLicenseKey(license_key);
    const license = await MarketLicense.findOne({ license_key_hash: hashedKey });
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }

    const activation = await LicenseActivation.findOne({ license_id: license._id, domain, install_id });
    if (activation) {
      activation.status = 'deactivated';
      await activation.save();
    }

    res.status(200).json({ success: true, message: 'License deactivated for domain' });

  } catch (error) {
    console.error('Deactivate error:', error);
    res.status(500).json({ error: error.message || 'Failed to deactivate license' });
  }
};
