/**
 * @fileoverview Authentication-related TypeScript interfaces.
 * Defines the shape of user data, credentials, and auth API responses.
 */

// user roles available in the system - determines access permissions
export type UserRole = 'employee' | 'manager' | 'admin';

// core user object returned from the api and stored in auth context
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: string | null;
  createdAt?: string;
}

// credentials sent to the login endpoint
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// data sent when creating a new account
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// shape of the successful auth response from login/register endpoints
export interface AuthResponse {
  user: User;
  accessToken: string;
  message?: string;
}

// data sent to the forgot-password endpoint to trigger a reset email
export interface ForgotPasswordData {
  email: string;
}

// data sent to the reset-password endpoint along with the reset token
export interface ResetPasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}
