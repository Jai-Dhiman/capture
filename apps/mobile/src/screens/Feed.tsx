import React, { useState } from 'react';
import { View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { useFeed } from '../hooks/useFeed';
import { PostItem } from '../components/post/PostItem';
import { ThreadItem } from '../components/post/ThreadItem';
import Header from '../components/ui/Header';
import { EmptyState } from '../components/ui/EmptyState';
import type { Post, Thread } from '../types/postTypes';
import { FlashList } from '@shopify/flash-list';

export default function Feed() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: posts, isLoading, isError, error, refetch } = useFeed();

  const onRefresh = async () => {
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
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#E4CAC7" />
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
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-300">
      <Header />
      
      <FlashList
        data={sortedPosts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={400}
        contentContainerStyle={{ 
          padding: 16,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Your Feed is Empty"
            message="Start following other users to see their posts here or create your first post"
            icon="feed"
          />
        }
      />
    </View>
  );
}