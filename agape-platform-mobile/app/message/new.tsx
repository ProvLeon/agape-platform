import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from '@/types';
import { getUsers } from '@/services/userService';
import Input from '@/components/Input';
import ListItem from '@/components/ListItem';
import Avatar from '@/components/Avatar';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import SkeletonLoader from '@/components/SkeletonLoader';
import Button from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';

const USERS_QUERY_KEY = 'usersForNewChat';

// Skeleton Loader for User Item
const UserListItemSkeleton = () => (
  <View className="flex-row items-center p-4 bg-card border-b border-border">
    <SkeletonLoader className="w-10 h-10 rounded-full mr-3" />
    <View className="flex-1">
      <SkeletonLoader className="h-4 w-3/4 rounded mb-1.5" />
      <SkeletonLoader className="h-3 w-1/2 rounded" />
    </View>
  </View>
);

export default function NewMessageScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { authState } = useAuth(); // Get current user to filter self out
  const currentUserId = authState.currentUser?._id;
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const {
    data: usersData,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [USERS_QUERY_KEY, searchTerm],
    // Fetch users, potentially filtering by search term on backend
    queryFn: () => getUsers({ search: searchTerm, per_page: 30 }),
    staleTime: 5 * 60 * 1000, // Cache users for 5 minutes
    select: (data) => ({
      // Filter out the current user from the list
      users: data.items.filter(user => user._id !== currentUserId)
    })
  });

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY, searchTerm] });
  }, [queryClient, searchTerm]);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const handleUserSelect = (userId: string) => {
    // Navigate to the chat screen with the selected user's ID
    router.replace(`/chat/${userId}`);
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <ListItem
      title={`${item.first_name} ${item.last_name}`}
      subtitle={item.email}
      leftElement={<Avatar name={`${item.first_name} ${item.last_name}`} source={item.profile_image} size={40} />}
      onPress={() => handleUserSelect(item._id)}
      bottomBorder
      className="bg-card"
    />
  );

  const renderContent = () => {
    if (isLoading && !usersData) {
      return <View>{[...Array(10)].map((_, i) => <UserListItemSkeleton key={i} />)}</View>;
    }
    if (error) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="warning-outline" size={48} color={colors.destructive} className="mb-4" />
          <Text className="text-center text-lg text-destructive mb-4">Failed to load users.</Text>
          <Text className="text-center text-sm text-muted-foreground mb-6">{error.message}</Text>
          <Button title="Retry" onPress={() => refetch()} iconLeft="refresh-outline" variant="secondary" />
        </View>
      );
    }
    if (!usersData?.users?.length) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="people-outline" size={48} color={colors.mutedForeground} className="mb-4" />
          <Text className="text-lg text-muted-foreground">
            {searchTerm ? `No users found for "${searchTerm}"` : 'No users available.'}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={usersData.users}
        renderItem={renderUserItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  return (
    <SafeAreaWrapper edges={['top']} className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'New Chat',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.primary, // Back button color
        }}
      />
      <View className="p-4 border-b border-border">
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          iconLeft="search-outline"
          containerClassName="mb-0"
        />
      </View>
      {renderContent()}
    </SafeAreaWrapper>
  );
}
