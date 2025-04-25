import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, AppState
} from 'react-native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Message, User } from '@/types';
import { getMessages, createMessage } from '@/services/messageService';
import { getUserDetails } from '@/services/userService';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import Avatar from '@/components/Avatar';
import SkeletonLoader from '@/components/SkeletonLoader';
import Button from '@/components/Button'; // For potential error states

const CHAT_MESSAGES_QUERY_KEY = 'chatMessages';
const PARTNER_DETAILS_QUERY_KEY = 'partnerDetails';

// --- Message Bubble Component ---
const MessageBubble = React.memo(({ message, isSender, showSenderName }: {
  message: Message;
  isSender: boolean;
  showSenderName?: boolean; // Optional: for group chats later
}) => {
  const alignClass = isSender ? 'self-end' : 'self-start';
  const bubbleBgClass = isSender ? 'bg-primary' : 'bg-card'; // Primary for sender, card for receiver
  const textClass = isSender ? 'text-primary-foreground' : 'text-foreground';
  const timeClass = isSender ? 'text-primary-foreground/70' : 'text-muted-foreground';
  // Add slightly different radius for conversational flow
  const bubbleRadiusClass = isSender ? 'rounded-l-xl rounded-t-xl rounded-br-sm' : 'rounded-r-xl rounded-t-xl rounded-bl-sm';

  // Function to format time
  const formatTime = (dateString: string) => {
    try {
      console.log(dateString)
      return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return '...'; // Fallback for invalid date/temp ID
    }
  };

  return (
    <View className={`my-1 max-w-[80%] ${alignClass}`}>
      <View className={`py-2 px-3 shadow-sm ${bubbleBgClass} ${bubbleRadiusClass}`}>
        {/* Add sender name display logic here if showSenderName is true (for group chats) */}
        <Text className={`${textClass} text-base leading-snug`}>{message.content}</Text>
        <View className="flex-row justify-end items-center mt-1">
          <Text className={`text-[10px] ${timeClass} mr-1`}>
            {formatTime(message.created_at)}
          </Text>
          {/* Optional: Add read receipts for sender */}
          {isSender && message._id && !message._id.startsWith('temp_') && ( // Show check only for sent messages
            <Ionicons name="checkmark-done" size={14} color={Colors.light.secondary} className={timeClass} /> // Example read receipt
          )}
          {isSender && message._id?.startsWith('temp_') && ( // Show clock for pending messages
            <Ionicons name="time-outline" size={12} className={timeClass} />
          )}
        </View>
      </View>
    </View>
  );
});

// --- Skeleton Loader ---
const ChatSkeleton = () => (
  <View className="flex-1 p-4 space-y-3">
    {[0.6, 0.8, 0.5, 0.7, 0.4, 0.9].map((width, index) => (
      <SkeletonLoader
        key={index}
        className={`h-12 rounded-lg ${index % 2 === 0 ? 'self-start' : 'self-end'}`}
        style={{ width: `${width * 80}%` }} // Varying widths
      />
    ))}
  </View>
);


