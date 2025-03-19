import React, { useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useAtom } from 'jotai';
import BottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { 
  commentDrawerOpenAtom, 
  currentPostIdAtom,
  commentSortAtom,
  combinedCommentsAtom,
  commentsQueryAtom,
  commentPageAtom
} from '../../atoms/commentAtoms';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';

export const CommentDrawer = () => {
  const [isOpen, setIsOpen] = useAtom(commentDrawerOpenAtom);
  const [postId] = useAtom(currentPostIdAtom);
  const [comments] = useAtom(combinedCommentsAtom);
  const [sortBy, setSortBy] = useAtom(commentSortAtom);
  const [page, setPage] = useAtom(commentPageAtom);
  const queryResult = useAtom(commentsQueryAtom)[0];
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);
  
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);
  
  const toggleSort = useCallback(() => {
    setSortBy(prev => prev === 'newest' ? 'oldest' : 'newest');
    setPage(1); // Reset to first page on sort change
  }, [setSortBy, setPage]);
  
  const handleLoadMore = useCallback(() => {
    if (queryResult.data?.hasNextPage && !queryResult.isFetching) {
      setPage(prev => prev + 1);
    }
  }, [queryResult, setPage]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={isOpen ? 0 : -1}
      snapPoints={snapPoints}
      onChange={(index) => setIsOpen(index > -1)}
      handleIndicatorStyle={styles.indicator}
      backgroundStyle={styles.background}
      enablePanDownToClose={true}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Comments</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.sortContainer}>
          <TouchableOpacity onPress={toggleSort} style={styles.sortButton}>
            <Text style={styles.sortText}>Sort by: {sortBy}</Text>
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
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  indicator: {
    backgroundColor: '#999',
    width: 40,
  },
  background: {
    backgroundColor: '#fff',
  },
  sortContainer: {
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  sortText: {
    marginRight: 8,
    color: '#666',
  },
});