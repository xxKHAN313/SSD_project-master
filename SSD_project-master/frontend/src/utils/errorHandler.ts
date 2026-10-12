/**
 * @fileoverview Centralized error handling utilities.
 * Converts raw axios/network errors into user-friendly messages
 * and provides type guards for common error categories.
 */

import { AxiosError } from 'axios';

/**
 * Extract a user-friendly error message from any thrown error.
 * Handles Axios errors, standard Error instances, and unknown values.
 */
export function parseApiError(error: unknown): string {
  // axios errors with a response body
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string;
      error?: string;
    }>;

    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      if (typeof data.message === 'string' && data.message) {
        return data.message;
      }
      if (typeof data.error === 'string' && data.error) {
        return data.error;
      }
    }

    // network errors (ECONNREFUSED, timeout, etc.)
    if (axiosError.code === 'ECONNABORTED') {
      return 'Request timed out. Please check your connection and try again.';
    }
    if (axiosError.code === 'ERR_NETWORK') {
      return 'Network error. Please check your internet connection.';
    }
  }

  // standard Error instances (including our manually thrown ones in api.ts)
  if (error instanceof Error) {
    return error.message || 'An unexpected error occurred.';
  }

  // unknown type - stringify safely
  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Type guard: check if an error is an Axios error.
 */
export function isAxiosError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError: unknown }).isAxiosError === true
  );
}

/**
 * Check if the error is a 401 authentication error.
 * Used to decide whether to redirect to login.
 */
export function isAuthError(error: unknown): boolean {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    return axiosError.response?.status === 401;
  }
  return false;
}

/**
 * Check if the error is a network connectivity error (no response received).
 */
export function isNetworkError(error: unknown): boolean {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    return !axiosError.response;
  }
  // our api.ts throws standard Errors for network issues
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('network');
  }
  return false;
}

/**
 * Handle an error by showing an appropriate toast notification.
 * @param error - the caught error value
 * @param addToast - the toast function from AppContext
 */
export function handleError(
  error: unknown,
  addToast: (type: 'error' | 'warning', message: string) => void
): void {
  const message = parseApiError(error);

  // rate limit errors get a warning level toast (not a hard error)
  if (
    message.toLowerCase().includes('too many requests') ||
    message.toLowerCase().includes('rate limit')
  ) {
    addToast('warning', message);
    return;
  }

  addToast('error', message);
}
