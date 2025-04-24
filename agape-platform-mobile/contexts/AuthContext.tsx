import React, { createContext, useState, useEffect, useContext, useMemo, ReactNode, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/types';
import api from '@/services/api';
import { login as loginApi, register as registerApi, fetchCurrentUser, getSocketToken as getSocketTokenApi } from '@/services/authService'; // Renamed import
import { LoginCredentials, RegisterData } from '@/types';

interface AuthState {
  authToken: string | null;
  socketToken: string | null;
  currentUser: User | null;
  isAuthenticated: boolean;
}

interface AuthContextType {
  authState: AuthState;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  // **** MODIFIED SIGNATURE ****
  fetchSocketToken: (currentAuthToken: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'authToken';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    authToken: null,
    socketToken: null,
    currentUser: null,
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load token and user data on mount
  useEffect(() => {
    const loadAuthData = async () => {
      console.log("AuthProvider: Loading auth data...");
      setIsLoading(true);
      try {
        const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        console.log("AuthProvider: Token found?", !!token);

        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          try {
            const user = await fetchCurrentUser();
            if (user) {
              console.log("AuthProvider: User fetched successfully:", user.email);
              let sockToken = null;
              try {
                // Fetch socket token right after user load if token exists
                sockToken = await getSocketTokenApi(); // Use imported service directly
                console.log("AuthProvider: Socket token fetched on load:", !!sockToken);
              } catch (socketErr) {
                console.error("AuthProvider: Failed to get socket token on load:", socketErr);
              }
              setAuthState({ // Set all state together
                authToken: token,
                socketToken: sockToken,
                currentUser: user,
                isAuthenticated: true,
              });
            } else {
              console.log("AuthProvider: User fetch returned null, clearing token");
              await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
              delete api.defaults.headers.common['Authorization'];
              setAuthState({ authToken: null, socketToken: null, currentUser: null, isAuthenticated: false });
            }
          } catch (userErr) {
            console.error("AuthProvider: Failed to fetch user:", userErr);
            await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
            delete api.defaults.headers.common['Authorization'];
            setAuthState({ authToken: null, socketToken: null, currentUser: null, isAuthenticated: false });
          }
        } else {
          console.log("AuthProvider: No token found, setting unauthenticated state");
          setAuthState({ authToken: null, socketToken: null, currentUser: null, isAuthenticated: false });
        }
      } catch (error) {
        console.error("AuthProvider: Failed to load auth data:", error);
        setAuthState({ authToken: null, socketToken: null, currentUser: null, isAuthenticated: false });
      } finally {
        console.log("AuthProvider: Finished loading auth data");
        setIsLoading(false);
      }
    };
    loadAuthData();
  }, []);

  // --- Memoized Helper Functions ---
  const handleLoginSuccess = useCallback(async (token: string, user: User) => {
    console.log("handleLoginSuccess running...");
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    let sockToken = null;
    try {
      sockToken = await getSocketTokenApi(); // Use service directly
    } catch (sockErr) {
      console.error("Failed to get socket token during login:", sockErr);
    }
    setAuthState({
      authToken: token,
      socketToken: sockToken,
      currentUser: user,
      isAuthenticated: true,
    });
    setIsLoading(false);
  }, []);

  const handleLogout = useCallback(async () => {
    console.log("handleLogout running...");
    setIsLoading(true);
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      delete api.defaults.headers.common['Authorization'];
      setAuthState({ authToken: null, socketToken: null, currentUser: null, isAuthenticated: false });
    } catch (error) {
      console.error("Logout failed:", error);
      setAuthState(prev => ({ ...prev, isAuthenticated: false }));
    } finally {
      setIsLoading(false);
    }
  }, []);


  // --- Memoized Context Functions ---
  const login = useCallback(async (credentials: LoginCredentials) => {
    console.log("Context login running...");
    setIsLoading(true);
    try {
      const { access_token, user } = await loginApi(credentials);
      await handleLoginSuccess(access_token, user);
    } catch (error) {
      setIsLoading(false);
      console.error("Login context error:", error);
      throw error;
    }
  }, [handleLoginSuccess]);

  const register = useCallback(async (data: RegisterData) => {
    console.log("Context register running...");
    setIsLoading(true);
    try {
      await registerApi(data);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      console.error("Register context error:", error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    console.log("Context logout running...");
    await handleLogout();
  }, [handleLogout]);

  const fetchUser = useCallback(async () => {
    console.log("Context fetchUser running...");
    const tokenFromStorage = await SecureStore.getItemAsync(AUTH_TOKEN_KEY); // Re-read token
    if (!tokenFromStorage) {
      console.log("fetchUser skipped: No auth token in storage");
      if (authState.isAuthenticated) await handleLogout(); // Logout if state is inconsistent
      return;
    }
    // Ensure API header is set (might be cleared on error elsewhere)
    api.defaults.headers.common['Authorization'] = `Bearer ${tokenFromStorage}`;

    setIsLoading(true);
    try {
      const user = await fetchCurrentUser();
      if (user) {
        console.log("fetchUser successful, updating user state.");
        // Fetch socket token again if needed after user fetch
        let sockToken = authState.socketToken; // Keep existing if present
        if (!sockToken) {
          try {
            sockToken = await getSocketTokenApi();
          } catch (e) { console.error("Error fetching socket token in fetchUser", e) }
        }
        setAuthState({ // Set all relevant state
          authToken: tokenFromStorage,
          socketToken: sockToken,
          currentUser: user,
          isAuthenticated: true
        });
      } else {
        console.log("fetchUser returned null, logging out.");
        await handleLogout();
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      await handleLogout();
    } finally {
      setIsLoading(false);
    }
  }, [handleLogout, authState.isAuthenticated, authState.socketToken]); // Add relevant state checks

  // **** MODIFIED FUNCTION ****
  const fetchSocketToken = useCallback(async (currentAuthToken: string): Promise<string | null> => {
    // Caller must ensure currentAuthToken is valid and user is authenticated
    console.log("Context fetchSocketToken running (token provided)...");

    if (!currentAuthToken) {
      console.error("fetchSocketToken called without providing an auth token!");
      return null;
    }

    // Ensure API header is set correctly before the call
    api.defaults.headers.common['Authorization'] = `Bearer ${currentAuthToken}`;

    setIsLoading(true);
    try {
      const sockToken = await getSocketTokenApi(); // Use service directly
      console.log("Socket token fetched successfully via context function:", !!sockToken);
      // Update state - critical to ensure this update happens
      setAuthState(prev => ({ ...prev, socketToken: sockToken }));
      return sockToken;
    } catch (error) {
      console.error("Failed to fetch socket token in context function:", error);
      // Clear potentially invalid header if the request failed due to auth
      if ((error as any)?.response?.status === 401) {
        delete api.defaults.headers.common['Authorization'];
        await handleLogout(); // Log out if token is invalid
      }
      return null;
    } finally {
      setIsLoading(false);
    }
    // Depend on handleLogout to ensure it's available for error handling
  }, [handleLogout]);

  // Memoize context value
  const value = useMemo(() => ({
    authState,
    isLoading,
    login,
    register,
    logout,
    fetchUser,
    fetchSocketToken,
  }), [authState, isLoading, login, register, logout, fetchUser, fetchSocketToken]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
