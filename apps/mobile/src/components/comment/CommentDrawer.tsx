import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAtom } from 'jotai';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { 
  commentDrawerOpenAtom, 
  currentPostIdAtom,
  commentSortAtom,
  combinedCommentsAtom,
  commentsQueryAtom,
  loadMoreCommentsAtom
} from '../../atoms/commentAtoms';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';

export const CommentDrawer = () => {
  const [isOpen, setIsOpen] = useAtom(commentDrawerOpenAtom);
  const [postId] = useAtom(currentPostIdAtom);
  const [comments] = useAtom(combinedCommentsAtom);
  const [sortBy, setSortBy] = useAtom(commentSortAtom);
  const [, loadMoreComments] = useAtom(loadMoreCommentsAtom);
  const queryResult = useAtom(commentsQueryAtom)[0];
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);
  
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);
  
  const toggleSort = useCallback(() => {
    setSortBy(prev => prev === 'newest' ? 'oldest' : 'newest');
  }, [setSortBy]);
  
  const handleLoadMore = useCallback(() => {
    if (queryResult.data?.hasNextPage && !queryResult.isFetching) {
      loadMoreComments();
    }
  }, [queryResult, loadMoreComments]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={isOpen ? 0 : -1}
      snapPoints={snapPoints}
      onChange={(index) => setIsOpen(index > -1)}
      handleIndicatorStyle={{ backgroundColor: '#999', width: 40 }}
      backgroundStyle={{ backgroundColor: '#fff' }}
      enablePanDownToClose={true}
    >
      <BottomSheetView className="flex-1 p-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-semibold">Comments</Text>
          <TouchableOpacity 
            onPress={handleClose} 
            className="p-1"
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        <View className="mb-3 items-end">
          <TouchableOpacity 
            onPress={toggleSort} 
            className="flex-row items-center p-2"
          >
            <Text className="mr-2 text-gray-600">Sort by: {sortBy}</Text>
            <Ionicons 
              name={sortBy === 'newest' ? 'arrow-down' : 'arrow-up'} 
              size={16} 
              color="#666" 
            />
          </TouchableOpacity>
        </View>
        
        <CommentInput />
        
        <CommentList 
          comments={comments} 
          loading={queryResult.isLoading}
          hasNextPage={queryResult.data?.hasNextPage || false}
          loadingMore={queryResult.isFetching}
          onLoadMore={handleLoadMore}
        />
      </BottomSheetView>
    </BottomSheet>
  );
};