import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAtom } from 'jotai';
import { ProfileImage } from '@/features/post/components/ProfileImage';
import { useCommentActions } from '../hooks/useCommentActions';
import { replyingToCommentAtom, currentPostIdAtom } from '../atoms/commentAtoms';
import type { Comment } from '../types/commentTypes';
import XIcon from '@assets/icons/XIcon.svg';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { API_URL } from '@env';
import { errorService } from '@/shared/services/errorService';

export const CommentItem = ({ comment }: { comment: Comment }) => {
  const { startReply, cancelReply } = useCommentActions();
  const [replyingTo] = useAtom(replyingToCommentAtom);
  const [postId] = useAtom(currentPostIdAtom);
  const [showReplies, setShowReplies] = useState(false);
  const [hasReplies, setHasReplies] = useState(false);
  const { session } = useAuthStore();

  const isSelected = replyingTo?.id === comment.id;

  // Check if comment has replies
  const { data: repliesCheck } = useQuery({
    queryKey: ['comment-has-replies', comment.id],
    queryFn: async () => {
      if (!session?.access_token || !postId) {
        return { comments: [], totalCount: 0 };
      }

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              query CheckCommentReplies($postId: ID!, $parentId: ID!) {
                commentConnection(postId: $postId, parentId: $parentId, sortBy: newest, limit: 1) {
                  totalCount
                }
              }
            `,
            variables: {
              postId,
              parentId: comment.id,
            },
          }),
        });

        const data = await response.json();

        if (data.errors) {
          throw errorService.createError(data.errors[0].message || "Failed to check replies", "server/graphql-error");
        }

        return data.data?.commentConnection;
      } catch (error) {
        console.error("Error checking for replies:", error);
        return { totalCount: 0 };
      }
    },
    enabled: !!comment.id && !!postId && !!session?.access_token,
  });

  useEffect(() => {
    if (repliesCheck?.totalCount > 0) {
      setHasReplies(true);
    }
  }, [repliesCheck]);

  // Fetch replies for this comment
  const { data: replies, isLoading: loadingReplies, refetch } = useQuery({
    queryKey: ['comment-replies', comment.id],
    queryFn: async () => {
      if (!session?.access_token || !postId) {
        return { comments: [] };
      }

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              query GetCommentReplies($postId: ID!, $parentId: ID!) {
                commentConnection(postId: $postId, parentId: $parentId, sortBy: newest, limit: 10) {
                  comments {
                    id
                    content
                    path
                    depth
                    parentId
                    createdAt
                    user {
                      id
                      username
                      profileImage
                    }
                  }
                }
              }
            `,
            variables: {
              postId,
              parentId: comment.id,
            },
          }),
        });

        const data = await response.json();

        if (data.errors) {
          throw errorService.createError(data.errors[0].message || "Failed to fetch replies", "server/graphql-error");
        }

        return data.data?.commentConnection;
      } catch (error) {
        throw errorService.createError(
          "Unable to load replies",
          "network/fetch-failed",
          error instanceof Error ? error : undefined
        );
      }
    },
    enabled: false, // Don't fetch automatically
  });

  const handleCommentPress = () => {
    if (!comment.isDeleted) {
      if (!comment.path) {
        console.error("Comment is missing path property", comment);
        return;
      }

      startReply({
        id: comment.id,
        path: comment.path,
        username: comment.user?.username
      });
    }
  };

  const handleToggleReplies = () => {
    if (!showReplies) {
      refetch();
    }
    setShowReplies(!showReplies);
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
    <View style={{ marginLeft: paddingLeft }}>
      <TouchableOpacity
        onPress={handleCommentPress}
        activeOpacity={0.7}
        disabled={comment.isDeleted}
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

      {/* Reply toggle button when there are replies */}
      {hasReplies && (
        <TouchableOpacity
          onPress={handleToggleReplies}
          className="pl-16 py-2"
        >
          <Text className="text-[#6B7280] text-xs">
            {showReplies ? "Hide replies" : "View replies"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Show replies when expanded */}
      {showReplies && (
        <View className="pl-8">
          {loadingReplies ? (
            <View className="py-2 items-center">
              <ActivityIndicator size="small" color="#e4cac7" />
            </View>
          ) : replies?.comments?.length > 0 ? (
            replies.comments.map((reply: Comment) => (
              <CommentItem key={reply.id} comment={reply} />
            ))
          ) : (
            <Text className="text-[#6B7280] text-xs pl-8 py-2">No replies yet</Text>
          )}
        </View>
      )}
    </View>
  );
};