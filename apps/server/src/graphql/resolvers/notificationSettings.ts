import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import type { ContextType } from '../../types';

interface NotificationSettingsInput {
  enablePush?: boolean;
  likes?: boolean;
  comments?: boolean;
  follows?: boolean;
  mentions?: boolean;
  saves?: boolean;
}

interface NotificationSettingsRow {
  id: string;
  userId: string;
  enableInApp: number;
  enablePush: number;
  frequency: string;
  likes: number;
  comments: number;
  follows: number;
  mentions: number;
  saves: number;
  createdAt: string;
  updatedAt: string;
}

export const notificationSettingsResolvers = {
  Query: {
    async notificationSettings(_: unknown, __: unknown, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      let settings = await db
        .select()
        .from(schema.notificationSettings)
        .where(eq(schema.notificationSettings.userId, context.user.id))
        .get();

      // Create default settings if none exist
      if (!settings) {
        const newSettings = {
          id: nanoid(),
          userId: context.user.id,
          enableInApp: 1,
          enablePush: 1,
          frequency: 'IMMEDIATE',
          likes: 1,
          comments: 1,
          follows: 1,
          mentions: 1,
          saves: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.insert(schema.notificationSettings).values(newSettings);
        settings = newSettings;
      }

      return settings;
    },
  },

  Mutation: {
    async updateNotificationSettings(
      _: unknown,
      { input }: { input: NotificationSettingsInput },
      context: ContextType,
    ) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      const existing = await db
        .select()
        .from(schema.notificationSettings)
        .where(eq(schema.notificationSettings.userId, context.user.id))
        .get();

      const now = new Date().toISOString();

      if (existing) {
        const updateData: Partial<NotificationSettingsRow> = {
          updatedAt: now,
        };

        if (input.enablePush !== undefined) updateData.enablePush = input.enablePush ? 1 : 0;
        if (input.likes !== undefined) updateData.likes = input.likes ? 1 : 0;
        if (input.comments !== undefined) updateData.comments = input.comments ? 1 : 0;
        if (input.follows !== undefined) updateData.follows = input.follows ? 1 : 0;
        if (input.mentions !== undefined) updateData.mentions = input.mentions ? 1 : 0;
        if (input.saves !== undefined) updateData.saves = input.saves ? 1 : 0;

        await db
          .update(schema.notificationSettings)
          .set(updateData)
          .where(eq(schema.notificationSettings.userId, context.user.id));
      } else {
        await db.insert(schema.notificationSettings).values({
          id: nanoid(),
          userId: context.user.id,
          enableInApp: 1,
          enablePush: input.enablePush !== undefined ? (input.enablePush ? 1 : 0) : 1,
          frequency: 'IMMEDIATE',
          likes: input.likes !== undefined ? (input.likes ? 1 : 0) : 1,
          comments: input.comments !== undefined ? (input.comments ? 1 : 0) : 1,
          follows: input.follows !== undefined ? (input.follows ? 1 : 0) : 1,
          mentions: input.mentions !== undefined ? (input.mentions ? 1 : 0) : 1,
          saves: input.saves !== undefined ? (input.saves ? 1 : 0) : 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      return await db
        .select()
        .from(schema.notificationSettings)
        .where(eq(schema.notificationSettings.userId, context.user.id))
        .get();
    },
  },

  NotificationSettings: {
    enablePush: (parent: NotificationSettingsRow) => Boolean(parent.enablePush),
    likes: (parent: NotificationSettingsRow) => Boolean(parent.likes),
    comments: (parent: NotificationSettingsRow) => Boolean(parent.comments),
    follows: (parent: NotificationSettingsRow) => Boolean(parent.follows),
    mentions: (parent: NotificationSettingsRow) => Boolean(parent.mentions),
    saves: (parent: NotificationSettingsRow) => Boolean(parent.saves),
  },
};
