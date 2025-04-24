import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Meeting, MeetingMessage, User } from '@/types'; // Adjust path
import { getMeetingDetails, startMeeting, endMeeting } from '@/services/meetingService'; // Create this service
import { getMeetingMessages, createMeetingMessage } from '@/services/meetingMessageService'; // Create this service
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import Button from '@/components/Button';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';

const MeetingMessageBubble = ({ message, isSender }: { message: MeetingMessage, isSender: boolean }) => {
  const alignClass = isSender ? 'items-end' : 'items-start';
  const bubbleClass = isSender ? 'bg-light-primary dark:bg-dark-primary' : 'bg-gray-200 dark:bg-gray-700';
  const textClass = isSender ? 'text-white' : 'text-light-text dark:text-dark-text';

  return (
    <View className={`my-1 ${alignClass} flex-row items-end max-w-[80%] ${isSender ? 'justify-end' : 'justify-start'}`}>
      {!isSender && (
        <View className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-500 mr-1.5 mb-1 items-center justify-center">
          {/* Placeholder Image */}
          <Ionicons name="person" size={12} color="#fff" />
        </View>
      )}
      <View className={`py-1.5 px-3 rounded-lg ${bubbleClass}`}>
        {!isSender && (
          <Text className={`text-xs font-medium mb-0.5 ${textClass} opacity-80`}>
            {message.user?.name || 'User'}
          </Text>
        )}
        <Text className={`${textClass}`}>{message.content}</Text>
        <Text className={`text-[10px] mt-0.5 text-right ${isSender ? 'text-blue-100 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'} opacity-70`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
};


export default function MeetingDetailScreen() {
  const { id: meetingId } = useLocalSearchParams<{ id: string }>();
  const { authState } = useAuth();
  const { socket, isConnected } = useSocket();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light'; // Default to light if undefined
  const colors = Colors[currentScheme];

  const currentUserId = authState.currentUser?._id;
  const isHost = meeting?.host_id === currentUserId;
  // TODO: Add role check for admins/leaders if they can control meetings
  const canControlMeeting = isHost; // || isAdmin || isCampLeaderForThisCamp

  const fetchData = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true); // Ensure loading is true at start
    setError(null);
    try {
      const [detailsResponse, messagesResponse] = await Promise.all([
        getMeetingDetails(meetingId),
        getMeetingMessages(meetingId) // Fetch initial chat messages
      ]);
      setMeeting(detailsResponse.meeting);
      setMessages(messagesResponse.messages.reverse()); // Oldest first
    } catch (err: any) {
      console.error("Failed to fetch meeting data:", err);
      setError(err.message || 'Failed to load meeting details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Socket Event Listeners ---
  useEffect(() => {
    if (!socket || !isConnected || !meetingId) return;

    const handleNewMeetingMessage = (message: MeetingMessage) => {
      if (message.meeting_id === meetingId) {
        setMessages(prevMessages => [...prevMessages, message]);
      }
    };

    const handleMeetingStarted = (data: any) => {
      if (data.meeting_id === meetingId) {
        setMeeting(prev => prev ? { ...prev, status: 'in_progress' } : null);
        Alert.alert("Meeting Started", meeting?.title ?? '');
      }
    };

    const handleMeetingEnded = (data: any) => {
      if (data.meeting_id === meetingId) {
        setMeeting(prev => prev ? { ...prev, status: 'completed', recording_url: data.recording_url } : null);
        Alert.alert("Meeting Ended", meeting?.title ?? '');
        setIsChatVisible(false); // Hide chat when meeting ends
      }
    };

    // Join meeting room via socket
    socket.emit('join_meeting', { meeting_id: meetingId, user_id: currentUserId });

    socket.on('new_meeting_message', handleNewMeetingMessage);
    socket.on('meeting_started', handleMeetingStarted);
    socket.on('meeting_ended', handleMeetingEnded);
    // TODO: Listen for user_joined, user_left, etc.

    return () => {
      socket.emit('leave_meeting', { meeting_id: meetingId, user_id: currentUserId });
      socket.off('new_meeting_message', handleNewMeetingMessage);
      socket.off('meeting_started', handleMeetingStarted);
      socket.off('meeting_ended', handleMeetingEnded);
    };
  }, [socket, isConnected, meetingId, currentUserId, meeting?.title]); // Add meeting title to deps for alert

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleJoinMeeting = () => {
    // TODO: Implement actual joining logic (e.g., navigate to video call screen, open link)
    if (meeting?.meeting_link) {
      // Open external link or navigate to internal video component
      // Linking.openURL(meeting.meeting_link);
      Alert.alert("Join Meeting", `Joining: ${meeting.title}\nLink: ${meeting.meeting_link}`);
    } else {
      Alert.alert("Join Meeting", `Joining: ${meeting.title} (No external link provided)`);
    }
    // Optionally show chat when joining
    if (meeting?.status === 'in_progress') {
      setIsChatVisible(true);
    }
  };

  const handleStartMeeting = async () => {
    if (!meetingId || !canControlMeeting) return;
    setLoading(true); // Indicate loading state
    try {
      await startMeeting(meetingId);
      // Backend should emit 'meeting_started' via socket, which updates state
      // No need to setMeeting state directly here if socket handler works
      setIsChatVisible(true); // Show chat when starting
    } catch (error: any) {
      Alert.alert('Error', `Failed to start meeting: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEndMeeting = async () => {
    if (!meetingId || !canControlMeeting) return;
    // Optional: Prompt for recording URL if applicable
    Alert.alert(
      "End Meeting",
      "Are you sure you want to end this meeting for everyone?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Meeting",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              // Pass recording_url if available/prompted
              await endMeeting(meetingId, { recording_url: null });
              // Backend should emit 'meeting_ended' via socket
            } catch (error: any) {
              Alert.alert('Error', `Failed to end meeting: ${error.message}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };


  const handleSendChatMessage = async () => {
    if (!newMessage.trim() || !meetingId || !currentUserId || meeting?.status !== 'in_progress') return;

    const optimisticMessage: MeetingMessage = {
      _id: `temp_${Date.now()}`,
      content: newMessage.trim(),
      user_id: currentUserId,
      meeting_id: meetingId,
      created_at: new Date().toISOString(),
      user: { // Include sender info for immediate display
        id: currentUserId,
        name: `${authState.currentUser?.first_name} ${authState.currentUser?.last_name}`,
        profile_image: authState.currentUser?.profile_image
      }
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setSending(true);

    try {
      // Send message via REST API (backend handles socket broadcast)
      await createMeetingMessage(meetingId, { content: optimisticMessage.content });
    } catch (error: any) {
      console.error('Failed to send meeting message:', error);
      Alert.alert('Error', 'Could not send message.');
      // Revert optimistic update
      setMessages(prev => prev.filter(msg => msg._id !== optimisticMessage._id));
      setNewMessage(optimisticMessage.content);
    } finally {
      setSending(false);
    }
  };

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (isChatVisible && flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, isChatVisible]);


  if (loading && !refreshing && !meeting) { // Show loader only on initial load
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

  if (!meeting) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-light-background dark:bg-dark-background">
        <Text className="text-gray-500 dark:text-gray-400">Meeting not found.</Text>
      </SafeAreaView>
    );
  }

  const startDate = new Date(meeting.scheduled_start);
  const endDate = new Date(meeting.scheduled_end);


  return (
    <SafeAreaView className="flex-1 bg-light-background dark:bg-dark-background">
      <Stack.Screen options={{ title: meeting.title || 'Meeting Details', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} // Adjust as needed
      >
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
          }
        >
          {/* Meeting Info */}
          <View className="p-4 border-b border-light-cardBorder dark:border-dark-cardBorder bg-light-card dark:bg-dark-card">
            <Text className="text-2xl font-bold text-light-text dark:text-dark-text mb-1">{meeting.title}</Text>
            <Text className="text-base text-gray-600 dark:text-gray-400 mb-3">{meeting.description}</Text>
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={16} color={colors.icon} style={{ marginRight: 6 }} />
              <Text className="text-sm text-light-text dark:text-dark-text">
                {startDate.toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-row items-center mb-2">
              <Ionicons name="time-outline" size={16} color={colors.icon} style={{ marginRight: 6 }} />
              <Text className="text-sm text-light-text dark:text-dark-text">
                {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </View>
            {meeting.host && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="person-circle-outline" size={16} color={colors.icon} style={{ marginRight: 6 }} />
                <Text className="text-sm text-light-text dark:text-dark-text">Hosted by {meeting.host.first_name} {meeting.host.last_name}</Text>
              </View>
            )}
            {meeting.camp && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="people-outline" size={16} color={colors.icon} style={{ marginRight: 6 }} />
                <Text className="text-sm text-light-text dark:text-dark-text">Camp: {meeting.camp.name}</Text>
              </View>
            )}
            <View className="flex-row items-center mb-4">
              <Ionicons name="information-circle-outline" size={16} color={colors.icon} style={{ marginRight: 6 }} />
              <Text className={`text-sm font-medium capitalize ${meeting.status === 'in_progress' ? 'text-green-500' : meeting.status === 'scheduled' ? 'text-blue-500' : 'text-gray-500'}`}>{meeting.status.replace('_', ' ')}</Text>
            </View>


            {/* Action Buttons */}
            <View className="flex-row justify-around mt-2">
              {meeting.status === 'scheduled' && canControlMeeting && (
                <Button title="Start Meeting" onPress={handleStartMeeting} disabled={loading} />
              )}
              {meeting.status === 'scheduled' && !canControlMeeting && (
                <Button title="Join Meeting" onPress={handleJoinMeeting} variant="outline" />
              )}
              {meeting.status === 'in_progress' && (
                <Button title="Join Meeting" onPress={handleJoinMeeting} />
              )}
              {meeting.status === 'in_progress' && canControlMeeting && (
                <Button title="End Meeting" onPress={handleEndMeeting} variant="destructive" disabled={loading} className="ml-2" />
              )}
              {meeting.status === 'completed' && meeting.recording_url && (
                <Button title="View Recording" onPress={() => {/* Open recording link */ }} variant="secondary" />
              )}
            </View>
            {/* Toggle Chat Button */}
            {(meeting.status === 'in_progress' || meeting.status === 'completed') && (
              <TouchableOpacity onPress={() => setIsChatVisible(!isChatVisible)} className="mt-4 flex-row items-center justify-center">
                <Ionicons name={isChatVisible ? "chatbubbles" : "chatbubbles-outline"} size={20} color={colors.tint} />
                <Text className="text-light-primary dark:text-dark-primary ml-2">{isChatVisible ? 'Hide Chat' : 'Show Chat'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Attendee List (Optional - maybe show count or top few) */}
          {/* <View className="p-4">
                   <Text className="text-lg font-semibold text-light-text dark:text-dark-text mb-2">Attendees ({meeting.attendees?.length || 0})</Text>
                  {/* Render attendee list */}
          {/*</View> */}

          {/* Meeting Chat Section */}
          {isChatVisible && (
            <View className="p-4 flex-1 min-h-[300px]"> {/* Ensure chat has space */}
              <Text className="text-xl font-semibold text-light-text dark:text-dark-text mb-2">Meeting Chat</Text>
              {loading && messages.length === 0 ? (
                <ActivityIndicator color={colors.tint} />
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  renderItem={({ item }) => (
                    <MeetingMessageBubble message={item} isSender={item.user_id === currentUserId} />
                  )}
                  keyExtractor={(item) => item._id}
                  ListEmptyComponent={<Text className="text-center text-gray-500 dark:text-gray-400">No messages yet.</Text>}
                />
              )}
            </View>
          )}
        </ScrollView>

        {/* Chat Input Area (Only when chat is visible and meeting is in progress) */}
        {isChatVisible && meeting.status === 'in_progress' && (
          <View className="flex-row items-center p-2 border-t border-light-cardBorder dark:border-dark-cardBorder bg-light-card dark:bg-dark-card">
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Send a message..."
              placeholderTextColor={colors.tabIconDefault}
              className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-full px-4 mr-2 text-light-text dark:text-dark-text"
              multiline
            />
            <TouchableOpacity onPress={handleSendChatMessage} disabled={sending || !newMessage.trim()} className="p-2">
              {sending ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <Ionicons name="send" size={24} color={!newMessage.trim() ? colors.tabIconDefault : colors.tint} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
