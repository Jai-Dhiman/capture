import NewPost from '@assets/icons/PlusIcon.svg';
import type React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface NewPostButtonProps {
  onPress: () => void;
}

export const NewPostButton: React.FC<NewPostButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      className="absolute bottom-6 right-6 shadow-lg"
      style={{ zIndex: 2 }}
      onPress={onPress}
    >
      <View className="bg-[#e4CAC7] rounded-[10px] border border-black flex-row items-center px-2 py-1">
        <NewPost width={20} height={20} />
        <Text className="ml-2 text-xs font-normal">New Post</Text>
      </View>
    </TouchableOpacity>
  );
};
