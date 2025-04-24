import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router'; // Removed useFocusEffect
import { useAuth } from '@/contexts/AuthContext'; // Use for logout/auth status
import { useCurrentUser, CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'; // Import the new hook
import Button from '@/components/Button';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Avatar from '@/components/Avatar';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/Card';
import { useQueryClient } from '@tanstack/react-query';
import SkeletonLoader from '@/components/SkeletonLoader';

// Reusable Info Row Component
const ProfileInfoRow = ({ label, value, iconName }: { label: string; value?: string | string[] | null; iconName?: React.ComponentProps<typeof Ionicons>['name'] }) => {
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const displayValue = Array.isArray(value) ? value.join(', ') : (value || 'N/A');

  return (
    <View className="flex-row items-center mb-3 pb-3 border-b border-border/50">
      {iconName && <Ionicons name={iconName} size={20} color={colors.mutedForeground} className="mr-3 w-5" />}
      <View className="flex-1">
        <Text className="text-xs text-muted-foreground mb-0.5">{label}</Text>
        <Text className="text-base text-foreground">{displayValue}</Text>
      </View>
    </View>
  );
};

const ProfileSkeleton = () => (
  <View className="p-4">
    <View className="items-center mb-8 pt-4">
      <SkeletonLoader className="w-[100px] h-[100px] rounded-full mb-4" />
      <SkeletonLoader className="h-7 w-2/3 rounded mb-2" />
      <SkeletonLoader className="h-5 w-1/2 rounded" />
    </View>
    <Card className="mb-6">
      <CardHeader><SkeletonLoader className="h-6 w-1/4 rounded" /></CardHeader>
      <CardContent>
        {[...Array(5)].map((_, i) => <SkeletonLoader key={i} className="h-10 w-full rounded mb-3" />)}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><SkeletonLoader className="h-6 w-1/3 rounded" /></CardHeader>
      <CardContent>
        <SkeletonLoader className="h-10 w-full rounded mb-4" />
        <SkeletonLoader className="h-10 w-full rounded" />
      </CardContent>
    </Card>
  </View>
);


export default function ProfileScreen() {
  // Use useAuth only for actions and basic auth status
  const { authState, logout } = useAuth();
  // Use useCurrentUser for the user data itself
  const { data: user, isLoading: isUserLoading, error: userError, refetch: refetchUser, isFetching: isUserFetching } = useCurrentUser();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient(); // Get query client
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleLogout = async () => {
    Alert.alert("Confirm Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", style: "destructive",
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
            // Invalidate user query on logout
            await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
            // Root layout handles redirect
          } catch (error: any) { Alert.alert('Logout Failed', error.message); }
          finally { setIsLoggingOut(false); }
        },
      },
    ]);
  };

  const handleEditProfile = () => { /* ... */ };
  const handleChangePassword = () => { /* ... */ };

  // Manual refresh using react-query's refetch
  const onRefresh = useCallback(async () => {
    console.log("ProfileScreen: Manual refresh triggered.");
    try {
      await refetchUser(); // Trigger react-query refetch
    } catch (error) {
      console.error("Failed to refresh profile via RQ:", error);
      Alert.alert("Refresh Failed", "Could not update profile data.");
    }
  }, [refetchUser]);


  // --- Render Logic ---

  if (isUserLoading && !user) { // Show skeleton on initial load
    return (
      <SafeAreaWrapper className="flex-1 bg-background">
        <ProfileSkeleton />
      </SafeAreaWrapper>
    );
  }

  if (userError || !user) { // Handle error or case where user is null after loading (e.g., auth invalid)
    return (
      <SafeAreaWrapper className="flex-1 bg-background justify-center items-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} className="mb-4" />
        <Text className="text-center text-lg text-destructive mb-4">
          {userError ? 'Failed to load profile.' : 'User not found.'}
        </Text>
        {userError && <Text className="text-center text-sm text-muted-foreground mb-6">{userError.message}</Text>}
        <Button title="Retry" onPress={() => refetchUser()} iconLeft="refresh-outline" variant="secondary" />
        <Button title="Logout" onPress={handleLogout} variant="destructive" className="mt-4" />
      </SafeAreaWrapper>
    );
  }

  // --- Display user data ---
  const roleFormatted = user.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  const joinedDateFormatted = user.joined_date ? new Date(user.joined_date).toLocaleDateString() : 'Unknown';

  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'My Profile',
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerRight: () => (
            <TouchableOpacity onPress={handleEditProfile} className="mr-3">
              <Ionicons name="create-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        className="flex-1"
        refreshControl={
          // Use RQ's isFetching for the refresh control state
          <RefreshControl refreshing={isUserFetching && !isUserLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerClassName="p-4 pb-8"
      >
        {/* ... (Profile Header and Cards using `user` data as before) ... */}
        <View className="items-center mb-8 pt-4">
          <Avatar source={user.profile_image} name={`${user.first_name} ${user.last_name}`} size={100} className="mb-4 border-2 border-primary/50" />
          <Text className="text-2xl font-bold text-foreground">{user.first_name} {user.last_name}</Text>
          <Text className="text-base text-muted-foreground">{user.email}</Text>
        </View>

        <Card className="mb-6">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <ProfileInfoRow label="Role" value={roleFormatted} iconName="shield-checkmark-outline" />
            {/* TODO: Fetch camp name separately if needed, maybe another query */}
            <ProfileInfoRow label="Camp" value={user.camp_id ? 'Camp ID: ' + user.camp_id : 'Not Assigned'} iconName="people-outline" />
            <ProfileInfoRow label="Phone" value={user.phone} iconName="call-outline" />
            <ProfileInfoRow label="Joined Date" value={joinedDateFormatted} iconName="calendar-outline" />
            <ProfileInfoRow label="Spiritual Gifts" value={user.spiritual_gifts} iconName="sparkles-outline" />
            <View className="flex-row items-center pt-3">
              <Ionicons name="log-in-outline" size={20} color={colors.mutedForeground} className="mr-3 w-5" />
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-0.5">Last Login</Text>
                <Text className="text-base text-foreground">{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account Actions</CardTitle></CardHeader>
          <CardContent>
            <Button title="Change Password" onPress={handleChangePassword} variant="outline" iconLeft="key-outline" className="mb-4 w-full" />
            <Button title="Logout" onPress={handleLogout} variant="destructive" iconLeft="log-out-outline" isLoading={isLoggingOut} disabled={isLoggingOut} className="w-full" />
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaWrapper>
  );
}
