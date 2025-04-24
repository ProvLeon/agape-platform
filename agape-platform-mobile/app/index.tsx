import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { authState, isLoading } = useAuth();

  // If still loading auth state, don't redirect yet - show nothing
  if (isLoading) {
    console.log('Loading auth state...');
    return null;
  }

  // Use Redirect component instead of programmatic navigation
  // This is safer for initial routing
  if (authState.isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}
