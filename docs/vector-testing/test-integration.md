# Integration Test Guide

This guide helps you manually test the full embedding pipeline in your development environment.

## Prerequisites

1. **Start Qdrant**:
```bash
docker run -d --name qdrant -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

2. **Test Qdrant Connection**:
```bash
node test-scripts/test-qdrant-basic.js
```

3. **Start your development server**:
```bash
npm run dev
# or
wrangler dev
```

## Test Steps

### Step 1: Create Test User and Profile

Using your frontend or GraphQL playground:

```graphql
# First create a user through your auth system
# Then create/update profile
mutation UpdateProfile($input: ProfileInput!) {
  updateProfile(input: $input) {
    id
    username
    bio
  }
}
```

Variables:
```json
{
  "input": {
    "username": "testuser123",
    "bio": "Testing the recommendation system"
  }
}
```

### Step 2: Create Posts with Different Topics

Create several posts with distinct topics to test similarity:

**Post 1 - AI/Technology**:
```graphql
mutation CreatePost($input: PostInput!) {
  createPost(input: $input) {
    id
    content
    createdAt
  }
}
```

Variables:
```json
{
  "input": {
    "content": "Artificial intelligence and machine learning are revolutionizing healthcare. Deep learning models can now detect diseases from medical images with incredible accuracy.",
    "type": "post"
  }
}
```

**Post 2 - Cooking/Food**:
```json
{
  "input": {
    "content": "Just made an amazing pasta dish with fresh tomatoes and basil. Italian cuisine never fails to impress. The secret is using high-quality olive oil.",
    "type": "post"
  }
}
```

**Post 3 - Fitness/Health**:
```json
{
  "input": {
    "content": "Morning workout complete! Nothing beats a good run followed by strength training. Consistency is key to building healthy habits.",
    "type": "post"
  }
}
```

### Step 3: Monitor Queue Processing

Check your server logs for:
```
[handlePostQueue] Successfully stored vector for post {POST_ID}
```

### Step 4: Verify Embeddings in Storage

**Check KV Storage**:
In your server logs or admin panel, verify embeddings exist:
```typescript
// You can add this to a debug route
const postVector = await env.POST_VECTORS.get('post:YOUR_POST_ID', { type: 'json' });
console.log('Vector length:', postVector?.vector?.length); // Should be 768
```

**Check Qdrant**:
Visit http://localhost:6333/dashboard and verify:
- Collection "posts" exists
- Vectors are being stored
- You can search and see results

### Step 5: Create User Interest Profile

Save one or more posts as the test user:

```graphql
mutation SavePost($postId: ID!) {
  savePost(postId: $postId) {
    success
  }
}
```

Use the ID from the AI/Technology post to indicate interest in that topic.

### Step 6: Wait for User Vector Generation

Monitor logs for:
```
[UserQueue] User {USER_ID} vector generated from X saved + Y created posts
```

### Step 7: Test Discovery Feed

Query the discovery feed:

```graphql
query DiscoverFeed($limit: Int) {
  discoverFeed(limit: $limit) {
    posts {
      id
      content
      user {
        username
      }
    }
    nextCursor
  }
}
```

Variables:
```json
{
  "limit": 10
}
```

### Step 8: Create Similar Content

Create a new post similar to the one you saved:

```json
{
  "input": {
    "content": "Neural networks and computer vision are advancing rapidly. AI models can now process and understand visual data better than ever before.",
    "type": "post"
  }
}
```

### Step 9: Verify Recommendations

Query the discovery feed again. The new AI-related post should appear in the results for the user who saved AI content.

## Expected Results

### ✅ Success Indicators:
- [ ] All posts create embeddings (768-dimensional vectors)
- [ ] User vector is generated after saving posts
- [ ] Discovery feed returns posts
- [ ] Similar content appears higher in recommendations
- [ ] Different topic content appears lower or not at all

### ❌ Failure Indicators:
- [ ] Queue processing fails (check error logs)
- [ ] Embeddings are not 768 dimensions
- [ ] User vector is not generated
- [ ] Discovery feed returns empty results
- [ ] No relevance in recommendations (random results)

## Debugging Commands

### Check Queue Status:
```bash
# In wrangler dev console
curl -X POST http://localhost:8787/api/debug/queues
```

### Inspect Qdrant Collection:
```bash
curl http://localhost:6333/collections/posts
```

### Search Vectors Manually:
```bash
curl -X POST http://localhost:6333/collections/posts/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [/* your test vector */],
    "limit": 5,
    "with_payload": true
  }'
```

### Check KV Data:
Add debug routes to inspect:
```typescript
// Add to a debug route
app.get('/debug/vectors/:postId', async (c) => {
  const postVector = await c.env.POST_VECTORS.get(`post:${c.req.param('postId')}`, { type: 'json' });
  return c.json({ vector: postVector });
});
```

## Troubleshooting

### Issue: Posts created but no embeddings
- Check AI binding is working
- Verify queue messages are being sent
- Check worker logs for embedding generation errors

### Issue: User vector not updating
- Verify user saves posts successfully
- Check USER_VECTOR_QUEUE is triggered
- Look for cooldown messages (5-minute cooldown between updates)

### Issue: Discovery feed empty
- Ensure user has a vector (check USER_VECTORS KV)
- Verify Qdrant has vectors to search
- Check privacy filters aren't hiding all content

### Issue: No similarity in recommendations
- Create more posts with clear topical differences
- Verify vector search returns reasonable similarity scores
- Check that user vector represents saved content properly

## Next Steps

Once Phase 1 testing passes:
1. Document any issues found
2. Optimize performance if needed
3. Begin Phase 2: Multi-Modal Embeddings
4. Set up automated testing infrastructure 