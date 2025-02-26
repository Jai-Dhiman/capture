import React from 'react';
import { View, Text, FlatList, Image, RefreshControl, TouchableOpacity } from 'react-native';
import { useSessionStore } from '../stores/sessionStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { useUserPosts } from '../hooks/useUserPosts';
import { useSignedUrl } from '../hooks/useSignedUrl';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const PostMedia = ({ media }: { media: any }) => {
  const { data: signedUrl, isLoading, error } = useSignedUrl(media.id);
  console.log('Media data:', {
    mediaId: media.id,
    storageKey: media.storageKey,
    signedUrl,
    isLoading,
    error
  });

  if (isLoading) {
    console.log('Loading signed URL for media:', media.id);
    return <Text>Loading media...</Text>;
  }

  if (error) {
    console.error('Error loading signed URL:', error);
    return <Text>Failed to load media</Text>;
  }

  if (!signedUrl) {
    console.log('No signed URL available for media:', media.id);
    return null;
  }

  return (
    <Image
      source={{ uri: signedUrl }}
      className="w-full h-48 rounded-lg mb-2"
      resizeMode="cover"
      onError={(error) => console.error('Image loading error:', error.nativeEvent)}
      onLoad={() => console.log('Image loaded successfully:', media.id)}
    />
  );
};

export default function Profile() {
  const navigation = useNavigation<NavigationProp>();
  const { authUser } = useSessionStore();
  const { data: posts, isLoading, error, refetch } = useUserPosts(authUser?.id);

  const renderPost = ({ item }: { item: any }) => (
    <View className="bg-white p-4 mb-4 rounded-lg shadow">
      {item.media && item.media.length > 0 && (
        <PostMedia media={item.media[0]} />
      )}
      <Text className="text-base">{item.content}</Text>
      <Text className="text-sm text-gray-500 mt-2">
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );

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
        renderItem={renderPost}
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