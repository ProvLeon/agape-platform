import React, { useEffect } from 'react';
import { Stack, SplashScreen, Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { lightTheme, darkTheme } from '@/constants/themes';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Color';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Needed for gesture handling
import { useNotifications } from '@/hooks/useNotifications'; // Import notification hook
import ErrorBoundary from '@/components/ErrorBoundary'; // Import Error Boundary
import "./global.css"; // Ensure global CSS is imported

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Centralized Navigation Logic
function RootLayoutNav() {
  const { authState, isLoading } = useAuth();
  const { colorScheme } = useColorScheme();
  const currentScheme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[currentScheme];

  useNotifications(); // Initialize notification listeners

  const [fontsLoaded, fontError] = useFonts({
    // Add custom fonts here if needed
    // 'Inter-Regular': require('@/assets/fonts/Inter-Regular.ttf'),
    // 'Poppins-Bold': require('@/assets/fonts/Poppins-Bold.ttf'),
    SpaceMono: require('@/assets/fonts/SpaceMono-Regular.ttf'), // Keep default if used
  });

  useEffect(() => {
    if (fontError) {
      console.error("Font loading error:", fontError);
      // Handle font error, maybe show a message
    }
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);


  if (isLoading || (!fontsLoaded && !fontError)) {
    // Show a themed loading screen while auth and fonts load
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  console.log("RootLayoutNav: Auth State:", { isLoading, isAuthenticated: authState.isAuthenticated });


  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Conditionally render auth or main app stacks */}
      {!authState.isAuthenticated ? (
        <Stack.Screen name="(auth)" />
      ) : (
        <Stack.Screen name="(tabs)" />
      )}

      {/* Define other screens accessible from anywhere */}
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      {/* Detail screens - Use presentation: 'card' for standard stack behavior */}
      <Stack.Screen name="camp/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="chat/[userId]" options={{ presentation: 'card' }} />
      <Stack.Screen name="meeting/[id]" options={{ presentation: 'card' }} />

      {/* Fallback for unmatched routes (optional) */}
      {/* <Stack.Screen name="+not-found" /> */}
    </Stack>
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  // Apply the global theme class and styles
  // Wrap with GestureHandlerRootView and ErrorBoundary
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <View className={`flex-1 ${colorScheme === 'dark' ? 'dark' : ''} bg-background`} style={colorScheme === 'dark' ? darkTheme : lightTheme}>
                <RootLayoutNav />
              </View>
            </GestureHandlerRootView>
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
