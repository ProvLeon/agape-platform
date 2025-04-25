// services/userService.ts
import { PaginatedResponse, User } from '@/types';
import api from './api';

interface UserDetailsResponse {
  user: User;
}

interface GetUsersParams {
  search?: string;
  page?: number;
  per_page?: number;
  // Add other filters if needed (e.g., by camp, role)
}

type UsersResponse = PaginatedResponse<User> // Assuming backend provides pagination

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

export const getUsers = async (params?: GetUsersParams): Promise<UsersResponse> => {
  try {
    // Adjust endpoint if needed (e.g., '/users/' or '/members/')
    const response = await api.get<UsersResponse>('/users/', { params });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch users:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not load users.');
  }
};

// ... (updateUser function will be needed for Edit Profile) ...
export const updateUser = async (userId: string, data: Partial<User>): Promise<{ user: User }> => {
  try {
    // Assuming endpoint is PUT /api/users/{userId} or PUT /api/auth/me
    const response = await api.put<{ user: User }>(`/users/${userId}`, data); // Adjust endpoint as needed
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update user ${userId}:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Could not update profile.');
  }
};
