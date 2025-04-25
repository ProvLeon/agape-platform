import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Message, User } from '@/types';
import { getMessages } from '@/services/messageService';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Color';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import ListItem from '@/components/ListItem';
import Avatar from '@/components/Avatar';
import SkeletonLoader from '@/components/SkeletonLoader';
import Button from '@/components/Button';

const MESSAGES_QUERY_KEY = 'conversations';

// ... (groupMessagesIntoConversations, ConversationListItemSkeleton, ConversationItem remain the same) ...
// Basic conversation grouping logic (Client-side - Needs Backend Improvement)
const groupMessagesIntoConversations = (messages: Message[], currentUserId: string): Message[] => {
  const conversations: Record<string, Message> = {};
  messages.forEach(msg => {
    const isSender = msg.sender_id === currentUserId;
    const partnerId = isSender ? msg.recipient_id : msg.sender_id;
    const partner = isSender ? msg.recipient : msg.sender;

    if (partnerId && partner) { // Ensure partner exists for personal messages
      if (!conversations[partnerId] || new Date(msg.created_at) > new Date(conversations[partnerId].created_at)) {
        conversations[partnerId] = { ...msg, is_read: true }; // Default to read
      }
      if (msg.sender_id === partnerId && !msg.read_by?.includes(currentUserId)) {
        conversations[partnerId].is_read = false;
      }
    } else if (msg.recipient_type === 'ministry' || msg.recipient_type === 'camp') {
      const groupId = `${msg.recipient_type}-${msg.recipient_id || 'ministry'}`;
      if (!conversations[groupId] || new Date(msg.created_at) > new Date(conversations[groupId].created_at)) {
        conversations[groupId] = { ...msg, is_read: true };
      }
      // Add unread logic for group chats if needed
    }
  });
  return Object.values(conversations).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// Skeleton component for a single conversation item
const ConversationListItemSkeleton = () => (
  <View className="flex-row items-center p-4 bg-card border-b border-border">
    <SkeletonLoader className="w-12 h-12 rounded-full mr-3" />
    <View className="flex-1">
      <SkeletonLoader className="h-4 w-3/5 rounded mb-1.5" />
      <SkeletonLoader className="h-3 w-4/5 rounded" />
    </View>
    <SkeletonLoader className="h-3 w-12 rounded self-start" />
  </View>
);


// Enhanced ConversationItem
const ConversationItem = ({ item, onPress, currentUserId }: { item: Message, onPress: () => void, currentUserId: string | null }) => {
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isSender = item.sender_id === currentUserId;

  let title = 'Unknown Conversation';
  let avatarName = '?';
  let avatarSource = null;
  let iconName: React.ComponentProps<typeof Ionicons>['name'] | null = null;

  if (item.recipient_type === 'user') {
    const otherParty = isSender ? item.recipient : item.sender;
    if (otherParty && 'first_name' in otherParty) {
      title = `${otherParty.first_name} ${otherParty.last_name}`;
      avatarName = title;
      // avatarSource = otherParty.profile_image;
    } else if (otherParty && 'name' in otherParty) {
      title = otherParty.name;
      avatarName = title;
    }
    iconName = "person-outline";
  } else if (item.recipient_type === 'camp') {
    title = `${item.recipient?.name || item.camp_name || 'Camp Chat'}`;
    avatarName = item.recipient?.name?.substring(0, 1) || 'C';
    iconName = "people-outline";
  } else if (item.recipient_type === 'ministry') {
    title = "Ministry Announcements";
    avatarName = "M"; // Example
    iconName = "megaphone-outline";
  }

  const messageDate = new Date(item.created_at);
  const timeString = messageDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateString = messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const isToday = new Date().toDateString() === messageDate.toDateString();
  const isUnread = !item.is_read && !isSender; // Based on previous logic

  return (
    <ListItem
      onPress={onPress}
      leftElement={<Avatar name={avatarName} source={avatarSource} size={48} />}
      title={title}
      subtitle={
        <Text className={`text-sm ${isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`} numberOfLines={1}>
          {isSender && item.recipient_type === 'user' ? 'You: ' : ''}{item.content}
        </Text>
      }
      rightElement={
        <View className="items-end">
          <Text className="text-xs text-muted-foreground mb-1">{isToday ? timeString : dateString}</Text>
          {isUnread && <View className="w-2.5 h-2.5 bg-primary rounded-full" />}
        </View>
      }
      bottomBorder
      className="bg-card px-4 py-3"
    />
  );
};


export default function MessagesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const { colorScheme } = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const currentUserId = authState.currentUser?._id ?? null;

  const { data: messagesData, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: [MESSAGES_QUERY_KEY, currentUserId],
    queryFn: async () => {
      if (!currentUserId) return { conversations: [] }; // Return empty structure
      const response = await getMessages({ per_page: 100 }); // Fetch more for grouping
      const conversations = groupMessagesIntoConversations(response.messages, currentUserId);
      return { conversations };
    },
    enabled: !!currentUserId,
    staleTime: 1 * 60 * 1000,
  });

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [MESSAGES_QUERY_KEY, currentUserId] });
  }, [queryClient, currentUserId]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleConversationPress = (item: Message) => {
    // ... (navigation logic as before) ...
    if (item.recipient_type === 'user') {
      const partnerId = item.sender_id === currentUserId ? item.recipient_id : item.sender_id;
      if (partnerId) {
        router.push(`/chat/${partnerId}`);
      }
    } else if (item.recipient_type === 'camp') {
      Alert.alert("TODO", `Navigate to Camp Chat for ID: ${item.recipient_id}`);
    } else {
      Alert.alert("TODO", "Navigate to Ministry Chat");
    }
  };

  // --- NEW CHAT HANDLER ---
  const handleNewMessage = () => {
    // TODO: Replace with navigation to a contact selection screen
    // router.push('/messages/new');
    Alert.alert("New Chat", "Select a contact screen coming soon!");
  };

  const renderContent = () => {
    // ... (Loading, Error, Empty states remain the same) ...
    if (isLoading && !messagesData) {
      return (
        <View className="flex-1">
          {[...Array(10)].map((_, index) => <ConversationListItemSkeleton key={index} />)}
        </View>
      );
    }
    if (error) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="chatbubbles-outline" size={48} color={colors.destructive} className="mb-4" />
          <Text className="text-center text-lg text-destructive mb-4">
            Failed to load messages.
          </Text>
          <Text className="text-center text-sm text-muted-foreground mb-6">{error.message}</Text>
          <Button title="Retry" onPress={() => refetch()} iconLeft="refresh-outline" variant="secondary" />
        </View>
      );
    }
    if (!messagesData?.conversations?.length) {
      return (
        <View className="flex-1 justify-center items-center px-6">
          <Ionicons name="mail-unread-outline" size={48} color={colors.mutedForeground} className="mb-4" />
          <Text className="text-lg text-muted-foreground">No messages yet.</Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">Start a new conversation!</Text>
          <Button title="New Message" onPress={handleNewMessage} iconLeft="add-outline" className="mt-6" />
        </View>
      );
    }

    return (
      <FlatList
        data={messagesData.conversations}
        renderItem={({ item }) => (
          <ConversationItem
            item={item}
            onPress={() => handleConversationPress(item)}
            currentUserId={currentUserId}
          />
        )}
        keyExtractor={(item) => `${item.recipient_type}-${item.recipient_id || item.sender_id}-${item._id}`} // More unique key
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerClassName="bg-background"
      />
    );
  }

  return (
    <SafeAreaWrapper className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Messages',
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          // --- ADDED HEADER BUTTON ---
          headerRight: () => (
            <TouchableOpacity onPress={handleNewMessage} className="mr-4"> {/* Added margin */}
              <Ionicons name="create-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      {/* Add Segmented Control/Tabs here later for filtering */}
      {renderContent()}
    </SafeAreaWrapper>
  );
}
