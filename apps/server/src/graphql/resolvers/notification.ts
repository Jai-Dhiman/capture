import { and, eq, sql } from 'drizzle-orm';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import type { ContextType } from '../../types';

export const notificationResolvers = {
  Query: {
    notifications: async (
      _: unknown,
      { limit = 20, offset = 0, includeRead = false },
      context: ContextType,
    ) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const db = createD1Client(context.env);

      const conditions = [eq(schema.notification.userId, context.user.id)];

      if (!includeRead) {
        conditions.push(eq(schema.notification.isRead, 0));
      }

      return await db
        .select()
        .from(schema.notification)
        .where(and(...conditions))
        .orderBy(sql`${schema.notification.createdAt} DESC`)
        .limit(limit)
        .offset(offset);
    },

    unreadNotificationCount: async (_: unknown, __: unknown, context: ContextType) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const db = createD1Client(context.env);

      const result = await db
        .select({ count: sql`count(*)` })
        .from(schema.notification)
        .where(
          and(eq(schema.notification.userId, context.user.id), eq(schema.notification.isRead, 0)),
        )
        .get();

      return result?.count || 0;
    },
  },

  Mutation: {
    markNotificationRead: async (_: unknown, { id }: { id: string }, context: ContextType) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const db = createD1Client(context.env);

      await db
        .update(schema.notification)
        .set({ isRead: 1 })
        .where(
          and(eq(schema.notification.id, id), eq(schema.notification.userId, context.user.id)),
        );

      return { success: true };
    },

    markAllNotificationsRead: async (_: unknown, __: unknown, context: ContextType) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const db = createD1Client(context.env);

      const result = await db
        .update(schema.notification)
        .set({ isRead: 1 })
        .where(
          and(eq(schema.notification.userId, context.user.id), eq(schema.notification.isRead, 0)),
        );

      return {
        success: true,
        count: 0,
      };
    },
  },

  Notification: {
    actionUser: async (parent: { actionUserId?: string }, _: unknown, context: ContextType) => {
      if (!parent.actionUserId) return null;

      const db = createD1Client(context.env);

      return await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, parent.actionUserId))
        .get();
    },

    isRead: (parent: { isRead: number }) => Boolean(parent.isRead),
  },
};
