/**
 * socketAuth.ts
 *
 * Socket.io authentication middleware.
 * validates the JWT access token from the socket handshake and attaches
 * the authenticated user's data to socket.data for use in event handlers.
 *
 * token extraction order:
 * 1. socket.handshake.auth.token (preferred — explicit bearer token)
 * 2. socket.handshake.query.token (fallback — for clients that cannot set auth)
 * 3. Authorization cookie from handshake headers (browser clients)
 */

import { Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/tokenUtils';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/**
 * Socket.io middleware that authenticates incoming connections.
 * called once per socket connection before any event handlers are registered.
 *
 * attaches to socket.data:
 * - userId: string (MongoDB ObjectId as string)
 * - role: UserRole ('employee' | 'manager' | 'admin')
 * - username: string
 *
 * @param socket - the incoming socket connection
 * @param next - callback to proceed or reject the connection
 */
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    // attempt to extract the token from multiple sources
    const authToken = socket.handshake.auth['token'] as string | undefined;
    const queryToken = socket.handshake.query['token'] as string | undefined;

    // extract from cookie header as a fallback for browser clients
    let cookieToken: string | undefined;
    const cookieHeader = socket.handshake.headers['cookie'];
    if (cookieHeader) {
      const match = /access_token=([^;]+)/.exec(cookieHeader);
      if (match) {
        cookieToken = decodeURIComponent(match[1] ?? '');
      }
    }

    const token = authToken ?? queryToken ?? cookieToken;

    if (!token) {
      logger.warn('[socketAuth] connection attempt without token', {
        address: socket.handshake.address,
      });
      return next(new Error('Authentication required'));
    }

    // verify JWT signature, expiry, issuer, and audience
    const decoded = verifyAccessToken(token);

    // verify the user still exists and is active in the database
    // this prevents stale tokens from working after deactivation/deletion
    const user = await User.findById(decoded.userId)
      .select('username role isActive')
      .lean();

    if (!user) {
      logger.warn('[socketAuth] authenticated socket user not found in database', {
        userId: decoded.userId,
      });
      return next(new Error('Authentication failed'));
    }

    if (!user.isActive) {
      logger.warn('[socketAuth] inactive user attempted socket connection', {
        userId: decoded.userId,
        username: user.username,
      });
      return next(new Error('Authentication failed'));
    }

    // attach user identity to the socket for use by event handlers
    socket.data['userId'] = decoded.userId;
    socket.data['role'] = user.role; // use DB role — reflects any role changes since token issuance
    socket.data['username'] = user.username;

    next();
  } catch (error) {
    logger.warn('[socketAuth] authentication failed', {
      error: (error as Error).message,
      address: socket.handshake.address,
    });
    next(new Error('Authentication failed'));
  }
}
