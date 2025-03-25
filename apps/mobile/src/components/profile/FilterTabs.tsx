import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import PhotosIcon from "../../../assets/icons/PhotosIcon.svg";
import TextIcon from "../../../assets/icons/TextIcon.svg";
import SavedPosts from "../../../assets/icons/FavoriteIcon.svg";

interface FilterTabsProps {
  postFilter: 'posts' | 'threads';
  onFilterChange: (filter: 'posts' | 'threads') => void;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  postFilter,
  onFilterChange
}) => {
  return (
    <View className="flex-row justify-around py-2 items-center">
      <TouchableOpacity 
        className="items-center justify-center"
        onPress={() => onFilterChange('posts')}
      >
        <View className={postFilter === 'posts' ? "bg-stone-300 bg-opacity-30 w-7 h-7 rounded-[10px] items-center justify-center" : ""}>
          <PhotosIcon width={20} height={20}/>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        className="items-center justify-center"
        onPress={() => onFilterChange('threads')}
      >
        <View className={postFilter === 'threads' ? "bg-stone-300 bg-opacity-30 w-7 h-7 rounded-[10px] items-center justify-center" : ""}>
          <TextIcon width={20} height={20} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        className="items-center justify-center"
        onPress={() => {/* Saved posts */}}
      >
        <SavedPosts width={20} height={20}/>
      </TouchableOpacity>
    </View>
  );
};