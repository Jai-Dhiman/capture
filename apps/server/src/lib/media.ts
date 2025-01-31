// lib/media.ts
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { createDb } from '../db'
import * as schema from 'db/schema'
import type { Bindings } from '../types/index'

export interface MediaService {
  uploadFile: (file: File, userId?: string) => Promise<string>
  deleteFile: (key: string) => Promise<void>
  getSignedUrl: (key: string) => Promise<string>
  create: (data: { userId?: string; [key: string]: any }) => Promise<any>
  list: (userId?: string) => Promise<any[]>
  findById: (id: string) => Promise<any>
  delete: (id: string) => Promise<void>
}

export function createMediaService(env: Bindings): MediaService {
  const db = createDb(env)
  const r2 = env.BUCKET

  return {
    async create({
      userId = '6AyQt2ddpeJUG7W1SC3VQiDGbADEbSDo',
      ...data
    }: {
      userId?: string
      [key: string]: any
    }) {
      const mediaId = nanoid()
      await db.insert(schema.media).values({
        id: mediaId,
        userId,
        type: data.type,
        url: data.url,
        order: data.order,
        thumbnailUrl: data.thumbnailUrl,
        postId: data.postId,
        createdAt: new Date(),
      })

      // Return the created media object
      return await db.query.media.findFirst({
        where: (media, { eq }) => eq(schema.media.id, mediaId),
      })
    },

    async list(userId?: string) {
      if (userId) {
        return await db.query.media.findMany({
          where: (media, { eq }) => eq(schema.media.userId, userId),
        })
      } else {
        return await db.query.media.findMany()
      }
    },

    async findById(id: string) {
      return await db.query.media.findFirst({
        where: (media, { eq }) => eq(schema.media.id, id),
      })
    },

    async delete(id: string) {
      await db.delete(schema.media).where(eq(schema.media.id, id))
    },

    async uploadFile(file: File, userId?: string) {
      const extension = file.name.split('.').pop()
      const key = `${userId || '6AyQt2ddpeJUG7W1SC3VQiDGbADEbSDo'}/${nanoid()}.${extension}`

      await r2.put(key, file, {
        httpMetadata: {
          contentType: file.type,
        },
      })

      return key
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
