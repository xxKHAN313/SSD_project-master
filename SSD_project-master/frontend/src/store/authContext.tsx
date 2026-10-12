/**
 * @fileoverview Authentication context and provider.
 * Manages global auth state (current user, loading) using useReducer.
 * Persists non-sensitive user data to localStorage; tokens are handled by tokenManager.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User, LoginCredentials, RegisterData } from '../types';
import authService from '../services/authService';
import { storeAccessToken, clearTokens } from '../utils/tokenManager';

// --- state shape ---

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// --- action types ---

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'CLEAR_ERROR' };

// --- reducer ---

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // start true so we can check persisted session on mount
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true, error: null };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'UPDATE_USER':
      if (!state.user) return state;
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// --- context interface ---

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// localStorage key for persisting user (non-sensitive) across refreshes
const USER_STORAGE_KEY = 'shield_chat_user';

// --- provider ---

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // on mount: restore user from localStorage and verify with backend
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem(USER_STORAGE_KEY);
        if (!stored) {
          dispatch({ type: 'AUTH_FAILURE', payload: '' });
          return;
        }

        // verify token is still valid by calling /me endpoint
        const user = await authService.getMe();
        dispatch({ type: 'AUTH_SUCCESS', payload: user });
      } catch {
        // token expired or invalid - clear everything
        localStorage.removeItem(USER_STORAGE_KEY);
        clearTokens();
        dispatch({ type: 'AUTH_FAILURE', payload: '' });
      }
    };

    restoreSession();
  }, []);

  // persist user to localStorage whenever it changes (non-sensitive data only)
  useEffect(() => {
    if (state.user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(state.user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [state.user]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const response = await authService.login(credentials);
      storeAccessToken(response.accessToken);
      dispatch({ type: 'AUTH_SUCCESS', payload: response.user });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // even if the api call fails, clear local state
    } finally {
      clearTokens();
      localStorage.removeItem(USER_STORAGE_KEY);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    dispatch({ type: 'AUTH_START' });
    try {
      await authService.register(data);
      // registration does not auto-login - user must verify then log in
      dispatch({ type: 'AUTH_FAILURE', payload: '' });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw err;
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    dispatch({ type: 'UPDATE_USER', payload: updates });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    register,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --- hook ---

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
