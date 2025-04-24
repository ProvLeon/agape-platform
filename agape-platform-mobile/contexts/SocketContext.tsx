import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const WS_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_WS_URL || process.env.EXPO_PUBLIC_WS_URL;

if (!WS_URL) {
  console.error("WebSocket URL is not defined. Check environment variables.");
}

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { authState: { isAuthenticated, authToken }, fetchSocketToken } = useAuth();

  const connectSocket = useCallback(async () => {
    if (!isAuthenticated || !authToken || !WS_URL) {
      console.log('Socket connection skipped: Auth state not ready or WS_URL missing.');
      return;
    }

    console.log('Attempting to fetch socket token using confirmed authToken...');
    // **** CALL MODIFIED FUNCTION ****
    const socketAuthToken = await fetchSocketToken(authToken); // Pass the confirmed token

    if (!socketAuthToken) {
      console.error('Failed to get socket token via context, cannot connect WebSocket.');
      return;
    }

    console.log('Attempting to connect WebSocket with fetched socket token...');
    const newSocket = io(WS_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      timeout: 10000,
      // Removed query token - prefer authenticate event
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setIsConnected(true);
      newSocket.emit('authenticate', { token: socketAuthToken });
    });

    // ... (other event listeners remain the same)
    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });
    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      setIsConnected(false);
    });
    newSocket.on('authenticated', (data) => {
      console.log('WebSocket authenticated successfully:', data);
    });
    newSocket.on('authentication_error', (error) => {
      console.error('WebSocket authentication failed:', error.message);
      newSocket.disconnect();
    });

    setSocket(newSocket);

    // Dependencies remain the same as they correctly reflect what triggers a connection attempt
  }, [isAuthenticated, authToken, WS_URL, fetchSocketToken]);

  const disconnectSocket = useCallback(() => {
    if (socket) {
      console.log('Disconnecting WebSocket...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);


  useEffect(() => {
    if (isAuthenticated && authToken && !socket && !isConnected) { // Added !isConnected check
      console.log("Auth state ready & disconnected, attempting socket connection...");
      connectSocket();
    } else if (!isAuthenticated && socket) {
      console.log("Auth state indicates logged out, disconnecting socket...");
      disconnectSocket();
    }

    // Cleanup logic remains the same
    return () => {
      if (!isAuthenticated && socket) {
        console.log("Cleanup effect: Disconnecting socket due to auth state change.");
        disconnectSocket();
      }
    };
  }, [isAuthenticated, authToken, socket, isConnected, connectSocket, disconnectSocket]); // Added isConnected

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
