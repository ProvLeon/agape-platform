import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Meeting } from '@/types';
import { getMeetings } from '@/services/meetingService';
import Button from '@/components/Button';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Card from '@/components/Card'; // Use Card component

// Enhanced MeetingCard Component
const MeetingCard = ({ item, onPress }: { item: Meeting, onPress: () => void }) => {
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];

  const startDate = new Date(item.scheduled_start);
  const endDate = new Date(item.scheduled_end);

  const optionsDate: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const optionsTime: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

  const formatDate = (date: Date) => date.toLocaleDateString(undefined, optionsDate);
  const formatTime = (date: Date) => date.toLocaleTimeString(undefined, optionsTime);

  // Status logic (simplified for example)
  const getStatusStyle = () => {
    switch (item.status) {
      case 'scheduled': return { text: 'Scheduled', color: 'text-blue-500 dark:text-blue-400', icon: 'time-outline' as const };
      case 'in_progress': return { text: 'In Progress', color: 'text-green-500 dark:text-green-400', icon: 'play-circle-outline' as const };
      case 'completed': return { text: 'Completed', color: 'text-muted-foreground', icon: 'checkmark-done-outline' as const };
      case 'cancelled': return { text: 'Cancelled', color: 'text-destructive', icon: 'close-circle-outline' as const };
      default: return { text: item.status, color: 'text-muted-foreground', icon: 'help-circle-outline' as const };
    }
  };
  const statusInfo = getStatusStyle();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card className="mb-4 flex-row items-center p-3">
        {/* Date Block */}
        <View className="items-center justify-center bg-primary/10 dark:bg-primary/20 rounded-lg w-16 h-16 mr-4 p-1">
          <Text className="text-sm font-bold text-primary uppercase">{startDate.toLocaleDateString(undefined, { month: 'short' })}</Text>
          <Text className="text-2xl font-extrabold text-primary">{startDate.getDate()}</Text>
          <Text className="text-xxs text-primary/80">{startDate.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
        </View>

        {/* Details */}
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground mb-1" numberOfLines={1}>{item.title}</Text>
          <View className="flex-row items-center mb-1 opacity-80">
            <Ionicons name="time-outline" size={14} color={colors.mutedForeground} className="mr-1.5" />
            <Text className="text-xs text-muted-foreground">{formatTime(startDate)} - {formatTime(endDate)}</Text>
          </View>
          {item.camp_name && (
            <View className="flex-row items-center mb-1 opacity-80">
              <Ionicons name="people-outline" size={14} color={colors.mutedForeground} className="mr-1.5" />
              <Text className="text-xs text-muted-foreground">{item.camp_name}</Text>
            </View>
          )}
          <View className="flex-row items-center mt-1">
            <Ionicons name={statusInfo.icon} size={14} className={`${statusInfo.color} mr-1.5`} />
            <Text className={`text-xs font-medium capitalize ${statusInfo.color}`}>{statusInfo.text}</Text>
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward-outline" size={22} color={colors.mutedForeground} className="opacity-70" />
      </Card>
    </TouchableOpacity>
  );
};


// Define query key
const MEETINGS_QUERY_KEY = 'meetings';

export default function MeetingsScreen() {
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming'); // Filter state
  const router = useRouter();
  const queryClient = useQueryClient();

  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];

  // Define query parameters based on filter
  const queryParams: Record<string, any> = { per_page: 20 }; // Example pagination
  if (filter === 'upcoming') {
    queryParams.upcoming = 'true';
    queryParams.status = 'scheduled,in_progress'; // Include in_progress for upcoming
  } else if (filter === 'past') {
    queryParams.status = 'completed,cancelled';
    queryParams.upcoming = 'false'; // Be explicit if backend supports
    // Add date range for past if needed
  }

  // Use TanStack Query for data fetching
  const {
    data: meetingsData,
    isLoading,
    error,
    isFetching, // Use isFetching for refresh indicator
    refetch,
  } = useQuery({
    queryKey: [MEETINGS_QUERY_KEY, filter], // Query key includes the filter
    queryFn: () => getMeetings(queryParams),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [MEETINGS_QUERY_KEY, filter] });
    // refetch(); // invalidateQueries usually triggers refetch if staleTime is exceeded or always
  }, [queryClient, filter]);

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );


  const handleMeetingPress = (id: string) => {
    router.push(`/meeting/${id}`);
  };

  const handleCreateMeeting = () => {
    Alert.alert("Feature", "Create meeting functionality coming soon!");
  };

  const renderFilterButtons = () => (
    <View className="flex-row justify-center mb-4 px-4 gap-x-3">
      <Button
        title="Upcoming"
        onPress={() => setFilter('upcoming')}
        variant={filter === 'upcoming' ? 'default' : 'outline'}
        size="sm"
        className="flex-1"
      />
      <Button
        title="Past"
        onPress={() => setFilter('past')}
        variant={filter === 'past' ? 'default' : 'outline'}
        size="sm"
        className="flex-1"
      />
    </View>
  );

  const renderContent = () => {
    if (isLoading && !meetingsData) {
      return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color={colors.primary} /></View>;
    }
    if (error) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} className="mb-4" />
          <Text className="text-center text-lg text-destructive mb-4">
            Failed to load meetings.
          </Text>
          <Text className="text-center text-sm text-muted-foreground mb-6">{error.message}</Text>
          <Button title="Retry" onPress={() => refetch()} iconLeft="refresh-outline" />
        </View>
      );
    }
    if (!meetingsData?.meetings?.length) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} className="mb-4" />
          <Text className="text-lg text-muted-foreground">No {filter} meetings found.</Text>
          {filter === 'upcoming' && (
            <Text className="text-sm text-muted-foreground text-center mt-2">Check back later or try creating a new one.</Text>
          )}
        </View>
      );
    }

    return (
      <FlatList
        data={meetingsData.meetings}
        renderItem={({ item }) => <MeetingCard item={item} onPress={() => handleMeetingPress(item._id)} />}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerClassName="px-4 pb-4" // Add padding
      />
    );
  }

  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Meetings',
          headerShown: true,
          headerLargeTitle: true, // iOS large title style
          headerShadowVisible: false, // Cleaner look
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerRight: () => (
            <TouchableOpacity onPress={handleCreateMeeting} className="mr-3">
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
