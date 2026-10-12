/**
 * tokenUtils.ts
 *
 * JWT generation and verification utilities.
 * access tokens expire in 1 hour; refresh tokens expire in 7 days.
 * all tokens include userId and role in the payload.
 * verify functions throw on invalid/expired tokens — callers must catch.
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { JWT_ACCESS_OPTIONS, JWT_REFRESH_OPTIONS } from '../config/security';
import { UserRole } from '../config/constants';

/**
 * structure of the JWT payload for both access and refresh tokens.
 */
export interface TokenPayload {
  userId: string;
  role: UserRole;
  type: 'access' | 'refresh';
  // jti (jwt id) added by sign options for token uniqueness
}

/**
 * the decoded token as returned by jwt.verify.
 * extends TokenPayload with standard jwt registered claims.
 */
export interface DecodedToken extends TokenPayload {
  iat: number; // issued at (unix timestamp)
  exp: number; // expiry (unix timestamp)
  iss: string; // issuer
  aud: string | string[]; // audience
}

/**
 * generates a signed JWT access token for the given user.
 * access tokens are short-lived (1 hour) and carried in the authorization header
 * or httpOnly cookie. they authorize API requests.
 *
 * @param userId - the user's mongodb objectid as string
 * @param role - the user's current role
 * @returns signed JWT string
 */
export function generateAccessToken(userId: string, role: UserRole): string {
  const payload: TokenPayload = {
    userId,
    role,
    type: 'access',
  };
  return jwt.sign(payload, env.jwt.accessSecret, JWT_ACCESS_OPTIONS);
}

/**
 * generates a signed JWT refresh token for the given user.
 * refresh tokens are long-lived (7 days) and stored httpOnly in a cookie.
 * the raw token is hashed before storage in the sessions collection.
 * they are only valid for the /auth/refresh endpoint.
 *
 * @param userId - the user's mongodb objectid as string
 * @param role - the user's current role
 * @returns signed JWT string
 */
export function generateRefreshToken(userId: string, role: UserRole): string {
  const payload: TokenPayload = {
    userId,
    role,
    type: 'refresh',
  };
  return jwt.sign(payload, env.jwt.refreshSecret, JWT_REFRESH_OPTIONS);
}

/**
 * verifies an access token and returns the decoded payload.
 * throws JsonWebTokenError if invalid, TokenExpiredError if expired.
 * callers should catch these and return 401.
 *
 * @param token - the raw JWT string
 * @returns decoded token payload
 */
export function verifyAccessToken(token: string): DecodedToken {
  const decoded = jwt.verify(token, env.jwt.accessSecret, {
    issuer: 'shield-chat',
    audience: 'shield-chat-client',
    algorithms: ['HS256'],
  }) as DecodedToken;

  // extra runtime check — ensures the token is of the expected type
  if (decoded.type !== 'access') {
    throw new jwt.JsonWebTokenError('invalid token type — expected access token');
  }

  return decoded;
}

/**
 * verifies a refresh token and returns the decoded payload.
 * throws JsonWebTokenError if invalid, TokenExpiredError if expired.
 *
 * @param token - the raw JWT string
 * @returns decoded token payload
 */
export function verifyRefreshToken(token: string): DecodedToken {
  const decoded = jwt.verify(token, env.jwt.refreshSecret, {
    issuer: 'shield-chat',
    audience: 'shield-chat-client',
    algorithms: ['HS256'],
  }) as DecodedToken;

  if (decoded.type !== 'refresh') {
    throw new jwt.JsonWebTokenError('invalid token type — expected refresh token');
  }

  return decoded;
}

/**
 * extracts a bearer token from an Authorization header.
 * returns null if the header is missing or malformed.
 *
 * @param authorizationHeader - the value of the Authorization header
 * @returns the raw token string or null
 */
export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const parts = authorizationHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') return null;
  return parts[1] ?? null;
}

/**
 * returns the remaining TTL (in seconds) for a decoded token.
 * useful for setting cookie max-age to match token expiry.
 *
 * @param decoded - the decoded token payload
 * @returns seconds until expiry (0 if already expired)
 */
export function getTokenTTLSeconds(decoded: DecodedToken): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(0, decoded.exp - nowSeconds);
}
