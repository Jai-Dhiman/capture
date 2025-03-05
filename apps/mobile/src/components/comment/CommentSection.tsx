import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePostComments } from '../../hooks/useComments';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';

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
  const [expandComments, setExpandComments] = useState(false);
  
  // Only fetch comments when they're being shown
  const { 
    data: comments, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = usePostComments(postId, null, { 
    enabled: showComments,
    limit: expandComments ? 50 : 2 // Fetch either 2 or 50 comments based on expansion state
  });
  
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

  const remainingComments = Math.max(0, (commentCount || 0) - 2);
  
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
            <ActivityIndicator size="small" color="#0000ff" className="py-4" />
          ) : isError ? (
            <Text className="text-red-500 py-2">
              Error loading comments: {(error as Error)?.message || 'Unknown error'}
            </Text>
          ) : comments && comments.length > 0 ? (
            <>
              <CommentList 
                comments={expandComments ? comments : comments.slice(0, 2)} 
                postId={postId}
                onReplyAdded={() => refetch()}
              />
              
              {!expandComments && remainingComments > 0 && (
                <TouchableOpacity 
                  onPress={() => setExpandComments(true)}
                  className="py-2"
                >
                  <Text className="text-blue-500">
                    See {remainingComments} more {remainingComments === 1 ? 'comment' : 'comments'}
                  </Text>
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