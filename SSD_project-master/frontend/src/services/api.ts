/**
 * @fileoverview Configured Axios instance for all API communication.
 * Sets base URL, credentials mode, and request/response interceptors
 * for auth token injection, 401 redirect, rate limit handling, and error formatting.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL, TOKEN_KEY } from '../config';

// create the central axios instance - all services use this
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  // send cookies (httpOnly refresh token) on every request
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  // double-submit cookie CSRF: axios reads the XSRF-TOKEN cookie set by
  // the backend and echoes it back as X-XSRF-TOKEN on every request.
  // The server rejects state-changing requests whose header does not
  // match the cookie.
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// --- request interceptor ---
// attach the access token from localStorage to every outgoing request
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// track whether a token refresh is already in progress to avoid duplicate calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

// drain the queued requests after a refresh attempt completes
function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

// --- response interceptor ---
api.interceptors.response.use(
  // success path - just pass through
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!error.response) {
      // network error - no response received from server
      return Promise.reject(
        new Error('Network error. Please check your connection.')
      );
    }

    const { status } = error.response;

    // auth endpoints themselves: a 401 here means bad credentials / invalid token
    // NOT an expired session — so do not trigger the refresh flow (which would
    // navigate away mid-request and leave the login form stuck on "loading").
    const requestUrl = originalRequest.url ?? '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');

    // handle 401 unauthorized - attempt token refresh once (skip for auth endpoints)
    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // queue the request until the ongoing refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // attempt to get a new access token using the httpOnly refresh cookie
        const refreshResponse = await api.post('/auth/refresh');
        const newToken = refreshResponse.data?.data?.accessToken as string;
        if (newToken) {
          localStorage.setItem(TOKEN_KEY, newToken);
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          }
          processQueue(null, newToken);
          isRefreshing = false;
          return api(originalRequest);
        }
        // refresh endpoint returned success but no token — treat as failure
        throw new Error('No access token returned from refresh endpoint');
      } catch (refreshError) {
        // refresh failed - clear auth state and redirect to login
        processQueue(refreshError, null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('shield_chat_user');
        isRefreshing = false;
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // handle 403 forbidden - user lacks permission for this action
    if (status === 403) {
      return Promise.reject(
        new Error('You do not have permission to perform this action.')
      );
    }

    // handle 429 rate limit - too many requests
    if (status === 429) {
      return Promise.reject(
        new Error('Too many requests. Please slow down and try again shortly.')
      );
    }

    // handle 500+ server errors with a generic message
    if (status >= 500) {
      return Promise.reject(
        new Error('Server error. Please try again later.')
      );
    }

    // extract the api's error message from the response body
    const responseData = error.response.data as {
      message?: string;
      error?: string;
    };
    const message =
      responseData?.message ||
      responseData?.error ||
      `Request failed with status ${status}`;

    return Promise.reject(new Error(message));
  }
);

export default api;
