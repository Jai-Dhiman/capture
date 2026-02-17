import { apiClient } from '@/shared/lib/apiClient';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handling behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushNotificationToken = {
  token: string;
  type: 'expo' | 'ios' | 'android';
};

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

class PushNotificationService {
  private token: string | null = null;
  private notificationListener: Notifications.EventSubscription | null = null;
  private responseListener: Notifications.EventSubscription | null = null;
  private tokenListener: Notifications.EventSubscription | null = null;

  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    return status as NotificationPermissionStatus;
  }

  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    const permissionGranted = await this.requestPermissions();
    if (!permissionGranted) {
      console.warn('Push notification permission not granted');
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      if (!projectId) {
        throw new Error('Project ID not found in app configuration');
      }

      const expoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.token = expoPushToken.data;

      // Register token with backend
      await this.registerTokenWithBackend(this.token);

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      return this.token;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      throw error;
    }
  }

  private async setupAndroidChannel(): Promise<void> {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });

    await Notifications.setNotificationChannelAsync('social', {
      name: 'Social',
      description: 'Notifications for likes, comments, and follows',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
      lightColor: '#4ECDC4',
    });
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      await apiClient.post('/auth/register-device', {
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName || 'Unknown Device',
      });
    } catch (error) {
      console.error('Failed to register push token with backend:', error);
      throw error;
    }
  }

  async unregisterDevice(): Promise<void> {
    if (!this.token) {
      return;
    }

    try {
      await apiClient.post('/auth/unregister-device', {
        token: this.token,
      });
      this.token = null;
    } catch (error) {
      console.error('Failed to unregister device:', error);
      throw error;
    }
  }

  setupListeners(
    onNotification?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void,
  ): void {
    // Listen for incoming notifications while app is foregrounded
    if (onNotification) {
      this.notificationListener = Notifications.addNotificationReceivedListener(onNotification);
    }

    // Listen for user interactions with notifications
    if (onNotificationResponse) {
      this.responseListener =
        Notifications.addNotificationResponseReceivedListener(onNotificationResponse);
    }

    // Listen for token updates
    this.tokenListener = Notifications.addPushTokenListener(async (token) => {
      console.log('Push token updated:', token.data);
      this.token = token.data;
      try {
        await this.registerTokenWithBackend(token.data);
      } catch (error) {
        console.error('Failed to update token with backend:', error);
      }
    });
  }

  removeListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
    if (this.tokenListener) {
      this.tokenListener.remove();
      this.tokenListener = null;
    }
  }

  async getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    return await Notifications.getLastNotificationResponseAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  async dismissAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }

  getToken(): string | null {
    return this.token;
  }
}

export const pushNotificationService = new PushNotificationService();
