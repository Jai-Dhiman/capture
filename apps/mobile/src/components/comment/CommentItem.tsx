import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Comment, useCommentReplies, useDeleteComment } from '../../hooks/useComments';
import { ProfileImage } from '../media/ProfileImage';
import { CommentInput } from './CommentInput';
import { useSessionStore } from '../../stores/sessionStore';

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
  const { authUser } = useSessionStore();
  
  const deleteCommentMutation = useDeleteComment();
  
  const { 
    data: replies, 
    isLoading: repliesLoading, 
    refetch: refetchReplies 
  } = useCommentReplies(comment.id, showReplies);
  
  const handleDelete = async () => {
    try {
      await deleteCommentMutation.mutateAsync({ 
        commentId: comment.id,
        postId,
        parentCommentId: comment.parentComment?.id
      });
    } catch (error) {
      console.error('Failed to delete comment:', error);
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
          {comment.user?.image ? (
            <ProfileImage cloudflareId={comment.user.image} />
          ) : (
            <View className="w-full h-full bg-gray-200 rounded-full" />
          )}
        </View>
        
        {/* Comment content */}
        <View className="flex-1 bg-gray-50 rounded-lg p-2">
          <View className="flex-row justify-between">
            <Text className="font-medium">{comment.user?.username || 'User'}</Text>
            {isOwner && !deleteCommentMutation.isPending && (
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons name="trash-outline" size={16} color="#999" />
              </TouchableOpacity>
            )}
            {deleteCommentMutation.isPending && (
              <ActivityIndicator size="small" color="#999" />
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
                <Text className="text-xs text-blue-500 mr-1">Reply</Text>
                <Ionicons name="return-down-forward-outline" size={12} color="#3b82f6" />
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
          {repliesLoading ? (
            <ActivityIndicator size="small" color="#0000ff" className="ml-11" />
          ) : replies && replies.length > 0 ? (
            replies.map((reply: Comment) => (
              <CommentItem 
                key={reply.id} 
                comment={reply} 
                postId={postId}
                onReplyAdded={onReplyAdded}
                isReply
              />
            ))
          ) : (
            <Text className="text-xs text-gray-500 ml-11">No replies yet</Text>
          )}
        </View>
      )}
    </View>
  );
};