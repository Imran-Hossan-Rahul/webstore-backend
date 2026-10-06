import crypto from 'crypto';

/**
 * ---------------------------------------------------------
 * CODALINA DRM - CLIENT SDK
 * ---------------------------------------------------------
 * This file is part of the Protected Core. It must be obfuscated 
 * and bundled before shipping to the client.
 * 
 * It handles signature verification (Ed25519), server-less caching, 
 * and grace-period enforcement.
 */

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA... (Insert Actual Public Key Here) ...
-----END PUBLIC KEY-----`;

const LICENSE_SERVER_URL = 'https://codalina.com/api/v1/license';
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheAdapter {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
}

export class LicenseManager {
  private licenseKey: string;
  private domain: string;
  private installId: string;
  private cache: CacheAdapter;

  constructor(licenseKey: string, domain: string, installId: string, cacheAdapter: CacheAdapter) {
    this.licenseKey = licenseKey;
    this.domain = domain;
    this.installId = installId;
    this.cache = cacheAdapter;
  }

  /**
   * Verifies the Ed25519 signature of the payload.
   */
  private verifySignature(payload: any, signatureBase64: string): boolean {
    try {
      const payloadStr = JSON.stringify(payload);
      const signature = Buffer.from(signatureBase64, 'base64');
      const publicKey = crypto.createPublicKey(PUBLIC_KEY_PEM);
      return crypto.verify(null, Buffer.from(payloadStr, 'utf8'), publicKey, signature);
    } catch (err) {
      return false;
    }
  }

  /**
   * Core verification loop. Should be called by a cron or middleware every 24h.
   */
  async verifyLicense(): Promise<{ valid: boolean; features?: string[] }> {
    const cachedDataStr = await this.cache.get('codalina_license_cache');
    let lastChecked = 0;
    
    if (cachedDataStr) {
      const cached = JSON.parse(cachedDataStr);
      lastChecked = cached.timestamp;
      
      // If checked within the last 24h, return cached validity
      if (Date.now() - lastChecked < 24 * 60 * 60 * 1000) {
        return { valid: true, features: cached.payload.features };
      }
    }

    try {
      // Need to re-verify with the server
      const nonce = crypto.randomBytes(16).toString('hex');
      const timestamp = new Date().toISOString();

      const response = await fetch(`${LICENSE_SERVER_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: this.licenseKey,
          domain: this.domain,
          install_id: this.installId,
          nonce,
          timestamp
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.valid || !this.verifySignature(data.payload, data.signature)) {
        await this.cache.set('codalina_license_cache', ''); // Clear cache
        return { valid: false };
      }

      // Domain spoofing protection
      if (data.payload.domain !== this.domain) {
        return { valid: false };
      }

      // Cache the successful validation
      await this.cache.set('codalina_license_cache', JSON.stringify({
        timestamp: Date.now(),
        payload: data.payload,
        signature: data.signature
      }));

      return { valid: true, features: data.payload.features };

    } catch (err) {
      // Server is unreachable. Apply Grace Period logic.
      if (lastChecked > 0 && (Date.now() - lastChecked < GRACE_PERIOD_MS)) {
        // Still within grace period, allow execution
        if (cachedDataStr) {
           const cached = JSON.parse(cachedDataStr);
           return { valid: true, features: cached.payload.features };
        }
      }
      return { valid: false };
    }
  }

  /**
   * API Dependency Gateway: Call this to access premium server-side features
   */
  async proxyProtectedFeature(endpoint: string, data: any) {
    const cachedDataStr = await this.cache.get('codalina_license_cache');
    if (!cachedDataStr) throw new Error("License not verified");
    
    const cached = JSON.parse(cachedDataStr);
    
    // Attach the signed payload as proof to the Codalina feature server
    const response = await fetch(`${LICENSE_SERVER_URL}/feature/${endpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-License-Proof': JSON.stringify({ payload: cached.payload, signature: cached.signature })
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error("Protected feature request failed");
    return await response.json();
  }
}
