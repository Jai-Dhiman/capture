import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import type React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useMarkNotificationRead } from '../hooks/useNotifications';

type NotificationItemProps = {
  notification: {
    id: string;
    type: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    actionUser?: {
      userId: string;
      username: string;
      profileImage?: string;
    };
    resourceId?: string;
    resourceType?: string;
  };
};

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const navigation = useNavigation<any>();
  const { mutate: markAsRead } = useMarkNotificationRead();

  const getRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (_error) {
      return 'recently';
    }
  };

  const handlePress = () => {
    markAsRead(notification.id);

    // Navigate based on notification type and resourceType
    if (notification.resourceType === 'profile' && notification.actionUser?.userId) {
      navigation.navigate('Profile', { userId: notification.actionUser.userId });
    } else if (notification.resourceType === 'post' && notification.resourceId) {
      // Navigation for posts will be implemented later
    } else if (notification.resourceType === 'comment' && notification.resourceId) {
      // Navigation for comments will be implemented later
    }
  };

  // Get a color based on notification type
  const getNotificationColor = () => {
    switch (notification.type) {
      case 'FOLLOW_REQUEST':
      case 'NEW_FOLLOW':
        return '#4895ef';
      case 'NEW_COMMENT':
      case 'COMMENT_REPLY':
        return '#f77f00';
      case 'MENTION':
        return '#6a994e';
      case 'POST_SAVE':
        return '#9b5de5';
      default:
        return '#212529';
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={`flex-row items-center p-4 border-b border-gray-200 ${notification.isRead ? '' : 'bg-gray-50'}`}
    >
      {notification.actionUser?.profileImage ? (
        <Image
          source={{ uri: notification.actionUser.profileImage }}
          className="w-12 h-12 rounded-full mr-3"
        />
      ) : (
        <View className="w-12 h-12 rounded-full bg-[#DFD2CD] mr-3 items-center justify-center">
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: getNotificationColor(),
            }}
          />
        </View>
      )}

      <View className="flex-1">
        <Text className="text-sm mb-1" numberOfLines={2}>
          {notification.message}
        </Text>
        <Text className="text-xs text-gray-500">{getRelativeTime(notification.createdAt)}</Text>
      </View>

      {!notification.isRead && <View className="w-2 h-2 rounded-full bg-blue-500 ml-2" />}
    </TouchableOpacity>
  );
};
