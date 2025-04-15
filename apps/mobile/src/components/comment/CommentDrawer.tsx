import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAtom } from 'jotai';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
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
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      )}
    >
      <BottomSheetView style={styles.container}>
        <View className="px-4 py-3 border-b border-[#e5e5e5]">
          <Text className="text-xs text-neutral-800 text-center">
            {comments.length} COMMENTS
          </Text>
        </View>
        
        <View style={styles.commentListContainer}>
          <CommentList 
            comments={comments} 
            loading={queryResult.isLoading}
            hasNextPage={queryResult.data?.hasNextPage || false}
            loadingMore={queryResult.isFetching}
            onLoadMore={handleLoadMore}
          />
        </View>
        
        <View className="px-6 pt-6 pb-8 border-t border-[#e5e5e5] bg-white">
          <CommentInput />
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  commentListContainer: {
    flex: 1,
  }
});