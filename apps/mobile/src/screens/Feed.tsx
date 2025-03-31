import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFeed } from '../hooks/useFeed';
import { PostItem } from '../components/post/PostItem';
import { ThreadItem } from '../components/post/ThreadItem';
import Header from '../components/ui/Header';
import { EmptyState } from '../components/ui/EmptyState';
import { useNavigation } from '@react-navigation/native';
import type { Post, Thread } from '../types/postTypes';
import { FlashList } from '@shopify/flash-list';
import { SkeletonLoader, SkeletonElement } from '../components/ui/SkeletonLoader';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'Warning: ProgressiveListView: `ref` is not a prop',
]);

export default function Feed() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: posts, isLoading, isError, error, refetch } = useFeed();
  const navigation = useNavigation();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const sortedPosts = posts ? [...posts].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }) : [];

  const renderItem = ({ item }: { item: Post | Thread }) => {
    if (item.type === 'thread') {
      return <ThreadItem thread={item} />;
    }
    return <PostItem post={item} />;
  };
  
  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-zinc-300">
        <Header />
        <View className="p-4">
          <SkeletonLoader isLoading={true}>
            {Array(3).fill(0).map((_, index) => (
              <SkeletonElement key={index} width="100%" height={250} radius={8} />
            ))}
          </SkeletonLoader>
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-zinc-300">
        <Header />
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-red-500 text-center mb-4">
            {error instanceof Error ? error.message : "An error occurred loading your feed"}
          </Text>
          <TouchableOpacity 
            className="bg-black py-3 px-6 rounded-full"
          >
            <Text className="text-white font-medium">Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-300">
      <Header />
      
      <View className="flex-1">
        <FlashList
          data={sortedPosts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={400}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={{ 
            padding: 16,
            paddingBottom: 100,
          }}
          ListEmptyComponent={
            <EmptyState
              title="Your Feed is Empty"
              message="Start following other users to see their posts here."
              icon="people"
            />
          }
        />
      </View>
    </View>
  );
}