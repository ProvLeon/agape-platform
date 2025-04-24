// services/messageService.ts
import { Message } from '@/types';
import api from './api';

interface GetMessagesParams {
  type?: 'ministry' | 'camp' | 'personal' | 'sent';
  camp_id?: string;
  partner_id?: string;
  announcements_only?: 'true' | 'false';
  from_date?: string; // ISO Date string
  to_date?: string; // ISO Date string
  page?: number;
  per_page?: number;
  limit?: number; // Add limit if supported by backend/needed
}

interface MessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface CreateMessagePayload {
  content: string;
  recipient_type: 'ministry' | 'camp' | 'user';
  recipient_id?: string; // Required for camp/user
  message_type?: string;
  attachment_urls?: string[];
  is_announcement?: boolean;
}

interface CreateMessageResponse {
  message: string;
  message_id: string;
}


export const getMessages = async (params?: GetMessagesParams): Promise<MessagesResponse> => {
  try {
    const response = await api.get<MessagesResponse>('/messages/', { params });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch messages:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load messages.');
  }
};

export const createMessage = async (payload: CreateMessagePayload): Promise<CreateMessageResponse> => {
  try {
    const response = await api.post<CreateMessageResponse>('/messages/', payload);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create message:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not send message.');
  }
};

// Add getMessage(id), deleteMessage(id), markAsRead(id), uploadAttachment etc.
