/**
 * Session.ts
 *
 * mongoose schema for user sessions (refresh token tracking).
 * raw refresh tokens are NEVER stored — only SHA-256 hashes.
 * this ensures a stolen database cannot be used to forge sessions.
 * sessions can be individually or bulk-revoked (e.g., "log out all devices").
 */

import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * interface for a session document.
 */
export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  // sha-256 hash of the raw refresh token — stored for lookup/revocation
  refreshTokenHash: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  // isRevoked: true when the session is explicitly invalidated (logout, role change, etc.)
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISessionModel extends Model<ISession> {
  revokeAllForUser(userId: string): Promise<void>;
  findValidSession(refreshTokenHash: string): Promise<ISession | null>;
}

const sessionSchema = new Schema<ISession, ISessionModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    // sha-256 hex digest of the refresh token
    // indexed for fast lookup during token refresh
    refreshTokenHash: {
      type: String,
      required: [true, 'Refresh token hash is required'],
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
      // mongodb TTL index will automatically delete expired sessions
      index: { expires: 0 }, // 0 = delete at expiresAt time exactly
    },

    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
    },

    userAgent: {
      type: String,
      default: 'unknown',
      maxlength: 500,
    },

    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// compound index for user + revocation status queries
sessionSchema.index({ userId: 1, isRevoked: 1 });

/**
 * static method: revokes all sessions for a user.
 * called on password change, role change, or "logout all devices".
 */
sessionSchema.statics.revokeAllForUser = async function (userId: string): Promise<void> {
  await this.updateMany(
    { userId: new mongoose.Types.ObjectId(userId), isRevoked: false },
    { $set: { isRevoked: true } }
  );
};

/**
 * static method: finds a valid (non-revoked, non-expired) session by token hash.
 * returns null if not found, expired, or revoked.
 */
sessionSchema.statics.findValidSession = function (
  refreshTokenHash: string
): Promise<ISession | null> {
  return this.findOne({
    refreshTokenHash,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).exec();
};

export const Session = mongoose.model<ISession, ISessionModel>('Session', sessionSchema);
