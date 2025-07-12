import { PostItem } from '@/features/post/components/PostItem';
import { ThreadItem } from '@/features/post/components/ThreadItem';
import type { Post, Thread } from '@/features/post/types/postTypes';
import Header from '@/shared/components/Header';
import { HeaderSpacer } from '@/shared/components/HeaderSpacer';
import { SkeletonElement } from '@/shared/components/SkeletonLoader';
import { useHeaderAnimation } from '@/shared/hooks/useHeaderAnimation';
import { FlashList } from '@shopify/flash-list';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { useDiscoverFeed } from '../hooks/useDiscoverFeed';
import { useFollowingFeed } from '../hooks/useFollowingFeed';
import { useMarkPostsAsSeen } from '@/features/post/hooks/usePosts';

const HEADER_HEIGHT = 150;

export default function Feed() {
  const [refreshing, setRefreshing] = useState(false);
  const seenPostIdsRef = useRef(new Set<string>());

  // Header animation hook - only show header on fast upward scrolls
  const { hideHeader, handleScroll, resetHeader } = useHeaderAnimation({
    hideThreshold: 40,
    showThreshold: 0,
    fastScrollVelocity: 3.0, // Require 3.0 pixels/ms upward velocity to show header
  });

  // Use both feeds directly
  const followingFeed = useFollowingFeed(10);
  const discoveryFeed = useDiscoverFeed(10);
  const { mutate: markAsSeen } = useMarkPostsAsSeen();

  // Create seamless unified feed: following posts first, then discovery
  const { posts, isLoading, isError, error, hasNextPage, isFetchingNextPage } = useMemo(() => {
    const followingPosts = followingFeed.data?.pages.flatMap((page) => page.posts) || [];
    const discoveryPosts = discoveryFeed.data?.pages.flatMap((page) => page.posts) || [];

    // Following posts first, then discovery posts (remove duplicates)
    const seenIds = new Set(followingPosts.map(p => p.id));
    const uniqueDiscoveryPosts = discoveryPosts.filter(p => !seenIds.has(p.id));

    // Additional deduplication to prevent same posts appearing multiple times
    const allPostsMap = new Map();

    // Add following posts first
    for (const post of followingPosts) {
      allPostsMap.set(post.id, post);
    }

    // Add unique discovery posts
    for (const post of uniqueDiscoveryPosts) {
      if (!allPostsMap.has(post.id)) {
        allPostsMap.set(post.id, post);
      }
    }

    const allPosts = Array.from(allPostsMap.values());

    // Smart loading state - show loading if either feed is loading and we have no posts
    const isLoading = (followingFeed.isLoading || discoveryFeed.isLoading) && allPosts.length === 0;

    // Error handling - show error only if both feeds fail
    const isError = followingFeed.isError && discoveryFeed.isError;
    const error = followingFeed.error || discoveryFeed.error;

    // Pagination - has more if either feed has more
    const hasNextPage = followingFeed.hasNextPage || discoveryFeed.hasNextPage || false;
    const isFetchingNextPage = followingFeed.isFetchingNextPage || discoveryFeed.isFetchingNextPage;

    return {
      posts: allPosts,
      isLoading,
      isError,
      error,
      hasNextPage,
      isFetchingNextPage,
    };
  }, [
    followingFeed.data,
    followingFeed.isLoading,
    followingFeed.isError,
    followingFeed.error,
    followingFeed.hasNextPage,
    followingFeed.isFetchingNextPage,
    discoveryFeed.data,
    discoveryFeed.isLoading,
    discoveryFeed.isError,
    discoveryFeed.error,
    discoveryFeed.hasNextPage,
    discoveryFeed.isFetchingNextPage,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    resetHeader(); // Reset header when refreshing
    await Promise.allSettled([
      followingFeed.refetch(),
      discoveryFeed.refetch()
    ]);
    setRefreshing(false);
  }, [followingFeed.refetch, discoveryFeed.refetch, resetHeader]);

  useEffect(() => {
    if (posts.length > 0) {
      const newPostIds = posts.map((p) => p.id).filter((id) => !seenPostIdsRef.current.has(id));

      if (newPostIds.length > 0) {
        for (const id of newPostIds) {
          seenPostIdsRef.current.add(id);
        }
        markAsSeen(newPostIds);
      }
    }
  }, [posts, markAsSeen]);

  const renderItem = useCallback(({ item }: { item: Post | Thread }) => {
    if (item.type === 'thread') {
      return <ThreadItem thread={item} />;
    }
    return <PostItem post={item} />;
  }, []);

  const keyExtractor = useCallback((item: Post | Thread) => item.id, []);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      if (followingFeed.hasNextPage) {
        followingFeed.fetchNextPage();
      }
      if (discoveryFeed.hasNextPage) {
        discoveryFeed.fetchNextPage();
      }
    }
  }, [hasNextPage, isFetchingNextPage, followingFeed, discoveryFeed]);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;

    return (
      <View className="py-4 flex items-center justify-center">
        <ActivityIndicator size="small" color="#000" />
      </View>
    );
  }, [isFetchingNextPage]);

  // Reset header when switching between states
  useEffect(() => {
    resetHeader();
  }, [resetHeader]);

  if (isLoading && !refreshing) {
    return (
      <View className="flex-1 bg-[#DCDCDE]">
        <Header hideHeader={hideHeader} height={HEADER_HEIGHT} addSpacer={false} />
        <HeaderSpacer hideHeader={hideHeader} height={HEADER_HEIGHT} />
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
        <Header hideHeader={hideHeader} height={HEADER_HEIGHT} addSpacer={false} />
        <HeaderSpacer hideHeader={hideHeader} height={HEADER_HEIGHT} />
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-red-500 text-center mb-4">
            {error instanceof Error ? error.message : 'An error occurred loading your feed'}
          </Text>
          <TouchableOpacity className="bg-black py-3 px-6 rounded-full" onPress={handleRefresh}>
            <Text className="text-white font-medium">Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#DCDCDE]">
      <Header hideHeader={hideHeader} height={HEADER_HEIGHT} addSpacer={false} />
      <HeaderSpacer hideHeader={hideHeader} height={HEADER_HEIGHT} />
      <View className="flex-1">
        <FlashList
          data={posts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={400}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <EmptyState
              title="Your Feed is Empty"
              message="Start following other users to see their posts here, or check back later for personalized content recommendations."
              icon="inbox"
            />
          }
        />
      </View>
    </View>
  );
}

