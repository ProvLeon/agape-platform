import React from 'react';
import { Tabs, usePathname } from 'expo-router'; // Removed Redirect
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
// Removed useAuth import as it's not needed here anymore

function TabBarIcon(props: { name: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return <Ionicons size={26} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  // No need for authState or isLoading here
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];
  const pathname = usePathname();

  // The parent RootLayoutNav guarantees this layout is only rendered when authenticated.

  const hideTabBarForScreens = ['/meeting/', '/chat/', '/camp/'];
  const display = hideTabBarForScreens.some(prefix => pathname.startsWith(prefix)) ? 'none' : 'flex';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.cardBorder,
          display: display,
        },
        headerShown: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      {/* Screens remain the same */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <TabBarIcon name="chatbubbles-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="camps"
        options={{
          title: 'Camps',
          tabBarIcon: ({ color }) => <TabBarIcon name="people-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="prayer"
        options={{
          title: 'Prayer',
          tabBarIcon: ({ color }) => <TabBarIcon name="heart-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="person-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
