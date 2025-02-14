import { Hono } from 'hono'
import { createMediaService } from 'lib/media'
import type { Bindings, Variables } from 'types'

const mediaRouter = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

const ALLOWED_TYPES = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024

mediaRouter.post('/', async (c) => {
  const mediaService = createMediaService(c.env)
  const user = c.get('user')

  try {
    if (!user) {
      console.error('User not authenticated')
      return c.json({ error: 'User not authenticated' }, 401)
    }

    const formData = await c.req.formData()
    const fileData = formData.get('file')

    if (!fileData || typeof fileData !== 'object' || !('arrayBuffer' in fileData)) {
      console.error('Invalid file data received:', fileData)
      return c.json({ error: 'No valid file provided' }, 400)
    }

    const file = fileData as File
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error('Invalid file type:', file.type)
      return c.json({ error: 'Invalid file type' }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      console.error('File too large:', file.size)
      return c.json({ error: 'File too large' }, 400)
    }

    try {
      const key = await mediaService.uploadFile(file, user.id)
      const url = await mediaService.getSignedUrl(key)
      const media = await mediaService.create({
        userId: user.id,
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
    } catch (serviceError) {
      console.error('Service error details:', {
        name: serviceError instanceof Error ? serviceError.name : 'UnknownError',
        message: serviceError instanceof Error ? serviceError.message : 'UnknownError',
      })
      throw serviceError
    }
  } catch (error) {
    console.error('Upload failed:', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'UnknownError',
    })
    return c.json(
      {
        error: 'Failed to create media',
        details: error instanceof Error ? error.message : 'UnknownError',
        type: error instanceof Error ? error.name : 'UnknownError',
      },
      500
    )
  }
})

mediaRouter.delete('/:mediaId', async (c) => {
  const mediaId = c.req.param('mediaId')
  const user = c.get('user')
  const mediaService = createMediaService(c.env)

  try {
    const media = await mediaService.findById(mediaId, user.id)

    if (!media) {
      return c.json({ error: 'Media not found' }, 404)
    }

    await mediaService.deleteFile(media.url)
    await mediaService.delete(mediaId, user.id)

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete failed:', error)
    return c.json({ error: 'Delete failed' }, 400)
  }
})

mediaRouter.get('/:mediaId/url', async (c) => {
  const mediaId = c.req.param('mediaId')
  const user = c.get('user')
  const mediaService = createMediaService(c.env)

  try {
    const media = await mediaService.findById(mediaId, user.id)

    if (!media) {
      return c.json({ error: 'Media not found' }, 404)
    }

    const signedUrl = await mediaService.getSignedUrl(media.url)
    return c.json({ url: signedUrl })
  } catch (error) {
    console.error('Failed to get signed URL:', error)
    return c.json({ error: 'Failed to get signed URL' }, 400)
  }
})

export default mediaRouter
