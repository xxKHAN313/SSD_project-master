/**
 * PasswordReset.ts
 *
 * mongoose schema for password reset tokens.
 * raw tokens are sent via email; only SHA-256 hashes are stored in the DB.
 * tokens expire after 1 hour and are single-use (isUsed flag).
 * TTL index automatically cleans up expired records.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';
import { PASSWORD_RESET_EXPIRY_MS } from '../utils/constants';

/**
 * interface for a password reset document.
 */
export interface IPasswordReset extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  // sha-256 hash of the raw token sent to the user's email
  tokenHash: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

export interface IPasswordResetModel extends Model<IPasswordReset> {
  findValidToken(tokenHash: string): Promise<IPasswordReset | null>;
  invalidateAllForUser(userId: string): Promise<void>;
}

const passwordResetSchema = new Schema<IPasswordReset, IPasswordResetModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
      default: () => new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS),
      // TTL index: mongodb will automatically remove documents when expiresAt is past
      index: { expires: 0 },
    },

    // once a token is used, it cannot be used again (prevents replay attacks)
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

/**
 * static method: finds a valid (unused, non-expired) reset token by hash.
 * returns null if not found, expired, or already used.
 */
passwordResetSchema.statics.findValidToken = function (
  tokenHash: string
): Promise<IPasswordReset | null> {
  return this.findOne({
    tokenHash,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).exec();
};

/**
 * static method: marks all reset tokens for a user as used.
 * called when a password reset succeeds — prevents reuse of old tokens.
 */
passwordResetSchema.statics.invalidateAllForUser = async function (
  userId: string
): Promise<void> {
  await this.updateMany(
    { userId: new mongoose.Types.ObjectId(userId) },
    { $set: { isUsed: true } }
  );
};

export const PasswordReset = mongoose.model<IPasswordReset, IPasswordResetModel>(
  'PasswordReset',
  passwordResetSchema
);
