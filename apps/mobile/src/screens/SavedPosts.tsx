import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../types/navigation';
import { useSavedPosts } from '../hooks/useSavesPosts';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MediaImage } from '../components/media/MediaImage';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const { width } = Dimensions.get('window');
const itemSize = width / 3;

export default function SavedPosts() {
  const navigation = useNavigation<NavigationProp>();
  const { data: savedPosts, isLoading, error } = useSavedPosts(30, 0);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading your saved posts..." />;
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-5">
        <Text className="text-lg text-red-500 mb-2">Failed to load saved posts</Text>
        <Text className="text-sm text-gray-500">{error.message}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Image
        source={require('../../assets/DefaultBackground.png')}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        resizeMode="cover"
      />
      
      <View className="flex-row items-center p-4 bg-transparent">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-[30px] font-light mx-auto">Saved Posts</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {savedPosts && savedPosts.length > 0 ? (
        <FlatList
          data={savedPosts}
          numColumns={3}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              className="relative"
              style={{ width: itemSize, height: itemSize }}
              onPress={() => navigation.navigate('SinglePost', { post: item })}
            >
              <View className="w-full h-full border border-white">
                {item.media && item.media.length > 0 ? (
                  <MediaImage media={item.media[0]} expirySeconds={3600} />
                ) : (
                  <View className="w-full h-full bg-gray-200 justify-center items-center">
                    <Text className="text-xs text-gray-400">No image</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <View className="flex-1 justify-center items-center p-5">
          <Text className="text-lg text-gray-700 mb-2">No saved posts yet</Text>
          <Text className="text-sm text-gray-500 text-center">
            When you save posts, they'll appear here for easy access.
          </Text>
        </View>
      )}
    </View>
  );
}