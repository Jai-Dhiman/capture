import { MaterialIcons } from '@expo/vector-icons';
import type React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  minHeight?: number;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon = 'inbox',
  minHeight
}) => {
  const { height: windowHeight } = useWindowDimensions();
  
  // Calculate minimum height to ensure centering works properly
  // Account for header, safe areas, and other UI elements
  const dynamicMinHeight = minHeight || Math.max(windowHeight * 0.6, 400);

  return (
    <View 
      className="justify-center items-center p-8"
      style={{ minHeight: dynamicMinHeight }}
    >
      <MaterialIcons name={icon} size={64} color="#9ca3af" />
      <Text className="text-xl font-bold text-gray-800 mt-4 mb-2 text-center">{title}</Text>
      <Text className="text-gray-500 text-center">{message}</Text>
    </View>
  );
};
