import { Hono } from 'hono'
import { createMediaService } from 'lib/media'
import { requireAuth } from 'middleware/auth'
import type { Bindings, Variables } from 'types'

const mediaRouter = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024

mediaRouter.post('/', requireAuth, async (c) => {
  const mediaService = createMediaService(c.env)
  const user = c.get('user')

  try {
    const media = await mediaService.create({
      userId: user!.id,
      // ... other media data
    })
    return c.json({ media })
  } catch (error) {
    return c.json({ error: 'Failed to create media' }, 400)
  }
})

mediaRouter.delete('/:mediaId', requireAuth, async (c) => {
  const user = c.get('user')
  const mediaId = c.req.param('mediaId')
  const mediaService = createMediaService(c.env)

  try {
    const media = await mediaService.findById(mediaId)

    if (!media || media.userId !== user?.id) {
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

mediaRouter.get('/:mediaId/url', requireAuth, async (c) => {
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
