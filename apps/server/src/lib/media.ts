// lib/media.ts
import { nanoid } from 'nanoid'
import { R2Bucket } from '@cloudflare/workers-types'

export interface MediaService {
  uploadFile: (file: File, userId: string) => Promise<string>
  deleteFile: (key: string) => Promise<void>
  getSignedUrl: (key: string) => Promise<string>
}

export function createMediaService(r2: R2Bucket): MediaService {
  return {
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
      const url = await r2.createPresignedUrl({
        bucket: r2,
        key,
        expirationSeconds: 3600, // 1 hour
      })
      return url
    },
  }
}
