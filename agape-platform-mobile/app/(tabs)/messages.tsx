import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Message, User } from '@/types'; // Adjust path
import { getMessages } from '@/services/messageService'; // Create this service
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';

// Placeholder ConversationItem component
const ConversationItem = ({ item, onPress, currentUserId }: { item: Message, onPress: () => void, currentUserId: string | null }) => {
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light'; // Default to light if undefined
  const colors = Colors[currentScheme];
  const isSender = item.sender_id === currentUserId;
  const otherParty = isSender ? item.recipient : item.sender;
  const otherPartyName = otherParty && 'first_name' in otherParty ? `${otherParty.first_name} ${otherParty.last_name}` : (otherParty?.name || 'Unknown');
  const otherPartyImage = otherParty && 'profile_image' in otherParty ? otherParty.profile_image : null; // Assuming profile image URL

  const messageDate = new Date(item.created_at);
  const timeString = messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateString = messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const isToday = new Date().toDateString() === messageDate.toDateString();

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center bg-light-card dark:bg-dark-card p-3 mb-1 rounded-lg border-b border-light-cardBorder dark:border-dark-cardBorder"
    >
      {/* Profile Image Placeholder */}
      <View className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600 mr-3 items-center justify-center">
        {/* TODO: Replace with actual Image component */}
        <Ionicons name="person" size={24} color={colors.icon} />
      </View>

      {/* Text Content */}
      <View className="flex-1">
        <Text className="text-base font-semibold text-light-text dark:text-dark-text" numberOfLines={1}>{otherPartyName}</Text>
        <Text className={`text-sm ${item.is_read ? 'text-gray-500 dark:text-gray-400' : 'text-light-text dark:text-dark-text font-medium'}`} numberOfLines={1}>
          {isSender ? 'You: ' : ''}{item.content}
        </Text>
      </View>

      {/* Timestamp & Read Status */}
      <View className="items-end ml-2 w-16">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{isToday ? timeString : dateString}</Text>
        {!item.is_read && !isSender && (
          <View className="w-2.5 h-2.5 bg-light-primary dark:bg-dark-primary rounded-full" />
        )}
      </View>
    </TouchableOpacity>
  );
};

// TODO: This screen needs significant refinement to handle different message types (ministry, camp, personal)
// Likely needs tabs or sections for each type. This is a simplified placeholder for personal messages.
export default function MessagesScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { authState } = useAuth();
  const { colorScheme: nwColorScheme } = useColorScheme();
  const currentScheme = nwColorScheme ?? 'light';
  const colors = Colors[currentScheme];

  // Simplified fetch for personal messages (needs proper grouping/logic)
  const fetchConversations = useCallback(async () => {
    if (!authState.currentUser) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch personal messages - NEED TO GROUP BY CONVERSATION PARTNER
      // This endpoint fetches individual messages, not conversations.
      // A real implementation needs backend support for conversation lists or client-side grouping.
      const response = await getMessages({ type: 'personal' });

      // --- *** VERY BASIC GROUPING LOGIC (Replace with robust solution) *** ---
      const conversations: Record<string, Message> = {};
      response.messages.forEach(msg => {
        const partnerId = msg.sender_id === authState.currentUser?._id ? msg.recipient_id : msg.sender_id;
        if (partnerId) {
          // Keep only the latest message for each conversation partner
          if (!conversations[partnerId] || new Date(msg.created_at) > new Date(conversations[partnerId].created_at)) {
            conversations[partnerId] = msg;
          }
          // Mark conversation as unread if any message from partner is unread
          if (msg.sender_id === partnerId && !msg.read_by?.includes(authState.currentUser?._id ?? '')) {
            if (conversations[partnerId]) conversations[partnerId].is_read = false;
          }
        }
      });
      const latestMessages = Object.values(conversations).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      // Set is_read correctly based on aggregation (if not already done)
      latestMessages.forEach(msg => {
        if (msg.sender_id !== authState.currentUser?._id && !msg.read_by?.includes(authState.currentUser?._id ?? '')) {
          msg.is_read = false;
        } else {
          msg.is_read = true; // Default to read if sent by self or already read
        }
      });

      setMessages(latestMessages);
      // --- *** END BASIC GROUPING *** ---

    } catch (err: any) {
      console.error("Failed to fetch messages:", err);
      setError(err.message || 'Failed to load messages.');
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authState.currentUser]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  const handleConversationPress = (item: Message) => {
    const partnerId = item.sender_id === authState.currentUser?._id ? item.recipient_id : item.sender_id;
    if (partnerId) {
      router.push(`/chat/${partnerId}`);
    } else {
      // Handle navigation for ministry/camp messages differently
      console.warn("Cannot determine chat partner for message:", item._id);
    }
  };

  const handleNewMessage = () => {
    // router.push('/messages/new'); // Navigate to screen to select contact
    Alert.alert("Feature", "New message functionality coming soon!");
  };


  return (
    <SafeAreaView className="flex-1 bg-light-background dark:bg-dark-background">
      <Stack.Screen
        options={{
          title: 'Messages',
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity onPress={handleNewMessage} style={{ marginRight: 15 }}>
              <Ionicons name="create-outline" size={26} color={colors.tint} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* TODO: Add Tabs for Ministry / Camp / Direct */}
      <View className="flex-1 p-4">
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.tint} className="mt-10" />
        ) : error ? (
          <View className="items-center justify-center mt-10">
            <Text className="text-destructive dark:text-destructive-dark">{error}</Text>
            <TouchableOpacity onPress={fetchConversations} className="mt-2 p-2 bg-light-primary dark:bg-dark-primary rounded">
              <Text className="text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : messages.length === 0 ? (
          <View className="items-center justify-center flex-1">
            <Text className="text-gray-500 dark:text-gray-400">No messages yet.</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={({ item }) => (
              <ConversationItem
                item={item}
                onPress={() => handleConversationPress(item)}
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
