import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Import query hooks

import { Camp } from '@/types';
import { getCamps } from '@/services/campService';
import Input from '@/components/Input';
import ListItem from '@/components/ListItem'; // Import ListItem
import Avatar from '@/components/Avatar';   // Import Avatar
import SafeAreaWrapper from '@/components/SafeAreaWrapper'; // Import Wrapper
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

// Define a query key for camps
const CAMPS_QUERY_KEY = 'camps';

export default function CampsScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient(); // For manual refetching/invalidation

  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];

  // Use TanStack Query for data fetching
  const {
    data: campsData,
    isLoading,
    error,
    isFetching, // Use isFetching for refresh indicator
    refetch,    // Function to refetch data
  } = useQuery({
    queryKey: [CAMPS_QUERY_KEY, searchTerm], // Query key includes search term
    queryFn: () => getCamps({ search: searchTerm }), // Fetching function
    // Optional: configure staleTime, cacheTime etc.
    // staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const onRefresh = useCallback(async () => {
    // Invalidate and refetch the query
    await queryClient.invalidateQueries({ queryKey: [CAMPS_QUERY_KEY, searchTerm] });
    // refetch(); // Alternatively, call refetch directly
  }, [queryClient, searchTerm]); // Include dependencies

  const handleCampPress = (id: string) => {
    router.push(`/camp/${id}`);
  };

  const renderCampItem = ({ item }: { item: Camp }) => (
    <ListItem
      title={item.name}
      subtitle={item.leader ? `Leader: ${item.leader.first_name} ${item.leader.last_name}` : item.description || 'No description'}
      leftElement={<Avatar name={item.name} size={40} />} // Use Avatar
      rightElement={
        item.members_count !== undefined ? (
          <Text className="text-xs text-gray-500 dark:text-gray-400">{item.members_count} members</Text>
        ) : null
      }
      onPress={() => handleCampPress(item._id)}
      showChevron // Show chevron since it's pressable
    />
  );

  const renderContent = () => {
    if (isLoading && !campsData) { // Initial load
      return <ActivityIndicator size="large" color={colors.tint} className="mt-10 flex-1" />;
    }

    if (error) {
      return (
        <View className="items-center justify-center mt-10 flex-1">
          <Text className="text-destructive dark:text-destructive-dark mb-2">
            Error loading camps: {error.message}
          </Text>
          <TouchableOpacity onPress={() => refetch()} className="mt-2 p-2 bg-light-primary dark:bg-dark-primary rounded">
            <Text className="text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!campsData?.camps?.length) {
      return (
        <View className="items-center justify-center mt-10 flex-1">
          <Text className="text-gray-500 dark:text-gray-400">
            {searchTerm ? `No results for "${searchTerm}".` : 'No camps found.'}
          </Text>
        </View>
      );
    }

    // Ensure camps array exists before passing to FlatList
    const campsList = campsData?.camps ?? [];

    // Populate leader info if needed (TanStack Query data is immutable, do this in renderItem or selector)
    const campsWithLeaderDetails = campsList.map(camp => ({
      ...camp,
      // Example: If getCamps service doesn't populate leader fully, you might need a separate query or adjust the service.
      // For now, assuming leader object with names is potentially available in `camp.leader`.
    }));


    return (
      <FlatList
        data={campsWithLeaderDetails}
        renderItem={renderCampItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading} // Show refresh indicator only during background fetch
            onRefresh={onRefresh}
            tintColor={colors.tint}
          />
        }
        contentContainerStyle={{ flexGrow: 1 }} // Ensure ListEmptyComponent centers correctly
      />
    );
  };

  return (
    <SafeAreaWrapper edges={['top']}> {/* Adjust edges as needed */}
      <Stack.Screen options={{ title: 'Camps', headerShown: true }} />
      <View className="p-4 flex-1">
        <Input
          placeholder="Search Camps..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          className="mb-4"
        />
        {renderContent()}
      </View>
    </SafeAreaWrapper>
  );
}
