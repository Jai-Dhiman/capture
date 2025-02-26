import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { createD1Client } from '../db'
import * as schema from 'db/schema'
import type { Bindings } from '../types/index'

export interface ImageService {
  getUploadUrl: () => Promise<{ uploadURL: string; id: string }>
  getImageUrl: (imageId: string, variant?: string) => string
  create: (data: { userId: string; imageId: string; [key: string]: any }) => Promise<any>
  list: (userId: string) => Promise<any[]>
  findById: (id: string, userId: string) => Promise<any>
  delete: (id: string, userId: string) => Promise<void>
}

export function createImageService(env: Bindings): ImageService {
  const db = createD1Client(env)
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = env.CLOUDFLARE_IMAGES_TOKEN

  return {
    async getUploadUrl() {
      const imageId = nanoid()
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/direct_upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: imageId,
            metadata: {},
            requireSignedURLs: false,
          }),
        }
      )

      const data = await response.json()

      interface CloudflareResponse {
        success: boolean
        errors?: Array<any>
      }

      const responseData = data as CloudflareResponse
      if (!responseData.success) {
        console.error('Failed to get upload URL:', responseData.errors)
        throw new Error('Failed to get upload URL')
      }

      return {
        uploadURL: (data as { result: { uploadURL: string } }).result.uploadURL,
        id: imageId,
      }
    },

    getImageUrl(imageId, variant = 'public') {
      return `https://imagedelivery.net/${accountId}/${imageId}/${variant}`
    },

    async create({ userId, imageId, ...data }) {
      if (!userId) throw new Error('User ID is required')
      if (!imageId) throw new Error('Image ID is required')

      try {
        const mediaId = nanoid()
        await db.insert(schema.media).values({
          id: mediaId,
          userId,
          type: 'image',
          storageKey: imageId,
          order: data.order || 0,
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

    async list(userId) {
      return await db.query.media.findMany({
        where: (media, { eq }) => eq(media.userId, userId),
      })
    },

    async findById(id, userId) {
      return await db.query.media.findFirst({
        where: (media, { and }) => and(eq(media.id, id), eq(media.userId, userId)),
      })
    },

    async delete(id, userId) {
      const media = await this.findById(id, userId)
      if (!media) return

      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${media.storageKey}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        }
      )

      await db
        .delete(schema.media)
        .where(eq(schema.media.id, id) && eq(schema.media.userId, userId))
    },
  }
}
