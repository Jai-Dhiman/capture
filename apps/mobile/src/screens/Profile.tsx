import React from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useSessionStore } from '../stores/sessionStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { useUserPosts } from '../hooks/useUserPosts';
import { PostItem } from '../components/PostItem';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

export default function Profile() {
  const navigation = useNavigation<NavigationProp>();
  const { authUser } = useSessionStore();
  const { data: posts, isLoading, error, refetch } = useUserPosts(authUser?.id);

  return (
    <View className="flex-1 p-5">
      <View className="flex-row justify-between items-center mb-5">
        <Text className="text-2xl font-bold">My Profile</Text>
        <TouchableOpacity 
          className="bg-blue-600 px-4 py-2 rounded-lg"
          onPress={() => navigation.navigate('Feed')}
        >
          <Text className="text-white font-bold">Back to Feed</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={posts}
        renderItem={({ item }) => <PostItem post={item} />}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <Text className="text-center text-gray-500 mt-4">
            {isLoading ? 'Loading posts...' : 'No posts yet'}
          </Text>
        }
      />
    </View>
  );
}