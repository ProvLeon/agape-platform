// services/prayerService.ts
import { PrayerRequest } from '@/types';
import api from './api';

interface GetPrayerRequestsParams {
  status?: 'active' | 'answered' | 'archived';
  testimonies?: 'true' | 'false';
  camp_id?: string | null; // null for ministry-wide
  from_date?: string; // ISO Date string
  to_date?: string; // ISO Date string
  search?: string;
  personal?: 'true' | 'false';
  page?: number;
  per_page?: number;
}

interface PrayerRequestsResponse {
  prayer_requests: PrayerRequest[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export const getPrayerRequests = async (params?: GetPrayerRequestsParams): Promise<PrayerRequestsResponse> => {
  try {
    const response = await api.get<PrayerRequestsResponse>('/prayer-requests/', { params });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch prayer requests:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load prayer requests.');
  }
};

export const prayForRequest = async (requestId: string, pray: boolean): Promise<{ message: string }> => {
  const endpoint = pray ? `/prayer-requests/${requestId}/pray` : `/prayer-requests/${requestId}/unpray`;
  try {
    const response = await api.post<{ message: string }>(endpoint);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to ${pray ? 'pray for' : 'unpray'} request:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not update prayer status.');
  }
};

// Add createPrayerRequest, updatePrayerRequest, deletePrayerRequest, addTestimony etc.
