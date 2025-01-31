import { Hono } from 'hono'
import { createMediaService } from 'lib/media'
import type { Bindings } from 'types'

const mediaRouter = new Hono<{
  Bindings: Bindings
}>()

const ALLOWED_TYPES = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024

mediaRouter.post('/', async (c) => {
  const mediaService = createMediaService(c.env)
  const testUserId = '6AyQt2ddpeJUG7W1SC3VQiDGbADEbSDo'

  try {
    const formData = await c.req.formData()
    const fileData = formData.get('file')

    if (!fileData || typeof fileData !== 'object' || !('arrayBuffer' in fileData)) {
      return c.json({ error: 'No valid file provided' }, 400)
    }

    const file = fileData as File

    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ error: 'Invalid file type' }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File too large' }, 400)
    }

    const key = await mediaService.uploadFile(file, testUserId)
    const url = await mediaService.getSignedUrl(key)

    const media = await mediaService.create({
      userId: testUserId,
      type: file.type,
      url: key,
      order: 0,
      thumbnailUrl: null,
      postId: c.req.query('postId'),
    })

    return c.json({
      media: {
        ...media,
        url,
      },
    })
  } catch (error) {
    console.error('Upload failed:', error)
    return c.json({ error: 'Failed to create media' }, 400)
  }
})

mediaRouter.delete('/:mediaId', async (c) => {
  const testUserId = '6AyQt2ddpeJUG7W1SC3VQiDGbADEbSDo'
  const mediaId = c.req.param('mediaId')
  const mediaService = createMediaService(c.env)

  try {
    const media = await mediaService.findById(mediaId)

    if (!media || media.userId !== testUserId) {
      return c.json({ error: 'Media not found' }, 404)
    }

    await mediaService.deleteFile(media.url)
    await mediaService.delete(mediaId)

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete failed:', error)
    return c.json({ error: 'Delete failed' }, 400)
  }
})

mediaRouter.get('/:mediaId/url', async (c) => {
  const mediaId = c.req.param('mediaId')
  const mediaService = createMediaService(c.env)

  try {
    const media = await mediaService.findById(mediaId)
    const signedUrl = await mediaService.getSignedUrl(media.url)

    return c.json({ url: signedUrl })
  } catch (error) {
    console.error('Failed to get signed URL:', error)
    return c.json({ error: 'Failed to get signed URL' }, 400)
  }
})

export default mediaRouter
