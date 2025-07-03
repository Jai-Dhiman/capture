import {  desc, eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createD1Client } from '../../db';
import * as schema from '../../db/schema';
import { createImageService } from '../../lib/imageService';
import { createVersionHistoryService } from '../../lib/versionHistoryService';
import { createCachingService, CacheKeys, CacheTTL } from '../../lib/cachingService';
import { QdrantClient } from '../../lib/qdrantClient';
import type { ContextType } from '../../types';

export const postResolvers = {
  Query: {
    async draftPost(_parent: unknown, { id }: { id: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const db = createD1Client(context.env);
        const draftPost = await db
          .select()
          .from(schema.draftPost)
          .where(eq(schema.draftPost.id, id))
          .get();

        if (!draftPost) throw new Error('Draft post not found');

        // Verify user owns this draft
        if (draftPost.userId !== context.user.id) {
          throw new Error('Not authorized to access this draft');
        }

        const user = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, draftPost.userId))
          .get();

        const media = await db
          .select()
          .from(schema.media)
          .where(eq(schema.media.draftPostId, draftPost.id))
          .all();

        const draftHashtags = await db
          .select()
          .from(schema.draftPostHashtag)
          .where(eq(schema.draftPostHashtag.draftPostId, draftPost.id))
          .all();

        let hashtags: Array<{ id: string; name: string }> = [];
        if (draftHashtags.length > 0) {
          const hashtagIds = draftHashtags.map((dh) => dh.hashtagId).filter(Boolean);
          hashtags = await db
            .select()
            .from(schema.hashtag)
            .where(inArray(schema.hashtag.id, hashtagIds))
            .all();
        }

        return {
          ...draftPost,
          user,
          media,
          hashtags,
          editingMetadata: draftPost.editingMetadata ? JSON.parse(draftPost.editingMetadata) : null,
        };
      } catch (error) {
        console.error('Error fetching draft post:', error);
        throw new Error(`Failed to fetch draft post: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async draftPosts(_parent: unknown, { limit = 10, offset = 0 }: { limit?: number; offset?: number }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const cachingService = createCachingService(context.env);
      const cacheKey = `${CacheKeys.userDrafts(context.user.id)}:${limit}:${offset}`;

      try {
        const cachedDrafts = await cachingService.getOrSet(
          cacheKey,
          async () => {
            const db = createD1Client(context.env);
            const draftPosts = await db
              .select()
              .from(schema.draftPost)
              .where(eq(schema.draftPost.userId, context.user.id))
              .orderBy(desc(schema.draftPost.updatedAt))
              .limit(limit)
              .offset(offset)
              .all();

            return Promise.all(
              draftPosts.map(async (draft) => {
                const user = await db
                  .select()
                  .from(schema.profile)
                  .where(eq(schema.profile.userId, draft.userId))
                  .get();

                const media = await db
                  .select()
                  .from(schema.media)
                  .where(eq(schema.media.draftPostId, draft.id))
                  .all();

                return {
                  ...draft,
                  user,
                  media,
                  hashtags: [],
                  editingMetadata: draft.editingMetadata ? JSON.parse(draft.editingMetadata) : null,
                };
              })
            );
          },
          CacheTTL.SHORT // Shorter TTL for frequently changing drafts
        );

        return cachedDrafts;
      } catch (error) {
        console.error('Error fetching draft posts:', error);
        throw new Error(`Failed to fetch draft posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async postVersionHistory(_parent: unknown, { postId, limit = 10, offset = 0 }: { postId: string; limit?: number; offset?: number }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const versionHistoryService = createVersionHistoryService(context.env);
        const versions = await versionHistoryService.getVersionHistory(postId, limit, offset);

        // Enrich with user data
        const enrichedVersions = await Promise.all(
          versions.map(async (version) => {
            const user = await createD1Client(context.env)
              .select()
              .from(schema.profile)
              .where(eq(schema.profile.userId, version.userId))
              .get();

            return {
              ...version,
              user,
            };
          })
        );

        return enrichedVersions;
      } catch (error) {
        console.error('Error fetching version history:', error);
        throw new Error(`Failed to fetch version history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async postVersion(_parent: unknown, { id }: { id: string }, context: ContextType) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      try {
        const versionHistoryService = createVersionHistoryService(context.env);
        const version = await versionHistoryService.getVersion(id, context.user.id);

        const user = await createD1Client(context.env)
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, version.userId))
          .get();

        return {
          ...version,
          user,
        };
      } catch (error) {
        console.error('Error fetching version:', error);
        throw new Error(`Failed to fetch version: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async post(_parent: unknown, { id }: { id: string }, context: { env: any; user: any }) {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const cachingService = createCachingService(context.env);
      const cacheKey = CacheKeys.post(id);

      try {
        const cachedPost = await cachingService.getOrSet(
          cacheKey,
          async () => {
            const db = createD1Client(context.env);
            const post = await db.select().from(schema.post).where(eq(schema.post.id, id)).get();

            if (!post) throw new Error('Post not found');

            const user = await db
              .select()
              .from(schema.profile)
              .where(post.userId ? eq(schema.profile.userId, post.userId) : sql`FALSE`)
              .get();

            const media = await db
              .select()
              .from(schema.media)
              .where(eq(schema.media.postId, post.id))
              .all();

            const postHashtags = await db
              .select()
              .from(schema.postHashtag)
              .where(eq(schema.postHashtag.postId, post.id))
              .all();

            let hashtags: Array<{ id: string; name: string }> = [];
            if (postHashtags.length > 0) {
              const hashtagIds = postHashtags.map((ph) => ph.hashtagId);
              const validHashtagIds = hashtagIds.filter((id): id is string => id !== null);
              hashtags = await db
                .select()
                .from(schema.hashtag)
                .where(
                  validHashtagIds.length > 0 ? inArray(schema.hashtag.id, validHashtagIds) : sql`FALSE`,
                )
                .all();
            }

            const comments = await db
              .select()
              .from(schema.comment)
              .where(eq(schema.comment.postId, post.id))
              .all();

            return {
              ...post,
              user,
              media,
              hashtags,
              comments,
              savedBy: [],
              editingMetadata: post.editingMetadata ? JSON.parse(post.editingMetadata) : null,
            };
          },
          CacheTTL.MEDIUM
        );

        return cachedPost;
      } catch (error) {
        console.error('Error fetching post:', error);
        throw new Error(
          `Failed to fetch post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  },

  Mutation: {
    async saveDraftPost(_parent: unknown, { input }: { input: any }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const existingProfile = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        if (!existingProfile) {
          throw new Error('Profile not found.');
        }

        const draftId = nanoid();
        const editingMetadata = input.editingMetadata ? JSON.stringify(input.editingMetadata) : null;

        await db.insert(schema.draftPost).values({
          id: draftId,
          userId: context.user.id,
          content: input.content,
          type: input.type || 'post',
          editingMetadata,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (input.mediaIds?.length) {
          await Promise.all(
            input.mediaIds.map((mediaId: string, index: number) =>
              db
                .update(schema.media)
                .set({
                  draftPostId: draftId,
                  order: index,
                })
                .where(eq(schema.media.id, mediaId)),
            ),
          );
        }

        if (input.hashtagIds?.length) {
          await Promise.all(
            input.hashtagIds.map((hashtagId: string) =>
              db.insert(schema.draftPostHashtag).values({
                draftPostId: draftId,
                hashtagId,
                createdAt: new Date().toISOString(),
              }),
            ),
          );
        }

        const createdDraft = await db
          .select()
          .from(schema.draftPost)
          .where(eq(schema.draftPost.id, draftId))
          .get();

        if (!createdDraft) throw new Error('Failed to create draft post');

        const media = await db
          .select()
          .from(schema.media)
          .where(eq(schema.media.draftPostId, draftId))
          .all();

        // Invalidate draft caches
        const cachingService = createCachingService(context.env);
        await cachingService.invalidatePattern(CacheKeys.userPattern(context.user.id));

        return {
          ...createdDraft,
          user: existingProfile,
          media,
          hashtags: [],
          editingMetadata: createdDraft.editingMetadata ? JSON.parse(createdDraft.editingMetadata) : null,
        };
      } catch (error) {
        console.error('Draft creation error:', error);
        throw new Error(`Failed to create draft post: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async updateDraftPost(_parent: unknown, { id, input }: { id: string; input: any }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const existingDraft = await db
          .select()
          .from(schema.draftPost)
          .where(eq(schema.draftPost.id, id))
          .get();

        if (!existingDraft) {
          throw new Error('Draft post not found');
        }

        if (existingDraft.userId !== context.user.id) {
          throw new Error('Not authorized to update this draft');
        }

        const editingMetadata = input.editingMetadata ? JSON.stringify(input.editingMetadata) : existingDraft.editingMetadata;

        const newVersion = existingDraft.version + 1;

        await db
          .update(schema.draftPost)
          .set({
            content: input.content || existingDraft.content,
            type: input.type || existingDraft.type,
            editingMetadata,
            version: newVersion,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.draftPost.id, id));

        const updatedDraft = await db
          .select()
          .from(schema.draftPost)
          .where(eq(schema.draftPost.id, id))
          .get();

        if (!updatedDraft) throw new Error('Failed to update draft post');

        // Create version history entry for draft update
        const versionHistoryService = createVersionHistoryService(context.env);
        await versionHistoryService.createVersion({
          draftPostId: id,
          version: newVersion,
          content: updatedDraft.content,
          editingMetadata: input.editingMetadata,
          changeType: 'EDITED',
          changeDescription: 'Draft updated',
          userId: context.user.id,
        });

        const user = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        const media = await db
          .select()
          .from(schema.media)
          .where(eq(schema.media.draftPostId, id))
          .all();

        return {
          ...updatedDraft,
          user,
          media,
          hashtags: [],
          editingMetadata: updatedDraft.editingMetadata ? JSON.parse(updatedDraft.editingMetadata) : null,
        };
      } catch (error) {
        console.error('Draft update error:', error);
        throw new Error(`Failed to update draft post: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async publishDraftPost(_parent: unknown, { id }: { id: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const draftPost = await db
          .select()
          .from(schema.draftPost)
          .where(eq(schema.draftPost.id, id))
          .get();

        if (!draftPost) {
          throw new Error('Draft post not found');
        }

        if (draftPost.userId !== context.user.id) {
          throw new Error('Not authorized to publish this draft');
        }

        const postId = nanoid();

        // Create the published post
        await db.insert(schema.post).values({
          id: postId,
          userId: context.user.id,
          content: draftPost.content,
          type: draftPost.type,
          isDraft: 0,
          editingMetadata: draftPost.editingMetadata,
          version: draftPost.version,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Move media from draft to published post
        await db
          .update(schema.media)
          .set({ postId, draftPostId: null })
          .where(eq(schema.media.draftPostId, id));

        // Move hashtag associations
        const draftHashtags = await db
          .select()
          .from(schema.draftPostHashtag)
          .where(eq(schema.draftPostHashtag.draftPostId, id))
          .all();

        if (draftHashtags.length > 0) {
          await Promise.all(
            draftHashtags.map((dh) =>
              db.insert(schema.postHashtag).values({
                postId,
                hashtagId: dh.hashtagId,
                createdAt: new Date().toISOString(),
              }),
            ),
          );
        }

        // Create version history entry for publishing
        const versionHistoryService = createVersionHistoryService(context.env);
        await versionHistoryService.createVersion({
          postId,
          version: draftPost.version,
          content: draftPost.content,
          editingMetadata: draftPost.editingMetadata ? JSON.parse(draftPost.editingMetadata) : null,
          changeType: 'PUBLISHED',
          changeDescription: `Published from draft ${id}`,
          userId: context.user.id,
        });

        // Clean up draft
        await db.delete(schema.draftPostHashtag).where(eq(schema.draftPostHashtag.draftPostId, id));
        await db.delete(schema.draftPost).where(eq(schema.draftPost.id, id));

        // Queue for processing
        try {
          await context.env.POST_QUEUE.send({ postId });
        } catch (queueError) {
          console.error(`[publishDraftPost] FAILED to send postId ${postId} to POST_QUEUE:`, queueError);
        }

        // Return the published post
        const publishedPost = await db
          .select()
          .from(schema.post)
          .where(eq(schema.post.id, postId))
          .get();

        const user = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        const media = await db
          .select()
          .from(schema.media)
          .where(eq(schema.media.postId, postId))
          .all();

        return {
          ...publishedPost,
          user,
          media,
          comments: [],
          hashtags: [],
          savedBy: [],
          editingMetadata: publishedPost?.editingMetadata ? JSON.parse(publishedPost.editingMetadata) : null,
        };
      } catch (error) {
        console.error('Draft publish error:', error);
        throw new Error(`Failed to publish draft post: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async deleteDraftPost(_parent: unknown, { id }: { id: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const draftPost = await db
          .select()
          .from(schema.draftPost)
          .where(eq(schema.draftPost.id, id))
          .get();

        if (!draftPost) {
          throw new Error('Draft post not found');
        }

        if (draftPost.userId !== context.user.id) {
          throw new Error('Not authorized to delete this draft');
        }

        // Clean up associated data
        await db.delete(schema.draftPostHashtag).where(eq(schema.draftPostHashtag.draftPostId, id));
        await db.update(schema.media).set({ draftPostId: null }).where(eq(schema.media.draftPostId, id));
        await db.delete(schema.draftPost).where(eq(schema.draftPost.id, id));

        return {
          id,
          success: true,
        };
      } catch (error) {
        console.error('Draft delete error:', error);
        throw new Error(`Failed to delete draft post: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async revertPostToVersion(_parent: unknown, { postId, versionId }: { postId: string; versionId: string }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      try {
        const versionHistoryService = createVersionHistoryService(context.env);
        const revertedPost = await versionHistoryService.revertToVersion(postId, versionId, context.user.id);

        const db = createD1Client(context.env);
        const user = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        const media = await db
          .select()
          .from(schema.media)
          .where(eq(schema.media.postId, postId))
          .all();

        // Invalidate caches for reverted post
        const cachingService = createCachingService(context.env);
        await Promise.all([
          cachingService.delete(CacheKeys.post(postId)),
          cachingService.delete(CacheKeys.postVersions(postId)),
          cachingService.invalidatePattern(CacheKeys.postPattern(postId)),
        ]);

        return {
          ...revertedPost,
          user,
          media,
          comments: [],
          hashtags: [],
          savedBy: [],
        };
      } catch (error) {
        console.error('Post revert error:', error);
        throw new Error(`Failed to revert post: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async createPost(_parent: unknown, { input }: { input: any }, context: ContextType) {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);

      try {
        const existingProfile = await db
          .select()
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        if (!existingProfile) {
          throw new Error('Profile not found.');
        }

        const postId = nanoid();
        const editingMetadata = input.editingMetadata ? JSON.stringify(input.editingMetadata) : null;

        await db.insert(schema.post).values({
          id: postId,
          userId: context.user.id,
          content: input.content,
          type: input.type || 'post',
          isDraft: input.isDraft ? 1 : 0,
          editingMetadata,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        try {
          await context.env.POST_QUEUE.send({ postId });
        } catch (queueError) {
          console.error(`[createPost] FAILED to send postId ${postId} to POST_QUEUE:`, queueError);
        }

        if (input.mediaIds?.length) {
          await Promise.all(
            input.mediaIds.map((mediaId: string, index: number) =>
              db
                .update(schema.media)
                .set({
                  postId,
                  order: index,
                })
                .where(eq(schema.media.id, mediaId)),
            ),
          );
        }

        if (input.hashtagIds?.length) {
          await Promise.all(
            input.hashtagIds.map((hashtagId: string) =>
              db.insert(schema.postHashtag).values({
                postId,
                hashtagId,
                createdAt: new Date().toISOString(),
              }),
            ),
          );
        }

        const createdPost = await db
          .select({
            id: schema.post.id,
            content: schema.post.content,
            type: schema.post.type,
            createdAt: schema.post.createdAt,
            userId: schema.post.userId,
          })
          .from(schema.post)
          .where(eq(schema.post.id, postId))
          .get();

        if (!createdPost) throw new Error('Failed to create post');

        const userProfile = await db
          .select({
            id: schema.profile.id,
            userId: schema.profile.userId,
            username: schema.profile.username,
            image: schema.profile.profileImage,
          })
          .from(schema.profile)
          .where(eq(schema.profile.userId, context.user.id))
          .get();

        if (!userProfile) throw new Error('User profile not found');

        const mediaItems: Array<any> = [];
        const hashtagItems: Array<any> = [];

        // record post event
        await db.insert(schema.userActivity).values({
          id: nanoid(),
          userId: context.user.id,
          eventType: 'post',
          createdAt: new Date().toISOString(),
        });

        // Create initial version history entry
        const versionHistoryService = createVersionHistoryService(context.env);
        await versionHistoryService.createVersion({
          postId,
          version: 1,
          content: input.content,
          editingMetadata: input.editingMetadata,
          changeType: 'CREATED',
          changeDescription: 'Initial post creation',
          userId: context.user.id,
        });

        // Invalidate relevant caches
        const cachingService = createCachingService(context.env);
        await Promise.all([
          cachingService.invalidatePattern(CacheKeys.userPattern(context.user.id)),
          cachingService.invalidatePattern('feed:*'), // Invalidate all feeds
        ]);

        return {
          ...createdPost,
          type: createdPost.type || 'post',
          user: userProfile,
          media: mediaItems,
          comments: [],
          hashtags: hashtagItems,
          savedBy: [],
        };
      } catch (error) {
        console.error('Creation error:', error);
        console.error('Input:', input);
        throw new Error(
          `Failed to create post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    async deletePost(_parent: unknown, { id }: { id: string }, context: ContextType) {
      if (!context?.user?.id) {
        throw new Error('Authentication required');
      }

      const db = createD1Client(context.env);
      const imageService = createImageService(context.env);
      const qdrantClient = new QdrantClient(context.env);

      try {
        const post = await db
          .select({ id: schema.post.id, userId: schema.post.userId })
          .from(schema.post)
          .where(eq(schema.post.id, id))
          .get();

        if (!post) {
          throw new Error('Post not found');
        }

        if (post.userId !== context.user.id) {
          throw new Error('Not authorized to delete this post');
        }

        const mediaItems = await db
          .select({ id: schema.media.id, storageKey: schema.media.storageKey })
          .from(schema.media)
          .where(eq(schema.media.postId, id))
          .all();

        const deletionPromises = [];

        deletionPromises.push(
          db.delete(schema.postHashtag).where(eq(schema.postHashtag.postId, id)),
        );
        deletionPromises.push(db.delete(schema.comment).where(eq(schema.comment.postId, id)));
        deletionPromises.push(db.delete(schema.savedPost).where(eq(schema.savedPost.postId, id)));

        // Delete associated images from Cloudflare Images and DB
        for (const mediaItem of mediaItems) {
          deletionPromises.push(imageService.delete(mediaItem.id, context.user.id));
        }

        // Delete vector from Qdrant
        const vectorIdToDelete = `post:${post.id}`;
        deletionPromises.push(
          qdrantClient.deleteVector(vectorIdToDelete).catch((err) => {
            console.error(`Failed to delete vector ${vectorIdToDelete} from Qdrant:`, err);
          }),
        );

        await Promise.all(deletionPromises);

        await db.delete(schema.post).where(eq(schema.post.id, id));

        // Invalidate caches for deleted post
        const cachingService = createCachingService(context.env);
        await Promise.all([
          cachingService.delete(CacheKeys.post(id)),
          cachingService.invalidatePattern(CacheKeys.postPattern(id)),
          cachingService.invalidatePattern(CacheKeys.userPattern(context.user.id)),
          cachingService.invalidatePattern('feed:*'),
        ]);

        return {
          id,
          success: true,
        };
      } catch (error) {
        console.error('Delete post error:', error);
        throw new Error(
          `Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },

    markPostsAsSeen: async (
      _: unknown,
      { postIds }: { postIds: string[] },
      context: ContextType,
    ): Promise<{ success: boolean }> => {
      const { user, env } = context;
      if (!user) {
        throw new Error('Authentication required');
      }
      if (!postIds || postIds.length === 0) {
        return { success: true };
      }

      const db = createD1Client(env);
      const seenAt = new Date().toISOString();

      try {
        const seenPostsData = postIds.map((postId) => ({
          userId: user.id,
          postId,
          seenAt,
        }));

        await db.insert(schema.seenPostLog).values(seenPostsData).execute();

        return { success: true };
      } catch (error) {
        console.error('Failed to mark posts as seen:', error);
        throw new Error('Could not update seen posts');
      }
    },
  },

  Post: {
    async hashtags(parent: { id: string }, _: unknown, context: ContextType) {
      try {
        if (!parent.id) return [];

        const db = createD1Client(context.env);

        const postHashtags = await db
          .select({ hashtagId: schema.postHashtag.hashtagId })
          .from(schema.postHashtag)
          .where(eq(schema.postHashtag.postId, parent.id))
          .all();

        if (!postHashtags || postHashtags.length === 0) return [];

        const hashtagIds = postHashtags.map((ph) => ph.hashtagId).filter(Boolean);
        const validHashtagIds = hashtagIds.filter((id): id is string => id !== null);

        if (hashtagIds.length === 0) return [];

        const hashtags: Array<{ id: string; name: string }> = await db
          .select()
          .from(schema.hashtag)
          .where(
            validHashtagIds.length > 0 ? inArray(schema.hashtag.id, validHashtagIds) : sql`FALSE`,
          )
          .all();

        return hashtags || [];
      } catch (error) {
        console.error('Error resolving hashtags:', error);
        return [];
      }
    },

    _commentCount: (parent: { _commentCount: number }) => parent._commentCount,
    _saveCount: (parent: { _saveCount: number }) => parent._saveCount,
  },
};
