import { createD1Client } from '../../db'
import { eq, and, sql } from 'drizzle-orm'
import * as schema from '../../db/schema'
import { nanoid } from 'nanoid'
import type { ContextType } from '../../types'

export const relationshipResolvers = {
  Mutation: {
    async followUser(_: unknown, { userId }: { userId: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required')
      }

      const followerId = context.user.id
      const followedId = userId

      if (followerId === followedId) {
        throw new Error('Cannot follow yourself')
      }

      const db = createD1Client(context.env)

      const followedUser = await db
        .select()
        .from(schema.profile)
        .where(eq(schema.profile.userId, followedId))
        .get()

      if (!followedUser) {
        throw new Error('User to follow not found')
      }

      const existingRelationship = await db
        .select()
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.followerId, followerId),
            eq(schema.relationship.followedId, followedId)
          )
        )
        .get()

      if (existingRelationship) {
        return {
          success: true,
          relationship: existingRelationship,
        }
      }

      const relationshipId = nanoid()
      const newRelationship = {
        id: relationshipId,
        followerId,
        followedId,
        createdAt: new Date().toISOString(),
      }

      await db.insert(schema.relationship).values(newRelationship)

      return {
        success: true,
        relationship: newRelationship,
      }
    },

    async unfollowUser(_: unknown, { userId }: { userId: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required')
      }

      const followerId = context.user.id
      const followedId = userId

      const db = createD1Client(context.env)

      await db
        .delete(schema.relationship)
        .where(
          and(
            eq(schema.relationship.followerId, followerId),
            eq(schema.relationship.followedId, followedId)
          )
        )

      return {
        success: true,
      }
    },
  },

  Profile: {
    async isFollowing(parent: { userId: string }, _: unknown, context: ContextType) {
      if (!context?.user) return false

      const followerId = context.user.id
      const followedId = parent.userId

      if (followerId === followedId) return null

      const db = createD1Client(context.env)

      const relationship = await db
        .select()
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.followerId, followerId),
            eq(schema.relationship.followedId, followedId)
          )
        )
        .get()

      return !!relationship
    },

    async followersCount(parent: { userId: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env)

      const result = await db
        .select({ count: sql`count(*)` })
        .from(schema.relationship)
        .where(eq(schema.relationship.followedId, parent.userId))
        .get()

      return result?.count || 0
    },

    async followingCount(parent: { userId: string }, _: unknown, context: ContextType) {
      const db = createD1Client(context.env)

      const result = await db
        .select({ count: sql`count(*)` })
        .from(schema.relationship)
        .where(eq(schema.relationship.followerId, parent.userId))
        .get()

      return result?.count || 0
    },
  },
}
