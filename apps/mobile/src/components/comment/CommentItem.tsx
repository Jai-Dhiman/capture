import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useAtom } from 'jotai';
import { ProfileImage } from '../media/ProfileImage';
import { useCommentActions } from '../../hooks/useCommentActions';
import { replyingToCommentAtom } from '../../atoms/commentAtoms';
import type { Comment } from '../../types/commentTypes';
import XIcon from '../../../assets/icons/XIcon.svg';

export const CommentItem = ({ comment }: { comment: Comment }) => {
  const { deleteComment, startReply, cancelReply } = useCommentActions();
  const [replyingTo] = useAtom(replyingToCommentAtom);

  const isSelected = replyingTo?.id === comment.id;

  const handleCommentPress = () => {
    if (!comment.isDeleted) {
      startReply({
        id: comment.id,
        path: comment.path,
        username: comment.user?.username
      });
    }
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

  // Calculate indent based on the comment's depth (for nested comments)
  const indentLevel = Math.min(comment.depth, 3); // Limit max indent to 3 levels
  const paddingLeft = indentLevel * 16; // 16px per level of nesting

  return (
    <TouchableOpacity
      onPress={handleCommentPress}
      activeOpacity={0.7}
      disabled={comment.isDeleted}
      style={{ marginLeft: paddingLeft }}
    >
      <View className={`border-t border-[#e5e5e5] ${isSelected ? 'bg-[#e4cac7]' : ''}`}>
        <View className="w-full p-4 flex flex-row items-start gap-2.5 relative">
          {isSelected && (
            <TouchableOpacity
              onPress={cancelReply}
              className="absolute top-2 right-2 z-10"
            >
              <XIcon width={16} height={16} />
            </TouchableOpacity>
          )}

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
          </View>
        </View>

        {comment.optimistic && (
          <View className="flex-row items-center ml-2 mt-1 mb-2">
            <Text className="text-xs text-gray-500">Sending...</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};