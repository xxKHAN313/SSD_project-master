/**
 * tokenService.ts
 *
 * manages JWT token lifecycle: creation, refresh, and revocation.
 * refresh tokens are stored as SHA-256 hashes in the sessions collection.
 * raw tokens live only in httpOnly cookies — never in the database.
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import { Session } from '../models/Session';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/tokenUtils';
import { UserRole } from '../config/constants';
import { REFRESH_TOKEN_EXPIRY_MS } from '../utils/constants';
import { logger } from '../utils/logger';

/**
 * hashes a raw token for storage or lookup.
 * using SHA-256 means a compromised DB cannot be used to forge sessions.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * creates a new access + refresh token pair for a user.
 * saves a session record with the refresh token hash.
 * returns both tokens for delivery to the client.
 *
 * @param userId - mongodb objectid string
 * @param role - user's current role
 * @param ipAddress - client IP for session tracking
 * @param userAgent - client user-agent for session tracking
 * @returns { accessToken, refreshToken }
 */
export async function createTokenPair(
  userId: string,
  role: UserRole,
  ipAddress: string,
  userAgent: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = generateAccessToken(userId, role);
  const refreshToken = generateRefreshToken(userId, role);
  const refreshTokenHash = hashToken(refreshToken);

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await Session.create({
    userId: new mongoose.Types.ObjectId(userId),
    refreshTokenHash,
    expiresAt,
    ipAddress,
    userAgent: userAgent.substring(0, 500),
    isRevoked: false,
  });

  logger.info('[tokenService] token pair created', { userId, ipAddress });

  return { accessToken, refreshToken };
}

/**
 * validates a refresh token and issues a new token pair (token rotation).
 * token rotation: each refresh invalidates the old refresh token and issues a new one.
 * this limits the window of opportunity if a refresh token is stolen.
 *
 * process:
 * 1. verify the JWT signature and expiry
 * 2. look up the session by token hash
 * 3. revoke the old session
 * 4. create a new token pair
 *
 * @param rawRefreshToken - the raw refresh token from the client cookie
 * @param ipAddress - current client IP
 * @param userAgent - current client user-agent
 * @returns new { accessToken, refreshToken } or null if invalid
 */
export async function refreshTokens(
  rawRefreshToken: string,
  ipAddress: string,
  userAgent: string
): Promise<{ accessToken: string; refreshToken: string; userId: string; role: UserRole } | null> {
  try {
    // step 1: verify jwt signature and expiry
    const decoded = verifyRefreshToken(rawRefreshToken);

    // step 2: look up session in database by token hash
    const tokenHash = hashToken(rawRefreshToken);
    const session = await Session.findValidSession(tokenHash);

    if (!session) {
      logger.warn('[tokenService] refresh attempt with non-existent or revoked session', {
        userId: decoded.userId,
        ipAddress,
      });
      return null;
    }

    // step 3: revoke the old session (token rotation)
    session.isRevoked = true;
    await session.save();

    // step 4: issue a new token pair
    const { accessToken, refreshToken } = await createTokenPair(
      decoded.userId,
      decoded.role,
      ipAddress,
      userAgent
    );

    return { accessToken, refreshToken, userId: decoded.userId, role: decoded.role };
  } catch (error) {
    // jwt verification errors (expired, invalid signature) end up here
    logger.warn('[tokenService] token refresh failed', {
      error: (error as Error).message,
      ipAddress,
    });
    return null;
  }
}

/**
 * revokes a specific refresh token session.
 * called during logout to invalidate the current session.
 *
 * @param rawRefreshToken - the raw refresh token to revoke
 * @returns true if the session was found and revoked, false otherwise
 */
export async function revokeToken(rawRefreshToken: string): Promise<boolean> {
  if (!rawRefreshToken) return false;

  const tokenHash = hashToken(rawRefreshToken);
  const result = await Session.updateOne(
    { refreshTokenHash: tokenHash, isRevoked: false },
    { $set: { isRevoked: true } }
  );

  return result.modifiedCount > 0;
}

/**
 * revokes all sessions for a given user.
 * called on password change, role change, or admin forced logout.
 * effectively logs the user out of all devices.
 *
 * @param userId - the user's mongodb objectid string
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await Session.revokeAllForUser(userId);
  logger.info('[tokenService] all sessions revoked for user', { userId });
}

/**
 * validates a refresh token without rotating it.
 * used for checking session validity without creating a new session.
 *
 * @param rawRefreshToken - the raw refresh token
 * @returns the decoded payload or null if invalid
 */
export async function validateRefreshToken(
  rawRefreshToken: string
): Promise<{ userId: string; role: UserRole } | null> {
  try {
    const decoded = verifyRefreshToken(rawRefreshToken);
    const tokenHash = hashToken(rawRefreshToken);
    const session = await Session.findValidSession(tokenHash);

    if (!session) return null;

    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}
