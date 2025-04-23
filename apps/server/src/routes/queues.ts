import { Hono } from 'hono';
import { createD1Client } from '../db';
import * as schema from '../db/schema';
import type { Bindings } from 'types';
import {
  generatePostEmbedding,
  storePostEmbedding,
  generateUserEmbedding,
  storeUserEmbedding,
} from '../lib/embeddings';
import { inArray, eq } from 'drizzle-orm';

const router = new Hono<{ Bindings: Bindings }>();

// 1) Post‐queue: re‐embed a post by ID
router.post('/post-queue', async (c) => {
  const { postId } = await c.req.json<{ postId: string }>();
  const env = c.env as unknown as Bindings;
  const db = createD1Client(env);

  // fetch post + hashtags
  const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();
  if (!post) return c.text('Post not found', 404);

  const hashtags = await db
    .select({ name: schema.hashtag.name })
    .from(schema.postHashtag)
    .where(inArray(schema.postHashtag.postId, [postId]))
    .leftJoin(schema.hashtag, eq(schema.hashtag.id, schema.postHashtag.hashtagId))
    .all()
    .then((rows) => rows.map((r) => r.name));

  const validHashtags = hashtags.filter((tag): tag is string => tag !== null);

  // regenerate + store
  const vectorData = await generatePostEmbedding(postId, post.content, validHashtags, env.AI);
  await storePostEmbedding(vectorData, env.POST_VECTORS, env.VECTORIZE);

  return c.text('OK');
});

// 2) User‐queue: re‐embed user interest
router.post('/user-vector-queue', async (c) => {
  const { userId } = await c.req.json<{ userId: string }>();
  const env = c.env as unknown as Bindings;
  const db = createD1Client(env);

  // gather interests: saved posts, own posts, and hashtags
  const ownPosts = await db
    .select({ id: schema.post.id, content: schema.post.content })
    .from(schema.post)
    .where(eq(schema.post.userId, userId))
    .all();

  const savedRows = await db
    .select({ postId: schema.savedPost.postId })
    .from(schema.savedPost)
    .where(eq(schema.savedPost.userId, userId))
    .all();
  const savedPostIds = savedRows.map((r) => r.postId);
  let savedContents: string[] = [];
  if (savedPostIds.length > 0) {
    const savedPosts = await db
      .select({ content: schema.post.content })
      .from(schema.post)
      .where(inArray(schema.post.id, savedPostIds))
      .all();
    savedContents = savedPosts.map((p) => p.content);
  }

  // fetch hashtags from all user posts
  const allPostIds = [...ownPosts.map((p) => p.id), ...savedPostIds];
  let hashtagNames: string[] = [];
  if (allPostIds.length > 0) {
    const hashtagRows = await db
      .select({ hashtagId: schema.postHashtag.hashtagId })
      .from(schema.postHashtag)
      .where(inArray(schema.postHashtag.postId, allPostIds))
      .all();
    const hashtagIds = [...new Set(hashtagRows.map((r) => r.hashtagId))].filter(Boolean);
    if (hashtagIds.length > 0) {
      const hashtags = await db
        .select({ name: schema.hashtag.name })
        .from(schema.hashtag)
        .where(inArray(schema.hashtag.id, hashtagIds))
        .all();
      hashtagNames = hashtags.map((h) => h.name);
    }
  }

  // combine interests (duplicate saved post content for higher weight)
  const interests: string[] = [
    ...savedContents.flatMap((c) => [c, c]),
    ...ownPosts.map((p) => p.content),
    ...hashtagNames,
  ];

  const vectorData = await generateUserEmbedding(userId, interests, env.AI);
  await storeUserEmbedding(vectorData, env.POST_VECTORS, env.VECTORIZE);

  return c.text('OK');
});

export default router;
