import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { createD1Client } from '../db';
import type { Bindings, Variables } from 'types';
import {
  generatePostEmbedding,
  generateUserEmbedding,
  storePostEmbedding,
  storeUserEmbedding,
  findSimilarPosts,
  getUserVector,
} from '../lib/embeddings';

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

router.get('/test', async (c) => {
  const user = c.get('user');

  const text = `User ${user.id} interests`;

  try {
    const embedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: text,
    });

    return c.json({
      userId: user.id,
      inputText: text,
      embedding: embedding,
    });
  } catch (error) {
    console.error('Embedding generation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

router.post('/post-embedding/:postId', async (c) => {
  const user = c.get('user');
  const postId = c.req.param('postId');
  const db = createD1Client(c.env);

  try {
    const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    if (post.userId !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const postHashtags = await db
      .select()
      .from(schema.postHashtag)
      .where(eq(schema.postHashtag.postId, postId))
      .all();

    let hashtags: string[] = [];
    if (postHashtags.length > 0) {
      const hashtagIds = postHashtags.map((ph) => ph.hashtagId).filter(Boolean);
      if (hashtagIds.length > 0) {
        const hashtagData = await db
          .select({ name: schema.hashtag.name })
          .from(schema.hashtag)
          .where(inArray(schema.hashtag.id, hashtagIds))
          .all();
        hashtags = hashtagData.map((h) => h.name);
      }
    }

    const vectorData = await generatePostEmbedding(postId, post.content, hashtags, c.env.AI);
    await storePostEmbedding(vectorData, c.env.POST_VECTORS, c.env.VECTORIZE);

    return c.json({
      success: true,
      message: 'Post embedding created and stored',
      postId: postId,
    });
  } catch (error) {
    console.error('Post embedding error:', error);
    return c.json({ error: error.message }, 500);
  }
});

router.post('/user-embedding', async (c) => {
  const user = c.get('user');
  const db = createD1Client(c.env);

  try {
    const savedPosts = await db
      .select({ postId: schema.savedPost.postId })
      .from(schema.savedPost)
      .where(eq(schema.savedPost.userId, user.id))
      .all();

    const savedPostIds = savedPosts.map((sp) => sp.postId);

    const userPosts = await db
      .select()
      .from(schema.post)
      .where(eq(schema.post.userId, user.id))
      .all();

    const postIds = [...savedPostIds, ...userPosts.map((p) => p.id)];

    let interests: string[] = [];

    if (postIds.length > 0) {
      const posts = await db
        .select({ content: schema.post.content })
        .from(schema.post)
        .where(inArray(schema.post.id, postIds))
        .all();

      interests = posts.map((p) => p.content);

      const postHashtags = await db
        .select({ hashtagId: schema.postHashtag.hashtagId })
        .from(schema.postHashtag)
        .where(inArray(schema.postHashtag.postId, postIds))
        .all();

      const hashtagIds = postHashtags.map((ph) => ph.hashtagId).filter(Boolean);

      if (hashtagIds.length > 0) {
        const hashtags = await db
          .select({ name: schema.hashtag.name })
          .from(schema.hashtag)
          .where(inArray(schema.hashtag.id, hashtagIds))
          .all();

        interests = [...interests, ...hashtags.map((h) => h.name)];
      }
    }

    if (interests.length === 0) {
      interests = ['general content'];
    }

    const vectorData = await generateUserEmbedding(user.id, interests, c.env.AI);
    await storeUserEmbedding(vectorData, c.env.POST_VECTORS, c.env.VECTORIZE);

    return c.json({
      success: true,
      message: 'User interest embedding created and stored',
      userId: user.id,
      interestsCount: interests.length,
    });
  } catch (error) {
    console.error('User embedding error:', error);
    return c.json({ error: error.message }, 500);
  }
});

router.get('/content', async (c) => {
  const user = c.get('user');
  const db = createD1Client(c.env);
  const limit = Number(c.req.query('limit') || '10');

  try {
    const userVector = await getUserVector(user.id, c.env.POST_VECTORS);

    if (!userVector) {
      return c.json(
        {
          message: 'No user embedding found, please generate one first',
          recommendations: [],
        },
        404,
      );
    }

    const similarPosts = await findSimilarPosts(userVector.vector, c.env.VECTORIZE, limit, 0.5);

    if (similarPosts.length === 0) {
      return c.json({
        message: 'No recommendations found',
        recommendations: [],
      });
    }

    const postIds = similarPosts.map((result) => result.id);
    const posts = await db.select().from(schema.post).where(inArray(schema.post.id, postIds)).all();

    const recommendations = posts.map((post) => {
      const similarityData = similarPosts.find((sp) => sp.id === post.id);
      return {
        post: post,
        similarity: similarityData ? similarityData.score : 0,
      };
    });

    recommendations.sort((a, b) => b.similarity - a.similarity);

    return c.json({
      success: true,
      recommendations: recommendations,
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    return c.json({ error: error.message }, 500);
  }
});

router.post('/process-post/:postId', async (c) => {
  const postId = c.req.param('postId');
  const secretKey = c.req.header('x-api-key');

  if (!secretKey || secretKey !== c.env.SEED_SECRET) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const db = createD1Client(c.env);

  try {
    const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    const postHashtags = await db
      .select()
      .from(schema.postHashtag)
      .where(eq(schema.postHashtag.postId, postId))
      .all();

    let hashtags: string[] = [];
    if (postHashtags.length > 0) {
      const hashtagIds = postHashtags.map((ph) => ph.hashtagId).filter(Boolean);
      if (hashtagIds.length > 0) {
        const hashtagData = await db
          .select({ name: schema.hashtag.name })
          .from(schema.hashtag)
          .where(inArray(schema.hashtag.id, hashtagIds))
          .all();
        hashtags = hashtagData.map((h) => h.name);
      }
    }

    const vectorData = await generatePostEmbedding(postId, post.content, hashtags, c.env.AI);
    await storePostEmbedding(vectorData, c.env.POST_VECTORS, c.env.VECTORIZE);

    return c.json({
      success: true,
      message: 'Post processed successfully',
      postId: postId,
    });
  } catch (error) {
    console.error('Post processing error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default router;
