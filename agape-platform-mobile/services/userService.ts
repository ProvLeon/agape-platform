// services/userService.ts
import { User } from '@/types';
import api from './api';

interface UserDetailsResponse {
  user: User;
}

export const getUserDetails = async (userId: string): Promise<UserDetailsResponse> => {
  try {
    const response = await api.get<UserDetailsResponse>(`/users/${userId}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch user details:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load user details.');
  }
};

// Add getUsers (admin), createUser (admin), updateUser, deleteUser (admin) if needed
