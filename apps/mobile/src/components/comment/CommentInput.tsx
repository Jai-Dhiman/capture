import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, Text, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateComment } from '../../hooks/useComments';
import { useSessionStore } from '../../stores/sessionStore';
import { useQueryClient } from '@tanstack/react-query';

interface CommentInputProps {
  postId: string;
  parentCommentId?: string;
  isReply?: boolean;
  onCommentAdded: () => void;
}

export const CommentInput: React.FC<CommentInputProps> = ({ 
  postId, 
  parentCommentId,
  isReply = false,
  onCommentAdded 
}) => {
  const [content, setContent] = useState('');
  const createCommentMutation = useCreateComment();
  const { userProfile, authUser } = useSessionStore();
  const queryClient = useQueryClient();
  
  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    const optimisticComment = {
      id: `temp-${Date.now()}`,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      user: {
        id: userProfile?.id || '',
        username: userProfile?.username || '',
        image: userProfile?.profileImage
      },
      parentComment: parentCommentId ? { id: parentCommentId } : null,
      optimistic: true
    };
    
    const queryKey = ['comments', postId, parentCommentId];
    queryClient.setQueryData(queryKey, (oldData: any[] = []) => {
      return [optimisticComment, ...oldData];
    });
    
    try {
      await createCommentMutation.mutateAsync({
        postId,
        content: content.trim(),
        parentCommentId
      });
      
      setContent('');
      Keyboard.dismiss();
      onCommentAdded();
    } catch (error) {
      queryClient.setQueryData(queryKey, (oldData: any[] = []) => {
        return oldData.filter(comment => comment.id !== optimisticComment.id);
      });
      console.error('Failed to create comment:', error);
    }
  };
  
  return (
    <View className={`flex-row items-center p-2 bg-gray-50 rounded-lg ${isReply ? '' : 'mx-4 my-2'}`}>
      <TextInput
        className="flex-1 bg-white rounded-full px-4 py-2"
        placeholder={isReply ? "Write a reply..." : "Write a comment..."}
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={1000}
      />
      
      {createCommentMutation.isPending ? (
        <ActivityIndicator size="small" color="#0000ff" className="ml-2" />
      ) : (
        <TouchableOpacity 
          onPress={handleSubmit} 
          disabled={!content.trim()}
          className={`ml-2 ${!content.trim() ? 'opacity-50' : ''}`}
        >
          <Ionicons name="send" size={24} color="#3b82f6" />
        </TouchableOpacity>
      )}
    </View>
  );
};