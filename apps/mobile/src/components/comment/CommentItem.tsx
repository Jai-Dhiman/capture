import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Comment, useCommentReplies, useDeleteComment } from '../../hooks/useComments';
import { ProfileImage } from '../media/ProfileImage';
import { CommentInput } from './CommentInput';
import { useSessionStore } from '../../stores/sessionStore';
import { CommentSkeleton } from './CommentSkeleton';
import { LoadingSpinner } from 'components/LoadingSpinner';

interface CommentItemProps {
  comment: Comment;
  postId: string;
  onReplyAdded: () => void;
  isReply?: boolean;
}

export const CommentItem: React.FC<CommentItemProps> = ({ 
  comment, 
  postId,
  onReplyAdded,
  isReply = false
}) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [repliesPage, setRepliesPage] = useState(1);
  const REPLIES_PER_PAGE = 3;
  const { authUser } = useSessionStore();
  
  const deleteCommentMutation = useDeleteComment();
  
  const hasIncludedReplies = comment.replies && Array.isArray(comment.replies);
  const replyCount = comment.replyCount || (hasIncludedReplies ? comment.replies?.length : 0);
  
  const { 
    data: fetchedReplies, 
    isLoading: repliesLoading, 
    refetch: refetchReplies 
  } = useCommentReplies(comment.id, showReplies && !hasIncludedReplies, { 
    limit: repliesPage * REPLIES_PER_PAGE
  });
  
  const replies = hasIncludedReplies ? comment.replies : fetchedReplies;
  
  const loadMoreReplies = useCallback(() => {
    if (!repliesLoading) {
      setRepliesPage(prev => prev + 1);
    }
  }, [repliesLoading]);
  
  useEffect(() => {
    if (showReplies && !hasIncludedReplies) {
      refetchReplies();
    }
  }, [repliesPage, showReplies, hasIncludedReplies]);
  
  const handleDelete = async () => {
    try {
      await deleteCommentMutation.mutateAsync({ 
        commentId: comment.id,
        postId,
        parentCommentId: comment.parentComment?.id
      });
    } catch (error) {
      console.error('Failed to delete comment:', error);
      Alert.alert("Error", "Failed to delete comment");
    }
  };
  
  const formattedDate = new Date(comment.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  
  const isOwner = authUser?.id === comment.user?.id;
  
  return (
    <View className={`mb-3 ${isReply ? 'ml-8' : ''}`}>
      <View className="flex-row">
        {/* User avatar */}
        <View className="w-8 h-8 rounded-full overflow-hidden mr-3">
          {comment.user?.profileImage ? (
            <ProfileImage cloudflareId={comment.user.profileImage} />
          ) : (
            <View className="w-full h-full bg-gray-200 rounded-full" />
          )}
        </View>
        
        {/* Comment content */}
        <View className="flex-1 bg-gray-50 rounded-lg p-2">
          <View className="flex-row justify-between items-center">
            <Text className="font-medium">{comment.user?.username || 'User'}</Text>
            {deleteCommentMutation.isPending ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : isOwner && (
              <TouchableOpacity 
                onPress={() => {
                  Alert.alert(
                    "Delete Comment",
                    "Are you sure you want to delete this comment?",
                    [
                      {
                        text: "Cancel",
                        style: "cancel"
                      },
                      { 
                        text: "Delete", 
                        onPress: handleDelete,
                        style: "destructive"
                      }
                    ]
                  );
                }}
                className="bg-red-50 p-1 rounded-full"
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
          
          <Text className="mt-1">{comment.content}</Text>
          
          <View className="flex-row justify-between mt-2">
            <Text className="text-xs text-gray-500">{formattedDate}</Text>
            
            {!isReply && (
              <TouchableOpacity 
                onPress={() => setShowReplyInput(!showReplyInput)}
                className="flex-row items-center"
              >
                <Text className="text-xs color=#e4cac7 mr-1">Reply</Text>
                <Ionicons name="return-down-forward-outline" size={12} color="#E4cac7" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      
      {/* Reply input */}
      {showReplyInput && !isReply && (
        <View className="ml-11 mt-2">
          <CommentInput 
            postId={postId} 
            parentCommentId={comment.id}
            isReply
            onCommentAdded={() => {
              setShowReplyInput(false);
              setShowReplies(true);
              refetchReplies();
              onReplyAdded();
            }}
          />
        </View>
      )}
      
      {/* Show/hide replies button */}
      {!isReply && (replies?.length > 0 || showReplies) && (
        <TouchableOpacity 
          className="ml-11 mt-1 flex-row items-center" 
          onPress={() => setShowReplies(!showReplies)}
        >
          <Ionicons 
            name={showReplies ? "chevron-up" : "chevron-down"} 
            size={12} 
            color="#666" 
          />
          <Text className="text-xs text-gray-600 ml-1">
            {showReplies ? 'Hide replies' : `View ${replies?.length || ''} replies`}
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Replies */}
      {showReplies && (
    <View className="mt-2">
      {repliesLoading && !hasIncludedReplies ? (
        <>
          <CommentSkeleton isReply={true} />
          <CommentSkeleton isReply={true} />
        </>
      ) : replies && replies.length > 0 ? (
        <>
          {replies.map((reply: Comment) => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              postId={postId}
              onReplyAdded={onReplyAdded}
              isReply
            />
          ))}
          
          {!hasIncludedReplies && replies.length < (replyCount || 0) && (
            <TouchableOpacity 
              onPress={loadMoreReplies}
              className="ml-11 mt-2 items-start"
              disabled={repliesLoading}
            >
              {repliesLoading ? (
                <LoadingSpinner />
              ) : (
                <Text className="text-xs color=#e4cac7">
                  Load more replies
                </Text>
              )}
            </TouchableOpacity>
          )}
        </>
      ) : (
        <Text className="text-xs text-gray-500 ml-11">No replies yet</Text>
      )}
        </View>
      )}
    </View>
  );
};