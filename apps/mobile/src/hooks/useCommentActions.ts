import { useAtom } from 'jotai'
import { nanoid } from 'nanoid'
import {
  createCommentMutationAtom,
  optimisticCommentsAtom,
  replyingToCommentAtom,
  currentPostIdAtom,
  deleteCommentMutationAtom,
} from '../atoms/commentAtoms'
import { useProfileStore } from '../stores/profileStore'
import { Comment } from '../types/commentTypes'

export const useCommentActions = () => {
  const [, setOptimisticComments] = useAtom(optimisticCommentsAtom)
  const [createMutation] = useAtom(createCommentMutationAtom)
  const [deleteMutation] = useAtom(deleteCommentMutationAtom)
  const [replyingTo, setReplyingTo] = useAtom(replyingToCommentAtom)
  const [postId] = useAtom(currentPostIdAtom)
  const { profile } = useProfileStore()

  const createComment = async (content: string) => {
    if (!postId || !content.trim()) return

    const tempId = `temp-${nanoid()}`
    const now = new Date().toISOString()

    const parentPath = replyingTo?.path || null
    let newPath: string
    let depth: number

    // This is simplified - your backend would handle actual path generation
    if (!parentPath) {
      // This is a top-level comment - you'd need logic to determine the next available path
      newPath = `01` // This is just a placeholder
      depth = 0
    } else {
      // This is a reply - you'd need logic to determine the next child path
      newPath = `${parentPath}.01` // This is just a placeholder
      depth = parentPath.split('.').length
    }

    const optimisticComment: Comment = {
      id: tempId,
      content: content.trim(),
      path: newPath,
      depth,
      createdAt: now,
      user: {
        id: profile?.id || '',
        username: profile?.username || '',
        profileImage: profile?.profileImage,
      },
      optimistic: true,
    }

    setOptimisticComments((prev) => [...prev, optimisticComment])

    setReplyingTo(null)

    try {
      await createMutation.mutateAsync({
        postId,
        content: content.trim(),
        parentPath,
      })
    } catch (error) {
      console.error('Failed to create comment:', error)

      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId))
    }
  }

  const deleteComment = async (commentId: string) => {
    if (!postId) return

    try {
      await deleteMutation.mutateAsync({
        commentId,
        postId,
      })
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  const startReply = (comment: { id: string; path: string }) => {
    setReplyingTo(comment)
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  return {
    createComment,
    deleteComment,
    startReply,
    cancelReply,
    replyingTo,
  }
}
