import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { createD1Client } from '../db'
import * as schema from 'db/schema'
import type { Bindings } from '../types/index'

export interface MediaService {
  uploadFile: (file: File, userId: string) => Promise<string>
  deleteFile: (key: string) => Promise<void>
  getSignedUrl: (key: string) => Promise<string>
  create: (data: { userId: string; [key: string]: any }) => Promise<any>
  list: (userId: string) => Promise<any[]>
  findById: (id: string, userId: string) => Promise<any>
  delete: (id: string, userId: string) => Promise<void>
}

export function createMediaService(env: Bindings): MediaService {
  const db = createD1Client(env)
  const r2 = env.BUCKET

  return {
    async create({ userId, ...data }: { userId: string; [key: string]: any }) {
      if (!userId) throw new Error('User ID is required')

      try {
        const mediaId = nanoid()
        await db.insert(schema.media).values({
          id: mediaId,
          userId,
          type: data.type,
          url: data.url,
          order: data.order || 0,
          thumbnailUrl: data.thumbnailUrl,
          postId: data.postId,
          createdAt: new Date().toISOString(),
        })

        const media = await db.query.media.findFirst({
          where: (media, { eq }) => eq(media.id, mediaId),
        })

        if (!media) throw new Error('Failed to create media record')
        return media
      } catch (error) {
        console.error('Database error:', error)
        throw new Error(
          `Failed to create media record: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    },

    async list(userId: string) {
      return await db.query.media.findMany({
        where: (media, { eq }) => eq(media.userId, userId),
      })
    },

    async findById(id: string, userId: string) {
      return await db.query.media.findFirst({
        where: (media, { and }) => and(eq(media.id, id), eq(media.userId, userId)),
      })
    },

    async delete(id: string, userId: string) {
      await db
        .delete(schema.media)
        .where(eq(schema.media.id, id) && eq(schema.media.userId, userId))
    },

    async uploadFile(file: File, userId: string) {
      try {
        const extension = file.name.split('.').pop()
        const key = `${userId}/${nanoid()}.${extension}`
        await r2.put(key, file, {
          httpMetadata: {
            contentType: file.type,
          },
        })
        return key
      } catch (error) {
        console.error('R2 upload error:', {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : 'UnknownError',
        })
        throw error
      }
    },

    async deleteFile(key: string) {
      await r2.delete(key)
    },

    async getSignedUrl(key: string) {
      const object = await r2.get(key)
      if (!object) throw new Error('File not found')
      return `https://capture-bucket.r2.cloudflarestorage.com/${key}`
    },
  }
}
