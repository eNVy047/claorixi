import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE_URL } from './api';

// Ensures notifications appear even when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
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
      return;
    }

    // Get the EAS Project ID
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('EAS Project ID not found. Ensure it is in app.json.');
    }

    // Get the token
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token:', token);
    } catch (e: any) {
      if (Platform.OS === 'android' && e.message?.includes('FirebaseApp is not initialized')) {
        console.error('\n--- PUSH NOTIFICATION ERROR ---\n' +
          'Firebase is not initialized for Android. To fix this:\n' +
          '1. Create a project in Firebase Console.\n' +
          '2. Add an Android app with package name: com.narayan098.mobile\n' +
          '3. Download google-services.json and place it in the /mobile directory.\n' +
          '4. Add "googleServicesFile": "./google-services.json" to the "android" section in app.json.\n' +
          '-------------------------------\n');
      } else {
        console.error('Error fetching push token:', e);
      }
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export async function syncPushToken(token: string, userToken: string) {
  try {
    // Using the PATCH /api/v1/notifications/push-token route
    await fetch(`${API_BASE_URL}/api/v1/notifications/push-token`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({ token }),
    });
    console.log('Push token synced with backend');
  } catch (error) {
    console.error('Error syncing push token', error);
  }
}