export default function ChatScreen() {
  const { userId: partnerId } = useLocalSearchParams<{ userId: string }>();
  const { authState } = useAuth();
  const currentUserId = authState.currentUser?._id;
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const [newMessage, setNewMessage] = useState('');
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Query for Partner Details
  const { data: partnerInfo, isLoading: isLoadingPartner, error: partnerError } = useQuery({
    queryKey: [PARTNER_DETAILS_QUERY_KEY, partnerId],
    queryFn: () => getUserDetails(partnerId!),
    enabled: !!partnerId,
    staleTime: Infinity, // User details rarely change, rely on manual invalidation if needed
  });

  // Query for Messages
  const { data: messagesData, isLoading: isLoadingMessages, error: messagesError, refetch: refetchMessages } = useQuery({
    queryKey: [CHAT_MESSAGES_QUERY_KEY, partnerId],
    queryFn: () => getMessages({ type: 'personal', partner_id: partnerId, limit: 50 }), // Fetch initial batch
    enabled: !!partnerId && !!currentUserId,
    select: (data) => ({ // Process data immediately
      messages: data.messages.reverse() ?? [], // Oldest first for FlatList
      // Add pagination info if needed: total, pages etc.
    }),
    // Refetch on focus might be too aggressive for chat history, rely on sockets primarily
    // refetchOnWindowFocus: true,
  });

  const messages = messagesData?.messages ?? [];

  // Mutation for Sending Messages
  const sendMessageMutation = useMutation({
    mutationFn: (payload: { content: string; recipient_type: 'user'; recipient_id: string }) => createMessage(payload),
    onMutate: async (newMessagePayload) => {
      // Cancel any outgoing refetches for messages
      await queryClient.cancelQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, partnerId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<ReturnType<typeof messagesData.select>>([CHAT_MESSAGES_QUERY_KEY, partnerId]);

      // Optimistically update to the new value
      const optimisticMessage: Message = {
        _id: `temp_${Date.now()}`,
        content: newMessagePayload.content,
        sender_id: currentUserId!,
        recipient_type: 'user',
        recipient_id: partnerId!,
        created_at: new Date().toISOString(),
        sender: authState.currentUser ? { // Add sender stub
          _id: authState.currentUser._id,
          first_name: authState.currentUser.first_name,
          last_name: authState.currentUser.last_name
        } as User : undefined,
        is_read: false // Mark optimistic as unread initially? Or based on status
      };

      queryClient.setQueryData([CHAT_MESSAGES_QUERY_KEY, partnerId], (old) => ({
        messages: [...(old?.messages ?? []), optimisticMessage]
      }));

      // Return context object with the optimistic message and snapshot
      return { previousMessages, optimisticMessage };
    },
    onError: (err, newMessagePayload, context) => {
      console.error("Failed to send message:", err);
      Alert.alert('Error', 'Could not send message. Please try again.');
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData([CHAT_MESSAGES_QUERY_KEY, partnerId], context.previousMessages);
      }
      // Optionally put text back?
      setNewMessage(newMessagePayload.content);
    },
    onSuccess: (data, variables, context) => {
      // Update the optimistic message with the real one from the server if needed
      // OR simply rely on the socket event + invalidation
      console.log('Message sent successfully:', data.message_id);
      // Invalidate after success to ensure consistency (or rely on socket update)
      queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, partnerId] });
    },
    // onSettled: () => {
    //   // Optionally refetch/invalidate after error or success, though socket should handle success
    //   // queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, partnerId] });
    // }
  });

  // --- Socket Event Listener ---
  useEffect(() => {
    if (!socket || !isConnected || !currentUserId || !partnerId) return;

    const handleNewMessage = (incomingMessage: Message) => {
      console.log('Socket received new_message:', incomingMessage);
      // Check if the message belongs to this conversation
      const isFromPartner = incomingMessage.sender_id === partnerId && incomingMessage.recipient_id === currentUserId;
      // NOTE: We usually don't need to handle messages *sent by self* via socket
      // if the optimistic update + API success handles it. Relying on socket
      // for self-sent messages can lead to duplicates if not handled carefully.

      if (isFromPartner) {
        console.log(`Message from partner ${partnerId} received.`);
        // Add message to react-query cache
        queryClient.setQueryData([CHAT_MESSAGES_QUERY_KEY, partnerId], (oldData: any) => {
          // Avoid adding duplicates if message already exists (e.g., from rapid events)
          const messageExists = oldData?.messages?.some((m: Message) => m._id === incomingMessage._id);
          if (messageExists) return oldData;

          return {
            messages: [...(oldData?.messages ?? []), incomingMessage]
          };
        });
        // TODO: Mark message as read via socket emit if app is focused
        // if (AppState.currentState === 'active') {
        //    socket.emit('message_read', { message_id: incomingMessage._id, user_id: currentUserId });
        // }
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      console.log('Cleaning up new_message listener for chat with', partnerId);
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, isConnected, partnerId, currentUserId, queryClient]);


  // --- Send Handler ---
  const handleSend = () => {
    if (!newMessage.trim() || !partnerId || sendMessageMutation.isPending) return;
    const contentToSend = newMessage.trim();
    setNewMessage(''); // Clear input immediately
    sendMessageMutation.mutate({
      content: contentToSend,
      recipient_type: 'user',
      recipient_id: partnerId,
    });
  };

  // --- Auto Scrolling ---
  useEffect(() => {
    if (messages.length > 0) {
      // Delay slightly to allow layout calculation after new message render
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]); // Rerun when number of messages changes


  // --- Combined Loading/Error State ---
  const isLoading = isLoadingPartner || (isLoadingMessages && messages.length === 0); // Loading if partner OR initial messages are loading
  const error = partnerError || messagesError;


  return (
    <SafeAreaWrapper className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerTitle: () => ( // Custom header to show avatar and name
            <View className="flex-row items-center">
              <Avatar name={partnerInfo?.user?.first_name} source={partnerInfo?.user?.profile_image} size={32} />
              <Text className="text-lg font-semibold text-foreground ml-2">
                {partnerInfo ? `${partnerInfo.user.first_name} ${partnerInfo.user.last_name}` : 'Chat'}
              </Text>
            </View>
          ),
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.card }, // Use card color for header consistency
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.primary,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.select({ ios: 90, android: 0 })} // Adjust offset as needed
      >
        <View className="flex-1 bg-background pt-2">
          {isLoading ? (
            <ChatSkeleton />
          ) : error ? (
            <View className="flex-1 justify-center items-center px-6">
              <Ionicons name="warning-outline" size={48} color={colors.destructive} className="mb-4" />
              <Text className="text-center text-lg text-destructive mb-4">Error loading chat.</Text>
              <Text className="text-center text-sm text-muted-foreground mb-6">{error.message}</Text>
              <Button title="Retry" onPress={() => {
                if (partnerError) queryClient.invalidateQueries({ queryKey: [PARTNER_DETAILS_QUERY_KEY, partnerId] });
                if (messagesError) refetchMessages();
              }} iconLeft="refresh-outline" variant="secondary" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item }) => (
                <MessageBubble message={item} isSender={item.sender_id === currentUserId} />
              )}
              keyExtractor={(item) => item._id} // Use temp ID for optimistic items
              ListEmptyComponent={
                <View className="flex-1 justify-center items-center px-6">
                  <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.mutedForeground} className="mb-4" />
                  <Text className="text-lg text-muted-foreground">No messages yet.</Text>
                  <Text className="text-sm text-muted-foreground text-center mt-2">Send a message to start the conversation!</Text>
                </View>
              }
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingBottom: 8 }}
              // Optimization props
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={11}
            />
          )}
        </View>

        {/* Input Area */}
        <View className="flex-row items-center p-2 border-t border-border bg-card">
          {/* TODO: Add Attachment Button */}
          {/* <TouchableOpacity className="p-2 mr-1"><Ionicons name="add-circle-outline" size={28} color={colors.primary} /></TouchableOpacity> */}
          <View className="flex-1 flex-row items-center bg-background dark:bg-black/20 rounded-full px-3 py-1.5 mr-2">
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Message..."
              placeholderTextColor={colors.mutedForeground}
              className="flex-1 text-base text-foreground mr-2 max-h-24" // Limit height
              multiline
              textAlignVertical="center" // Better alignment on Android
            />
            {/* TODO: Add Emoji Button */}
            {/* <TouchableOpacity className="p-1"><Ionicons name="happy-outline" size={24} color={colors.mutedForeground} /></TouchableOpacity> */}
          </View>
          <Button
            onPress={handleSend}
            // disabled={sendMessageMutation.isPending || !newMessage.trim()}
            size="icon"
            className={`w-11 h-11 ${!newMessage.trim() ? 'bg-muted' : 'bg-primary'}`} // Change bg when disabled
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Ionicons name="send" size={20} color={!newMessage.trim() ? colors.mutedForeground : colors.primaryForeground} />
            )}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
