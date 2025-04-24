import React, { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { lightTheme, darkTheme } from '@/constants/themes';
import { useColorScheme } from '@/hooks/useColorScheme';
import "./global.css";
import { Colors } from '@/constants/Color';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

// Keep RootLayoutNav separate
function RootLayoutNav() {
  const { authState, isLoading } = useAuth();
  const { colorScheme } = useColorScheme();
  const currentScheme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[currentScheme];

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-light-background dark:bg-dark-background">
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!authState.isAuthenticated ? (
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      )}
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      <Stack.Screen name="camp/[id]" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen name="chat/[userId]" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen name="meeting/[id]" options={{ presentation: 'card', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const [fontsLoaded] = useFonts({
    SpaceMono: require('@/assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    // Apply the appropriate theme based on color scheme
    <QueryClientProvider client={queryClient}>
      <View className={`flex-1 ${colorScheme === 'dark' ? 'dark' : ''}`} style={colorScheme === 'dark' ? darkTheme : lightTheme}>
        <AuthProvider>
          <SocketProvider>
            <RootLayoutNav />
          </SocketProvider>
        </AuthProvider>
      </View>
    </QueryClientProvider>
  );
}
