import { AuthResponse, LoginCredentials, RegisterData, User } from '@/types'; // Adjust path
import api from './api';

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  } catch (error: any) {
    console.error('Login failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Login failed. Please check your credentials.');
  }
};

export const register = async (data: RegisterData): Promise<{ message: string; user_id: string }> => {
  try {
    // Ensure camp_id is handled if it's optional or required
    const payload = { ...data };
    if (!payload.camp_id) {
      // delete payload.camp_id; // Or set to null depending on backend expectations
    }

    const response = await api.post<{ message: string; user_id: string }>('/auth/register', payload);
    return response.data;
  } catch (error: any) {
    console.error('Registration failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Registration failed. Please try again.');
  }
};

export const fetchCurrentUser = async (): Promise<User | null> => {
  try {
    console.log("Fetching current user...");
    const response = await api.get<{ user: User }>('/auth/me');
    console.log("Current user fetched successfully");
    return response.data.user;
  } catch (error: any) {
    console.error("Failed to fetch current user:", error.message);
    // Add detailed logging
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    } else if (error.request) {
      console.error("No response received, request:", error.request);
    }
    return null;
  }
};

export const getSocketToken = async (): Promise<string | null> => {
  try {
    const response = await api.post<{ socket_token: string }>('/auth/socket-token');
    return response.data.socket_token;
  } catch (error: any) {
    console.error('Failed to get socket token:', error.response?.data || error.message);
    return null;
  }
};

export const changePassword = async (passwordData: { current_password: string, new_password: string }): Promise<{ message: string }> => {
  try {
    const response = await api.put<{ message: string }>('/auth/change-password', passwordData);
    return response.data;
  } catch (error: any) {
    console.error('Password change failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to change password.');
  }
};


export const forgotPassword = async (data: { email: string }): Promise<{ message: string }> => {
  try {
    const response = await api.post<{ message: string }>('/auth/forgot-password', data);
    return response.data;
  } catch (error: any) {
    console.error('Forgot password request failed:', error.response?.data || error.message);
    // Don't throw specific backend errors to avoid email enumeration
    throw new Error('If an account exists, an email will be sent.');
  }
};

export const resetPassword = async (data: { token: string, new_password: string }): Promise<{ message: string }> => {
  try {
    // Backend expects token in query/param usually, or sometimes body. Adjust as needed.
    // Example assumes backend takes token in body for simplicity here:
    const response = await api.post<{ message: string }>('/auth/reset-password', data);
    return response.data;
  } catch (error: any) {
    console.error('Reset password failed:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Password reset failed. Link may be invalid or expired.');
  }
};
