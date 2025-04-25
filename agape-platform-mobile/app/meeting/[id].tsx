import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Meeting, MeetingMessage, User } from '@/types';
import { getMeetingDetails, startMeeting, endMeeting } from '@/services/meetingService';
import { getMeetingMessages, createMeetingMessage } from '@/services/meetingMessageService';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import Button from '@/components/Button';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Card, { CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/Card';
import Avatar from '@/components/Avatar';
import SkeletonLoader from '@/components/SkeletonLoader';

const MEETING_DETAILS_QUERY_KEY = 'meetingDetails';
const MEETING_MESSAGES_QUERY_KEY = 'meetingMessages';

// --- Meeting Details Skeleton ---
const MeetingDetailSkeleton = () => (
  <View className="p-4">
    <Card className="mb-6">
      <CardHeader>
        <SkeletonLoader className="h-8 w-3/4 rounded mb-2" />
        <SkeletonLoader className="h-4 w-full rounded mb-1" />
        <SkeletonLoader className="h-4 w-5/6 rounded" />
      </CardHeader>
      <CardContent className="pt-4 border-t border-border space-y-2">
        <SkeletonLoader className="h-5 w-1/2 rounded" />
        <SkeletonLoader className="h-5 w-2/3 rounded" />
        <SkeletonLoader className="h-5 w-1/2 rounded" />
        <SkeletonLoader className="h-5 w-1/3 rounded" />
        <SkeletonLoader className="h-5 w-1/4 rounded" />
      </CardContent>
      <CardFooter className="pt-4 border-t border-border">
        <SkeletonLoader className="h-10 w-full rounded-md" />
      </CardFooter>
    </Card>
  </View>
);

// --- Meeting Message Bubble --- (Similar to Chat's, minor styling differences maybe)
const MeetingMessageBubble = React.memo(({ message, isSender }: { message: MeetingMessage, isSender: boolean }) => {
  const alignClass = isSender ? 'items-end' : 'items-start';
  const bubbleBgClass = isSender ? 'bg-primary' : 'bg-card'; // Use primary for sender
  const textClass = isSender ? 'text-primary-foreground' : 'text-foreground';
  const timeClass = isSender ? 'text-primary-foreground/70' : 'text-muted-foreground';
  const bubbleRadiusClass = isSender ? 'rounded-l-lg rounded-t-lg rounded-br-sm' : 'rounded-r-lg rounded-t-lg rounded-bl-sm';

  return (
    <View className={`my-1 ${alignClass} flex-row items-end max-w-[80%] ${isSender ? 'self-end' : 'self-start'}`}>
      {!isSender && ( // Show avatar for non-senders
        <Avatar
          name={message.user?.name}
          source={message.user?.profile_image}
          size={24}
          className="mr-1.5 mb-1" // Adjust spacing
        />
      )}
      <View className={`py-1.5 px-3 shadow-sm ${bubbleBgClass} ${bubbleRadiusClass}`}>
        {!isSender && (
          <Text className={`text-xs font-medium mb-0.5 ${textClass} opacity-80`}>
            {message.user?.name || 'User'}
          </Text>
        )}
        <Text className={`${textClass} text-sm leading-snug`}>{message.content}</Text>
        <Text className={`text-[10px] mt-0.5 text-right ${timeClass} opacity-70`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
});


export default function MeetingDetailScreen() {
  const { id: meetingId } = useLocalSearchParams<{ id: string }>();
  const { authState } = useAuth();
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [newMessage, setNewMessage] = useState('');
  const [isChatVisible, setIsChatVisible] = useState(false); // Start hidden
  const [actionLoading, setActionLoading] = useState(false); // Separate loading for Start/End actions
  const flatListRef = useRef<FlatList>(null);
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const currentUserId = authState.currentUser?._id;

  // Query for Meeting Details
  const { data: meeting, isLoading: isLoadingMeeting, error: meetingError, refetch: refetchMeeting, isFetching: isFetchingMeeting } = useQuery({
    queryKey: [MEETING_DETAILS_QUERY_KEY, meetingId],
    queryFn: async () => {
      if (!meetingId) throw new Error("Meeting ID required");
      const details = await getMeetingDetails(meetingId);
      return details.meeting;
    },
    enabled: !!meetingId,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });

  // Query for Meeting Messages
  const { data: messagesData, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useQuery({
    queryKey: [MEETING_MESSAGES_QUERY_KEY, meetingId],
    queryFn: () => getMeetingMessages(meetingId!),
    enabled: !!meetingId && !!currentUserId, // Enable only when needed
    select: (data) => ({ messages: data.messages.reverse() ?? [] }),
    staleTime: 30 * 1000, // Messages can be slightly more stale
  });

  const messages = messagesData?.messages ?? [];

  const isHost = meeting?.host_id === currentUserId;
  const canControlMeeting = isHost; // Add admin/leader logic if needed

  // Mutations for meeting actions
  const startMeetingMutation = useMutation({
    mutationFn: () => startMeeting(meetingId!),
    onSuccess: () => {
      Alert.alert("Success", "Meeting started!");
      setIsChatVisible(true); // Show chat on start
      queryClient.invalidateQueries({ queryKey: [MEETING_DETAILS_QUERY_KEY, meetingId] }); // Refetch details
    },
    onError: (error: any) => Alert.alert('Error', `Failed to start meeting: ${error.message}`),
    onSettled: () => setActionLoading(false),
  });

  const endMeetingMutation = useMutation({
    mutationFn: (payload?: { recording_url?: string | null }) => endMeeting(meetingId!, payload),
    onSuccess: () => {
      Alert.alert("Success", "Meeting ended.");
      setIsChatVisible(false); // Hide chat on end
      queryClient.invalidateQueries({ queryKey: [MEETING_DETAILS_QUERY_KEY, meetingId] }); // Refetch details
    },
    onError: (error: any) => Alert.alert('Error', `Failed to end meeting: ${error.message}`),
    onSettled: () => setActionLoading(false),
  });

  // Mutation for sending chat messages
  const sendChatMessageMutation = useMutation({
    mutationFn: (payload: { content: string }) => createMeetingMessage(meetingId!, payload),
    onMutate: async (newMessagePayload) => {
      await queryClient.cancelQueries({ queryKey: [MEETING_MESSAGES_QUERY_KEY, meetingId] });
      const previousMessages = queryClient.getQueryData<ReturnType<typeof messagesData.select>>([MEETING_MESSAGES_QUERY_KEY, meetingId]);

      const optimisticMessage: MeetingMessage = {
        _id: `temp_${Date.now()}`,
        content: newMessagePayload.content,
        user_id: currentUserId!,
        meeting_id: meetingId!,
        created_at: new Date().toISOString(),
        user: { id: currentUserId!, name: `${authState.currentUser?.first_name} ${authState.currentUser?.last_name}`, profile_image: authState.currentUser?.profile_image }
      };

      queryClient.setQueryData([MEETING_MESSAGES_QUERY_KEY, meetingId], (old) => ({
        messages: [...(old?.messages ?? []), optimisticMessage]
      }));
      return { previousMessages };
    },
    onError: (err, newMessagePayload, context) => {
      console.error('Failed to send meeting message:', err);
      Alert.alert('Error', 'Could not send message.');
      if (context?.previousMessages) {
        queryClient.setQueryData([MEETING_MESSAGES_QUERY_KEY, meetingId], context.previousMessages);
      }
      setNewMessage(newMessagePayload.content); // Put text back
    },
    onSuccess: () => {
      // Message is sent, socket event should provide the final update
      queryClient.invalidateQueries({ queryKey: [MEETING_MESSAGES_QUERY_KEY, meetingId] }); // Or rely purely on socket
    },
  });

  // --- Action Handlers ---
  const handleStartMeeting = () => {
    if (!meetingId || !canControlMeeting || actionLoading) return;
    setActionLoading(true);
    startMeetingMutation.mutate();
  };

  const handleEndMeeting = () => {
    if (!meetingId || !canControlMeeting || actionLoading) return;
    Alert.alert("End Meeting", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Meeting", style: "destructive", onPress: () => {
          setActionLoading(true);
          endMeetingMutation.mutate(); // Pass payload if needed for recording URL
        }
      },
    ]);
  };

  const handleSendChatMessage = () => {
    if (!newMessage.trim() || !meetingId || !currentUserId || meeting?.status !== 'in_progress' || sendChatMessageMutation.isPending) return;
    const contentToSend = newMessage.trim();
    setNewMessage('');
    sendChatMessageMutation.mutate({ content: contentToSend });
  };


  // --- Socket Event Listeners ---
  useEffect(() => {
    if (!socket || !isConnected || !meetingId || !currentUserId) return;
    console.log(`Socket Context: Setting up listeners for meeting ${meetingId}`);

    const handleNewMeetingMessage = (message: MeetingMessage) => {
      console.log('Socket received new_meeting_message:', message);
      if (message.meeting_id === meetingId) {
        queryClient.setQueryData([MEETING_MESSAGES_QUERY_KEY, meetingId], (oldData: any) => {
          const messageExists = oldData?.messages?.some((m: MeetingMessage) => m._id === message._id || m._id === message.tempId); // Check tempId if backend echoes optimistic
          if (messageExists) return oldData;
          return { messages: [...(oldData?.messages ?? []), message] };
        });
      }
    };
    const handleMeetingStatusUpdate = (data: { meeting_id: string, status: Meeting['status'], recording_url?: string }) => {
      console.log('Socket received meeting_status_update:', data);
      if (data.meeting_id === meetingId) {
        queryClient.setQueryData([MEETING_DETAILS_QUERY_KEY, meetingId], (oldMeeting: Meeting | undefined) => {
          if (!oldMeeting) return undefined;
          return { ...oldMeeting, status: data.status, recording_url: data.recording_url ?? oldMeeting.recording_url };
        });
        // Show alerts based on status change
        if (data.status === 'in_progress') Alert.alert("Meeting Started");
        if (data.status === 'completed') { Alert.alert("Meeting Ended"); setIsChatVisible(false); }
      }
    };

    socket.emit('join_meeting', { meeting_id: meetingId, user_id: currentUserId });
    socket.on('new_meeting_message', handleNewMeetingMessage);
    socket.on('meeting_status_update', handleMeetingStatusUpdate); // Listen for generic status updates
    // Remove specific start/end listeners if covered by status update
    // socket.on('meeting_started', handleMeetingStarted);
    // socket.on('meeting_ended', handleMeetingEnded);

    return () => {
      console.log(`Socket Context: Cleaning up listeners for meeting ${meetingId}`);
      socket.emit('leave_meeting', { meeting_id: meetingId, user_id: currentUserId });
      socket.off('new_meeting_message', handleNewMeetingMessage);
      socket.off('meeting_status_update', handleMeetingStatusUpdate);
      // socket.off('meeting_started', handleMeetingStarted);
      // socket.off('meeting_ended', handleMeetingEnded);
    };
  }, [socket, isConnected, meetingId, currentUserId, queryClient]);

  // --- Refresh Logic ---
  const onRefresh = useCallback(async () => {
    console.log("Meeting Detail: Manual refresh triggered.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [MEETING_DETAILS_QUERY_KEY, meetingId] }),
      queryClient.invalidateQueries({ queryKey: [MEETING_MESSAGES_QUERY_KEY, meetingId] }),
    ]);
  }, [queryClient, meetingId]);

  useFocusEffect(onRefresh); // Refetch on focus

  // --- Auto Scroll Chat ---
  useEffect(() => {
    if (isChatVisible && flatListRef.current && messages.length > 0) {
      const timer = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isChatVisible]);

  // --- Render Logic ---
  if (isLoadingMeeting && !meeting) {
    return <SafeAreaWrapper className="flex-1 bg-background"><MeetingDetailSkeleton /></SafeAreaWrapper>;
  }

  if (meetingError || !meeting) {
    return (
      <SafeAreaWrapper className="flex-1 bg-background justify-center items-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} className="mb-4" />
        <Text className="text-center text-lg text-destructive mb-4">
          {meetingError ? 'Failed to load meeting.' : 'Meeting not found.'}
        </Text>
        {meetingError && <Text className="text-center text-sm text-muted-foreground mb-6">{meetingError.message}</Text>}
        <Button title="Retry" onPress={onRefresh} iconLeft="refresh-outline" variant="secondary" />
      </SafeAreaWrapper>
    );
  }

  const startDate = new Date(meeting.scheduled_start);
  const endDate = new Date(meeting.scheduled_end);
  const status = meeting.status;

  // Info Item Component
  const InfoItem = ({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name'], label: string, value: string | null | undefined }) => (
    value ? <View className="flex-row items-center mb-2">
      <Ionicons name={icon} size={16} color={colors.mutedForeground} className="mr-2 w-5 text-center" />
      <Text className="text-sm text-foreground flex-1">{label}: <Text className="font-semibold">{value}</Text></Text>
    </View> : null
  );

  return (
    <SafeAreaWrapper className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '', // Title set by header center component
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.card }, // Card color for header
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.primary,
          headerTitle: () => ( // Center title component
            <View className="items-center">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>{meeting.title}</Text>
              <Text className="text-xs text-muted-foreground capitalize">{status.replace('_', ' ')}</Text>
            </View>
          ),
        }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })}
      >
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={isFetchingMeeting && !isLoadingMeeting} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerClassName="pb-4"
        >
          {/* Meeting Details Card */}
          <Card className="m-4">
            <CardHeader>
              <CardTitle className="text-xl">{meeting.title}</CardTitle>
              {meeting.description && <CardDescription className="mt-1">{meeting.description}</CardDescription>}
            </CardHeader>
            <CardContent className="pt-3 border-t border-border">
              <InfoItem icon="calendar-outline" label="Date" value={startDate.toLocaleDateString()} />
              <InfoItem icon="time-outline" label="Time" value={`${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} />
              {meeting.host && <InfoItem icon="person-circle-outline" label="Host" value={`${meeting.host.first_name} ${meeting.host.last_name}`} />}
              {meeting.camp && <InfoItem icon="people-outline" label="Camp" value={meeting.camp.name} />}
              <InfoItem icon="link-outline" label="Link" value={meeting.meeting_link} />
              {status === 'completed' && meeting.recording_url && <InfoItem icon="videocam-outline" label="Recording" value={meeting.recording_url} />}
            </CardContent>
            <CardFooter className="pt-4 border-t border-border flex-row justify-center space-x-3">
              {/* Action Buttons */}
              {status === 'scheduled' && canControlMeeting && <Button title="Start Meeting" onPress={handleStartMeeting} isLoading={actionLoading} disabled={actionLoading} iconLeft="play-outline" />}
              {status === 'scheduled' && !canControlMeeting && <Button title="Join Soon" variant="outline" disabled />}
              {status === 'in_progress' && <Button title="Join Meeting" onPress={handleJoinMeeting} iconLeft="enter-outline" />}
              {status === 'in_progress' && canControlMeeting && <Button title="End Meeting" onPress={handleEndMeeting} variant="destructive" isLoading={actionLoading} disabled={actionLoading} iconLeft="stop-circle-outline" />}
              {status === 'completed' && meeting.recording_url && <Button title="View Recording" onPress={() => {/* TODO: Open recording link */ }} variant="secondary" iconLeft="recording-outline" />}
              {status === 'completed' && !meeting.recording_url && <Text className="text-sm text-muted-foreground">Meeting completed.</Text>}
              {status === 'cancelled' && <Text className="text-sm text-destructive">Meeting cancelled.</Text>}
            </CardFooter>
          </Card>

          {/* Chat Toggle & Section */}
          {(status === 'in_progress' || (status === 'completed' && messages.length > 0)) && (
            <TouchableOpacity onPress={() => setIsChatVisible(!isChatVisible)} className="mx-4 mb-2 flex-row items-center justify-center py-2 bg-card border border-border rounded-md">
              <Ionicons name={isChatVisible ? "chatbubbles" : "chatbubbles-outline"} size={20} color={colors.primary} />
              <Text className="text-primary font-medium ml-2">{isChatVisible ? 'Hide Chat' : 'Show Chat'} ({messages.length})</Text>
            </TouchableOpacity>
          )}

          {isChatVisible && (
            <View className="flex-1 px-4 min-h-[300px] max-h-[50vh]"> {/* Constrain chat height */}
              {isLoadingMessages && messages.length === 0 ? (
                <ActivityIndicator color={colors.primary} className="my-4" />
              ) : messagesError ? (
                <Text className="text-center text-destructive py-4">Error loading chat.</Text>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  renderItem={({ item }) => (
                    <MeetingMessageBubble message={item} isSender={item.user_id === currentUserId} />
                  )}
                  keyExtractor={(item) => item._id}
                  ListEmptyComponent={<Text className="text-center text-muted-foreground py-4">No messages yet.</Text>}
                  contentContainerStyle={{ paddingTop: 8 }} // Add padding top inside list
                />
              )}
            </View>
          )}
        </ScrollView>

        {/* Chat Input Area */}
        {isChatVisible && status === 'in_progress' && (
          <View className="flex-row items-center p-2 border-t border-border bg-card">
            {/* ... (Input and Send Button as in ChatScreen) ... */}
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Send a message..."
              placeholderTextColor={colors.mutedForeground}
              className="flex-1 h-10 bg-background dark:bg-black/20 rounded-full px-4 mr-2 text-foreground"
              multiline
            />
            <Button
              onPress={handleSendChatMessage}
              disabled={sendChatMessageMutation.isPending || !newMessage.trim()}
              size="icon"
              className={`w-10 h-10 ${!newMessage.trim() ? 'bg-muted' : 'bg-primary'}`}
            >
              {sendChatMessageMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="send" size={18} color={!newMessage.trim() ? colors.mutedForeground : colors.primaryForeground} />
              )}
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
