import { Hono } from 'hono';
import type { Bindings, Variables } from 'types';

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

export default router;
