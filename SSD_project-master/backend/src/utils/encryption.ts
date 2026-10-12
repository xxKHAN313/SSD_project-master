/**
 * encryption.ts
 *
 * low-level AES-256-GCM encryption and decryption using node's built-in crypto module.
 * AES-256-GCM provides authenticated encryption — it detects tampering via the auth tag.
 * each encryption produces a unique IV (initialization vector) to prevent pattern analysis.
 *
 * output format: "iv:authTag:ciphertext" — all parts base64-encoded, joined by colons.
 * this self-contained format makes the encrypted blob fully portable.
 */

import crypto from 'crypto';
import { env } from '../config/environment';

// AES-256-GCM constants
const ALGORITHM = 'aes-256-gcm';
// auth tag length: 16 bytes (128-bit) — maximum security for gcm mode
const AUTH_TAG_LENGTH = 16;

/**
 * derives the 32-byte (256-bit) encryption key from the hex string in environment.
 * called once per process — the key is cached for performance.
 */
function getEncryptionKey(): Buffer {
  // convert hex string to binary buffer — crypto expects raw bytes
  return Buffer.from(env.encryption.key, 'hex');
}

/**
 * encrypts a plaintext string using AES-256-GCM.
 *
 * process:
 * 1. generate a random 16-byte iv (never reuse ivs with the same key)
 * 2. create cipher with key + iv
 * 3. encrypt the data and finalize
 * 4. extract the gcm authentication tag (proves data integrity)
 * 5. return "iv:authTag:ciphertext" as colon-separated base64 strings
 *
 * @param plaintext - the string to encrypt
 * @returns base64-encoded "iv:authTag:ciphertext" string
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('[encryption] cannot encrypt empty string');
  }

  const key = getEncryptionKey();
  // generate a cryptographically random iv for each encryption
  // iv reuse with the same key in gcm mode is catastrophic for security
  const iv = crypto.randomBytes(env.encryption.ivLength);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // encrypt the plaintext (utf-8 input, base64 output)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // gcm auth tag — must be retrieved after cipher.final()
  const authTag = cipher.getAuthTag();

  // pack iv + authTag + ciphertext into a single string
  // base64 encoding for safe storage in json/text fields
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * decrypts a string produced by the encrypt() function.
 *
 * process:
 * 1. split the "iv:authTag:ciphertext" format
 * 2. reconstruct buffers from base64
 * 3. create decipher with key + iv
 * 4. set the auth tag — gcm will verify integrity during decryption
 * 5. decrypt and return plaintext
 *
 * throws if the data has been tampered with (auth tag mismatch).
 *
 * @param encryptedString - "iv:authTag:ciphertext" base64 string
 * @returns the original plaintext string
 */
export function decrypt(encryptedString: string): string {
  if (!encryptedString) {
    throw new Error('[encryption] cannot decrypt empty string');
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('[encryption] invalid encrypted string format — expected iv:authTag:ciphertext');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;

  if (!ivBase64 || !authTagBase64 || !ciphertextBase64) {
    throw new Error('[encryption] invalid encrypted string — missing required components');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // set the auth tag before decrypting — gcm verifies it during decipher.final()
  // if the data was tampered, final() will throw an authentication error
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(), // throws if auth tag doesn't match
    ]);
    return decrypted.toString('utf8');
  } catch {
    // do not expose internal error details — return a generic message
    throw new Error('[encryption] decryption failed — data may have been tampered with');
  }
}

/**
 * safely checks whether a string is already in the encrypted format.
 * this prevents double-encryption bugs.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // check if all parts are valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every((part) => base64Regex.test(part));
}

/**
 * generates a cryptographically secure random token of the specified byte length.
 * used for password reset tokens, csrf tokens, etc.
 *
 * @param byteLength - number of random bytes (default 32 = 256 bits)
 * @returns hex-encoded random token string
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * creates a sha-256 hash of a token for safe database storage.
 * raw tokens should only exist transiently (in emails, cookies)
 * — the db stores only the hash.
 *
 * @param token - the raw token string
 * @returns sha-256 hex digest
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
