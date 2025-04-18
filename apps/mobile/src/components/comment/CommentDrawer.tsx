import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Keyboard, Platform } from 'react-native';
import { useAtom } from 'jotai';
import BottomSheet, { 
  BottomSheetView, 
  BottomSheetBackdrop,
  BottomSheetFooter,
} from '@gorhom/bottom-sheet';
import { KeyboardAccessoryView } from 'react-native-keyboard-accessory';
import { 
  commentDrawerOpenAtom, 
  currentPostIdAtom,
  combinedCommentsAtom,
  commentsQueryAtom,
  loadMoreCommentsAtom
} from '../../atoms/commentAtoms';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CommentDrawer = () => {
  const [isOpen, setIsOpen] = useAtom(commentDrawerOpenAtom);
  const [comments] = useAtom(combinedCommentsAtom);
  const [, loadMoreComments] = useAtom(loadMoreCommentsAtom);
  const queryResult = useAtom(commentsQueryAtom)[0];
  const insets = useSafeAreaInsets();
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  useEffect(() => {
    if (isOpen && bottomSheetRef.current) {
      bottomSheetRef.current.snapToIndex(0);
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (!isOpen) {
      Keyboard.dismiss();
    }
  }, [isOpen]);
  
  const handleLoadMore = useCallback(() => {
    if (queryResult.data?.hasNextPage && !queryResult.isFetching) {
      loadMoreComments();
    }
  }, [queryResult, loadMoreComments]);

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        index={isOpen ? 0 : -1}
        snapPoints={snapPoints}
        onChange={(index) => {
          const newIsOpen = index > -1;
          setIsOpen(newIsOpen);
          if (!newIsOpen) Keyboard.dismiss();
        }}
        handleIndicatorStyle={{ backgroundColor: '#999', width: 40 }}
        backgroundStyle={{ backgroundColor: '#fff' }}
        enablePanDownToClose={true}
        keyboardBehavior="interactive"
        android_keyboardInputMode="adjustResize"
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
        </BottomSheetView>
      </BottomSheet>

      {isOpen && (
        <KeyboardAccessoryView 
          style={styles.keyboardAccessory}
          androidAdjustResize
          alwaysVisible={true}
          bumperHeight={10}
          hideBorder={true}
        >
          <View className="px-6 py-3 border-t border-[#e5e5e5] bg-white">
            <CommentInput />
          </View>
        </KeyboardAccessoryView>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  commentListContainer: {
    flex: 1,
  },
  keyboardAccessory: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
  }
});