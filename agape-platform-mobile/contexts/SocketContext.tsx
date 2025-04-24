import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  // Add functions to emit events or subscribe if needed centrally
  // Example: sendMessage: (event: string, data: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const WS_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_WS_URL || process.env.EXPO_PUBLIC_WS_URL;

if (!WS_URL) {
  console.error("WebSocket URL is not defined. Check environment variables.");
}


export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { authState, fetchSocketToken } = useAuth(); // Get auth state and token fetcher

  const connectSocket = useCallback(async () => {
    if (!authState.isAuthenticated || !WS_URL) {
      console.log('Socket connection skipped: Not authenticated or WS_URL missing.');
      return;
    }

    // Fetch a short-lived token specifically for the socket connection
    const socketAuthToken = await fetchSocketToken();

    if (!socketAuthToken) {
      console.error('Failed to get socket token, cannot connect WebSocket.');
      return;
    }

    console.log('Attempting to connect WebSocket...');
    const newSocket = io(WS_URL, {
      transports: ['websocket'],
      // Removed query token - prefer authenticate event
      // query: { token: authState.authToken }, // Use the main JWT or a dedicated socket token
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setIsConnected(true);
      // Emit authentication event AFTER connection
      newSocket.emit('authenticate', { token: socketAuthToken });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      // Handle reconnection logic if needed, or rely on socket.io's attempts
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      setIsConnected(false);
    });

    newSocket.on('authenticated', (data) => {
      console.log('WebSocket authenticated successfully:', data);
      // Handle successful authentication, maybe update user status/data
    });

    newSocket.on('authentication_error', (error) => {
      console.error('WebSocket authentication failed:', error.message);
      // Handle auth error, maybe disconnect or logout
      newSocket.disconnect();
    });


    setSocket(newSocket);

  }, [authState.isAuthenticated, WS_URL, fetchSocketToken]); // Depend on auth state and fetcher

  const disconnectSocket = useCallback(() => {
    if (socket) {
      console.log('Disconnecting WebSocket...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);


  useEffect(() => {
    if (authState.isAuthenticated && !socket) {
      connectSocket();
    } else if (!authState.isAuthenticated && socket) {
      disconnectSocket();
    }

    // Cleanup on component unmount or when auth state changes to false
    return () => {
      if (socket) {
        disconnectSocket();
      }
    };
  }, [authState.isAuthenticated, socket, connectSocket, disconnectSocket]); // Add dependencies

  const value = { socket, isConnected };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
