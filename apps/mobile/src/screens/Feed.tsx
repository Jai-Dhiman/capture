import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFeed } from '../hooks/useFeed';
import { PostItem } from '../components/post/PostItem';
import { ThreadItem } from '../components/post/ThreadItem';
import Header from '../components/ui/Header';
import { EmptyState } from '../components/ui/EmptyState';
import type { Post, Thread } from '../types/postTypes';

export default function Feed() {
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('month'); 

  const getDateThreshold = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        now.setDate(now.getDate() - 7);
        return now.toISOString();
      case 'month':
        now.setMonth(now.getMonth() - 1);
        return now.toISOString();
      case 'all':
        return null; 
      default:
        now.setMonth(now.getMonth() - 1);
        return now.toISOString();
    }
  };

  const { data: posts, isLoading, isError, error, refetch } = useFeed({
    dateThreshold: getDateThreshold(),
  });

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
      <View className="flex-1 bg-white">
        <Header />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-white">
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
    <View className="flex-1 bg-white">
      <Header />
      
      <FlatList
        data={sortedPosts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          padding: 16,
          paddingBottom: 100,
          flexGrow: sortedPosts.length === 0 ? 1 : undefined
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
            message="Sure a blank profile is cool but tap 'New Post' to add some flair to your feed! "
            icon="feed"
          />
        }
      />
    </View>
  );
}