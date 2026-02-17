import { createD1Client } from '@/db';
import { notification } from '@/db/schema';
import type { ContextType } from '@/types';
import { nanoid } from 'nanoid';
import { createNotificationData, sendPushNotification } from './pushNotificationService';

type CreateNotificationParams = {
  userId: string;
  type: string;
  actionUserId?: string;
  resourceId?: string;
  resourceType?: string;
  message: string;
  env: ContextType['env'];
  pushTitle?: string;
};

export async function createNotification(params: CreateNotificationParams) {
  const {
    userId,
    type,
    actionUserId = null,
    resourceId = null,
    resourceType = null,
    message,
    env,
    pushTitle,
  } = params;

  const db = createD1Client(env);

  await db.insert(notification).values({
    id: nanoid(),
    userId,
    type,
    actionUserId,
    resourceId,
    resourceType,
    message,
    isRead: 0,
    createdAt: new Date().toISOString(),
  });

  // Send push notification (fire and forget - don't block on this)
  sendPushNotification({
    userId,
    title: pushTitle || 'Capture',
    body: message,
    data: createNotificationData({
      type,
      resourceId: resourceId || undefined,
      resourceType: resourceType || undefined,
      actionUserId: actionUserId || undefined,
    }),
    env,
  }).catch((error) => {
    console.error('Failed to send push notification:', error);
  });
}

export async function createFollowRequestNotification({
  targetUserId,
  actionUserId,
  actionUsername,
  env,
}: {
  targetUserId: string;
  actionUserId: string;
  actionUsername: string;
  env: ContextType['env'];
}) {
  await createNotification({
    userId: targetUserId,
    type: 'FOLLOW_REQUEST',
    actionUserId,
    resourceType: 'profile',
    message: `@${actionUsername} has requested to follow you`,
    env,
  });
}

export async function createNewFollowNotification({
  targetUserId,
  actionUserId,
  actionUsername,
  env,
}: {
  targetUserId: string;
  actionUserId: string;
  actionUsername: string;
  env: ContextType['env'];
}) {
  await createNotification({
    userId: targetUserId,
    type: 'NEW_FOLLOW',
    actionUserId,
    resourceType: 'profile',
    message: `@${actionUsername} started following you`,
    env,
  });
}

export async function createNewCommentNotification({
  postAuthorId,
  actionUserId,
  actionUsername,
  commentId,
  env,
}: {
  postAuthorId: string;
  actionUserId: string;
  actionUsername: string;
  commentId: string;
  env: ContextType['env'];
}) {
  if (postAuthorId === actionUserId) return;

  await createNotification({
    userId: postAuthorId,
    type: 'NEW_COMMENT',
    actionUserId,
    resourceId: commentId,
    resourceType: 'comment',
    message: `@${actionUsername} commented on your post`,
    env,
  });
}

export async function createCommentReplyNotification({
  parentCommentAuthorId,
  actionUserId,
  actionUsername,
  commentId,
  env,
}: {
  parentCommentAuthorId: string;
  actionUserId: string;
  actionUsername: string;
  commentId: string;
  env: ContextType['env'];
}) {
  if (parentCommentAuthorId === actionUserId) return;

  await createNotification({
    userId: parentCommentAuthorId,
    type: 'COMMENT_REPLY',
    actionUserId,
    resourceId: commentId,
    resourceType: 'comment',
    message: `@${actionUsername} replied to your comment`,
    env,
  });
}

export async function createLikeNotification({
  postAuthorId,
  actionUserId,
  actionUsername,
  postId,
  env,
}: {
  postAuthorId: string;
  actionUserId: string;
  actionUsername: string;
  postId: string;
  env: ContextType['env'];
}) {
  if (postAuthorId === actionUserId) return;

  await createNotification({
    userId: postAuthorId,
    type: 'POST_LIKE',
    actionUserId,
    resourceId: postId,
    resourceType: 'post',
    message: `@${actionUsername} liked your post`,
    env,
  });
}
