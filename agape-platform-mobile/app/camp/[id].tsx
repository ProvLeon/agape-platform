import React, { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, FlatList } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Camp, User, Message, Meeting } from '@/types';
import { getCampDetails, getCampMembers } from '@/services/campService';
import { getMessages } from '@/services/messageService';
import { getMeetings } from '@/services/meetingService';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Avatar from '@/components/Avatar';
import Card, { CardHeader, CardTitle, CardContent, CardDescription } from '@/components/Card';
import ListItem from '@/components/ListItem';
import SkeletonLoader from '@/components/SkeletonLoader'; // Assuming creation

const CAMP_DETAILS_QUERY_KEY = 'campDetails';

// Skeleton Loader for the Camp Detail Screen
const CampDetailSkeleton = () => (
  <View className="p-4">
    {/* Header Skeleton */}
    <Card className="mb-6">
      <CardHeader>
        <SkeletonLoader className="h-8 w-3/4 rounded mb-2" />
        <SkeletonLoader className="h-4 w-1/2 rounded mb-3" />
        <SkeletonLoader className="h-4 w-1/3 rounded" />
      </CardHeader>
    </Card>

    {/* Sections Skeleton */}
    {[...Array(3)].map((_, index) => (
      <Card key={index} className="mb-6">
        <CardHeader>
          <SkeletonLoader className="h-6 w-1/2 rounded mb-2" />
        </CardHeader>
        <CardContent>
          <SkeletonLoader className="h-4 w-full rounded mb-2" />
          <SkeletonLoader className="h-4 w-5/6 rounded mb-2" />
          <SkeletonLoader className="h-4 w-3/4 rounded" />
        </CardContent>
      </Card>
    ))}
  </View>
);


// Sub-components for displaying items within sections
const MemberItem = ({ member }: { member: User }) => (
  <ListItem
    title={`${member.first_name} ${member.last_name}`}
    leftElement={<Avatar name={`${member.first_name} ${member.last_name}`} source={member.profile_image} size={36} />}
    bottomBorder={false} // No border within the list
    className="px-0 py-2" // Adjust padding as needed
  // Add onPress to view member profile if needed
  />
);

