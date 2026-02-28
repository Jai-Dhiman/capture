# Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all issues found in the production health check and mobile cross-reference audit -- server bugs, TanStack Query cache mismatches, and missing feature hook stubs.

**Architecture:** Server-side: fix auth middleware error response. Mobile-side: introduce a central `queryKeys.ts` registry, fix all cache invalidation calls, convert comments to `useInfiniteQuery`, add missing feature hook stubs. All hooks import keys from the registry.

**Tech Stack:** Hono (server), React Native, TanStack Query v5, Jotai, TypeScript

---

### Task 1: Re-create Production Profile via API

**Files:**
- None (API call only)

**Step 1: Create profile for jaidhiman2000@gmail.com**

Send an authenticated request. First get a fresh token, then create the profile.

Run:
```bash
# Send code
curl -s -X POST https://capture-api.jai-d.workers.dev/auth/send-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"jaidhiman2000@gmail.com"}'
```
Expected: `{"success":true,...}`

Then verify with the code from email:
```bash
curl -s -X POST https://capture-api.jai-d.workers.dev/auth/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"email":"jaidhiman2000@gmail.com","code":"<CODE>"}'
```
Expected: JSON with `session.access_token`

Then create profile:
```bash
curl -s -X POST https://capture-api.jai-d.workers.dev/api/profile \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"userId":"2dB8V65FMgtSLYa7suBFN","username":"jai","bio":"Building Capture"}'
```
Expected: 201 with profile JSON

**Step 2: Verify profile exists**

```bash
curl -s https://capture-api.jai-d.workers.dev/auth/me \
  -H 'Authorization: Bearer <TOKEN>'
```
Expected: `"profileExists": true`

---

### Task 2: Fix check-username 500 Error

**Files:**
- Modify: `apps/server/src/middleware/auth.ts` (investigate error handling)
- Modify: `scripts/health-check.ts:128-134` (fix test categorization)

**Step 1: Investigate the auth middleware error**

Read `apps/server/src/middleware/auth.ts` to understand why it returns 500 instead of 401 for unauthenticated requests to `/api/*` routes.

**Step 2: Fix the middleware to return clean 401**

The middleware should catch JWT verification errors and return `c.json({ error: 'Unauthorized' }, 401)` instead of throwing.

**Step 3: Fix health check categorization**

In `scripts/health-check.ts`, move `check-username` from the "Public" group to the "Auth" group (add `auth: true`):

```typescript
// Move from Public group to Profile group or change auth flag
{
  name: "Profile: check-username",
  method: "GET",
  path: "/api/profile/check-username?username=__health_check_test__",
  auth: true, // was: false
},
```

**Step 4: Commit**

```bash
git add apps/server/src/middleware/auth.ts scripts/health-check.ts
git commit -m "fix: return 401 instead of 500 for unauthenticated /api/* requests"
```

---

### Task 3: Create Query Key Registry

**Files:**
- Create: `apps/mobile/src/shared/lib/queryKeys.ts`

**Step 1: Create the registry file**

```typescript
export const queryKeys = {
  // Profile
  profile: (userId: string) => ['profile', userId] as const,
  followers: (userId: string) => ['followers', userId] as const,
  following: (userId: string) => ['following', userId] as const,
  blockedUsers: () => ['blockedUsers'] as const,

  // Feeds
  discoverFeed: () => ['discoverFeed'] as const,
  followingFeed: () => ['followingFeed'] as const,
  userPosts: (userId: string) => ['userPosts', userId] as const,
  post: (postId: string) => ['post', postId] as const,

  // Engagement
  savedPosts: () => ['savedPosts'] as const,
  likedPosts: () => ['likedPosts'] as const,

  // Comments
  comments: (postId: string) => ['comments', postId] as const,
  commentReplies: (commentId: string) => ['comment-replies', commentId] as const,
  commentHasReplies: (commentId: string) => ['comment-has-replies', commentId] as const,

  // Notifications
  notifications: () => ['notifications'] as const,
  unreadCount: () => ['unreadNotificationCount'] as const,
  notificationSettings: () => ['notificationSettings'] as const,

  // Other
  hashtags: (query: string) => ['hashtags', 'search', query] as const,
  passkeys: () => ['passkeys'] as const,
  passkeyCapabilities: () => ['passkey', 'capabilities'] as const,
  draftPosts: () => ['draftPosts'] as const,

  // Media
  imageUrl: (mediaId: string, variant: string, useCDN: boolean) =>
    ['imageUrl', mediaId, variant, useCDN] as const,
  cloudflareImageUrl: (cloudflareId: string, expirySeconds: number) =>
    ['cloudflareImageUrl', cloudflareId, expirySeconds] as const,
} as const;

// Invalidation helpers - groups of keys to invalidate together
export const invalidationGroups = {
  allFeeds: () => [queryKeys.discoverFeed(), queryKeys.followingFeed()],
  postEngagement: (postId: string) => [
    queryKeys.post(postId),
    ...invalidationGroups.allFeeds(),
  ],
};
```

