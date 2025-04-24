import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { PrayerRequest } from '@/types';
import { getPrayerRequests, prayForRequest } from '@/services/prayerService';
import Button from '@/components/Button';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Card, { CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/Card';
import SkeletonLoader from '@/components/SkeletonLoader'; // Assuming creation

const PRAYER_QUERY_KEY = 'prayerRequests';

// Skeleton for Prayer Card
const PrayerCardSkeleton = () => (
  <Card className="mb-4 opacity-70">
    <CardHeader className="pb-2">
      <SkeletonLoader className="h-5 w-3/4 rounded mb-1.5" />
      <SkeletonLoader className="h-3 w-1/4 rounded" />
    </CardHeader>
    <CardContent>
      <SkeletonLoader className="h-3 w-full rounded mb-1" />
      <SkeletonLoader className="h-3 w-full rounded mb-1" />
      <SkeletonLoader className="h-3 w-2/3 rounded" />
    </CardContent>
    <CardFooter className="pt-3 mt-3 border-t border-border justify-end">
      <SkeletonLoader className="h-8 w-24 rounded-md" />
    </CardFooter>
  </Card>
);


// Enhanced PrayerRequest Card
const PrayerRequestCard = ({ item, onPrayPress, currentUserId, onMarkAnswered }: {
  item: PrayerRequest,
  onPrayPress: (id: string, isPraying: boolean) => void,
  currentUserId: string | null,
  onMarkAnswered: (id: string) => void,
}) => {
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const requestDate = new Date(item.created_at);
  const dateString = requestDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const isPraying = item.praying_users?.includes(currentUserId ?? '') ?? false;
  const isAuthor = item.user_id === currentUserId;

  return (
    <Card className="mb-4">
      <CardHeader className="flex-row justify-between items-start pb-2">
        <View className="flex-1 mr-2">
          <CardTitle className="text-base">
            {item.is_anonymous ? 'Anonymous Request' : `${item.user?.first_name} ${item.user?.last_name}`}
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            {dateString} {item.camp_name ? `• Camp: ${item.camp_name}` : ''}
          </CardDescription>
        </View>
        {item.status === 'answered' && (
          <View className="bg-green-100 dark:bg-green-900/50 px-2.5 py-1 rounded-full">
            <Text className="text-xs font-medium text-green-700 dark:text-green-300">Answered</Text>
          </View>
        )}
      </CardHeader>

      <CardContent className="py-2">
        <Text className="text-foreground text-sm leading-relaxed">{item.content}</Text>
      </CardContent>

      {item.status === 'answered' && item.testimony_content && (
        <View className="border-t border-border pt-3 mt-3">
          <Text className="text-sm font-semibold text-accent mb-1">Testimony:</Text>
          <Text className="text-sm text-muted-foreground italic">{item.testimony_content}</Text>
        </View>
      )}

      {item.status === 'active' && (
        <CardFooter className="pt-3 mt-3 border-t border-border flex-row justify-between items-center">
          <Text className="text-xs text-muted-foreground">{item.praying_users?.length || 0} Praying</Text>
          {isAuthor ? (
            <Button
              title="Mark Answered"
              onPress={() => onMarkAnswered(item._id)}
              variant="outline"
              size="sm"
              iconLeft='checkmark-circle-outline'
            />
          ) : (
            <Button
              title={isPraying ? 'Praying' : 'Pray'}
              onPress={() => onPrayPress(item._id, isPraying)}
              variant={isPraying ? 'secondary' : 'default'}
              size="sm"
              iconLeft={isPraying ? "checkmark-done-outline" : "heart-outline"}
            />
          )}
        </CardFooter>
      )}
    </Card>
  );
};


export default function PrayerScreen() {
  const [filter, setFilter] = useState<'active' | 'answered' | 'personal'>('active');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const currentUserId = authState.currentUser?._id ?? null;

  // Fetching logic
  const { data: prayerData, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: [PRAYER_QUERY_KEY, filter, currentUserId], // Include user ID for personal filter
    queryFn: () => {
      const params: GetPrayerRequestsParams = { per_page: 15 };
      if (filter === 'active') params.status = 'active';
      else if (filter === 'answered') params.status = 'answered';
      else if (filter === 'personal') params.personal = 'true';
      return getPrayerRequests(params);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Mutation for praying/unpraying
  const prayMutation = useMutation({
    mutationFn: ({ requestId, pray }: { requestId: string; pray: boolean }) => prayForRequest(requestId, pray),
    onMutate: async ({ requestId, pray }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [PRAYER_QUERY_KEY, filter, currentUserId] });
      // Snapshot previous value
      const previousData = queryClient.getQueryData<PrayerRequestsResponse>([PRAYER_QUERY_KEY, filter, currentUserId]);
      // Optimistically update
      queryClient.setQueryData<PrayerRequestsResponse>([PRAYER_QUERY_KEY, filter, currentUserId], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          prayer_requests: oldData.prayer_requests.map(req => {
            if (req._id === requestId && currentUserId) {
              const prayingUsers = req.praying_users || [];
              const newPrayingUsers = pray
                ? [...prayingUsers, currentUserId]
                : prayingUsers.filter(id => id !== currentUserId);
              return { ...req, praying_users: newPrayingUsers };
            }
            return req;
          }),
        };
      });
      return { previousData }; // Return context with snapshot
    },
    onError: (err, variables, context) => {
      console.error("Prayer mutation error:", err);
      Alert.alert('Error', 'Could not update prayer status.');
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData([PRAYER_QUERY_KEY, filter, currentUserId], context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: [PRAYER_QUERY_KEY, filter, currentUserId] });
    },
  });

  const handlePrayPress = (id: string, isCurrentlyPraying: boolean) => {
    prayMutation.mutate({ requestId: id, pray: !isCurrentlyPraying });
  };

  const handleMarkAnswered = (id: string) => {
    // TODO: Implement mutation/logic to mark as answered (likely involves adding testimony)
    Alert.alert("Mark as Answered", "Functionality to add testimony and mark as answered coming soon!");
  };

  const handleAddRequest = () => {
    Alert.alert("Feature", "Add prayer request functionality coming soon!");
  };

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [PRAYER_QUERY_KEY, filter, currentUserId] });
  }, [queryClient, filter, currentUserId]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const renderFilterButtons = () => (
    <View className="flex-row justify-center mb-4 px-4 gap-x-2">
      <Button title="Active" onPress={() => setFilter('active')} variant={filter === 'active' ? 'secondary' : 'ghost'} size="sm" className="flex-1" />
      <Button title="Answered" onPress={() => setFilter('answered')} variant={filter === 'answered' ? 'secondary' : 'ghost'} size="sm" className="flex-1" />
      <Button title="My Requests" onPress={() => setFilter('personal')} variant={filter === 'personal' ? 'secondary' : 'ghost'} size="sm" className="flex-1" />
    </View>
  );

  const renderContent = () => {
    if (isLoading && !prayerData) {
      return <View className="flex-1 px-4">{[...Array(5)].map((_, index) => <PrayerCardSkeleton key={index} />)}</View>;
    }
    if (error) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="cloud-offline-outline" size={48} color={colors.destructive} className="mb-4" />
          <Text className="text-center text-lg text-destructive mb-4">Failed to load prayer requests.</Text>
          <Text className="text-center text-sm text-muted-foreground mb-6">{error.message}</Text>
          <Button title="Retry" onPress={() => refetch()} iconLeft="refresh-outline" variant="secondary" />
        </View>
      );
    }
    if (!prayerData?.prayer_requests?.length) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="heart-outline" size={48} color={colors.mutedForeground} className="mb-4" />
          <Text className="text-lg text-muted-foreground">No requests found for this filter.</Text>
          {filter === 'active' && <Text className="text-sm text-muted-foreground mt-2">Share a request to get started!</Text>}
        </View>
      );
    }

    return (
      <FlatList
        data={prayerData.prayer_requests}
        renderItem={({ item }) => (
          <PrayerRequestCard
            item={item}
            onPrayPress={handlePrayPress}
            currentUserId={currentUserId}
            onMarkAnswered={handleMarkAnswered}
          />
        )}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerClassName="px-4 pb-4"
      />
    );
  }

  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Prayer Wall',
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerRight: () => (
            <TouchableOpacity onPress={handleAddRequest} className="mr-3">
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      {renderFilterButtons()}
      {renderContent()}
    </SafeAreaWrapper>
  );
}
