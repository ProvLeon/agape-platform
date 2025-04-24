import api from './api';

/**
 * Saves the Expo Push Token to the backend for the current user.
 * Assumes the API request interceptor adds the auth token.
 */
export const savePushToken = async (token: string): Promise<void> => {
  try {
    // !!! IMPORTANT: You need a backend endpoint for this !!!
    // Example endpoint: PUT /api/users/me/push-token
    await api.put('/users/me/push-token', { pushToken: token });
    console.log('Push token saved successfully');
  } catch (error: any) {
    console.error('Failed to save push token to backend:', error.response?.data || error.message);
    // Don't throw necessarily, app can function without push token saved,
    // but log the error. Maybe implement retry logic.
  }
};

// Add functions to fetch notifications from backend if needed
// export const getNotifications = async (...) => { ... }
// export const markNotificationRead = async (...) => { ... }