**Step 2: Commit**

```bash
git add apps/mobile/src/shared/lib/queryKeys.ts
git commit -m "feat: add central query key registry for TanStack Query"
```

---

### Task 4: Fix Feed Invalidation Mismatch

Replace all `['feed']` invalidations with specific feed keys from the registry.

**Files:**
- Modify: `apps/mobile/src/features/post/hooks/useLikePosts.ts:28-30,56-58`
- Modify: `apps/mobile/src/features/post/hooks/useSavesPosts.ts:71-73,99-101`
- Modify: `apps/mobile/src/features/post/hooks/usePosts.ts:168-169`
- Modify: `apps/mobile/src/features/profile/hooks/useBlocking.ts:26-28,51-52`

**Step 1: Fix useLikePosts.ts**

Add import at top:
```typescript
import { queryKeys } from '@/shared/lib/queryKeys';
```

Replace lines 27-31 (useLikePost onSuccess):
```typescript
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likedPosts() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
```

Replace lines 55-59 (useUnlikePost onSuccess):
```typescript
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likedPosts() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
```

**Step 2: Fix useSavesPosts.ts**

Add import at top:
```typescript
import { queryKeys } from '@/shared/lib/queryKeys';
```

Replace lines 70-74 (useSavePost onSuccess):
```typescript
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPosts() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
```

Replace lines 98-102 (useUnsavePost onSuccess):
```typescript
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPosts() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
```

**Step 3: Fix usePosts.ts**

Add import at top:
```typescript
import { queryKeys } from '@/shared/lib/queryKeys';
```

Replace lines 166-170 (useDeletePost onSuccess):
```typescript
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.savedPosts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.likedPosts() });
    },
```

**Step 4: Fix useBlocking.ts**

Add import at top:
```typescript
import { queryKeys } from '@/shared/lib/queryKeys';
```

Replace lines 25-29 (useBlockUser onSuccess):
```typescript
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
```

Replace lines 50-53 (useUnblockUser onSuccess):
```typescript
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
    },
```

**Step 5: Commit**

```bash
git add apps/mobile/src/features/post/hooks/useLikePosts.ts \
        apps/mobile/src/features/post/hooks/useSavesPosts.ts \
        apps/mobile/src/features/post/hooks/usePosts.ts \
        apps/mobile/src/features/profile/hooks/useBlocking.ts
git commit -m "fix: replace broken ['feed'] invalidation with specific feed query keys"
```

---

### Task 5: Fix Comment Mutation Invalidation

Replace manual refetch trigger in `useCommentActions.ts` with proper TanStack Query invalidation.

**Files:**
- Modify: `apps/mobile/src/features/comments/hooks/useCommentActions.ts:22,27-29,72,105`

**Step 1: Add queryClient and import**

Add to imports (line 1 area):
```typescript
import { useQueryClient } from '@tanstack/react-query';
```

Inside `useCommentActions()` function (after line 24):
```typescript
const queryClient = useQueryClient();
```

**Step 2: Replace triggerRefetch with proper invalidation**

