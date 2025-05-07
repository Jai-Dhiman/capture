import React, { useState, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useDiscoverFeed } from '../hooks/useDiscoverFeed';
import { PostItem } from '../components/post/PostItem';
import { ThreadItem } from '../components/post/ThreadItem';
import Header from '../components/ui/Header';
import { EmptyState } from '../components/ui/EmptyState';
import type { Post, Thread } from '../types/postTypes';
import { FlashList } from '@shopify/flash-list';
import { SkeletonElement } from '../components/ui/SkeletonLoader';
import { MotiView } from 'moti';

const HEADER_HEIGHT = 150;

export default function Feed() {
  const [refreshing, setRefreshing] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const prevScrollY = useRef(0);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useDiscoverFeed();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const posts = data?.pages.flatMap(page => page.posts) || [];

  const renderItem = ({ item }: { item: Post | Thread }) => {
    if (item.type === 'thread') {
      return <ThreadItem thread={item} />;
    }
    return <PostItem post={item} />;
  };

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View className="py-4 flex items-center justify-center">
        <ActivityIndicator size="small" color="#000" />
      </View>
    );
  };

  const handleScroll = (event) => {
    const currentY = event.nativeEvent.contentOffset.y;
    if (currentY > prevScrollY.current && currentY > 40) {
      setHideHeader(true);
    } else if (currentY < prevScrollY.current) {
      setHideHeader(false);
    }
    prevScrollY.current = currentY;
  };

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-[#DCDCDE]">
        <Header hideHeader={hideHeader} height={HEADER_HEIGHT} addSpacer={false} />
        <MotiView
          from={{ height: HEADER_HEIGHT }}
          animate={{ height: hideHeader ? 0 : HEADER_HEIGHT }}
          transition={{ type: 'timing', duration: 300 }}
          className="w-full bg-[#DCDCDE]"
        />
        <View className="p-4 space-y-4">
          <PostSkeleton />
          <ThreadSkeleton />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-[#DCDCDE]">
        <Header hideHeader={hideHeader} height={HEADER_HEIGHT} />
        <MotiView
          from={{ height: HEADER_HEIGHT }}
          animate={{ height: hideHeader ? 0 : HEADER_HEIGHT }}
          transition={{ type: 'timing', duration: 300 }}
          className="w-full bg-[#DCDCDE]"
        />
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-red-500 text-center mb-4">
            {error instanceof Error ? error.message : "An error occurred loading your feed"}
          </Text>
          <TouchableOpacity
            className="bg-black py-3 px-6 rounded-full"
            onPress={() => refetch()}
          >
            <Text className="text-white font-medium">Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      <Header hideHeader={hideHeader} height={HEADER_HEIGHT} addSpacer={false} />
      <MotiView
        from={{ height: HEADER_HEIGHT }}
        animate={{ height: hideHeader ? 0 : HEADER_HEIGHT }}
        transition={{ type: 'timing', duration: 300 }}
        className="w-full bg-[#DCDCDE]"
      />
      <View className="flex-1">
        <FlashList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={400}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
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

const PostSkeleton = () => (
  <View className="bg-[#DCDCDE] rounded-lg overflow-hidden mb-4">
    <View className="flex-row items-center p-3">
      <SkeletonElement width={40} height={40} radius={9999} />
      <View className="ml-3">
        <SkeletonElement width={120} height={20} />
      </View>
    </View>

    <SkeletonElement width="100%" height={350} radius={16} />

    <View className="p-4">
      <View className="flex-row justify-end mb-2">
        <SkeletonElement width={80} height={10} />
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row space-x-8">
          <SkeletonElement width={20} height={20} />
          <SkeletonElement width={20} height={20} />
        </View>
        <SkeletonElement width={20} height={20} />
      </View>
    </View>
  </View>
);

const ThreadSkeleton = () => (
  <View className="bg-[#DCDCDE] rounded-lg overflow-hidden mb-4">
    <View className="flex-row items-center p-3">
      <SkeletonElement width={40} height={40} radius="round" />
      <View className="ml-3">
        <SkeletonElement width={120} height={20} />
      </View>
    </View>

    <View className="p-4">
      <SkeletonElement width="100%" height={20} />
      <SkeletonElement width="90%" height={20} />
      <SkeletonElement width="80%" height={20} />
    </View>

    <View className="p-4">
      <View className="flex-row justify-end mb-2">
        <SkeletonElement width={80} height={10} />
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row space-x-8">
          <SkeletonElement width={20} height={20} />
          <SkeletonElement width={20} height={20} />
        </View>
        <SkeletonElement width={20} height={20} />
      </View>
    </View>
  </View>
);