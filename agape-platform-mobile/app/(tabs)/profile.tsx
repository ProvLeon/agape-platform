import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import Input from '@/components/Input'; // Assuming Input can be used for display or editing
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

// Simple component to display profile info item
const ProfileInfoItem = ({ label, value }: { label: string; value?: string | string[] | null }) => (
  <View className="mb-4 pb-2 border-b border-light-cardBorder dark:border-dark-cardBorder">
    <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</Text>
    <Text className="text-base text-light-text dark:text-dark-text">
      {Array.isArray(value) ? value.join(', ') : (value || 'Not set')}
    </Text>
  </View>
);

export default function ProfileScreen() {
  const { authState, logout, fetchUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light'; // Default to light if undefined
  const colors = Colors[currentScheme];

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      // AuthProvider and RootLayout should handle redirecting to login
    } catch (error: any) {
      Alert.alert('Logout Failed', error.message || 'Could not log out.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    // router.push('/profile/edit'); // Navigate to edit screen
    Alert.alert("Feature", "Edit profile functionality coming soon!");
  };

  const handleChangePassword = () => {
    // router.push('/profile/change-password'); // Navigate to change password screen
    Alert.alert("Feature", "Change password functionality coming soon!");
  };

  // Refresh user data on focus (optional but good practice)
  // useFocusEffect(
  //   useCallback(() => {
  //     fetchUser();
  //   }, [fetchUser])
  // );

  const user = authState.currentUser;

  if (!user) {
    // This shouldn't happen if routing is correct, but handle defensively
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-light-background dark:bg-dark-background">
        <Text className="text-light-text dark:text-dark-text">No user data found. Please log in.</Text>
        <Button title="Go to Login" onPress={() => router.replace('/(auth)/login')} className="mt-4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-light-background dark:bg-dark-background">
      <Stack.Screen
        options={{
          title: 'My Profile',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity onPress={handleEditProfile} style={{ marginRight: 15 }}>
              <Ionicons name="create-outline" size={26} color={colors.tint} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView className="p-6">
        {/* Profile Header */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-gray-300 dark:bg-gray-600 mb-3 items-center justify-center">
            {/* TODO: Replace with actual profile Image */}
            <Ionicons name="person" size={48} color={colors.icon} />
          </View>
          <Text className="text-2xl font-bold text-light-text dark:text-dark-text">{user.first_name} {user.last_name}</Text>
          <Text className="text-base text-gray-500 dark:text-gray-400">{user.email}</Text>
        </View>

        {/* Profile Details */}
        <ProfileInfoItem label="Role" value={user.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} />
        {/* TODO: Fetch and display camp name if user.camp_id exists */}
        <ProfileInfoItem label="Camp" value={user.camp_id ? 'Loading...' : 'Not Assigned'} />
        <ProfileInfoItem label="Phone" value={user.phone} />
        <ProfileInfoItem label="Spiritual Gifts" value={user.spiritual_gifts} />
        <ProfileInfoItem label="Joined Date" value={user.joined_date ? new Date(user.joined_date).toLocaleDateString() : 'Unknown'} />


        {/* Actions */}
        <View className="mt-8">
          <Button
            title="Change Password"
            onPress={handleChangePassword}
            variant="secondary"
            className="mb-4"
          />
          {loading ? (
            <ActivityIndicator size="large" color={colors.destructive} />
          ) : (
            <Button
              title="Logout"
              onPress={handleLogout}
              variant="destructive"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
