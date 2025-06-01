import { describe, it, expect, vi } from 'vitest';
import { createGraphQLTestClient } from '../../../../test/utils/graphql-test-client';
import { type Post } from '@prisma/client'; // Assuming Post type is from Prisma, adjust if not
// Import D1 schema objects
import { users, posts, media, hashtags, postHashtags, comments } from '@/server/db/schema';

// Mock data - adjust as per your actual data structure and requirements
const mockPostId = 'test-post-id';
const mockUserId = 'test-user-id';
const mockMediaId = 'test-media-id';
const mockHashtagId = 'test-hashtag-id';
const mockCommentId = 'test-comment-id';
const nonExistentPostId = 'non-existent-post-id';

const mockUser = {
  id: mockUserId,
  username: 'testuser',
  displayName: 'Test User',
  bio: 'Test bio',
  avatarUrl: 'https://example.com/avatar.png',
  website: 'https://example.com',
  email: 'test@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMedia = {
  id: mockMediaId,
  url: 'https://example.com/media.jpg',
  type: 'IMAGE',
  userId: mockUserId,
  postId: mockPostId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockHashtag = {
  id: mockHashtagId,
  name: 'test',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockComment = {
  id: mockCommentId,
  content: 'Test comment',
  userId: mockUserId,
  postId: mockPostId,
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: mockUser,
};

const mockPost: Post & { user: any; media: any[]; comments: any[]; hashtags: any[] } = {
  id: mockPostId,
  content: 'Test post content',
  userId: mockUserId,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: mockUser,
  media: [mockMedia],
  comments: [mockComment],
  hashtags: [mockHashtag],
};


describe('Post Resolver - Query.post', () => {
  const GET_POST_QUERY = `
    query GetPost($id: ID!) {
      post(id: $id) {
        id
        content
        createdAt
        updatedAt
        user {
          id
          username
          displayName
          avatarUrl
        }
        media {
          id
          url
          type
        }
        hashtags {
          id
          name
        }
        comments {
          id
          content
          user {
            id
            username
          }
        }
        savedBy {
          id
        }
      }
    }
  `;

  it('should return the correct post data when a valid ID is provided and user is authenticated', async () => {
    const { query, updateMockData } = await createGraphQLTestClient();

    await updateMockData(async (db) => {
      await db.insert(users).values(mockUser).execute();
      await db.insert(posts).values({
        id: mockPost.id,
        content: mockPost.content,
        userId: mockPost.userId,
        createdAt: mockPost.createdAt,
        updatedAt: mockPost.updatedAt,
      }).execute();
      await db.insert(media).values(mockMedia).execute();
      await db.insert(hashtags).values(mockHashtag).execute();
      await db.insert(postHashtags).values({ postId: mockPostId, hashtagId: mockHashtagId }).execute();
      await db.insert(comments).values({
        id: mockComment.id,
        content: mockComment.content,
        userId: mockComment.userId,
        postId: mockComment.postId,
        parentId: mockComment.parentId,
        createdAt: mockComment.createdAt,
        updatedAt: mockComment.updatedAt,
      }).execute();
    });

    const { data, errors } = await query({
      query: GET_POST_QUERY,
      variables: { id: mockPostId },
    });

    expect(errors).toBeUndefined();
    expect(data).toBeDefined();
    expect(data?.post).toEqual({
      id: mockPostId,
      content: mockPost.content,
      createdAt: mockPost.createdAt.toISOString(),
      updatedAt: mockPost.updatedAt.toISOString(),
      user: {
        id: mockUser.id,
        username: mockUser.username,
        displayName: mockUser.displayName,
        avatarUrl: mockUser.avatarUrl,
      },
      media: [
        {
          id: mockMedia.id,
          url: mockMedia.url,
          type: mockMedia.type,
        },
      ],
      hashtags: [
        {
          id: mockHashtag.id,
          name: mockHashtag.name,
        },
      ],
      comments: [
        {
          id: mockComment.id,
          content: mockComment.content,
          user: {
            id: mockUser.id,
            username: mockUser.username,
          },
        },
      ],
      savedBy: [],
    });
  });

  // Authentication Required Test
  it('should throw "Authentication required" error if user is not authenticated', async () => {
    const { query } = await createGraphQLTestClient({
      contextOverrides: { user: null },
    });

    // No need to seed data as authentication check happens before DB lookup
    const { data, errors } = await query({
      query: GET_POST_QUERY,
      variables: { id: mockPostId },
    });

    expect(data?.post).toBeNull();
    expect(errors).toBeDefined();
    expect(errors?.[0].message).toBe('Authentication required');
  });

  // Post Not Found Test
  it('should throw "Post not found" error if the post ID does not exist', async () => {
    const { query, updateMockData } = await createGraphQLTestClient();

    // Seed a user, but no posts
    await updateMockData(async (db) => {
      await db.insert(users).values(mockUser).execute();
    });

    const { data, errors } = await query({
      query: GET_POST_QUERY,
      variables: { id: nonExistentPostId },
    });

    expect(data?.post).toBeNull();
    expect(errors).toBeDefined();
    expect(errors?.[0].message).toContain('Post not found');
  });
});
