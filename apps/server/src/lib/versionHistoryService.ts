import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Define types for version history
type EditingMetadata = Record<string, unknown>;

interface VersionData {
  id: string;
  postId: string | null;
  draftPostId: string | null;
  version: number;
  content: string;
  editingMetadata: string | null;
  changeType: string;
  changeDescription: string | null;
  userId: string;
  createdAt: string;
}

interface ProcessedVersionData extends Omit<VersionData, 'editingMetadata'> {
  editingMetadata: EditingMetadata | null;
}

interface ProcessedPostData {
  id: string;
  userId: string;
  content: string;
  version: number;
  editingMetadata: EditingMetadata | null;
  updatedAt: string;
  [key: string]: unknown;
}

export interface VersionHistoryService {
  createVersion: (data: {
    postId?: string;
    draftPostId?: string;
    version: number;
    content: string;
    editingMetadata?: EditingMetadata;
    changeType: 'CREATED' | 'EDITED' | 'PUBLISHED' | 'REVERTED';
    changeDescription?: string;
    userId: string;
  }) => Promise<ProcessedVersionData>;
  getVersionHistory: (postId: string, limit?: number, offset?: number) => Promise<ProcessedVersionData[]>;
  getVersion: (versionId: string, userId: string) => Promise<ProcessedVersionData>;
  revertToVersion: (postId: string, versionId: string, userId: string) => Promise<ProcessedPostData>;
  getDraftVersionHistory: (draftPostId: string, limit?: number, offset?: number) => Promise<ProcessedVersionData[]>;
}

export function createVersionHistoryService(env: Bindings): VersionHistoryService {
  const db = createD1Client(env);

  return {
    async createVersion(data) {
      try {
        const versionId = nanoid();
        const editingMetadata = data.editingMetadata ? JSON.stringify(data.editingMetadata) : null;

        await db.insert(schema.postVersionHistory).values({
          id: versionId,
          postId: data.postId,
          draftPostId: data.draftPostId,
          version: data.version,
          content: data.content,
          editingMetadata,
          changeType: data.changeType,
          changeDescription: data.changeDescription,
          userId: data.userId,
          createdAt: new Date().toISOString(),
        });

        const version = await db
          .select()
          .from(schema.postVersionHistory)
          .where(eq(schema.postVersionHistory.id, versionId))
          .get();

        if (!version) throw new Error('Failed to create version');

        return {
          ...version,
          editingMetadata: version.editingMetadata ? JSON.parse(version.editingMetadata) as EditingMetadata : null,
        };
      } catch (error) {
        console.error('Version creation error:', error);
        throw new Error(`Failed to create version: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async getVersionHistory(postId: string, limit = 10, offset = 0) {
      try {
        const versions = await db
          .select()
          .from(schema.postVersionHistory)
          .where(eq(schema.postVersionHistory.postId, postId))
          .orderBy(desc(schema.postVersionHistory.version))
          .limit(limit)
          .offset(offset)
          .all();

        return versions.map((version): ProcessedVersionData => ({
          ...version,
          editingMetadata: version.editingMetadata ? JSON.parse(version.editingMetadata) as EditingMetadata : null,
        }));
      } catch (error) {
        console.error('Version history fetch error:', error);
        throw new Error(`Failed to fetch version history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async getDraftVersionHistory(draftPostId: string, limit = 10, offset = 0) {
      try {
        const versions = await db
          .select()
          .from(schema.postVersionHistory)
          .where(eq(schema.postVersionHistory.draftPostId, draftPostId))
          .orderBy(desc(schema.postVersionHistory.version))
          .limit(limit)
          .offset(offset)
          .all();

        return versions.map((version): ProcessedVersionData => ({
          ...version,
          editingMetadata: version.editingMetadata ? JSON.parse(version.editingMetadata) as EditingMetadata : null,
        }));
      } catch (error) {
        console.error('Draft version history fetch error:', error);
        throw new Error(`Failed to fetch draft version history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async getVersion(versionId: string, userId: string) {
      try {
        const version = await db
          .select()
          .from(schema.postVersionHistory)
          .where(eq(schema.postVersionHistory.id, versionId))
          .get();

        if (!version) {
          throw new Error('Version not found');
        }

        // Verify user has access (either owner or if public post)
        if (version.userId !== userId) {
          // Additional access checks could go here
          // For now, we'll allow access if user is the owner
          throw new Error('Not authorized to access this version');
        }

        return {
          ...version,
          editingMetadata: version.editingMetadata ? JSON.parse(version.editingMetadata) as EditingMetadata : null,
        };
      } catch (error) {
        console.error('Version fetch error:', error);
        throw new Error(`Failed to fetch version: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    async revertToVersion(postId: string, versionId: string, userId: string) {
      try {
        // Get the version to revert to
        const targetVersion = await this.getVersion(versionId, userId);
        if (!targetVersion) {
          throw new Error('Target version not found');
        }

        // Get the current post
        const currentPost = await db
          .select()
          .from(schema.post)
          .where(eq(schema.post.id, postId))
          .get();

        if (!currentPost) {
          throw new Error('Post not found');
        }

        if (currentPost.userId !== userId) {
          throw new Error('Not authorized to revert this post');
        }

        // Create a version entry for the current state before reverting
        await this.createVersion({
          postId,
          version: currentPost.version + 1,
          content: currentPost.content,
          editingMetadata: currentPost.editingMetadata ? JSON.parse(currentPost.editingMetadata) : null,
          changeType: 'EDITED',
          changeDescription: `Auto-save before reverting to version ${targetVersion.version}`,
          userId,
        });

        // Update the post with the target version's content
        await db
          .update(schema.post)
          .set({
            content: targetVersion.content,
            editingMetadata: targetVersion.editingMetadata ? JSON.stringify(targetVersion.editingMetadata) : null,
            version: currentPost.version + 2, // Increment version for the revert
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.post.id, postId));

        // Create a version entry for the revert action
        await this.createVersion({
          postId,
          version: currentPost.version + 2,
          content: targetVersion.content,
          editingMetadata: targetVersion.editingMetadata,
          changeType: 'REVERTED',
          changeDescription: `Reverted to version ${targetVersion.version}`,
          userId,
        });

        // Return the updated post
        const updatedPost = await db
          .select()
          .from(schema.post)
          .where(eq(schema.post.id, postId))
          .get();

        return {
          ...updatedPost,
          editingMetadata: updatedPost?.editingMetadata ? JSON.parse(updatedPost.editingMetadata) as EditingMetadata : null,
        } as ProcessedPostData;
      } catch (error) {
        console.error('Version revert error:', error);
        throw new Error(`Failed to revert to version: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };
}