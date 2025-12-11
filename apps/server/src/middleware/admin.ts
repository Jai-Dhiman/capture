import { eq } from 'drizzle-orm';
import { createD1Client } from '../db';
import * as schema from '../db/schema';
import type { ContextType } from '../types';

export type UserRole = 'user' | 'moderator' | 'admin';

export async function getUserRole(context: ContextType): Promise<UserRole | null> {
  if (!context.user) {
    return null;
  }

  const db = createD1Client(context.env);
  const user = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, context.user.id))
    .get();

  return (user?.role as UserRole) || 'user';
}

export async function requireAdmin(context: ContextType): Promise<void> {
  if (!context.user) {
    throw new Error('Authentication required');
  }

  const role = await getUserRole(context);
  if (role !== 'admin') {
    throw new Error('Admin access required');
  }
}

export async function requireModerator(context: ContextType): Promise<void> {
  if (!context.user) {
    throw new Error('Authentication required');
  }

  const role = await getUserRole(context);
  if (role !== 'admin' && role !== 'moderator') {
    throw new Error('Moderator or admin access required');
  }
}

export async function isAdmin(context: ContextType): Promise<boolean> {
  const role = await getUserRole(context);
  return role === 'admin';
}

export async function isModerator(context: ContextType): Promise<boolean> {
  const role = await getUserRole(context);
  return role === 'admin' || role === 'moderator';
}
