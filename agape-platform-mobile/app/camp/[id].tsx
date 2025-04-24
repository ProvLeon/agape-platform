import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Camp, User, Message, Meeting } from '@/types'; // Adjust path
import { getCampDetails, getCampMembers } from '@/services/campService'; // Create this service
import { getMessages } from '@/services/messageService'; // Reuse or create specific service
import { getMeetings } from '@/services/meetingService'; // Reuse or create specific service
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/Button';

// Placeholder components for Members, Messages, Meetings lists
const MemberItem = ({ member }: { member: User }) => (
  <View className="flex-row items-center p-2 border-b border-light-cardBorder dark:border-dark-cardBorder">
    {/* Placeholder Image */}
    <View className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 mr-3 items-center justify-center">
      <Ionicons name="person" size={16} color="#fff" />
    </View>
    <Text className="text-light-text dark:text-dark-text">{member.first_name} {member.last_name}</Text>
    {/* Optionally add role/leader indicator */}
  </View>
);

const CampMessageItem = ({ message }: { message: Message }) => (
  <View className="p-2 border-b border-light-cardBorder dark:border-dark-cardBorder">
    <Text className="text-sm font-semibold text-light-text dark:text-dark-text">{message.sender?.first_name || 'User'} {message.sender?.last_name || ''}</Text>
    <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{new Date(message.created_at).toLocaleString()}</Text>
    <Text className="text-light-text dark:text-dark-text">{message.content}</Text>
  </View>
);

const CampMeetingItem = ({ meeting, onPress }: { meeting: Meeting, onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} className="p-2 border-b border-light-cardBorder dark:border-dark-cardBorder">
    <Text className="text-sm font-semibold text-light-text dark:text-dark-text">{meeting.title}</Text>
    <Text className="text-xs text-gray-500 dark:text-gray-400">{new Date(meeting.scheduled_start).toLocaleString()}</Text>
    <Text className={`text-xs capitalize ${meeting.status === 'scheduled' ? 'text-blue-500' : 'text-gray-500'}`}>{meeting.status}</Text>
  </TouchableOpacity>
);


export default function CampDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [camp, setCamp] = useState<Camp | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light'; // Default to light if undefined
  const colors = Colors[currentScheme];

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [campDetails, membersData, messagesData, meetingsData] = await Promise.all([
        getCampDetails(id),
        getCampMembers(id), // TODO: Pagination
        getMessages({ type: 'camp', camp_id: id, limit: 10 }), // Fetch latest 10 camp messages
        getMeetings({ camp_id: id, upcoming: 'true', limit: 5 }) // Fetch upcoming 5 camp meetings
      ]);

      setCamp(campDetails.camp);
      setMembers(membersData.members);
      setMessages(messagesData.messages);
      setMeetings(meetingsData.meetings);

    } catch (err: any) {
      console.error("Failed to fetch camp data:", err);
      setError(err.message || 'Failed to load camp details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-light-background dark:bg-dark-background">
        <ActivityIndicator size="large" color={colors.tint} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-light-background dark:bg-dark-background p-4">
        <Text className="text-destructive dark:text-destructive-dark text-center mb-4">{error}</Text>
        <Button title="Retry" onPress={fetchData} />
      </SafeAreaView>
    );
  }

  if (!camp) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-light-background dark:bg-dark-background">
        <Text className="text-gray-500 dark:text-gray-400">Camp not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-light-background dark:bg-dark-background">
      <Stack.Screen options={{ title: camp.name || 'Camp Details', headerShown: true }} />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
        }
      >
        {/* Camp Header Info */}
        <View className="p-4 bg-light-card dark:bg-dark-card border-b border-light-cardBorder dark:border-dark-cardBorder">
          <Text className="text-2xl font-bold text-light-text dark:text-dark-text mb-1">{camp.name}</Text>
          {camp.description && <Text className="text-base text-gray-600 dark:text-gray-400 mb-2">{camp.description}</Text>}
          {camp.leader && <Text className="text-sm text-gray-500 dark:text-gray-400">Leader: {camp.leader.first_name} {camp.leader.last_name}</Text>}
          {/* TODO: Add "Join/Leave Camp" button based on membership status */}
        </View>

        {/* Sections */}
        <View className="p-4">
          {/* Announcements/Messages Section */}
          <View className="mb-6">
            <Text className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">Announcements & Messages</Text>
            {messages.length > 0 ? (
              messages.map(msg => <CampMessageItem key={msg._id} message={msg} />)
            ) : (
              <Text className="text-gray-500 dark:text-gray-400">No recent messages.</Text>
            )}
            {/* TODO: Link to full camp chat */}
            <TouchableOpacity onPress={() => Alert.alert('TODO', 'Navigate to full camp chat')} className="mt-2">
              <Text className="text-light-primary dark:text-dark-primary text-sm font-medium">View All Messages...</Text>
            </TouchableOpacity>
            {/* TODO: Add input to send message */}
          </View>

          {/* Upcoming Meetings Section */}
          <View className="mb-6">
            <Text className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">Upcoming Meetings</Text>
            {meetings.length > 0 ? (
              meetings.map(meet => <CampMeetingItem key={meet._id} meeting={meet} onPress={() => router.push(`/meeting/${meet._id}`)} />)
            ) : (
              <Text className="text-gray-500 dark:text-gray-400">No upcoming meetings scheduled.</Text>
            )}
            {/* TODO: Link to all camp meetings */}
          </View>

          {/* Members Section */}
          <View>
            <Text className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">Members ({members.length})</Text>
            {members.length > 0 ? (
              members.slice(0, 5).map(mem => <MemberItem key={mem._id} member={mem} />) // Show first 5
            ) : (
              <Text className="text-gray-500 dark:text-gray-400">No members found.</Text>
            )}
            {members.length > 5 && (
              <TouchableOpacity onPress={() => Alert.alert('TODO', 'Navigate to full member list')} className="mt-2">
                <Text className="text-light-primary dark:text-dark-primary text-sm font-medium">View All Members...</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
