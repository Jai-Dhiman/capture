import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

const deeplinkRouter = new Hono<{ Bindings: Bindings }>();

deeplinkRouter.get('/:id', async (c) => {
  const postId = c.req.param('id');

  try {
    const db = createD1Client(c.env);
    const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();
    const rawDescription = post?.content?.slice(0, 200) ?? '';
    const description = rawDescription
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const shareLink = `capture://post/${encodeURIComponent(postId)}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="Capture Post" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${c.req.url}" />
  <meta http-equiv="refresh" content="0;URL='${shareLink}'"/>
</head>
<body>Redirecting...</body>
</html>`;
    return c.html(html);
  } catch (error) {
    console.error('Deeplink error:', error);
    return c.html('<html><body>Redirecting...</body></html>');
  }
});

export default deeplinkRouter;
