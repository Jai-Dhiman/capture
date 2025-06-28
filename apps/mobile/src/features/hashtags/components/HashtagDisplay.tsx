import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface HashtagDisplayProps {
  hashtags: Array<{ id: string; name: string }>;
  size?: 'small' | 'medium' | 'large';
}

export const HashtagDisplay = ({ hashtags, size = 'medium' }: HashtagDisplayProps) => {
  if (!hashtags || hashtags.length === 0) return null;

  return (
    <View className="flex-row flex-wrap mt-2">
      {hashtags.map((hashtag) => (
        <TouchableOpacity
          key={hashtag.id}
          className={`mr-2 mb-2 px-2 py-1 bg-gray-100 rounded-full ${
            size === 'small' ? 'py-0.5' : size === 'large' ? 'py-1.5 px-3' : ''
          }`}
          // onPress={}
        >
          <Text
            className={`text-blue-600 ${
              size === 'small' ? 'text-xs' : size === 'large' ? 'text-base' : 'text-sm'
            }`}
          >
            #{hashtag.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
