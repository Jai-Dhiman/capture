import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Comment } from '../../types/commentTypes';
import { CommentItem } from './CommentItem';
import { CommentSkeleton } from './CommentSkeleton';

interface CommentListProps {
  comments: Comment[];
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
}

export const CommentList: React.FC<CommentListProps> = ({
  comments,
  loading,
  loadingMore,
  hasNextPage,
  onLoadMore
}) => {
  if (loading && comments.length === 0) {
    return (
      <View className="py-2">
        <CommentSkeleton />
        <CommentSkeleton />
        <CommentSkeleton />
      </View>
    );
  }

  if (comments.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-gray-500">No comments yet</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={comments}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <CommentItem comment={item} />
      )}
      estimatedItemSize={100}
      contentContainerStyle={{ paddingVertical: 16, paddingBottom: 50 }}
      ItemSeparatorComponent={() => <View className="h-2" />}
      onEndReached={hasNextPage ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      removeClippedSubviews={true}
      getItemType={(item) => {
        return item.isDeleted ? 'deleted' : 'active';
      }}
      ListFooterComponent={
        <>
          {loadingMore ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#e4cac7" />
            </View>
          ) : hasNextPage ? (
            <TouchableOpacity
              onPress={onLoadMore}
              className="py-4 items-center"
            >
              <Text className="text-blue-500">Load more comments</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ height: 60 }} />
        </>
      }
    />
  );
};