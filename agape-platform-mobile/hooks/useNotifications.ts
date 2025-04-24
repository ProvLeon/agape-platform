import { savePushToken } from '@/services/notificationService'; // Need to create this service
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './useAuth';

// --- Notification Handler Configuration ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, // Be mindful of sound spam
    shouldSetBadge: true, // iOS badge count
  }),
});

// --- Helper Function to Register ---
async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250], // Example vibration pattern
      lightColor: '#FF231F7C', // Example light color
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      // Consider informing the user they need to enable permissions in settings
      return null;
    }

    // Learn more about projectId: https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    // Ensure projectId is set in app.json -> extra
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.error('Project ID not found. Add it to app.json (extra.eas.projectId)');
      // Alert.alert('Error', 'Project ID not found. Notifications may not work.');
      // return null; // Or handle appropriately
    }


    try {
      // Use the new getExpoPushTokenAsync method
      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId, // Use the correctly fetched projectId
      });
      token = pushTokenData.data;
      console.log('Expo Push Token:', token);
    } catch (e: any) {
      console.error("Failed to get Expo push token", e);
    }

  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}


// --- Custom Hook ---
export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const { authState } = useAuth();

  useEffect(() => {
    // Only register if authenticated
    if (authState.isAuthenticated) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          setExpoPushToken(token);
          // Send the token to your backend
          savePushToken(token).catch(err => console.error("Failed to save push token:", err));
        }
      });
    } else {
      // Clear token if logged out? Depends on backend logic.
      setExpoPushToken(null);
    }

    // --- Listener for incoming notifications (app in foreground) ---
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received while app is foregrounded:', notification);
      setNotification(notification);
      // Potentially update badge count, show in-app message, etc.
    });

    // --- Listener for user interacting with notification (tapping it) ---
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const notificationData = response.notification.request.content.data;
      // Handle navigation based on notification data
      // Example: if (notificationData?.screen === 'MeetingDetails') { router.push(`/meeting/${notificationData.id}`); }
    });

    // --- Cleanup listeners on unmount ---
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [authState.isAuthenticated]); // Re-run if auth state changes

  return {
    expoPushToken,
    notification,
  };
}
