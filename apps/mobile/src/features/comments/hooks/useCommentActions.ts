import { useProfileStore } from '@/features/profile/stores/profileStore';
import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useAtom } from 'jotai';
import {
  createCommentMutationAtom,
  currentPostIdAtom,
  deleteCommentMutationAtom,
  optimisticCommentsAtom,
  replyingToCommentAtom,
} from '../atoms/commentAtoms';
import type { Comment } from '../types/commentTypes';

export const useCommentActions = () => {
  const [, setOptimisticComments] = useAtom(optimisticCommentsAtom);
  const [createMutation] = useAtom(createCommentMutationAtom);
  const [deleteMutation] = useAtom(deleteCommentMutationAtom);
  const [replyingTo, setReplyingTo] = useAtom(replyingToCommentAtom);
  const [postId] = useAtom(currentPostIdAtom);
  const queryClient = useQueryClient();
  const { profile } = useProfileStore();
  const { showAlert } = useAlert();

  const createComment = async (content: string) => {
    if (!postId || !content.trim()) return;

    const tempId = `temp-${Crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    const parentId = replyingTo?.id;

    // Generate optimistic comment with appropriate depth
    const parentDepth = replyingTo?.path ? replyingTo.path.split('.').length : 0;
    const depth = parentId ? parentDepth + 1 : 0;

    const optimisticComment: Comment = {
      id: tempId,
      content: content.trim(),
      path: replyingTo?.path ? `${replyingTo.path}.01` : '01', // Simple path just for UI rendering
      depth,
      parentId,
      createdAt: now,
      user: {
        id: profile?.id || '',
        username: profile?.username || '',
        profileImage: profile?.profileImage,
      },
      optimistic: true,
    };

    setOptimisticComments((prev) => [...prev, optimisticComment]);
    setReplyingTo(null);

    try {
      await createMutation.mutateAsync({
        postId,
        content: content.trim(),
        parentId,
      });

      // Remove optimistic comment
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));

      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['comment-has-replies'] });
    } catch (error) {
      console.error('Full error details:', error);

      const appError = errorService.createError(
        'Failed to post comment',
        'network/comment-create-failed',
        error instanceof Error ? error : undefined,
      );

      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
        action: {
          label: 'Retry',
          onPress: () => createComment(content),
        },
      });

      console.error('Failed to create comment:', error);
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!postId) return;

    try {
      await deleteMutation.mutateAsync({
        commentId,
        postId,
      });

      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['comment-has-replies'] });
    } catch (error) {
      const appError = errorService.createError(
        'Failed to delete comment',
        'network/comment-delete-failed',
        error instanceof Error ? error : undefined,
      );

      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });

      console.error('Failed to delete comment:', error);
    }
  };

  const startReply = (comment: { id: string; path: string; username?: string }) => {
    if (!comment.path) {
      console.error('Cannot reply to a comment without a path', comment);
      showAlert('Cannot reply to this comment', {
        type: 'error',
      });
      return;
    }

    setReplyingTo(comment);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  return {
    createComment,
    deleteComment,
    startReply,
    cancelReply,
    replyingTo,
  };
};
