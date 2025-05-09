import { useAtom } from "jotai";
import * as Crypto from "expo-crypto";
import {
  createCommentMutationAtom,
  optimisticCommentsAtom,
  replyingToCommentAtom,
  currentPostIdAtom,
  deleteCommentMutationAtom,
} from "../atoms/commentAtoms";
import { useProfileStore } from "../stores/profileStore";
import { Comment } from "../types/commentTypes";
import { errorService } from "../services/errorService";
import { useAlert } from "../lib/AlertContext";

export const useCommentActions = () => {
  const [, setOptimisticComments] = useAtom(optimisticCommentsAtom);
  const [createMutation] = useAtom(createCommentMutationAtom);
  const [deleteMutation] = useAtom(deleteCommentMutationAtom);
  const [replyingTo, setReplyingTo] = useAtom(replyingToCommentAtom);
  const [postId] = useAtom(currentPostIdAtom);
  const { profile } = useProfileStore();
  const { showAlert } = useAlert();

  const createComment = async (content: string) => {
    if (!postId || !content.trim()) return;

    const tempId = `temp-${Crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    const parentId = replyingTo?.id;
    const parentPath = replyingTo?.path;

    let newPath = "01";
    if (parentPath) {
      newPath = `${parentPath}.01`;
    }

    const optimisticComment: Comment = {
      id: tempId,
      content: content.trim(),
      path: newPath,
      depth: parentPath ? parentPath.split(".").length : 0,
      parentId,
      createdAt: now,
      user: {
        id: profile?.id || "",
        username: profile?.username || "",
        profileImage: profile?.profileImage,
      },
      optimistic: true,
    };

    setOptimisticComments((prev) => [...prev, optimisticComment]);
    setReplyingTo(null);

    try {
      const result = await createMutation.mutateAsync({
        postId,
        content: content.trim(),
        parentId,
      });

      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
    } catch (error) {
      const appError = errorService.createError(
        "Failed to post comment",
        "network/comment-create-failed",
        error instanceof Error ? error : undefined
      );

      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
        action: {
          label: "Retry",
          onPress: () => createComment(content),
        },
      });

      console.error("Failed to create comment:", error);
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
    } catch (error) {
      const appError = errorService.createError(
        "Failed to delete comment",
        "network/comment-delete-failed",
        error instanceof Error ? error : undefined
      );

      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });

      console.error("Failed to delete comment:", error);
    }
  };

  const startReply = (comment: { id: string; path: string }) => {
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