Replace the `triggerRefetch` function and its calls (lines 27-29, 72, 105):

Remove `const [, setRefetchTrigger] = useAtom(refetchTriggerAtom);` (line 22) and the `triggerRefetch` function (lines 27-29).

Remove `refetchTriggerAtom` from the import on line 11.

Replace `triggerRefetch()` on line 72 with:
```typescript
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['comment-has-replies'] });
```

Replace `triggerRefetch()` on line 105 with:
```typescript
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['comment-has-replies'] });
```

**Step 3: Remove refetchTrigger from comment query key**

In `apps/mobile/src/features/comments/atoms/commentAtoms.ts`:

Remove line 16: `export const refetchTriggerAtom = atom(0);`

Update line 23: Remove `const refetchTrigger = get(refetchTriggerAtom);`

Update line 26: Change `queryKey: ['comments', postId, sort, cursor, limit, refetchTrigger]` to:
```typescript
    queryKey: ['comments', postId, sort, cursor, limit],
```

**Step 4: Commit**

```bash
git add apps/mobile/src/features/comments/hooks/useCommentActions.ts \
        apps/mobile/src/features/comments/atoms/commentAtoms.ts
git commit -m "fix: replace manual refetch trigger with proper query invalidation for comments"
```

---

### Task 6: Remove sessionId from Discover Feed Cache Key

**Files:**
- Modify: `apps/mobile/src/features/feed/hooks/useDiscoverFeed.ts:24`

**Step 1: Remove sessionId from query key**

Change line 24 from:
```typescript
    queryKey: ['discoverFeed', sessionId],
```
to:
```typescript
    queryKey: ['discoverFeed'],
```

The `sessionId` is already passed as a variable to the query function (line 80), so it still reaches the server correctly.

**Step 2: Commit**

```bash
git add apps/mobile/src/features/feed/hooks/useDiscoverFeed.ts
git commit -m "fix: remove sessionId from discoverFeed cache key to prevent cache bloat"
```

---

### Task 7: Add Missing onError Handlers

**Files:**
- Modify: `apps/mobile/src/features/post/hooks/useLikePosts.ts`
- Modify: `apps/mobile/src/features/post/hooks/useSavesPosts.ts`
- Modify: `apps/mobile/src/features/post/hooks/usePosts.ts:91-143` (useCreatePost)
- Modify: `apps/mobile/src/features/profile/hooks/useBlocking.ts`

**Step 1: Add onError to useLikePost and useUnlikePost**

After each `onSuccess` block in `useLikePosts.ts`, add:
```typescript
    onError: (error) => {
      console.error('Like mutation failed:', error.message);
    },
```

**Step 2: Add onError to useSavePost and useUnsavePost**

After each `onSuccess` block in `useSavesPosts.ts`, add:
```typescript
    onError: (error) => {
      console.error('Save mutation failed:', error.message);
    },
```

**Step 3: Add onError to useCreatePost**

In `usePosts.ts`, add to the `useCreatePost` mutation (after line 141):
```typescript
    onError: (error) => {
      console.error('Create post failed:', error.message);
    },
```

**Step 4: Add onError to useBlockUser and useUnblockUser**

In `useBlocking.ts`, add to both mutations:
```typescript
    onError: (error) => {
      console.error('Block mutation failed:', error.message);
    },
```

**Step 5: Fix silent error in useFollowing**

In `apps/mobile/src/features/profile/hooks/useRelationships.ts:130-132`, replace:
```typescript
      } catch (error) {
        return [];
      }
```
with:
```typescript
      } catch (error) {
        console.error('Failed to fetch following:', error);
        throw error;
      }
```

**Step 6: Commit**

```bash
git add apps/mobile/src/features/post/hooks/useLikePosts.ts \
        apps/mobile/src/features/post/hooks/useSavesPosts.ts \
        apps/mobile/src/features/post/hooks/usePosts.ts \
        apps/mobile/src/features/profile/hooks/useBlocking.ts \
        apps/mobile/src/features/profile/hooks/useRelationships.ts
git commit -m "fix: add missing onError handlers to mutation hooks"
```

