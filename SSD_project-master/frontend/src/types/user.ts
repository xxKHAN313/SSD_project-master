/**
 * @fileoverview User management TypeScript interfaces.
 * Used by admin panels for listing, creating, and updating users.
 */

import { UserRole } from './auth';

// full user profile with additional detail fields for admin views
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

// payload for creating a new user via the admin api
export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

// partial update payload - only fields being changed are required
export interface UpdateUserData {
  username?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

// paginated list response when fetching all users
export interface UserListResponse {
  users: UserProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
