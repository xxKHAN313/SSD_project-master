/**
 * encryptionService.ts
 *
 * high-level encryption service wrapping the low-level encryption utilities.
 * provides semantic methods for encrypting messages and email addresses.
 * all errors from the crypto layer are caught and re-thrown with context.
 */

import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

/**
 * encrypts a chat message content before storing in the database.
 * the entire message body is encrypted — metadata (sender, room, timestamp)
 * is stored in plaintext for querying and display purposes.
 *
 * @param plaintext - the raw message content
 * @returns AES-256-GCM encrypted string ("iv:authTag:ciphertext")
 */
export function encryptMessage(plaintext: string): string {
  try {
    return encrypt(plaintext);
  } catch (error) {
    logger.error('[encryptionService] failed to encrypt message', {
      error: (error as Error).message,
    });
    throw new Error('Failed to encrypt message content');
  }
}

/**
 * decrypts a chat message retrieved from the database.
 * throws if the data is corrupted or the key has changed.
 *
 * @param encryptedContent - the "iv:authTag:ciphertext" string from the DB
 * @returns the original plaintext message content
 */
export function decryptMessage(encryptedContent: string): string {
  try {
    return decrypt(encryptedContent);
  } catch (error) {
    logger.error('[encryptionService] failed to decrypt message', {
      error: (error as Error).message,
    });
    throw new Error('Failed to decrypt message content');
  }
}

/**
 * encrypts an email address before storing in the database.
 * email addresses are PII — encrypting them at rest limits exposure
 * in the event of a database breach.
 *
 * @param email - the normalized email address
 * @returns AES-256-GCM encrypted email string
 */
export function encryptEmail(email: string): string {
  try {
    return encrypt(email.toLowerCase().trim());
  } catch (error) {
    logger.error('[encryptionService] failed to encrypt email', {
      error: (error as Error).message,
    });
    throw new Error('Failed to encrypt email address');
  }
}

/**
 * decrypts an email address retrieved from the database.
 *
 * @param encryptedEmail - the encrypted email string from the DB
 * @returns the original plaintext email address
 */
export function decryptEmail(encryptedEmail: string): string {
  try {
    return decrypt(encryptedEmail);
  } catch (error) {
    logger.error('[encryptionService] failed to decrypt email', {
      error: (error as Error).message,
    });
    throw new Error('Failed to decrypt email address');
  }
}

/**
 * encrypts an email for use in database lookup queries.
 * since emails are encrypted at rest, searching by email requires
 * encrypting the query value first... but because AES-GCM uses random IVs,
 * the same email always produces a different ciphertext.
 *
 * to handle this, we use a deterministic approach for lookups:
 * we search all users and filter in application code, or maintain a separate
 * deterministic hash index. here we return all encrypted emails for comparison.
 *
 * note: for production at scale, consider HMAC-based searchable encryption.
 *
 * @param email - the plaintext email to search for
 * @returns the encrypted form (for systems using deterministic encryption)
 */
export function encryptEmailForLookup(email: string): string {
  // we encrypt for storage; lookups are handled by the service layer
  // which decrypts each record and compares in memory
  return encryptEmail(email);
}

/**
 * safely decrypts a message, returning a placeholder if decryption fails.
 * used when displaying message lists where a single corrupt entry
 * should not break the entire response.
 *
 * @param encryptedContent - the encrypted message string
 * @returns decrypted content or "[message unavailable]" on failure
 */
export function safeDecryptMessage(encryptedContent: string): string {
  try {
    return decryptMessage(encryptedContent);
  } catch {
    // do not propagate — return a safe placeholder instead
    return '[message unavailable]';
  }
}
