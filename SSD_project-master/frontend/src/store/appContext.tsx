/**
 * @fileoverview App-level context and provider.
 * Manages global UI state: toast notifications and global loading overlay.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from 'react';

// --- toast types ---

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// --- state shape ---

interface AppState {
  toasts: Toast[];
  isLoading: boolean;
}

// --- action types ---

type AppAction =
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_TOASTS' };

// --- reducer ---

const initialState: AppState = {
  toasts: [],
  isLoading: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_TOAST':
      // limit to 5 toasts visible at once to prevent screen clutter
      return {
        ...state,
        toasts: [...state.toasts.slice(-4), action.payload],
      };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'CLEAR_TOASTS':
      return { ...state, toasts: [] };

    default:
      return state;
  }
}

// --- context interface ---

interface AppContextValue extends AppState {
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  setLoading: (loading: boolean) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// --- provider ---

interface AppProviderProps {
  children: ReactNode;
}

let toastCounter = 0;

export function AppProvider({ children }: AppProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      // generate a unique id using an incrementing counter + timestamp
      const id = `toast_${++toastCounter}_${Date.now()}`;
      const toast: Toast = { id, type, message, duration };
      dispatch({ type: 'ADD_TOAST', payload: toast });

      // auto-dismiss after the specified duration
      if (duration > 0) {
        setTimeout(() => {
          dispatch({ type: 'REMOVE_TOAST', payload: id });
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const clearToasts = useCallback(() => {
    dispatch({ type: 'CLEAR_TOASTS' });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const value: AppContextValue = {
    ...state,
    addToast,
    removeToast,
    clearToasts,
    setLoading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// --- hook ---

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
