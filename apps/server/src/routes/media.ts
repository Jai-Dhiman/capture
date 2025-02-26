import { Hono } from 'hono'
import { createImageService } from '../lib/imageService'
import type { Bindings, Variables } from 'types'
import { generateImageSignature } from '../lib/crypto'

const mediaRouter = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

// Get upload URL for direct image upload
mediaRouter.post('/image-upload', async (c) => {
  const imageService = createImageService(c.env)
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401)
  }

  try {
    const { uploadURL, id } = await imageService.getUploadUrl()
    return c.json({ uploadURL, id })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return c.json({ error: 'Failed to generate upload URL' }, 500)
  }
})

// Create media record after successful upload
mediaRouter.post('/image-record', async (c) => {
  const imageService = createImageService(c.env)
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'User not authenticated' }, 401)
  }

  try {
    const body = await c.req.json()
    const { imageId, order, postId } = body

    if (!imageId) {
      return c.json({ error: 'Image ID is required' }, 400)
    }

    const media = await imageService.create({
      userId: user.id,
      imageId,
      order: order || 0,
      postId,
    })

    return c.json({
      media: {
        ...media,
        url: imageService.getImageUrl(imageId),
      },
    })
  } catch (error) {
    console.error('Failed to create media record:', error)
    return c.json({ error: 'Failed to create media record' }, 500)
  }
})

// Get image URL
// apps/server/src/routes/media.ts
mediaRouter.get('/:mediaId/url', async (c) => {
  const mediaId = c.req.param('mediaId')
  const user = c.get('user')

  try {
    const imageService = createImageService(c.env)
    const media = await imageService.findById(mediaId, user.id)

    if (!media) {
      return c.json({ error: 'Media not found' }, 404)
    }

    // Use Cloudflare's token API
    console.log('Requesting token for image:', media.storageKey)

    const tokenResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/images/v1/${media.storageKey}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.CLOUDFLARE_IMAGES_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        }),
      }
    )

    console.log('Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token response error:', errorText)
      throw new Error(`Failed to get image token: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token data success:', tokenData.success)

    if (!tokenData.success) {
      console.error('Token data error:', JSON.stringify(tokenData))
      throw new Error('Token API returned error')
    }

    const url = `https://imagedelivery.net/${c.env.CLOUDFLARE_ACCOUNT_ID}/${media.storageKey}/public?token=${tokenData.result.token}`
    console.log('Generated URL with token:', url)

    return c.json({ url })
  } catch (error) {
    console.error(
      'Error getting image URL:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return c.json({ error: 'Failed to get image URL' }, 500)
  }
})

// Delete media
mediaRouter.delete('/:mediaId', async (c) => {
  const mediaId = c.req.param('mediaId')
  const user = c.get('user')
  const imageService = createImageService(c.env)

  try {
    await imageService.delete(mediaId, user.id)
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete failed:', error)
    return c.json({ error: 'Delete failed' }, 500)
  }
})

export default mediaRouter
