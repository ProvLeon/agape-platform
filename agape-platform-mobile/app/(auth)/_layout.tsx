import React from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthLayout() {
  const { authState, isLoading } = useAuth();

  console.log('Auth Layout rendering', { isLoading, isAuthenticated: authState.isAuthenticated });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#A0522D" />
        <Text style={{ marginTop: 20 }}>Loading authentication...</Text>
      </View>
    );
  }

  if (authState.isAuthenticated) {
    console.log('Auth Layout: User is authenticated, should redirect');
    // Let root layout handle redirect
  }

  console.log('Auth Layout: Showing Stack');
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
