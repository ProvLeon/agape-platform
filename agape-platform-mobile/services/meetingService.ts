import { Meeting } from '@/types';
import api from './api';

interface GetMeetingsParams {
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string; // Allow comma-separated
  type?: string;
  from_date?: string; // ISO Date string
  to_date?: string; // ISO Date string
  upcoming?: 'true' | 'false';
  camp_id?: string;
  page?: number;
  per_page?: number;
  limit?: number; // Add limit if supported by backend/needed
}

interface MeetingsResponse {
  meetings: Meeting[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface MeetingDetailsResponse {
  meeting: Meeting;
}

export const getMeetings = async (params?: GetMeetingsParams): Promise<MeetingsResponse> => {
  try {
    const response = await api.get<MeetingsResponse>('/meetings/', { params });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch meetings:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load meetings.');
  }
};

export const getMeetingDetails = async (meetingId: string): Promise<MeetingDetailsResponse> => {
  try {
    const response = await api.get<MeetingDetailsResponse>(`/meetings/${meetingId}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch meeting details:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load meeting details.');
  }
};

export const startMeeting = async (meetingId: string): Promise<{ message: string }> => {
  try {
    const response = await api.post<{ message: string }>(`/meetings/${meetingId}/start`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to start meeting:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not start meeting.');
  }
};

export const endMeeting = async (meetingId: string, data?: { recording_url?: string | null }): Promise<{ message: string }> => {
  try {
    const response = await api.post<{ message: string }>(`/meetings/${meetingId}/end`, data);
    return response.data;
  } catch (error: any) {
    console.error('Failed to end meeting:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not end meeting.');
  }
};


// Add createMeeting, updateMeeting, deleteMeeting, attend/leave etc.
