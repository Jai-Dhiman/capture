import React, { useState } from 'react';
import { View, useWindowDimensions, FlatList, Text, TouchableOpacity, Dimensions } from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { PostsGrid } from './PostsGrid';
import { ThreadItem } from '@features/post/components/ThreadItem';
import { PostItem } from '@features/post/components/PostItem';
import PhotosIcon from "@assets/icons/PhotosIcon.svg";
import TextIcon from "@assets/icons/TextIcon.svg";
import SavedPosts from "@assets/icons/FavoriteIcon.svg";

const INITIAL_PAGE_SIZE = 15;

interface ProfileTabViewProps {
  posts: any[];
  savedPosts: any[];
  itemSize: number;
  spacing: number;
  containerPadding: number;
  onPostPress: (post: any) => void;
  isLoading: boolean;
  isLoadingSaved: boolean;
  onTabPress?: (index: number) => void;
  carouselActive?: boolean;
}

export const ProfileTabView = ({
  posts,
  savedPosts,
  onPostPress,
  isLoading,
  isLoadingSaved,
  onTabPress
}: ProfileTabViewProps) => {
  const layout = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const containerPadding = 16;
  const [routes] = useState([
    { key: 'posts', title: 'Posts' },
    { key: 'threads', title: 'Threads' },
    { key: 'saved', title: 'Saved' }
  ]);

  const photoPosts = posts.filter(post => post.type === 'post');
  const threadPosts = posts.filter(post => post.type === 'thread');

  const renderPhotosTab = () => {
    const { width } = Dimensions.get('window');

    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center pt-4">
          <Text className="text-gray-500">Loading...</Text>
        </View>
      );
    }

    if (photoPosts.length === 0) {
      return (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-500">No posts yet</Text>
        </View>
      );
    }

    const numColumns = 3;
    const itemSpacing = 12;

    const screenWidth = width;

    const itemWidth = Math.floor((screenWidth - (2 * containerPadding) - ((numColumns - 1) * itemSpacing)) / numColumns);

    const totalGridWidth = (itemWidth * numColumns) + ((numColumns - 1) * itemSpacing);

    const leftRightPadding = Math.floor((screenWidth - totalGridWidth) / 2);

    const rows = [];
    for (let i = 0; i < photoPosts.length; i += numColumns) {
      const row = photoPosts.slice(i, i + numColumns);
      rows.push(row);
    }

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          data={rows}
          keyExtractor={(_, index) => `row-${index}`}
          renderItem={({ item: row }) => (
            <View style={{
              flexDirection: 'row',
              marginBottom: itemSpacing,
              marginLeft: leftRightPadding,
              width: totalGridWidth,
            }}>
              {row.map((post, index) => (
                <View
                  key={post.id}
                  style={{
                    width: itemWidth,
                    height: itemWidth,
                    marginRight: index < row.length - 1 ? itemSpacing : 0,
                  }}
                >
                  <PostsGrid
                    post={post}
                    onPress={onPostPress}
                    itemSize={itemWidth}
                  />
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={{
            paddingVertical: 12,
          }}
        />
      </View>
    );
  };

  const renderThreadsTab = () => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading...</Text>
        </View>
      );
    }

    if (threadPosts.length === 0) {
      return (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-500">No threads yet</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={threadPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pt-2">
            <ThreadItem thread={item} />
          </View>
        )}
        contentContainerStyle={{ paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={INITIAL_PAGE_SIZE}
      />
    );
  };

  const renderSavedTab = () => {
    if (isLoadingSaved) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading saved items...</Text>
        </View>
      );
    }

    if (savedPosts.length === 0) {
      return (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-gray-500">No saved posts yet</Text>
        </View>
      );
    }

    const sortedSavedPosts = [...savedPosts].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
      <FlatList
        data={sortedSavedPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pt-2">
            {item.type === 'post'
              ? <PostItem post={item} />
              : <ThreadItem thread={item} />}
          </View>
        )}
        contentContainerStyle={{ paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={5}
      />
    );
  };

  const renderScene = SceneMap({
    posts: renderPhotosTab,
    threads: renderThreadsTab,
    saved: renderSavedTab
  });

  const handleTabPress = (newIndex: number) => {
    setIndex(newIndex);
    if (onTabPress) {
      onTabPress(newIndex);
    }
  };

  const renderTabBar = () => (
    <View
      className="w-full h-12 bg-[#DCDCDE]"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 8,
        zIndex: 10,
        position: 'relative',
        marginBottom: 8,
      }}
    >
      <View className="flex-row justify-between items-end h-full px-4 pb-2">
        <TouchableOpacity
          onPress={() => handleTabPress(0)}
          className="flex-1 items-center"
        >
          <View className={index === 0 ? "w-8 h-8 bg-[#E4CAC7] rounded-[10px] items-center justify-center" : "items-center justify-center"}>
            <PhotosIcon width={20} height={20} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabPress(1)}
          className="flex-1 items-center"
        >
          <View className={index === 1 ? "w-8 h-8 bg-[#E4CAC7] rounded-[10px] items-center justify-center" : "items-center justify-center"}>
            <TextIcon width={20} height={20} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabPress(2)}
          className="flex-1 items-center"
        >
          <View className={index === 2 ? "w-8 h-8 bg-[#E4CAC7] rounded-[10px] items-center justify-center" : "items-center justify-center"}>
            <SavedPosts width={20} height={20} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={setIndex}
      initialLayout={{ width: layout.width }}
      renderTabBar={renderTabBar}
      lazy={true}
      lazyPreloadDistance={1}
    />
  );
};