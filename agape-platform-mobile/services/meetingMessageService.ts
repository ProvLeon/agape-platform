// services/meetingMessageService.ts
import { MeetingMessage } from '@/types';
import api from './api';

interface GetMeetingMessagesParams {
  page?: number;
  per_page?: number;
}

interface MeetingMessagesResponse {
  messages: MeetingMessage[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface CreateMeetingMessagePayload {
  content: string;
  message_type?: string;
  attachment_urls?: string[];
}

interface CreateMeetingMessageResponse {
  message: string;
  message_id: string;
  data: MeetingMessage; // Include formatted message from backend
}

export const getMeetingMessages = async (meetingId: string, params?: GetMeetingMessagesParams): Promise<MeetingMessagesResponse> => {
  try {
    const response = await api.get<MeetingMessagesResponse>(`/meetings/messages/${meetingId}/messages`, { params });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch meeting messages:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load meeting messages.');
  }
};

export const createMeetingMessage = async (meetingId: string, payload: CreateMeetingMessagePayload): Promise<CreateMeetingMessageResponse> => {
  try {
    // Note: Backend route seems to expect meetingId in URL, not payload
    const response = await api.post<CreateMeetingMessageResponse>(`/meetings/messages/${meetingId}/messages`, payload);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create meeting message:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not send meeting message.');
  }
};
