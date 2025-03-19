import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ProfileImage } from '../media/ProfileImage';
import { useCommentActions } from '../../hooks/useCommentActions';
import { useAuthStore } from '../../stores/authStore';
import { Comment } from '../../types/commentTypes';

interface CommentItemProps {
  comment: Comment;
}

export const CommentItem: React.FC<CommentItemProps> = ({ comment }) => {
  const { deleteComment, startReply } = useCommentActions();
  const { user } = useAuthStore();
  const isOwner = user?.id === comment.user?.id;
  
  const handleDelete = () => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          onPress: () => deleteComment(comment.id),
          style: "destructive"
        }
      ]
    );
  };
  
  const handleReply = () => {
    startReply({ id: comment.id, path: comment.path });
  };
  
  const formattedDate = format(new Date(comment.createdAt), 'MMM d, yyyy');
  
  const indentation = Math.min(comment.depth * 16, 48);
  
  return (
    <View 
      style={{ 
        marginLeft: indentation,
        marginBottom: 12,
        opacity: comment.optimistic ? 0.7 : 1
      }}
    >
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
            {isOwner && (
              <TouchableOpacity 
                onPress={handleDelete}
                className="bg-red-50 p-1 rounded-full"
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
          
          <Text className="mt-1">{comment.content}</Text>
          
          <View className="flex-row justify-between mt-2">
            <Text className="text-xs text-gray-500">{formattedDate}</Text>
            
            <TouchableOpacity 
              onPress={handleReply}
              className="flex-row items-center"
            >
              <Text className="text-xs color=#e4cac7 mr-1">Reply</Text>
              <Ionicons name="return-down-forward-outline" size={12} color="#E4cac7" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {comment.optimistic && (
        <View className="flex-row items-center ml-11 mt-1">
          <Ionicons name="time-outline" size={12} color="#666" />
          <Text className="text-xs text-gray-500 ml-1">Sending...</Text>
        </View>
      )}
    </View>
  );
};