---

### Task 8: Standardize Stale Times

**Files:**
- Create: `apps/mobile/src/shared/lib/queryConfig.ts`
- Modify: `apps/mobile/src/features/feed/hooks/useDiscoverFeed.ts:87`
- Modify: `apps/mobile/src/features/feed/hooks/useFollowingFeed.ts:68`
- Modify: `apps/mobile/src/features/profile/hooks/useProfile.ts:62`
- Modify: `apps/mobile/src/App.tsx:36`

**Step 1: Create query config**

```typescript
export const STALE_TIMES = {
  FEED: 60_000,            // 1 min - feeds need fresh data
  PROFILE: 5 * 60_000,     // 5 min - profiles change less often
  STATIC: 30 * 60_000,     // 30 min - settings, categories
  MEDIA: 5 * 60_000,       // 5 min - media URLs
} as const;
```

**Step 2: Import and use in affected files**

Replace hardcoded `staleTime` values in each file with the constant:
- `useDiscoverFeed.ts:87`: `staleTime: STALE_TIMES.FEED`
- `useFollowingFeed.ts:68`: `staleTime: STALE_TIMES.FEED`
- `useProfile.ts:62`: `staleTime: STALE_TIMES.PROFILE`
- `App.tsx:36`: `staleTime: STALE_TIMES.PROFILE` (default)

**Step 3: Commit**

```bash
git add apps/mobile/src/shared/lib/queryConfig.ts \
        apps/mobile/src/features/feed/hooks/useDiscoverFeed.ts \
        apps/mobile/src/features/feed/hooks/useFollowingFeed.ts \
        apps/mobile/src/features/profile/hooks/useProfile.ts \
        apps/mobile/src/App.tsx
git commit -m "refactor: standardize staleTime values with shared constants"
```

---

### Task 9: Feature Hook Stubs - Post Operations

**Files:**
- Create: `apps/mobile/src/features/post/hooks/useUpdatePost.ts`
- Create: `apps/mobile/src/features/post/hooks/useLikedPosts.ts`

**Step 1: Create useUpdatePost**

```typescript
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UpdatePostInput {
  content: string;
  type: 'post' | 'thread';
  mediaIds?: string[];
  hashtagIds?: string[];
}

export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePostInput }) => {
      const data = await graphqlFetch<{ updatePost: any }>({
        query: `
          mutation UpdatePost($id: ID!, $input: PostInput!) {
            updatePost(id: $id, input: $input) {
              id
              content
              type
              createdAt
              updatedAt
              user { id username profileImage }
              media { id storageKey type order }
              hashtags { id name }
            }
          }
        `,
        variables: { id, input },
      });
      return data.updatePost;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.post(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
    onError: (error) => {
      console.error('Update post failed:', error.message);
    },
  });
};
```

**Step 2: Create useLikedPosts**

```typescript
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/shared/lib/queryConfig';

export const useLikedPosts = (limit = 10, offset = 0) => {
  return useQuery({
    queryKey: [...queryKeys.likedPosts(), limit, offset],
    queryFn: async () => {
      const data = await graphqlFetch<{ likedPosts: any[] }>({
        query: `
          query GetLikedPosts($limit: Int, $offset: Int) {
            likedPosts(limit: $limit, offset: $offset) {
              id
              content
              type
              createdAt
              user { id username profileImage }
              media { id storageKey type order }
              hashtags { id name }
              isSaved
              isLiked
              _commentCount
              _likeCount
            }
          }
        `,
        variables: { limit, offset },
      });
      return data.likedPosts || [];
    },
    staleTime: STALE_TIMES.PROFILE,
  });
};
```

**Step 3: Commit**

```bash
git add apps/mobile/src/features/post/hooks/useUpdatePost.ts \
        apps/mobile/src/features/post/hooks/useLikedPosts.ts
git commit -m "feat: add useUpdatePost and useLikedPosts hook stubs"
```

---

### Task 10: Feature Hook Stubs - Profile & Drafts

