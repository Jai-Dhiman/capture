import { createD1Client } from '@/db';
import { deviceToken } from '@/db/schema';
import type { ContextType } from '@/types';
import { and, eq } from 'drizzle-orm';

type ExpoPushMessage = {
  to: string;
  sound?: 'default' | null;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials';
  };
};

type SendPushNotificationParams = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  badge?: number;
  env: ContextType['env'];
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPushNotification(params: SendPushNotificationParams): Promise<boolean> {
  const { userId, title, body, data, channelId, badge, env } = params;

  const db = createD1Client(env);

  // Get all active device tokens for the user
  const tokens = await db
    .select({ token: deviceToken.token, id: deviceToken.id })
    .from(deviceToken)
    .where(and(eq(deviceToken.userId, userId), eq(deviceToken.isActive, 1)));

  if (tokens.length === 0) {
    return false;
  }

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title,
    body,
    data,
    channelId: channelId || 'social',
    priority: 'high',
  }));

  if (badge !== undefined) {
    for (const m of messages) {
      m.badge = badge;
    }
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error('Expo push notification failed:', response.status, await response.text());
      return false;
    }

    const result = (await response.json()) as { data: ExpoPushTicket[] };

    // Handle invalid tokens - mark them as inactive
    for (let i = 0; i < result.data.length; i++) {
      const ticket = result.data[i];
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        // Token is no longer valid, mark as inactive
        await db
          .update(deviceToken)
          .set({ isActive: 0, updatedAt: new Date().toISOString() })
          .where(eq(deviceToken.id, tokens[i].id));
      }
    }

    return result.data.some((ticket) => ticket.status === 'ok');
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}

export async function sendPushToMultipleUsers(
  params: Omit<SendPushNotificationParams, 'userId'> & { userIds: string[] },
): Promise<void> {
  const { userIds, ...rest } = params;

  // Send notifications in parallel
  await Promise.all(userIds.map((userId) => sendPushNotification({ ...rest, userId })));
}

type NotificationPayload = {
  type: string;
  resourceId?: string;
  resourceType?: string;
  actionUserId?: string;
};

export function createNotificationData(payload: NotificationPayload): Record<string, unknown> {
  return {
    type: payload.type,
    resourceId: payload.resourceId,
    resourceType: payload.resourceType,
    actionUserId: payload.actionUserId,
    timestamp: new Date().toISOString(),
  };
}
