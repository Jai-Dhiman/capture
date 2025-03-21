import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../Navigators/types/navigation';
import { ProfileImage } from '../media/ProfileImage';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface ThreadItemProps {
  thread: any;
}

export const ThreadItem = ({ thread }: ThreadItemProps) => {
  const navigation = useNavigation<NavigationProp>();
  const formattedDate = new Date(thread.createdAt).toLocaleDateString();
  
  return (
    <TouchableOpacity 
      className="bg-stone-100 p-4 mb-4 rounded-lg relative"
      onPress={() => navigation.navigate('SinglePost', { post: thread })}
    >
      {/* Username */}
      <Text className="left-[66px] text-black text-xl font-light font-['Roboto'] leading-3">
        {thread.user?.username || 'User'}
      </Text>
      
      {/* Content */}
      <View className="mt-6 mb-12">
        <Text className="w-full text-black text-base font-light font-['Roboto'] leading-snug">
          {thread.content}
        </Text>
      </View>
      
      {/* Date */}
      <Text className="absolute right-4 bottom-4 text-center text-black text-[10px] font-light font-['Roboto'] leading-3">
        {formattedDate}
      </Text>
      
      {/* Profile Image (position at bottom-right) */}
      <View className="w-5 h-5 absolute right-[20px] bottom-3">
        {thread.user?.profileImage ? (
          <ProfileImage cloudflareId={thread.user.profileImage} />
        ) : (
          <View className="w-5 h-5 bg-stone-300 rounded-full" />
        )}
      </View>
      
      {/* Interaction icons */}
      <View className="flex-row absolute left-4 bottom-3 space-x-6">
        {/* Like icon */}
        <View className="w-5 h-5 overflow-hidden">
          <View className="w-5 h-5" />
          <View className="w-2.5 h-2.5 left-[6.88px] top-[6.92px] absolute outline outline-[1.30px] outline-offset-[-0.65px] outline-black" />
          <View className="w-3 h-3 left-[2.29px] top-[2.33px] absolute outline outline-[1.30px] outline-offset-[-0.65px] outline-black" />
          <View className="w-1 h-1.5 left-[2.29px] top-[2.33px] absolute outline outline-[1.30px] outline-offset-[-0.65px] outline-black" />
        </View>
        
        {/* Comment icon */}
        <View className="w-5 h-5 overflow-hidden">
          <View className="w-5 h-5" />
          <View className="w-4 h-4 left-[1.50px] top-[2.67px] absolute bg-black" />
        </View>
      </View>
    </TouchableOpacity>
  );
};