**Files:**
- Create: `apps/mobile/src/features/profile/hooks/useUpdateProfile.ts`
- Create: `apps/mobile/src/features/post/hooks/useDraftPosts.ts`

**Step 1: Create useUpdateProfile**

```typescript
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ProfileInput {
  username?: string;
  bio?: string;
  profileImage?: string;
  isPrivate?: boolean;
}

export const useUpdateProfile = (userId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const data = await graphqlFetch<{ updateProfile: any }>({
        query: `
          mutation UpdateProfile($input: ProfileInput!) {
            updateProfile(input: $input) {
              id
              userId
              username
              bio
              profileImage
              isPrivate
              followersCount
              followingCount
            }
          }
        `,
        variables: { input },
      });
      return data.updateProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
    onError: (error) => {
      console.error('Update profile failed:', error.message);
    },
  });
};
```

**Step 2: Create useDraftPosts**

```typescript
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { queryKeys } from '@/shared/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STALE_TIMES } from '@/shared/lib/queryConfig';

export const useDraftPosts = (limit = 10, offset = 0) => {
  return useQuery({
    queryKey: [...queryKeys.draftPosts(), limit, offset],
    queryFn: async () => {
      const data = await graphqlFetch<{ draftPosts: any[] }>({
        query: `
          query GetDraftPosts($limit: Int, $offset: Int) {
            draftPosts(limit: $limit, offset: $offset) {
              id
              content
              type
              createdAt
              updatedAt
              media { id storageKey type order }
              hashtags { id name }
            }
          }
        `,
        variables: { limit, offset },
      });
      return data.draftPosts || [];
    },
    staleTime: STALE_TIMES.PROFILE,
  });
};

export const useSaveDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { content: string; type: 'post' | 'thread'; mediaIds?: string[]; hashtagIds?: string[] }) => {
      const data = await graphqlFetch<{ saveDraftPost: any }>({
        query: `
          mutation SaveDraft($input: PostInput!) {
            saveDraftPost(input: $input) {
              id
              content
              type
              createdAt
            }
          }
        `,
        variables: { input },
      });
      return data.saveDraftPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.draftPosts() });
    },
    onError: (error) => {
      console.error('Save draft failed:', error.message);
    },
  });
};

export const usePublishDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const data = await graphqlFetch<{ publishDraftPost: any }>({
        query: `
          mutation PublishDraft($id: ID!) {
            publishDraftPost(id: $id) {
              id
              content
              type
              createdAt
            }
          }
        `,
        variables: { id: draftId },
      });
      return data.publishDraftPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.draftPosts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed() });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
    onError: (error) => {
      console.error('Publish draft failed:', error.message);
    },
  });
};

export const useDeleteDraft = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const data = await graphqlFetch<{ deleteDraftPost: any }>({
        query: `
          mutation DeleteDraft($id: ID!) {
            deleteDraftPost(id: $id) {
              id
              success
            }
          }
        `,
        variables: { id: draftId },
      });
      return data.deleteDraftPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.draftPosts() });
    },
    onError: (error) => {
      console.error('Delete draft failed:', error.message);
    },
  });
};
```

**Step 3: Commit**

```bash
git add apps/mobile/src/features/profile/hooks/useUpdateProfile.ts \
        apps/mobile/src/features/post/hooks/useDraftPosts.ts
git commit -m "feat: add useUpdateProfile and draft management hook stubs"
```

---

### Task 11: Feature Hook Stubs - Feedback & Media Lifecycle

**Files:**
- Create: `apps/mobile/src/features/feedback/hooks/useMyTickets.ts`
- Modify: `apps/mobile/src/features/post/hooks/useMedia.ts` (add media lifecycle hooks)

**Step 1: Create useMyTickets**

