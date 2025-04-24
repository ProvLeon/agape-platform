import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camp } from '@/types';
import { getCamps } from '@/services/campService';
import Input from '@/components/Input';
import ListItem from '@/components/ListItem';
import Avatar from '@/components/Avatar';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import SkeletonLoader from '@/components/SkeletonLoader'; // Assuming creation of this component

const CAMPS_QUERY_KEY = 'camps';

// Skeleton component for a single camp item
const CampListItemSkeleton = () => (
  <View className="flex-row items-center p-4 bg-card border-b border-border">
    <SkeletonLoader className="w-10 h-10 rounded-full mr-4" />
    <View className="flex-1">
      <SkeletonLoader className="h-4 w-3/4 rounded mb-1.5" />
      <SkeletonLoader className="h-3 w-1/2 rounded" />
    </View>
    <SkeletonLoader className="h-3 w-12 rounded" />
  </View>
);

export default function CampsScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];

  const {
    data: campsData,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [CAMPS_QUERY_KEY, searchTerm],
    queryFn: () => getCamps({ search: searchTerm, per_page: 20 }), // Add pagination limit
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [CAMPS_QUERY_KEY] });
    // No need to filter by searchTerm on manual refresh? Or keep it consistent?
    // await queryClient.invalidateQueries({ queryKey: [CAMPS_QUERY_KEY, searchTerm] });
  }, [queryClient]);

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Optional: refetch only if data is stale
      // queryClient.invalidateQueries({ queryKey: [CAMPS_QUERY_KEY, searchTerm], refetchType: 'stale' });
      refetch();
    }, [refetch])
  );

  const handleCampPress = (id: string) => {
    router.push(`/camp/${id}`);
  };

  const renderCampItem = ({ item }: { item: Camp }) => (
    <ListItem
      title={item.name}
      subtitle={item.leader ? `Leader: ${item.leader.first_name} ${item.leader.last_name}` : (item.description || 'No description')}
      leftElement={<Avatar name={item.name} size={40} />}
      rightElement={
        item.members_count !== undefined ? (
          <View className="flex-row items-center">
            <Ionicons name="people-outline" size={14} className="text-muted-foreground mr-1" />
            <Text className="text-xs text-muted-foreground">{item.members_count}</Text>
          </View>
        ) : null
      }
      onPress={() => handleCampPress(item._id)}
      showChevron
      bottomBorder // Use component prop for border
      className="bg-card" // Ensure card background
    />
  );

  const renderContent = () => {
    if (isLoading && !campsData) { // Initial load: Show Skeletons
      return (
        <View className="flex-1">
          {[...Array(8)].map((_, index) => <CampListItemSkeleton key={index} />)}
        </View>
      );
    }

    if (error) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="cloud-offline-outline" size={48} color={colors.destructive} className="mb-4" />
          <Text className="text-center text-lg text-destructive mb-4">
            Failed to load camps.
          </Text>
          <Text className="text-center text-sm text-muted-foreground mb-6">{error.message}</Text>
          <Button title="Retry" onPress={() => refetch()} iconLeft="refresh-outline" variant="secondary" />
        </View>
      );
    }

    if (!campsData?.camps?.length) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="people-circle-outline" size={48} color={colors.mutedForeground} className="mb-4" />
          <Text className="text-lg text-muted-foreground">
            {searchTerm ? `No results for "${searchTerm}"` : 'No camps found.'}
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            {searchTerm ? 'Try a different search term.' : 'Check back later or contact an admin.'}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={campsData.camps}
        renderItem={renderCampItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.background }} // Ensure container grows and has bg color
      // Add ListFooterComponent for loading more indicator if implementing pagination
      />
    );
  };

  return (
    <SafeAreaWrapper edges={['top']} className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Camps',
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          // Optional: Add Search Bar in Header
          // headerSearchBarOptions: {
          //   placeholder: "Search Camps...",
          //   onChangeText: (event) => setSearchTerm(event.nativeEvent.text),
          // },
        }}
      />
      <View className="p-4 border-b border-border">
        <Input
          placeholder="Search Camps..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          iconLeft="search-outline"
          containerClassName="mb-0" // Remove bottom margin as it's in the header padding area now
        />
      </View>
      {renderContent()}
    </SafeAreaWrapper>
  );
}
