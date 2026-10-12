/**
 * @fileoverview User management API service.
 * Wraps all admin user management endpoints: CRUD, role assignment, activation/deactivation.
 */

import api from './api';
import {
  UserProfile,
  CreateUserData,
  UpdateUserData,
  UserListResponse,
  UserRole,
} from '../types';
import { PaginationParams } from '../types/api';

const userService = {
  /**
   * Fetch a paginated list of all users. Admin only.
   * Backend returns { success: true, data: { users, total, page, totalPages } }
   */
  async getAllUsers(
    params?: PaginationParams & { role?: UserRole; isActive?: boolean }
  ): Promise<UserListResponse> {
    const response = await api.get<{
      success: boolean;
      data: { users: UserProfile[]; total: number; page: number; totalPages: number };
    }>('/users', { params });
    const { users, total, page, totalPages } = response.data.data;
    return {
      users,
      total,
      page,
      limit: params?.limit ?? 20,
      totalPages,
    };
  },

  /**
   * Fetch a single user's profile by id. Admin only.
   * Backend returns { success: true, data: { user: UserProfile } }
   */
  async getUserById(id: string): Promise<UserProfile> {
    const response = await api.get<{ success: boolean; data: { user: UserProfile } }>(
      `/users/${id}`
    );
    return response.data.data.user as UserProfile;
  },

  /**
   * Create a new user account. Admin only.
   * Backend returns { success: true, data: { user: UserProfile } }
   */
  async createUser(data: CreateUserData): Promise<UserProfile> {
    const response = await api.post<{ success: boolean; data: { user: UserProfile } }>(
      '/users',
      data
    );
    return response.data.data.user as UserProfile;
  },

  /**
   * Update a user's profile fields. Admin only.
   * Backend returns { success: true, data: { user: UserProfile } }
   */
  async updateUser(id: string, data: UpdateUserData): Promise<UserProfile> {
    const response = await api.put<{ success: boolean; data: { user: UserProfile } }>(
      `/users/${id}`,
      data
    );
    return response.data.data.user as UserProfile;
  },

  /**
   * Delete a user account permanently. Admin only.
   */
  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  /**
   * Change a user's role. Admin only.
   * Backend uses PUT /users/:id/role
   * Returns { success: true, data: { user: UserProfile } }
   */
  async assignRole(
    id: string,
    role: UserRole,
    reason?: string
  ): Promise<UserProfile> {
    const response = await api.put<{ success: boolean; data: { user: UserProfile } }>(
      `/users/${id}/role`,
      { role, reason }
    );
    return response.data.data.user as UserProfile;
  },

  /**
   * Activate a deactivated user account. Admin only.
   * Backend uses PUT /users/:id/activate
   * Returns { success: true, data: { user: UserProfile } }
   */
  async activateUser(id: string): Promise<UserProfile> {
    const response = await api.put<{ success: boolean; data: { user: UserProfile } }>(
      `/users/${id}/activate`
    );
    return response.data.data.user as UserProfile;
  },

  /**
   * Deactivate a user account without deleting it. Admin only.
   * Backend uses PUT /users/:id/deactivate
   * Returns { success: true, data: { user: UserProfile } }
   */
  async deactivateUser(id: string): Promise<UserProfile> {
    const response = await api.put<{ success: boolean; data: { user: UserProfile } }>(
      `/users/${id}/deactivate`
    );
    return response.data.data.user as UserProfile;
  },
};

export default userService;