const PostSkeleton = React.memo(() => (
  <View className="bg-[#DCDCDE] rounded-lg overflow-hidden mb-4">
    <View className="flex-row items-center p-3">
      <View className="w-12 h-12 mr-3 drop-shadow-md">
        <SkeletonElement width={40} height={40} radius={24} />
      </View>
      <View>
        <SkeletonElement width={120} height={20} />
      </View>
      <View className="flex-1" />
      <SkeletonElement width={24} height={24} />
    </View>

    <View className="w-full h-[300px] p-2">
      <View className="w-full h-full flex-row" style={{ gap: 8 }}>
        <View
          className="flex-1 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#f0f0f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.15,
            shadowRadius: 5,
            elevation: 4,
          }}
        >
          <SkeletonElement width="100%" height="100%" />
        </View>
        <View
          className="flex-1 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#f0f0f0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.15,
            shadowRadius: 5,
            elevation: 4,
          }}
        >
          <SkeletonElement width="100%" height="100%" />
        </View>
      </View>
    </View>

    <View className="p-4">
      <View className="flex-row justify-end mb-2">
        <SkeletonElement width={80} height={10} />
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row">
          <View className="mr-4">
            <SkeletonElement width={20} height={20} />
          </View>
          <View className="mr-10">
            <SkeletonElement width={20} height={20} />
          </View>
        </View>
        <SkeletonElement width={20} height={20} />
      </View>
    </View>
  </View>
));

const ThreadSkeleton = React.memo(() => (
  <View className="bg-[#DCDCDE] rounded-lg overflow-hidden mb-4">
    <View className="flex-row items-center p-3">
      <View className="w-12 h-12 mr-3 drop-shadow-md">
        <SkeletonElement width={40} height={40} radius={24} />
      </View>
      <View>
        <SkeletonElement width={120} height={20} />
      </View>
      <View className="flex-1" />
      <SkeletonElement width={24} height={24} />
    </View>

    <View className="p-3">
      <View className="mb-2">
        <SkeletonElement width="100%" height={16} />
      </View>
      <View className="mb-2">
        <SkeletonElement width="90%" height={16} />
      </View>
      <SkeletonElement width="80%" height={16} />
    </View>

    <View className="p-4">
      <View className="flex-row justify-end mb-2">
        <SkeletonElement width={80} height={10} />
      </View>

      <View className="flex-row justify-between items-center">
        <View className="flex-row">
          <View className="mr-4">
            <SkeletonElement width={20} height={20} />
          </View>
          <View className="mr-10">
            <SkeletonElement width={20} height={20} />
          </View>
        </View>
        <SkeletonElement width={20} height={20} />
      </View>
    </View>
  </View>
));
