/**
 * @fileoverview Authentication API service.
 * Wraps all auth-related endpoints: login, register, logout, password reset, and session verification.
 */

import api from './api';
import { LoginCredentials, RegisterData, AuthResponse, User } from '../types';

const authService = {
  /**
   * Log in with email/username and password.
   * Returns the user object and access token on success.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<{ success: boolean; data: AuthResponse }>(
      '/auth/login',
      credentials
    );
    return response.data.data as AuthResponse;
  },

  /**
   * Register a new user account.
   * The backend will create the user with the 'employee' role by default.
   */
  async register(data: RegisterData): Promise<{ message: string }> {
    const response = await api.post<{
      success: boolean;
      data: { message: string };
    }>('/auth/register', data);
    return response.data.data as { message: string };
  },

  /**
   * Log out the current user.
   * Clears the httpOnly refresh cookie on the server side.
   */
  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  /**
   * Request a password reset email for the given address.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post<{
      success: boolean;
      data: { message: string };
    }>('/auth/forgot-password', { email });
    return response.data.data as { message: string };
  },

  /**
   * Complete the password reset using the token from the reset email.
   */
  async resetPassword(
    token: string,
    password: string,
    confirmPassword: string
  ): Promise<{ message: string }> {
    const response = await api.post<{
      success: boolean;
      data: { message: string };
    }>('/auth/reset-password', { token, newPassword: password, confirmPassword });
    return response.data.data as { message: string };
  },

  /**
   * Change the current user's password.
   * Requires re-authentication with the current password.
   * On success the server revokes all sessions — callers should log the user out locally.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const response = await api.post<{
      success: boolean;
      message: string;
    }>('/auth/change-password', { currentPassword, newPassword });
    return { message: response.data.message };
  },

  /**
   * Attempt to get a new access token using the stored httpOnly refresh cookie.
   * Called automatically by the axios interceptor on 401 responses.
   */
  async refreshToken(): Promise<{ accessToken: string }> {
    const response = await api.post<{
      success: boolean;
      data: { accessToken: string };
    }>('/auth/refresh');
    return response.data.data as { accessToken: string };
  },

  /**
   * Fetch the currently authenticated user's profile.
   * Used on app load to verify the stored token is still valid.
   * Backend returns { success: true, data: { user: User } }
   */
  async getMe(): Promise<User> {
    const response = await api.get<{ success: boolean; data: { user: User } }>(
      '/auth/me'
    );
    return response.data.data.user as User;
  },
};

export default authService;
