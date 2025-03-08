import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePostComments } from '../../hooks/useComments';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';
import { CommentSkeleton } from './CommentSkeleton';

interface CommentSectionProps {
  postId: string;
  commentCount?: number;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ 
  postId, 
  commentCount = 0 
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [page, setPage] = useState(1);
  const COMMENTS_PER_PAGE = 5;
  
  const { 
    data: comments, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isFetching
  } = usePostComments(postId, null, { 
    enabled: showComments,
    limit: page * COMMENTS_PER_PAGE,
    includeFirstReplies: true,
    repliesLimit: 2
  });
  
  // Determine if there are more comments to load
  const hasMoreComments = comments && comments.length < commentCount;
  
  const toggleComments = () => {
    setShowComments(!showComments);
    if (!showComments) {
      refetch();
    }
  };
  
  const handleCommentIconPress = () => {
    setShowInput(!showInput);
    if (!showComments) {
      setShowComments(true);
    }
  };

  const loadMoreComments = useCallback(() => {
    if (!isFetching && hasMoreComments) {
      setPage(prev => prev + 1);
    }
  }, [isFetching, hasMoreComments]);

  useEffect(() => {
    if (showComments) {
      refetch();
    }
  }, [page, showComments]);

  return (
    <View className="mt-2">
      {/* Comment controls */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <TouchableOpacity 
          onPress={toggleComments}
          className="flex-row items-center"
        >
          <Text className="text-gray-700 font-medium mr-1">
            {commentCount > 0 ? `${commentCount} Comments` : "Comments"}
          </Text>
          <Ionicons 
            name={showComments ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#666" 
          />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleCommentIconPress}>
          <Ionicons name="chatbubble-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      {/* Comment input */}
      {showInput && (
        <CommentInput 
          postId={postId} 
          onCommentAdded={() => {
            refetch();
            setShowInput(false);
          }}
        />
      )}
      
      {/* Comments list */}
      {showComments && (
        <View className="px-4">
          {isLoading ? (
            <>
              <CommentSkeleton replyCount={1} />
              <CommentSkeleton />
              <CommentSkeleton replyCount={2} />
            </>
          ) : isError ? (
            <Text className="text-red-500 py-2">
              Error loading comments: {(error as Error)?.message || 'Unknown error'}
            </Text>
          ) : comments && comments.length > 0 ? (
            <>
              <CommentList 
                comments={comments} 
                postId={postId}
                onReplyAdded={() => refetch()}
              />
              
              {/* Load more comments button */}
              {hasMoreComments && (
                <TouchableOpacity 
                  onPress={loadMoreComments}
                  className="py-3 items-center"
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <ActivityIndicator size="small" color="#0000ff" />
                  ) : (
                    <Text className="text-blue-500">
                      Load more comments
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text className="text-gray-500 py-2 text-center">No comments yet</Text>
          )}
        </View>
      )}
    </View>
  );
};