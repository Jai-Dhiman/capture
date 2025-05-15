import type React from 'react';
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { NotificationItem } from './NotificationItem';
import { useNotifications, useMarkAllNotificationsRead } from '../hooks/useNotifications';
import { EmptyState } from '@features/feed/components/EmptyState';

interface NotificationListProps {
  onClose: () => void;
}

export const NotificationList: React.FC<NotificationListProps> = () => {
  const [includeRead, setIncludeRead] = useState(false);
  const { data: notifications, isLoading, refetch } = useNotifications(20, 0, includeRead);
  const { mutate: markAllAsRead, isPending } = useMarkAllNotificationsRead();

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleToggleRead = () => {
    setIncludeRead(!includeRead);
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
        <Text className="text-xl font-semibold">Notifications</Text>
        <View className="flex-row">
          <TouchableOpacity
            onPress={handleToggleRead}
            className="mr-4"
          >
            <Text className="text-blue-500">
              {includeRead ? 'Hide Read' : 'Show All'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text className="text-blue-500">Mark All Read</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : notifications && notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationItem notification={item} />}
          contentContainerStyle={{ flexGrow: 1 }}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <EmptyState
          title="No Notifications"
          message="You don't have any notifications yet."
          icon="notifications"
        />
      )}
    </View>
  );
}; 