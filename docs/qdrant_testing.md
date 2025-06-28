# Phase 1 Recommendation System Testing Guide

## 🎯 Overview
This guide tests the complete Phase 1 pipeline:
1. **Post Creation** → **Embedding Generation** → **Qdrant Storage**
2. **User Vector Generation** → **KV Storage** 
3. **Discovery Feed** → **Vector Search** → **Recommendation Serving**

## 🚀 Quick Start

### 1. Start Local Environment

```bash
# Terminal 1: Start Qdrant
cd apps/server
docker run -d --name qdrant -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant

# Terminal 2: Start Cloudflare Workers
npm run dev
```

### 2. Verify Qdrant Connection
```bash
# Test Qdrant is running
curl http://localhost:6333/

# Should return: {"title":"qdrant - vector search engine","version":"1.x.x"}
```

## 🧪 Test Scenarios

### **Test 1: Post Embedding Pipeline**

**Objective**: Verify posts generate embeddings and store in both KV and Qdrant

**Steps**:
1. Create a test post via GraphQL
2. Verify queue processing
3. Check KV storage
4. Check Qdrant storage

**GraphQL Mutation**:
```graphql
mutation CreateTestPost {
  createPost(input: {
    content: "This is a test post about machine learning and artificial intelligence #AI #ML"
    type: post
  }) {
    id
    content
    user {
      username
    }
  }
}
```

**Verification Commands**:
```bash
# Check Qdrant collection exists
curl "http://localhost:6333/collections/posts"

# Check if vector was stored (replace POST_ID)
curl -X POST "http://localhost:6333/collections/posts/points/scroll" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "with_payload": true}'
```

### **Test 2: User Vector Generation**

**Objective**: Verify user vectors are calculated from user's posts and saved posts

**Steps**:
1. Create multiple posts for a user
2. Save some posts from other users  
3. Trigger user vector update
4. Verify user vector in KV

**Setup Commands**:
```graphql
# Create a few posts
mutation CreatePost1 {
  createPost(input: {
    content: "I love technology and programming #tech #coding"
    type: post
  }) {
    id
  }
}

mutation CreatePost2 {
  createPost(input: {
    content: "Machine learning is fascinating #AI #datascience"
    type: post
  }) {
    id
  }
}

# Save another user's post
mutation SavePost {
  savePost(postId: "some-other-post-id") {
    success
  }
}
```

**Manual Queue Trigger** (for testing):
```bash
# You can manually trigger user vector update via the interests endpoint
curl -X GET "http://localhost:8787/api/interests" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Test 3: Discovery Feed**

**Objective**: Verify recommendations work end-to-end

**Steps**:
1. Ensure user has vector (from Test 2)
2. Create posts from different users
3. Query discovery feed
4. Verify results are vector-similar

**GraphQL Query**:
```graphql
query DiscoverFeed {
  discoverFeed(limit: 5) {
    posts {
      id
      content
      user {
        username
      }
      _saveCount
      _commentCount
    }
    nextCursor
  }
}
```

### **Test 4: Error Handling**

**Objective**: Verify system handles failures gracefully

**Test Cases**:
1. **Qdrant Down**: Stop Qdrant, create post, verify graceful degradation
2. **Invalid Content**: Create post with empty content
3. **Missing User Vector**: Query discovery feed for user without vector

## 🔍 Debugging Tools

### **Check KV Storage**
```bash
# Via wrangler CLI (if available)
wrangler kv:key get --binding=POST_VECTORS "post:POST_ID"
wrangler kv:key get --binding=USER_VECTORS "USER_ID"
```

### **Check Qdrant Storage**
```bash
# List all points
curl -X POST "http://localhost:6333/collections/posts/points/scroll" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100, "with_payload": true}'

# Search for similar vectors (replace with actual vector)
curl -X POST "http://localhost:6333/collections/posts/points/search" \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, 0.3, ...],  
    "limit": 5,
    "with_payload": true
  }'
```

### **Check Queue Status**
```bash
# View worker logs
npm run dev # logs will show queue processing
```

## ✅ Success Criteria

### **Phase 1 Complete When**:
- [ ] Posts automatically generate embeddings
- [ ] Embeddings stored in both KV and Qdrant  
- [ ] User vectors calculated from user behavior
- [ ] Discovery feed returns vector-similar posts
- [ ] No errors in worker logs
- [ ] Qdrant collection properly configured

### **Performance Benchmarks**:
- [ ] Post embedding generation: < 2 seconds
- [ ] User vector calculation: < 5 seconds  
- [ ] Discovery query: < 500ms
- [ ] Qdrant vector search: < 100ms

## 🚨 Common Issues

### **Issue: "Collection not found"**
```bash
# Manually create collection
curl -X PUT "http://localhost:6333/collections/posts" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 768,
      "distance": "Cosine"
    }
  }'
```

### **Issue: "Queue not processing"**
- Check worker logs for errors
- Verify D1 database connection
- Ensure AI binding is working

### **Issue: "No recommendations returned"**
- Verify user has vector in USER_VECTORS KV
- Check if any posts exist in Qdrant
- Ensure user isn't blocked by all other users

## 📊 Monitoring

### **Key Metrics to Track**:
1. **Embedding Success Rate**: % of posts that get embeddings
2. **Queue Processing Time**: Time from post creation to vector storage
3. **Discovery Query Performance**: Response time for feed requests
4. **Vector Quality**: Similarity scores in recommendations

### **Log Patterns to Watch**:
```bash
grep "Successfully stored vector" logs
grep "Failed to generate embedding" logs  
grep "Qdrant.*failed" logs
grep "handleUserEmbeddingQueue.*Successfully" logs
``` 