import { Hono } from 'hono';
import { generateEmbedding } from '../lib/embeddings';
import type { Bindings, Variables } from '../types';

const embeddingsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

embeddingsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.text || typeof body.text !== 'string') {
      return c.json({ error: 'Text is required' }, 400);
    }

    const vector = await generateEmbedding(body.text, c.env.AI);

    return c.json({ 
      vector,
      dimension: vector.length,
      model: '@cf/baai/bge-base-en-v1.5'
    });
  } catch (error) {
    console.error('Embedding generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `Failed to generate embedding: ${message}` }, 500);
  }
});

export default embeddingsRouter; 