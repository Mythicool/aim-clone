import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getApiUrl } from '../utils/api';
import type { User, AuthToken } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

interface AuthContextType extends AuthState {
  login: (screenName: string, password: string) => Promise<void>;
  register: (screenName: string, password: string, email: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...initialState,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('aim_token');
    const userData = localStorage.getItem('aim_user');
    
    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
      } catch (error) {
        localStorage.removeItem('aim_token');
        localStorage.removeItem('aim_user');
      }
    }
  }, []);

  const login = async (screenName: string, password: string) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ screenName, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Login failed');
      }

      const authData: AuthToken = await response.json();
      
      // Store in localStorage
      localStorage.setItem('aim_token', authData.token);
      localStorage.setItem('aim_user', JSON.stringify(authData.user));
      
      dispatch({ 
        type: 'AUTH_SUCCESS', 
        payload: { user: authData.user, token: authData.token } 
      });
    } catch (error) {
      dispatch({ 
        type: 'AUTH_ERROR', 
        payload: error instanceof Error ? error.message : 'Login failed' 
      });
    }
  };

  const register = async (screenName: string, password: string, email: string) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const apiUrl = getApiUrl();
      console.log('Attempting registration to:', `${apiUrl}/api/auth/register`);

      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ screenName, password, email }),
      });

      console.log('Registration response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Registration error:', errorData);
        throw new Error(errorData.error?.message || 'Registration failed');
      }

      const authData: AuthToken = await response.json();
      
      // Store in localStorage
      localStorage.setItem('aim_token', authData.token);
      localStorage.setItem('aim_user', JSON.stringify(authData.user));
      
      dispatch({ 
        type: 'AUTH_SUCCESS', 
        payload: { user: authData.user, token: authData.token } 
      });
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';

      // Add more specific error messages for common issues
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('fetch')) {
        userFriendlyMessage = 'Unable to connect to server. Please check your internet connection and try again.';
      } else if (errorMessage.includes('timeout')) {
        userFriendlyMessage = 'Request timed out. The server might be starting up, please try again in a moment.';
      }

      dispatch({
        type: 'AUTH_ERROR',
        payload: userFriendlyMessage
      });
    }
  };

  const logout = () => {
    localStorage.removeItem('aim_token');
    localStorage.removeItem('aim_user');
    dispatch({ type: 'LOGOUT' });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const updateUser = (updates: Partial<User>) => {
    dispatch({ type: 'UPDATE_USER', payload: updates });
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    clearError,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}