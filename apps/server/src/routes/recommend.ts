import { Hono } from 'hono';
import type { Bindings, Variables } from 'types';
import { authMiddleware } from 'middleware/auth';

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Recommendation endpoint using a cost-effective LLM model
router.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const prompt = `Generate 5 personalized post recommendations for user ${user.id}.`;
  const aiResult = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { prompt });
  return c.json({ recommendations: aiResult });
});

export default router;
