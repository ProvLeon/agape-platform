import React, { createContext, useState, useEffect, useContext, useMemo, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/types'; // Adjust path
import api from '@/services/api';
import { login as loginApi, register as registerApi, fetchCurrentUser, getSocketToken } from '@/services/authService';
import { LoginCredentials, RegisterData } from '@/types'; // Adjust path

interface AuthState {
  authToken: string | null;
  socketToken: string | null;
  currentUser: User | null;
  isAuthenticated: boolean;
}

interface AuthContextType {
  authState: AuthState;
  isLoading: boolean; // Add loading state
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>; // Function to manually refresh user data
  fetchSocketToken: () => Promise<string | null>; // Expose socket token fetching
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
          // Set up API with token
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          try {
            const user = await fetchCurrentUser();
            if (user) {
              console.log("AuthProvider: User fetched successfully:", user.email);
              try {
                const sockToken = await getSocketToken();
                console.log("AuthProvider: Socket token fetched:", !!sockToken);

                setAuthState({
                  authToken: token,
                  socketToken: sockToken,
                  currentUser: user,
                  isAuthenticated: true,
                });
              } catch (socketErr) {
                console.error("AuthProvider: Failed to get socket token:", socketErr);
                // Still proceed with auth, socket token can be gotten later
                setAuthState({
                  authToken: token,
                  socketToken: null,
                  currentUser: user,
                  isAuthenticated: true,
                });
              }
            } else {
              console.log("AuthProvider: User fetch returned null, clearing token");
              await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
              delete api.defaults.headers.common['Authorization'];
              setAuthState({ authToken: null, socketToken: null, currentUser: null, isAuthenticated: false });
            }
          } catch (userErr) {
            console.error("AuthProvider: Failed to fetch user:", userErr);
            // Handle invalid token
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

  const handleLoginSuccess = async (token: string, user: User) => {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const sockToken = await getSocketToken(); // Fetch socket token on login
    setAuthState({
      authToken: token,
      socketToken: sockToken,
      currentUser: user,
      isAuthenticated: true,
    });
    setIsLoading(false); // Ensure loading is false after login
  }

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      delete api.defaults.headers.common['Authorization'];
      setAuthState({ authToken: null, socketToken: null, currentUser: null, isAuthenticated: false });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const { access_token, user } = await loginApi(credentials);
      await handleLoginSuccess(access_token, user);
    } catch (error) {
      setIsLoading(false); // Ensure loading is false on error
      console.error("Login context error:", error);
      throw error; // Re-throw for UI handling
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      // Registration doesn't usually log the user in automatically
      // Adjust based on backend behavior if it returns a token
      await registerApi(data);
      // Optionally automatically log in after registration:
      // const { access_token, user } = await loginApi({ email: data.email, password: data.password });
      // await handleLoginSuccess(access_token, user);
    } catch (error) {
      console.error("Register context error:", error);
      throw error; // Re-throw for UI handling
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await handleLogout();
  };

  const fetchUser = async () => {
    if (!authState.authToken) return; // Don't fetch if no token
    setIsLoading(true);
    try {
      const user = await fetchCurrentUser();
      if (user) {
        setAuthState(prev => ({ ...prev, currentUser: user }));
      } else {
        // Fetch failed, likely invalid token, logout
        await handleLogout();
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      // Potentially logout on specific errors
      await handleLogout();
    } finally {
      setIsLoading(false);
    }
  }

  const fetchSocketToken = async (): Promise<string | null> => {
    if (!authState.isAuthenticated || !authState.authToken) {
      console.warn("Cannot fetch socket token without being authenticated.");
      return null;
    }
    setIsLoading(true);
    try {
      const sockToken = await getSocketToken();
      setAuthState(prev => ({ ...prev, socketToken: sockToken }));
      return sockToken;
    } catch (error) {
      console.error("Failed to fetch socket token in context:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    authState,
    isLoading,
    login,
    register,
    logout,
    fetchUser,
    fetchSocketToken,
  }), [authState, isLoading]); // Dependencies for useMemo

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
