// lib/media.ts
import { nanoid } from 'nanoid'
import { R2Bucket } from '@cloudflare/workers-types'
import { eq } from 'drizzle-orm'
import { createDb } from '../db'
import { schema } from 'db/schema'
import type { Bindings } from '../types/index'

export interface MediaService {
  uploadFile: (file: File, userId: string) => Promise<string>
  deleteFile: (key: string) => Promise<void>
  getSignedUrl: (key: string) => Promise<string>
  create: (data: { userId: string; [key: string]: any }) => Promise<any>
  list: (userId: string) => Promise<any[]>
  findById: (id: string) => Promise<any>
  delete: (id: string) => Promise<void>
}

export function createMediaService(env: Bindings): MediaService {
  const db = createDb(env)
  const r2 = env.BUCKET

  return {
    async create({ userId, ...data }: { userId: string; [key: string]: any }) {
      const result = await db.insert(schema.media).values({
        id: nanoid(),
        userId,
        type: data.type,
        url: data.url,
        order: data.order,
        thumbnailUrl: data.thumbnailUrl,
        postId: data.postId,
        createdAt: new Date(),
      })
      return result
    },

    async list(userId: string) {
      return await db.query.media.findMany({
        where: (media, { eq }) => eq(schema.media.userId, userId),
      })
    },

    async findById(id: string) {
      return await db.query.media.findFirst({
        where: (media, { eq }) => eq(schema.media.id, id),
      })
    },

    async delete(id: string) {
      await db.delete(schema.media).where(eq(schema.media.id, id))
    },

    async uploadFile(file: File, userId: string) {
      const extension = file.name.split('.').pop()
      const key = `${userId}/${nanoid()}.${extension}`

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
      return `https://${env.BUCKET}.r2.cloudflarestorage.com/${key}`
    },
  }
}
