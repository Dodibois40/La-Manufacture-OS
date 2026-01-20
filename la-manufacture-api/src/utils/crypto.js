import crypto from 'crypto';

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16; // AES block size

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted string (iv:authTag:encrypted)
 */
export function encrypt(text) {
  if (!text) return null;

  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 * @param {string} encryptedText - Encrypted string (iv:authTag:encrypted)
 * @returns {string|null} - Decrypted text or null if invalid
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encrypted] = parts;
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a secure random token
 * @param {number} bytes - Number of random bytes (default 32)
 * @returns {string} - Hex-encoded random token
 */
export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Create a signed state token for OAuth flows
 * Contains userId + timestamp + random, signed with HMAC
 * @param {number} userId - User ID to embed
 * @returns {string} - Signed state token
 */
export function createOAuthState(userId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  const data = `${userId}:${timestamp}:${random}`;

  const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY);
  hmac.update(data);
  const signature = hmac.digest('hex');

  // Encode as base64url for URL safety
  const state = Buffer.from(`${data}:${signature}`).toString('base64url');
  return state;
}

/**
 * Verify and extract userId from OAuth state token
 * @param {string} state - State token from OAuth callback
 * @param {number} maxAgeMs - Max age in milliseconds (default 10 minutes)
 * @returns {{ valid: boolean, userId?: number, error?: string }}
 */
export function verifyOAuthState(state, maxAgeMs = 10 * 60 * 1000) {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split(':');

    if (parts.length !== 4) {
      return { valid: false, error: 'Invalid state format' };
    }

    const [userIdStr, timestampStr, random, signature] = parts;
    const data = `${userIdStr}:${timestampStr}:${random}`;

    // Verify signature
    const hmac = crypto.createHmac('sha256', ENCRYPTION_KEY);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');

    // Timing-safe comparison
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Check timestamp
    const timestamp = parseInt(timestampStr, 10);
    if (Date.now() - timestamp > maxAgeMs) {
      return { valid: false, error: 'State expired' };
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      return { valid: false, error: 'Invalid userId' };
    }

    return { valid: true, userId };
  } catch (error) {
    return { valid: false, error: 'Failed to parse state' };
  }
}

/**
 * Hash a string with SHA-256 (for non-reversible hashing)
 * @param {string} text - Text to hash
 * @returns {string} - Hex-encoded hash
 */
export function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
