import type React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
}) => {
  return (
    <View className="flex-1 justify-center items-center p-8">
      <MaterialIcons size={64} color="#9ca3af" />
      <Text className="text-xl font-bold text-gray-800 mt-4 mb-2 text-center">
        {title}
      </Text>
      <Text className="text-gray-500 text-center">
        {message}
      </Text>
    </View>
  );
};