const CampMessageItem = ({ message }: { message: Message }) => (
  <View className="py-2 border-b border-border/50">
    <View className="flex-row items-center mb-1">
      <Avatar name={`${message.sender?.first_name} ${message.sender?.last_name}`} source={message.sender?.profile_image} size={24} className="mr-2" />
      <Text className="text-sm font-medium text-foreground">{message.sender?.first_name || 'User'} {message.sender?.last_name || ''}</Text>
      <Text className="text-xs text-muted-foreground ml-auto">{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
    </View>
    <Text className="text-sm text-foreground ml-8">{message.content}</Text>
  </View>
);

const CampMeetingItem = ({ meeting, onPress }: { meeting: Meeting, onPress: () => void }) => (
  <ListItem
    title={meeting.title}
    subtitle={new Date(meeting.scheduled_start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
    leftElement={<Ionicons name="calendar-outline" size={24} className="text-secondary" />}
    onPress={onPress}
    showChevron
    bottomBorder={false}
    className="px-0 py-2"
  />
);


export default function CampDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Fetch all camp-related data using React Query
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [CAMP_DETAILS_QUERY_KEY, id],
    queryFn: async () => {
      if (!id) throw new Error("Camp ID is required");
      // Fetch data in parallel
      const [campDetails, membersData, messagesData, meetingsData] = await Promise.all([
        getCampDetails(id),
        getCampMembers(id, { per_page: 5 }), // Limit members shown initially
        getMessages({ type: 'camp', camp_id: id, limit: 3 }), // Limit messages
        getMeetings({ camp_id: id, upcoming: 'true', limit: 3, status: 'scheduled,in_progress' }) // Limit upcoming meetings
      ]);
      return {
        camp: campDetails.camp,
        members: membersData.members,
        messages: messagesData.messages,
        meetings: meetingsData.meetings,
      };
    },
    enabled: !!id, // Only run if ID exists
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [CAMP_DETAILS_QUERY_KEY, id] });
  }, [queryClient, id]);

  // Refetch on focus
  useFocusEffect(onRefresh);

  const camp = data?.camp;
  const members = data?.members ?? [];
  const messages = data?.messages ?? [];
  const meetings = data?.meetings ?? [];


  // --- Render Logic ---
  if (isLoading && !data) {
    return <SafeAreaWrapper className="flex-1 bg-background"><CampDetailSkeleton /></SafeAreaWrapper>;
  }

  if (error) {
    return (
      <SafeAreaWrapper className="flex-1 bg-background justify-center items-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} className="mb-4" />
        <Text className="text-center text-lg text-destructive mb-4">Failed to load camp details.</Text>
        <Text className="text-center text-sm text-muted-foreground mb-6">{error.message}</Text>
        <Button title="Retry" onPress={() => refetch()} iconLeft="refresh-outline" variant="secondary" />
      </SafeAreaWrapper>
    );
  }

  if (!camp) {
    return (
      <SafeAreaWrapper className="flex-1 bg-background justify-center items-center">
        <Text className="text-lg text-muted-foreground">Camp not found.</Text>
      </SafeAreaWrapper>
    );
  }


  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: camp.name || 'Camp Details',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.primary, // Back button color
          // Add Edit button for leader/admin?
        }}
      />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerClassName="p-4"
      >
        {/* Camp Header Card */}
        <Card className="mb-6">
          <CardHeader className="items-center">
            <Avatar name={camp.name} size={80} className="mb-4" />
            <CardTitle className="text-2xl text-center">{camp.name}</CardTitle>
            {camp.description && <CardDescription className="text-center mt-1">{camp.description}</CardDescription>}
            {camp.leader && <Text className="text-sm text-muted-foreground mt-2">Leader: {camp.leader.first_name} {camp.leader.last_name}</Text>}
          </CardHeader>
          <CardContent className="pt-4 border-t border-border">
            {/* TODO: Add Join/Leave Camp button logic */}
            <Button title="Join Camp" iconLeft="add-circle-outline" variant="outline" />
          </CardContent>
        </Card>

        {/* Announcements/Messages Section */}
        <Card className="mb-6">
          <CardHeader className="flex-row justify-between items-center">
            <CardTitle>Messages</CardTitle>
            <Button title="View All" variant="link" size="sm" onPress={() => Alert.alert('TODO', 'Navigate to full camp chat')} />
          </CardHeader>
          <CardContent>
            {messages.length > 0 ? (
              messages.map(msg => <CampMessageItem key={msg._id} message={msg} />)
            ) : (
              <Text className="text-muted-foreground text-center py-4">No recent messages.</Text>
            )}
            {/* TODO: Add input to send message if permissions allow */}
          </CardContent>
        </Card>

        {/* Upcoming Meetings Section */}
        <Card className="mb-6">
          <CardHeader className="flex-row justify-between items-center">
            <CardTitle>Upcoming Meetings</CardTitle>
            <Button title="View All" variant="link" size="sm" onPress={() => router.push('/(tabs)/meetings')} /> {/* Link to main meetings tab */}
          </CardHeader>
          <CardContent>
            {meetings.length > 0 ? (
              meetings.map(meet => <CampMeetingItem key={meet._id} meeting={meet} onPress={() => router.push(`/meeting/${meet._id}`)} />)
            ) : (
              <Text className="text-muted-foreground text-center py-4">No upcoming meetings.</Text>
            )}
          </CardContent>
        </Card>

        {/* Members Section */}
        <Card className="mb-6">
          <CardHeader className="flex-row justify-between items-center">
            <CardTitle>Members ({camp.members_count ?? members.length})</CardTitle>
            {/* TODO: Link to full member list */}
            <Button title="View All" variant="link" size="sm" onPress={() => Alert.alert('TODO', 'Navigate to full member list')} />
          </CardHeader>
          <CardContent>
            {members.length > 0 ? (
              members.map(mem => <MemberItem key={mem._id} member={mem} />)
            ) : (
              <Text className="text-muted-foreground text-center py-4">No members to display.</Text>
            )}
          </CardContent>
        </Card>

      </ScrollView>
    </SafeAreaWrapper>
  );
}
