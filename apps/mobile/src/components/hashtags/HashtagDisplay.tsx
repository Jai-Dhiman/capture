import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../Navigators/types/navigation';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface HashtagDisplayProps {
  hashtags: Array<{ id: string; name: string }>;
  size?: 'small' | 'medium' | 'large';
}

export const HashtagDisplay = ({ hashtags, size = 'medium' }: HashtagDisplayProps) => {
  const navigation = useNavigation<NavigationProp>();
  
  if (!hashtags || hashtags.length === 0) return null;
  
  const handleHashtagPress = (hashtagId: string, hashtagName: string) => {
    // Add Navigation to Hashtag feed screen here
  };
  
  return (
    <View className="flex-row flex-wrap mt-2">
      {hashtags.map((hashtag) => (
        <TouchableOpacity
          key={hashtag.id}
          className={`mr-2 mb-2 px-2 py-1 bg-gray-100 rounded-full ${
            size === 'small' 
              ? 'py-0.5' 
              : size === 'large' 
                ? 'py-1.5 px-3' 
                : ''
          }`}
          onPress={() => handleHashtagPress(hashtag.id, hashtag.name)}
        >
          <Text
            className={`text-blue-600 ${
              size === 'small' 
                ? 'text-xs' 
                : size === 'large' 
                  ? 'text-base' 
                  : 'text-sm'
            }`}
          >
            #{hashtag.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};