import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Message, User } from '@/types'; // Adjust path
import { getMessages, createMessage } from '@/services/messageService'; // Adjust path
import { getUserDetails } from '@/services/userService'; // Create this service
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext'; // Import useSocket
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';

const MessageBubble = ({ message, isSender }: { message: Message, isSender: boolean }) => {
  const alignClass = isSender ? 'items-end' : 'items-start';
  const bubbleClass = isSender ? 'bg-light-primary dark:bg-dark-primary' : 'bg-gray-200 dark:bg-gray-700';
  const textClass = isSender ? 'text-white' : 'text-light-text dark:text-dark-text';

  return (
    <View className={`my-1 ${alignClass}`}>
      <View className={`py-2 px-3 rounded-lg max-w-[80%] ${bubbleClass}`}>
        <Text className={`${textClass}`}>{message.content}</Text>
        <Text className={`text-xs mt-1 text-right ${isSender ? 'text-blue-100 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
};

export default function ChatScreen() {
  const { userId: partnerId } = useLocalSearchParams<{ userId: string }>();
  const { authState } = useAuth();
  const { socket, isConnected } = useSocket(); // Use the socket context
  const [messages, setMessages] = useState<Message[]>([]);
  const [partnerInfo, setPartnerInfo] = useState<User | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light'; // Default to light if undefined
  const colors = Colors[currentScheme];

  const fetchChatHistory = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch partner details and messages in parallel
      const [partnerDetailsResponse, messagesResponse] = await Promise.all([
        getUserDetails(partnerId),
        getMessages({ type: 'personal', partner_id: partnerId, limit: 50 }) // Fetch latest 50 messages
      ]);

      setPartnerInfo(partnerDetailsResponse.user);
      setMessages(messagesResponse.messages.reverse()); // Reverse to show oldest first for FlatList
    } catch (err: any) {
      console.error("Failed to fetch chat data:", err);
      setError(err.message || 'Failed to load chat.');
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  // --- Socket Event Listeners ---
  useEffect(() => {
    if (!socket || !isConnected || !authState.currentUser || !partnerId) return;

    const handleNewMessage = (message: Message) => {
      // Check if the message belongs to this conversation
      const currentUserId = authState.currentUser?._id;
      const isFromPartner = message.sender_id === partnerId && message.recipient_id === currentUserId;
      const isFromSelf = message.sender_id === currentUserId && message.recipient_id === partnerId;

      if (isFromPartner || isFromSelf) {
        setMessages(prevMessages => [...prevMessages, message]);
        // TODO: Mark message as read if received from partner and screen is focused
        // socket.emit('message_read', { message_id: message._id, user_id: currentUserId });
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, isConnected, partnerId, authState.currentUser]);


  const handleSend = async () => {
    if (!newMessage.trim() || !partnerId || !authState.currentUser) return;

    const optimisticMessage: Message = {
      _id: `temp_${Date.now()}`, // Temporary ID
      content: newMessage.trim(),
      sender_id: authState.currentUser._id,
      recipient_type: 'user',
      recipient_id: partnerId,
      created_at: new Date().toISOString(),
      // Add sender info for immediate display
      sender: {
        _id: authState.currentUser._id,
        first_name: authState.currentUser.first_name,
        last_name: authState.currentUser.last_name,
        // other necessary fields...
      } as User // Cast to User, ensure needed fields are present
    };

    setMessages(prevMessages => [...prevMessages, optimisticMessage]);
    setNewMessage('');
    setSending(true);

    try {
      // Use the REST API to send the message (backend handles WebSocket broadcast)
      await createMessage({
        content: optimisticMessage.content,
        recipient_type: 'user',
        recipient_id: partnerId,
      });
      // Optionally update the message list from API response if needed, or rely on socket event
      // fetchChatHistory(); // Could refetch, but socket event is better
    } catch (error: any) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Could not send message.');
      // Remove optimistic message on failure
      setMessages(prevMessages => prevMessages.filter(msg => msg._id !== optimisticMessage._id));
      setNewMessage(optimisticMessage.content); // Put text back in input
    } finally {
      setSending(false);
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);


  return (
    <SafeAreaView className="flex-1 bg-light-background dark:bg-dark-background">
      <Stack.Screen
        options={{
          title: partnerInfo ? `${partnerInfo.first_name} ${partnerInfo.last_name}` : 'Chat',
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} // Adjust offset if needed
      >
        <View className="flex-1 p-4">
          {loading ? (
            <ActivityIndicator size="large" color={colors.tint} className="mt-10" />
          ) : error ? (
            <Text className="text-center text-destructive dark:text-destructive-dark">{error}</Text>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item }) => (
                <MessageBubble message={item} isSender={item.sender_id === authState.currentUser?._id} />
              )}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={<Text className="text-center text-gray-500 dark:text-gray-400">No messages yet.</Text>}
            // onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })} // Alternative scroll logic
            // onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}
        </View>

        {/* Input Area */}
        <View className="flex-row items-center p-2 border-t border-light-cardBorder dark:border-dark-cardBorder bg-light-card dark:bg-dark-card">
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={colors.tabIconDefault}
            className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-full px-4 mr-2 text-light-text dark:text-dark-text"
            multiline
          />
          <TouchableOpacity onPress={handleSend} disabled={sending || !newMessage.trim()} className="p-2">
            {sending ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : (
              <Ionicons name="send" size={24} color={!newMessage.trim() ? colors.tabIconDefault : colors.tint} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