```typescript
import { graphqlFetch } from '@/shared/lib/graphqlClient';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/shared/lib/queryConfig';

export const useMyTickets = (status?: string, limit = 10, offset = 0) => {
  return useQuery({
    queryKey: ['myTickets', status, limit, offset],
    queryFn: async () => {
      const data = await graphqlFetch<{ myTickets: any[] }>({
        query: `
          query GetMyTickets($status: TicketStatus, $limit: Int, $offset: Int) {
            myTickets(status: $status, limit: $limit, offset: $offset) {
              id
              subject
              description
              status
              priority
              type
              createdAt
              updatedAt
              responseCount
              lastResponseAt
            }
          }
        `,
        variables: { status, limit, offset },
      });
      return data.myTickets || [];
    },
    staleTime: STALE_TIMES.PROFILE,
  });
};

export const useTicketDetail = (ticketId?: string) => {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      const data = await graphqlFetch<{ ticket: any }>({
        query: `
          query GetTicket($id: ID!) {
            ticket(id: $id) {
              id
              subject
              description
              status
              priority
              type
              createdAt
              updatedAt
              responses {
                id
                message
                responderType
                createdAt
                responder { id username profileImage }
              }
              attachments {
                id
                description
                createdAt
              }
            }
          }
        `,
        variables: { id: ticketId },
      });
      return data.ticket;
    },
    enabled: !!ticketId,
    staleTime: STALE_TIMES.PROFILE,
  });
};
```

**Step 2: Add media lifecycle hooks to useMedia.ts**

Append to the end of `apps/mobile/src/features/post/hooks/useMedia.ts`:

```typescript
export const useDeleteMedia = () => {
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to delete media');
      return response.json();
    },
    onError: (error) => {
      console.error('Delete media failed:', error.message);
    },
  });
};

export const useRestoreMedia = () => {
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/media/restore/${mediaId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to restore media');
      return response.json();
    },
    onError: (error) => {
      console.error('Restore media failed:', error.message);
    },
  });
};

export const useDeletedMedia = (limit = 50, offset = 0) => {
  return useQuery({
    queryKey: ['deletedMedia', limit, offset],
    queryFn: async () => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_URL}/api/media/deleted?limit=${limit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );

      if (!response.ok) throw new Error('Failed to fetch deleted media');
      return response.json();
    },
  });
};

export const useBatchUpload = () => {
  return useMutation({
    mutationFn: async ({ count, contentType }: { count: number; contentType?: string }) => {
      const { session } = useAuthStore.getState();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/media/batch-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ count, contentType }),
      });

      if (!response.ok) throw new Error('Failed to get batch upload URLs');
      return response.json();
    },
    onError: (error) => {
      console.error('Batch upload failed:', error.message);
    },
  });
};
```

**Step 3: Create the feedback hooks directory if needed**

```bash
mkdir -p apps/mobile/src/features/feedback/hooks
```

**Step 4: Commit**

```bash
git add apps/mobile/src/features/feedback/hooks/useMyTickets.ts \
        apps/mobile/src/features/post/hooks/useMedia.ts
git commit -m "feat: add feedback ticket and media lifecycle hook stubs"
```

---

### Task 12: Re-run Health Check to Verify Fixes

**Files:**
- None (verification only)

**Step 1: Re-create profile (Task 1) if not already done**

**Step 2: Run health check**

```bash
pnpm dlx tsx scripts/health-check.ts --code <CODE>
```

Expected: Higher pass rate now that profile exists. The mutation lifecycle tests (createPost, createComment, like/unlike, save/unsave, delete) should all pass.

**Step 3: Review report**

Check `scripts/health-check-report.json` for any remaining failures.

---

### Task 13: Final Commit and Summary

**Step 1: Run biome check**

```bash
pnpm biome check apps/mobile/src/shared/lib/queryKeys.ts \
                  apps/mobile/src/shared/lib/queryConfig.ts \
                  apps/mobile/src/features/post/hooks/useUpdatePost.ts \
                  apps/mobile/src/features/post/hooks/useLikedPosts.ts \
                  apps/mobile/src/features/profile/hooks/useUpdateProfile.ts \
                  apps/mobile/src/features/post/hooks/useDraftPosts.ts \
                  apps/mobile/src/features/feedback/hooks/useMyTickets.ts
```

**Step 2: Fix any lint issues**

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: fix lint issues from audit fix implementation"
```
