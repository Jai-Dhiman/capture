// routes/media.ts
import { Hono } from 'hono'
import { createMediaService } from 'lib/media'
import { requireAuth } from 'middleware/auth'
import type { Bindings, Variables } from 'types'

const mediaRouter = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// Upload file
mediaRouter.post('/upload', requireAuth, async (c) => {
  const user = c.get('user')
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return c.json({ error: 'No file provided' }, 400)
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: 'Invalid file type' }, 400)
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File too large' }, 400)
  }

  try {
    const mediaService = createMediaService(c.env.BUCKET)
    const key = await mediaService.uploadFile(file, user.id)

    // Store media metadata in database
    const media = await c.env.DB.insert('media')
      .values({
        userId: user.id,
        type: file.type,
        url: key,
        createdAt: new Date(),
      })
      .returning()
      .get()

    return c.json({ media })
  } catch (error) {
    console.error('Media upload error:', error)
    return c.json(
      {
        error: 'Failed to upload media',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

// Delete file
mediaRouter.delete('/:mediaId', requireAuth, async (c) => {
  const user = c.get('user')
  const mediaId = c.req.param('mediaId')

  try {
    // Get media record
    const media = await c.env.DB.query.media.findFirst({
      where: (media, { eq }) => eq(media.id, mediaId),
    })

    if (!media || media.userId !== user.id) {
      return c.json({ error: 'Media not found' }, 404)
    }

    const mediaService = createMediaService(c.env.BUCKET)
    await mediaService.deleteFile(media.url)

    // Delete from database
    await c.env.DB.delete('media').where(eq(media.id, mediaId)).run()

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete failed:', error)
    return c.json({ error: 'Delete failed' }, 400)
  }
})

// Get signed URL
mediaRouter.get('/:mediaId/url', requireAuth, async (c) => {
  const mediaId = c.req.param('mediaId')

  try {
    const media = await c.env.DB.query.media.findFirst({
      where: (media, { eq }) => eq(media.id, mediaId),
    })

    if (!media) {
      return c.json({ error: 'Media not found' }, 404)
    }

    const mediaService = createMediaService(c.env.BUCKET)
    const signedUrl = await mediaService.getSignedUrl(media.url)

    return c.json({ url: signedUrl })
  } catch (error) {
    console.error('Failed to get signed URL:', error)
    return c.json({ error: 'Failed to get signed URL' }, 400)
  }
})

export default mediaRouter
