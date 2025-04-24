# Capture: Privacy-First Recommendation System Plan

## Executive Summary

Capture's recommendation system uses content-based vector embeddings to suggest relevant posts to users without relying on invasive tracking. The system generates mathematical representations (vectors) of content and user interests, then matches similar vectors to provide personalized recommendations while preserving user privacy and mental wellbeing.

## Core Principles

- **Privacy by Design**: Recommendations based on content meaning, not behavior tracking
- **Explicit User Actions**: Signals derived from conscious user choices (saves, follows, posts)
- **Transparency**: Clear labeling of recommended content and why it appears
- **User Control**: Easy opt-out options and preference controls
- **Performance**: Event-driven updates to minimize resource usage

## Technical Architecture

### 1. Vector Representation System

**Content Vectors:**
- Each post generates a text embedding vector (384-768 dimensional)
- Vectors represent semantic meaning, not just keywords
- Stored in Cloudflare Vectorize linked to post IDs

**User Interest Vectors:**
- Created by combining vectors from:
  - Saved posts (highest weight)
  - Created content (medium weight)
  - Post Hashtags (medium weight)
- Single vector per user representing their interests

### 2. Event-Driven Vector Updates

- User vectors update only after meaningful actions:
  - Creating new posts
  - Saving/unsaving content
  - Following hashtags (future implementation)
  - Shares by Sender (future implementation)
- Implementation via Cloudflare Queues with cooldown periods
- Saves resources by not processing inactive users

### 3. Recommendation Generation Process

1. User requests discovery feed
2. System queries vector database using user's interest vector
3. Finds posts with similar vectors (high cosine similarity)
4. Filters results:
   - Prioritizes posts from followed users in the last week
   - Weights posts by popularity (higher save count/comment count)
   - Removes content from blocked users
   - Excludes already seen posts
   - Applies privacy settings and preferences
5. Ranks by combination of:
   - Recent posts from followed users (highest priority)
   - Popularity metrics (60%)
   - Similarity score (40%)
6. Returns recommendations alongside chronological feed

### 4. Data Schema Extensions

```
// User interest vectors
userInterestVector {
  userId: string (primary key)
  vector: string (JSON array of vector values)
  lastUpdated: timestamp
  sourceData: { saved: number, created: number, hashtags: number }
}

// Post vectors
postVector {
  postId: string (primary key)
  vector: string (JSON array of vector values)
  createdAt: timestamp
}

// Post view tracking
postView {
  id: string (primary key)
  userId: string
  postId: string
  viewedAt: timestamp
}
```

## Implementation Phases

### Phase 1: Foundation
1. Set up Cloudflare Workers AI for text embedding generation
2. Implement vector storage in Cloudflare Vectorize
3. Create background worker for processing new posts

### Phase 2: User Interest Modeling
1. Implement event-driven user vector updates
2. Develop saved post analysis system

### Phase 3: Recommendation Engine
1. Create similarity-based recommendation queries
2. Implement filtering and privacy controls
3. Add post view tracking to prevent repeated content
4. Add UI components for discovery feed

### Phase 4: Enhancements (Future)
1. Add image vector analysis
2. Implement more sophisticated blending algorithms
3. Add user feedback mechanisms to improve recommendations

## Technical Considerations

### Performance Optimizations
- Asynchronous vector generation
- Caching recommendation results (KV store)
- Progressive loading (chronological first, then recommendations)
- 5-10 minute cooldown between vector updates for active users

### Resource Requirements
- Storage: ~1KB per post vector, ~1KB per user vector
- Compute: Vector generation (1-2 seconds per post)
- Query Performance: ~100-200ms for recommendation queries with caching

## Privacy Safeguards

- No tracking of views, engagement time, or other behavioral metrics
- All processing happens within your infrastructure
- No third-party recommendation services
- Clear user controls for recommendation types
- Option to disable discovery content entirely

This recommendation system provides a compelling alternative to engagement-maximizing algorithms while still delivering relevant content to users, aligning perfectly with Capture's vision of a privacy-first social platform.