import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { format } from 'date-fns';
import { ProfileImage } from '../media/ProfileImage';
import { useCommentActions } from '../../hooks/useCommentActions';
import type { Comment } from '../../types/commentTypes'

export const CommentItem = ({ comment }: { comment: Comment }) => {
  const { deleteComment, startReply } = useCommentActions();
  
  const handleReply = () => {
    startReply({ id: comment.id, path: comment.path });
  };

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
  
  const timeAgo = () => {
    const now = new Date();
    const commentDate = new Date(comment.createdAt);
    const diffInHours = Math.floor((now.getTime() - commentDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays} days ago`;
  };

  const indentLevel = Math.min(comment.depth, 1);
  const isReply = comment.depth > 0;

  return (
    <View className={`border-t border-[#e5e5e5] ${isReply ? 'pl-16' : ''}`}>
      <View className="w-full p-4 flex flex-row items-start gap-2.5">
        <View className="w-11 h-11">
          {comment.user?.profileImage ? (
            <ProfileImage cloudflareId={comment.user.profileImage} style={{ width: 44, height: 44, borderRadius: 99 }} />
          ) : (
            <View className="w-11 h-11 bg-gray-200 rounded-full" />
          )}
        </View>
        
        <View className="flex-1 flex flex-col gap-1.5">
          <View className="flex flex-row justify-between items-center">
            <Text className="text-[#6B7280] text-sm font-normal">
              @{comment.user?.username || 'User'}
            </Text>
            <Text className="text-xs text-[#6B7280] text-right">
              {timeAgo()}
            </Text>
          </View>
          
          <View className="flex flex-row items-start gap-1.5">
            <Text className="text-[10px] font-normal text-black flex-1">
              {comment.isDeleted ? "[Comment deleted]" : comment.content}
            </Text>
          </View>
          
          {!comment.isDeleted && (
            <TouchableOpacity onPress={handleReply} className="self-end mt-2">
              <Text className="text-xs text-[#6B7280]">Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {comment.optimistic && (
        <View className="flex-row items-center ml-16 mt-1 mb-2">
          <Text className="text-xs text-gray-500">Sending...</Text>
        </View>
      )}
    </View>
  );
};