import { Camp } from '@/types';
import api from './api';

interface GetCampsParams {
  search?: string;
  page?: number;
  per_page?: number;
}

interface CampsResponse {
  camps: Camp[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface CampDetailsResponse {
  camp: Camp;
}

interface CampMembersResponse {
  members: User[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}


export const getCamps = async (params?: GetCampsParams): Promise<CampsResponse> => {
  try {
    const response = await api.get<CampsResponse>('/camps/', { params });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch camps:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load camps.');
  }
};

export const getCampDetails = async (campId: string): Promise<CampDetailsResponse> => {
  try {
    const response = await api.get<CampDetailsResponse>(`/camps/${campId}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch camp details:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load camp details.');
  }
};

export const getCampMembers = async (campId: string, params?: { page?: number, per_page?: number }): Promise<CampMembersResponse> => {
  try {
    const response = await api.get<CampMembersResponse>(`/camps/${campId}/members`, { params });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch camp members:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load camp members.');
  }
};

// Add createCamp, updateCamp, deleteCamp if needed from mobile (check permissions)
