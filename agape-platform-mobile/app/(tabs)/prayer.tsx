import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { PrayerRequest } from '@/types'; // Adjust path
import { getPrayerRequests, prayForRequest } from '@/services/prayerService'; // Create this service
import Button from '@/components/Button'; // Assuming creation
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

// Placeholder PrayerRequestCard component
const PrayerRequestCard = ({ item, onPrayPress, currentUserId }: { item: PrayerRequest, onPrayPress: (id: string, isPraying: boolean) => void, currentUserId: string | null }) => {
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light'; // Default to light if undefined
  const colors = Colors[currentScheme];
  const requestDate = new Date(item.created_at);
  const dateString = requestDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const isPraying = item.praying_users?.includes(currentUserId ?? '') ?? false;
  const isAuthor = item.user_id === currentUserId;

  return (
    <View className="bg-light-card dark:bg-dark-card p-4 mb-3 rounded-lg shadow-sm border border-light-cardBorder dark:border-dark-cardBorder">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          {item.is_anonymous ? (
            <Text className="text-base font-semibold text-light-text dark:text-dark-text">Anonymous Request</Text>
          ) : (
            <Text className="text-base font-semibold text-light-text dark:text-dark-text">
              {item.user?.first_name} {item.user?.last_name}
            </Text>
          )}
          <Text className="text-xs text-gray-500 dark:text-gray-400">{dateString}</Text>
          {item.camp_name && <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">Camp: {item.camp_name}</Text>}
        </View>
        {item.status === 'answered' && (
          <View className="bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-medium text-green-700 dark:text-green-200">Answered</Text>
          </View>
        )}
      </View>

      <Text className="text-light-text dark:text-dark-text mb-3">{item.content}</Text>

      {item.status === 'answered' && item.testimony_content && (
        <View className="border-t border-light-cardBorder dark:border-dark-cardBorder pt-2 mt-2">
          <Text className="text-sm font-semibold text-light-text dark:text-dark-text mb-1">Testimony:</Text>
          <Text className="text-sm text-gray-700 dark:text-gray-300">{item.testimony_content}</Text>
        </View>
      )}

      {item.status === 'active' && !isAuthor && (
        <View className="flex-row justify-end items-center mt-2 border-t border-light-cardBorder dark:border-dark-cardBorder pt-2">
          <TouchableOpacity
            onPress={() => onPrayPress(item._id, isPraying)}
            className={`flex-row items-center px-3 py-1 rounded-md ${isPraying ? 'bg-light-primary/20 dark:bg-dark-primary/30' : 'bg-gray-200 dark:bg-gray-600'}`}
          >
            <Ionicons name={isPraying ? "checkmark-circle" : "heart-outline"} size={18} color={isPraying ? colors.primary : colors.text} />
            <Text className={`ml-1.5 text-sm font-medium ${isPraying ? 'text-light-primary dark:text-dark-primary' : 'text-light-text dark:text-dark-text'}`}>
              {isPraying ? 'Praying' : 'Pray'}
            </Text>
          </TouchableOpacity>
          <Text className="text-xs text-gray-500 dark:text-gray-400 ml-3">{item.praying_users?.length || 0} Praying</Text>
        </View>
      )}
      {item.status === 'active' && isAuthor && (
        <View className="flex-row justify-end items-center mt-2 border-t border-light-cardBorder dark:border-dark-cardBorder pt-2">
          <Text className="text-xs text-gray-500 dark:text-gray-400">{item.praying_users?.length || 0} Praying</Text>
          {/* TODO: Add 'Mark as Answered' button */}
        </View>
      )}
    </View>
  );
};


export default function PrayerScreen() {
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'answered' | 'personal'>('active');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { authState } = useAuth();
  const { colorScheme: nwColorScheme } = useColorScheme();
  const colorScheme = nwColorScheme ?? 'light';
  const colors = Colors[colorScheme];

  const fetchRequests = useCallback(async (currentFilter: typeof filter) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {};
      if (currentFilter === 'active') {
        params.status = 'active';
      } else if (currentFilter === 'answered') {
        params.status = 'answered'; // Or is_testimony=true depending on backend
      } else if (currentFilter === 'personal') {
        params.personal = 'true';
      }

      // TODO: Implement pagination
      const response = await getPrayerRequests(params);
      setRequests(response.prayer_requests);
    } catch (err: any) {
      console.error("Failed to fetch prayer requests:", err);
      setError(err.message || 'Failed to load prayer requests.');
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(filter);
  }, [fetchRequests, filter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests(filter);
  }, [fetchRequests, filter]);

  const handlePrayPress = async (id: string, isCurrentlyPraying: boolean) => {
    // Optimistic UI Update
    setRequests(prevRequests =>
      prevRequests.map(req => {
        if (req._id === id) {
          const currentUserId = authState.currentUser?._id;
          let newPrayingUsers = [...(req.praying_users || [])];
          if (isCurrentlyPraying) {
            newPrayingUsers = newPrayingUsers.filter(userId => userId !== currentUserId);
          } else if (currentUserId && !newPrayingUsers.includes(currentUserId)) {
            newPrayingUsers.push(currentUserId);
          }
          return { ...req, praying_users: newPrayingUsers, is_praying: !isCurrentlyPraying };
        }
        return req;
      })
    );

    try {
      await prayForRequest(id, !isCurrentlyPraying); // Send request to backend
      // Optional: Refetch data after success if optimistic update isn't enough
      // fetchRequests(filter);
    } catch (error) {
      console.error('Failed to update prayer status:', error);
      Alert.alert('Error', 'Could not update prayer status.');
      // Revert Optimistic UI Update on failure
      setRequests(prevRequests =>
        prevRequests.map(req => {
          if (req._id === id) {
            const currentUserId = authState.currentUser?._id;
            let originalPrayingUsers = [...(req.praying_users || [])];
            // This revert logic needs careful handling if multiple users are involved
            // Simplified revert:
            if (!isCurrentlyPraying) { // If we added them optimistically, remove
              originalPrayingUsers = originalPrayingUsers.filter(userId => userId !== currentUserId);
            } else if (currentUserId) { // If we removed them optimistically, add back
              originalPrayingUsers.push(currentUserId);
            }
            return { ...req, praying_users: originalPrayingUsers, is_praying: isCurrentlyPraying };
          }
          return req;
        })
      );
    }
  };

  const handleAddRequest = () => {
    // router.push('/prayer/new'); // Navigate to a create prayer request screen
    Alert.alert("Feature", "Add prayer request functionality coming soon!");
  };

  const renderFilterButtons = () => (
    <View className="flex-row justify-around mb-4 px-2">
      <Button
        title="Active"
        onPress={() => setFilter('active')}
        variant={filter === 'active' ? 'default' : 'outline'}
        size="sm"
        className="flex-1 mx-1"
      />
      <Button
        title="Answered"
        onPress={() => setFilter('answered')}
        variant={filter === 'answered' ? 'default' : 'outline'}
        size="sm"
        className="flex-1 mx-1"
      />
      <Button
        title="My Requests"
        onPress={() => setFilter('personal')}
        variant={filter === 'personal' ? 'default' : 'outline'}
        size="sm"
        className="flex-1 mx-1"
      />
    </View>
  );


  return (
    <SafeAreaView className="flex-1 bg-light-background dark:bg-dark-background">
      <Stack.Screen
        options={{
          title: 'Prayer Wall',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity onPress={handleAddRequest} style={{ marginRight: 15 }}>
              <Ionicons name="add-circle-outline" size={28} color={colors.tint} />
            </TouchableOpacity>
          ),
        }}
      />

      {renderFilterButtons()}

      <View className="flex-1 px-4">
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.tint} className="mt-10" />
        ) : error ? (
          <View className="items-center justify-center mt-10">
            <Text className="text-destructive dark:text-destructive-dark">{error}</Text>
            <TouchableOpacity onPress={() => fetchRequests(filter)} className="mt-2 p-2 bg-light-primary dark:bg-dark-primary rounded">
              <Text className="text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : requests.length === 0 ? (
          <View className="items-center justify-center flex-1">
            <Text className="text-gray-500 dark:text-gray-400">No prayer requests found for this filter.</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            renderItem={({ item }) => (
              <PrayerRequestCard
                item={item}
                onPrayPress={handlePrayPress}
                currentUserId={authState.currentUser?._id ?? null}
              />
            )}
            keyExtractor={(item) => item._id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
