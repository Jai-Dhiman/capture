import React, { useState } from 'react';
import { View, useWindowDimensions, Text, FlatList, TouchableOpacity } from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { FlatGrid } from 'react-native-super-grid';
import { PostsGrid } from './PostsGrid';
import { ThreadItem } from '../post/ThreadItem';
import { PostItem } from '../post/PostItem';
import PhotosIcon from "../../../assets/icons/PhotosIcon.svg";
import TextIcon from "../../../assets/icons/TextIcon.svg";
import SavedPosts from "../../../assets/icons/FavoriteIcon.svg";

const INITIAL_PAGE_SIZE = 15;
const ADDITIONAL_PAGE_SIZE = 10;

interface ProfileTabViewProps {
  posts: any[];
  savedPosts: any[];
  itemSize: number;
  spacing: number;
  onPostPress: (post: any) => void;
  isLoading: boolean;
  isLoadingSaved: boolean;
  onTabPress?: (index: number) => void;
}

export const ProfileTabView = ({
  posts,
  savedPosts,
  itemSize,
  spacing,
  onPostPress,
  isLoading,
  isLoadingSaved,
  onTabPress
}: ProfileTabViewProps) => {
  const layout = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'posts', title: 'Posts' },
    { key: 'threads', title: 'Threads' },
    { key: 'saved', title: 'Saved' }
  ]);

  const photoPosts = posts.filter(post => post.type === 'post');
  const threadPosts = posts.filter(post => post.type === 'thread');
  const savedPhotoPosts = savedPosts.filter(post => post.type === 'post');
  const savedThreadPosts = savedPosts.filter(post => post.type === 'thread');

  const renderPhotosTab = () => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center">
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

    return (
      <FlatGrid
        itemDimension={itemSize}
        spacing={spacing}
        data={photoPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostsGrid
            post={item}
            onPress={onPostPress}
            itemSize={itemSize}
          />
        )}
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={INITIAL_PAGE_SIZE}
      />
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
        renderItem={({ item }) => <ThreadItem thread={item} />}
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

    const [savedTabType, setSavedTabType] = useState<'post' | 'thread'>('post');
    const filteredSavedPosts = savedPosts.filter(post => post.type === savedTabType);

    return (
      <View className="flex-1">
        <View className="flex-row border-b border-gray-200 py-2">
          <TouchableOpacity 
            className={`flex-1 items-center py-2 ${savedTabType === 'post' ? 'border-b-2 border-gray-800' : ''}`}
            onPress={() => setSavedTabType('post')}
          >
            <Text>Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 items-center py-2 ${savedTabType === 'thread' ? 'border-b-2 border-gray-800' : ''}`}
            onPress={() => setSavedTabType('thread')}
          >
            <Text>Threads</Text>
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={filteredSavedPosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            savedTabType === 'post' 
              ? <PostItem post={item} /> 
              : <ThreadItem thread={item} />
          )}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={5}
          windowSize={5}
          initialNumToRender={5}
        />
      </View>
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

  const renderTabBar = (props: any) => (
    <View className="w-full h-16 bg-zinc-300 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
      <View className="flex-row justify-center items-center h-full">
        <TouchableOpacity 
          onPress={() => handleTabPress(0)}
          className="mx-8"
        >
          <View className={index === 0 ? "w-7 h-7 bg-stone-300 rounded-[10px] items-center justify-center" : "items-center justify-center"}>
            <PhotosIcon width={20} height={20} />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => handleTabPress(1)}
          className="mx-8"
        >
          <View className={index === 1 ? "w-7 h-7 bg-stone-300 rounded-[10px] items-center justify-center" : "items-center justify-center"}>
            <TextIcon width={20} height={20} />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => handleTabPress(2)}
          className="mx-8"
        >
          <View className={index === 2 ? "w-7 h-7 bg-stone-300 rounded-[10px] items-center justify-center" : "items-center justify-center"}>
            <SavedPosts width={20} height={20} />
          </View>
        </TouchableOpacity>
      </View>
      <View className="h-px bg-black/10 w-72 self-center" />
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