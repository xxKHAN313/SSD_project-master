/**
 * seed.ts
 *
 * database seed script for Shield-Chat.
 * creates one user per role (admin, manager, employee) and three default chat rooms.
 * idempotent — skips seeding if any users already exist in the database.
 *
 * usage:
 *   npm run seed
 *   OR: ts-node src/database/seed.ts
 *
 * credentials printed to the logger so developers can log in immediately.
 * do NOT use these credentials in production.
 */

import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from './connection';
import { User } from '../models/User';
import { ChatRoom } from '../models/ChatRoom';
import { hashPassword } from '../utils/passwordUtils';
import { encryptEmail } from '../services/encryptionService';
import { logger } from '../utils/logger';
import type { UserRole } from '../config/constants';
import type { RoomAccessLevel } from '../models/ChatRoom';

/**
 * seed data for test users.
 * passwords are intentionally printed to the logger so developers
 * can log in to a fresh environment immediately.
 */
const TEST_USERS: Array<{
  username: string;
  email: string;
  password: string;
  role: UserRole;
}> = [
  {
    username: 'admin',
    email: 'admin@shield-chat.com',
    password: 'Admin@123456',
    role: 'admin',
  },
  {
    username: 'manager',
    email: 'manager@shield-chat.com',
    password: 'Manager@123456',
    role: 'manager',
  },
  {
    username: 'employee',
    email: 'employee@shield-chat.com',
    password: 'Employee@123456',
    role: 'employee',
  },
];

/**
 * default chat rooms created after seeding users.
 * covers all three access levels.
 */
const DEFAULT_ROOMS: Array<{
  name: string;
  description: string;
  accessLevel: RoomAccessLevel;
  allowedRoles: UserRole[];
}> = [
  {
    name: 'General',
    description: 'General discussion open to all employees',
    accessLevel: 'public',
    allowedRoles: ['employee', 'manager', 'admin'],
  },
  {
    name: 'Management',
    description: 'Discussion channel for managers and admins',
    accessLevel: 'manager',
    allowedRoles: ['manager', 'admin'],
  },
  {
    name: 'Admin',
    description: 'Admin-only channel for system administration discussions',
    accessLevel: 'admin',
    allowedRoles: ['admin'],
  },
];

/**
 * main seed function.
 * connects to MongoDB, checks if seeding is needed, creates users and rooms.
 */
async function seed(): Promise<void> {
  await connectDB();

  // check if the database has already been seeded
  const existingUserCount = await User.countDocuments();
  if (existingUserCount > 0) {
    logger.info('[seed] Database already contains users — skipping seed. Delete all users to reseed.');
    await disconnectDB();
    return;
  }

  logger.info('[seed] Starting database seed...');

  // create all test users
  const createdUserIds: Record<string, string> = {};
  for (const userData of TEST_USERS) {
    const passwordHash = await hashPassword(userData.password);
    const encryptedEmail = encryptEmail(userData.email);

    const user = await User.create({
      username: userData.username,
      email: encryptedEmail,
      passwordHash,
      role: userData.role,
      passwordHistory: [passwordHash],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
    });

    createdUserIds[userData.role] = user._id.toString();

    logger.info(`[seed] Created ${userData.role}: username="${userData.username}" password="${userData.password}"`);
  }

  // create default chat rooms using the admin's ID as creator
  const adminId = createdUserIds['admin'];
  if (!adminId) {
    logger.error('[seed] Admin user not found — cannot create rooms');
    await disconnectDB();
    return;
  }

  for (const roomData of DEFAULT_ROOMS) {
    await ChatRoom.create({
      name: roomData.name,
      description: roomData.description,
      accessLevel: roomData.accessLevel,
      allowedRoles: roomData.allowedRoles,
      createdBy: adminId,
      isActive: true,
    });

    logger.info(`[seed] Created room: "${roomData.name}" (accessLevel: ${roomData.accessLevel})`);
  }

  logger.info('[seed] Database seeded successfully.');
  logger.info('[seed] Test credentials:');
  TEST_USERS.forEach((u) => {
    logger.info(`[seed]   ${u.role}: ${u.username} / ${u.password}`);
  });

  await disconnectDB();
}

// run the seed function and exit with an appropriate code
seed().catch((err: Error) => {
  logger.error('[seed] Seed script failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
