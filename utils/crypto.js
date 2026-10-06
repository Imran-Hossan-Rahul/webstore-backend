import crypto from 'crypto';

/**
 * Validates or generates the Ed25519 key pair from environment variables.
 * In a real production setup, process.env.LICENSE_PRIVATE_KEY should be set.
 */
function getKeys() {
  let privateKeyStr = process.env.LICENSE_PRIVATE_KEY;
  let publicKeyStr = process.env.LICENSE_PUBLIC_KEY;

  if (!privateKeyStr || !publicKeyStr) {
    console.warn("WARNING: Ed25519 keys not found in environment variables. Generating temporary keys for this session.");
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    
    publicKeyStr = publicKey.export({ type: 'spki', format: 'pem' });
    privateKeyStr = privateKey.export({ type: 'pkcs8', format: 'pem' });
    
    // In dev, we might set them to process.env so they persist during the session
    process.env.LICENSE_PRIVATE_KEY = privateKeyStr;
    process.env.LICENSE_PUBLIC_KEY = publicKeyStr;
    
    // In a real app, you'd want to save these to .env permanently
  }

  const privateKey = crypto.createPrivateKey(privateKeyStr);
  const publicKey = crypto.createPublicKey(publicKeyStr);

  return { privateKey, publicKey };
}

/**
 * Signs a payload object using Ed25519.
 * @param {Object} payload 
 * @returns {String} Base64 encoded signature
 */
export const signPayload = (payload) => {
  const { privateKey } = getKeys();
  
  // Convert payload to deterministic JSON string
  const payloadStr = JSON.stringify(payload);
  
  const sign = crypto.createSign('sha512'); // Although Ed25519 doesn't technically use a separate hash algo in the same way RSA does, Node crypto requires an algorithm name here for some legacy wrapper reasons, or passing null might work in newer nodes. Actually, for Ed25519 in crypto.sign:
  
  // Using native crypto.sign which is cleaner for Ed25519
  const signature = crypto.sign(null, Buffer.from(payloadStr, 'utf8'), privateKey);
  
  return signature.toString('base64');
};

/**
 * Verifies a payload object using Ed25519.
 * @param {Object} payload 
 * @param {String} signatureBase64 
 * @returns {Boolean}
 */
const verifySignature = (payload, signatureBase64) => {
  const { publicKey } = getKeys();
  const payloadStr = JSON.stringify(payload);
  const signature = Buffer.from(signatureBase64, 'base64');
  
  return crypto.verify(null, Buffer.from(payloadStr, 'utf8'), publicKey, signature);
};

/**
 * Hashes a license key for safe database storage.
 * @param {String} licenseKey 
 * @returns {String}
 */
export const hashLicenseKey = (licenseKey) => {
  return crypto.createHash('sha256').update(licenseKey).digest('hex');
};

/**
 * Generates a CSPRNG readable license key format: XXXX-XXXX-XXXX-XXXX
 */
const generateReadableLicenseKey = () => {
  const generateSegment = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${generateSegment()}-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
};

