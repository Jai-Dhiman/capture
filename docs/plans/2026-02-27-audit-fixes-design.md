# Audit Fixes Design: Health Check + Mobile Cross-Reference

**Date:** 2026-02-27
**Status:** Approved

## Context

A full production health check (54 endpoints) and mobile cross-reference audit (REST, GraphQL, TanStack Query) revealed bugs, cache inconsistencies, and feature gaps. This design covers all fixes.

### Audit Results Summary

- **Production health check:** 42/54 passed (77.8%), avg latency 120ms
- **REST coverage:** Auth 100%, Media 25%, Cache/Analytics/Interests 0% (expected)
- **GraphQL coverage:** 28/63 operations used by mobile (44%)
- **TanStack Query:** 3 critical cache issues, 7 warnings

## Domain 1: Server-Side Fixes

### 1a. Fix `GET /api/profile/check-username` 500 Error

**Problem:** The endpoint sits under `/api/*` which applies `authMiddleware`. When called without auth (e.g., health check), it returns 500 instead of 401.

**Root cause:** The middleware likely throws an unhandled error rather than returning a clean 401 response.

**Fix:** Investigate why `authMiddleware` returns 500 instead of 401 for this route. The endpoint should remain behind auth (mobile calls it post-login during profile creation). Fix the error response to be a proper 401. Update the health check script to categorize `check-username` as auth-required.

### 1b. Account Deletion Behavior (No code change)

**Current behavior:** `DELETE /auth/account` removes the profile and anonymizes content, but the user record persists. On next login, the user sees the CreateProfile screen.

**Decision:** Keep this behavior. It allows account re-use, which is reasonable pre-launch. Document as expected behavior.

### 1c. Re-create Production Profile

**Action:** Call `POST /api/profile` with auth token to create a profile for `jaidhiman2000@gmail.com` (userId: `2dB8V65FMgtSLYa7suBFN`). Choose a username and optionally set bio/image.

## Domain 2: TanStack Query Cache Overhaul

### 2a. Cache Key Registry

**File:** `apps/mobile/src/shared/lib/queryKeys.ts`

Central registry of all cache keys as typed factory functions. All hooks import keys from here instead of using inline string arrays. Prevents typos, enables autocomplete, makes invalidation patterns explicit.

Keys to define:
- `profile(userId)`, `followers(userId)`, `following(userId)`, `blockedUsers()`
- `discoverFeed()`, `followingFeed()`, `userPosts(userId)`, `post(postId)`
- `savedPosts()`, `likedPosts()`
- `comments(postId)`, `commentReplies(commentId)`
- `notifications()`, `unreadCount()`, `notificationSettings()`
- `hashtags(query)`, `passkeys()`, `draftPosts()`

### 2b. Fix Feed Invalidation Mismatch (CRITICAL)

**Problem:** Mutations invalidate `['feed']` but feed queries use `['followingFeed']` and `['discoverFeed']`. Invalidations never hit the right cache entries. Feeds show stale data after likes/saves/deletes.

**Affected hooks:** `useLikePost`, `useUnlikePost`, `useSavePost`, `useUnsavePost`, `useDeletePost`, `useBlockUser`, `useUnblockUser`, `useFollowUser`, `useUnfollowUser`

**Fix:** Replace all `queryClient.invalidateQueries({ queryKey: ['feed'] })` with specific invalidations using the registry:
```
queryKeys.followingFeed()
queryKeys.discoverFeed()
queryKeys.userPosts(userId) // where applicable
```

### 2c. Fix Comment Mutation Invalidation (CRITICAL)

**Problem:** `createCommentMutationAtom` and `deleteCommentMutationAtom` use manual refetch triggers (`setRefetchTrigger(count + 1)`) instead of `queryClient.invalidateQueries()`. Related queries (post comment counts, feed) are not updated.

**Fix:** Replace manual refetch with:
```
queryClient.invalidateQueries({ queryKey: queryKeys.comments(postId) })
queryClient.invalidateQueries({ queryKey: queryKeys.post(postId) })
```

### 2d. Convert Comments to `useInfiniteQuery`

**Problem:** Comments use a manual cursor atom pattern (`commentCursorAtom`, `loadMoreCommentsAtom`) instead of `useInfiniteQuery`. This refetches the entire dataset on each cursor change.

**Fix:** Create a `useComments(postId)` hook using `useInfiniteQuery` with `getNextPageParam` extracting `nextCursor` from the `commentConnection` response. Remove `commentCursorAtom`, `commentLimitAtom`, `loadMoreCommentsAtom`.

### 2e. Remove sessionId from Discover Feed Cache Key

**Problem:** `queryKey: ['discoverFeed', sessionId]` creates a new cache entry for every session, causing memory bloat.

**Fix:** Remove `sessionId` from the query key. Pass it as a variable to the query function instead.

### 2f. Standardize Error Handling

**Problem:** Inconsistent error handling: some hooks have `onError`, some silently return empty arrays, some have no error handling.

**Fix:** Create shared mutation defaults in `apps/mobile/src/shared/lib/mutationDefaults.ts`:
```typescript
export const defaultMutationOptions = {
  onError: (error: Error) => {
    console.error('Mutation failed:', error.message);
  },
};
```

Apply to all mutations missing `onError`.

### 2g. Standardize Stale Times

**Fix:** Define constants in `apps/mobile/src/shared/lib/queryConfig.ts`:
```typescript
export const STALE_TIMES = {
  FEED: 60_000,         // 1 min
  PROFILE: 5 * 60_000,  // 5 min
  STATIC: 30 * 60_000,  // 30 min
};
```

### 2h. Guard CommentItem Queries

**Problem:** Queries in `CommentItem.tsx` can fire without auth tokens.

**Fix:** Ensure `enabled` condition includes all required dependencies. Remove auth checks from inside `queryFn`.

## Domain 3: Feature Hook Stubs

Create TanStack Query hooks with GraphQL operations defined but no UI screens. Each hook has proper types, cache keys from registry, and invalidation patterns.

### Post Operations
| Hook | File | Operation |
|------|------|-----------|
| `useUpdatePost` | `post/hooks/useUpdatePost.ts` | `updatePost(id, input)` |

### Profile Operations
| Hook | File | Operation |
|------|------|-----------|
| `useUpdateProfile` | `profile/hooks/useUpdateProfile.ts` | `updateProfile(input)` |

### Liked Posts
| Hook | File | Operation |
|------|------|-----------|
| `useLikedPosts` | `post/hooks/useLikedPosts.ts` | `likedPosts(limit, offset)` |

### Draft Management
| Hook | File | Operations |
|------|------|-----------|
| `useDraftPosts` | `post/hooks/useDraftPosts.ts` | `draftPosts(limit, offset)` |
| `useSaveDraft` | `post/hooks/useDraftPosts.ts` | `saveDraftPost(input)` |
| `usePublishDraft` | `post/hooks/useDraftPosts.ts` | `publishDraftPost(id)` |
| `useDeleteDraft` | `post/hooks/useDraftPosts.ts` | `deleteDraftPost(id)` |

### Feedback System
| Hook | File | Operations |
|------|------|-----------|
| `useMyTickets` | `feedback/hooks/useMyTickets.ts` | `myTickets(status, limit)` |
| `useTicketDetail` | `feedback/hooks/useMyTickets.ts` | `ticket(id)` |

### Media Lifecycle
| Hook | File | Operations |
|------|------|-----------|
| `useDeleteMedia` | `post/hooks/useMedia.ts` | REST `DELETE /api/media/:id` |
| `useRestoreMedia` | `post/hooks/useMedia.ts` | REST `POST /api/media/restore/:id` |
| `useDeletedMedia` | `post/hooks/useMedia.ts` | REST `GET /api/media/deleted` |
| `useBatchUpload` | `post/hooks/useMedia.ts` | REST `POST /api/media/batch-upload` |

## Cache Invalidation Map

When a mutation succeeds, these queries should be invalidated:

| Mutation | Invalidate |
|----------|-----------|
| `createPost` | `discoverFeed`, `followingFeed`, `userPosts(userId)`, `draftPosts` |
| `deletePost` | `discoverFeed`, `followingFeed`, `userPosts(userId)`, `savedPosts`, `likedPosts` |
| `updatePost` | `post(postId)`, `userPosts(userId)`, `discoverFeed`, `followingFeed` |
| `likePost/unlikePost` | `post(postId)`, `likedPosts`, `discoverFeed`, `followingFeed` |
| `savePost/unsavePost` | `post(postId)`, `savedPosts`, `discoverFeed`, `followingFeed` |
| `createComment/deleteComment` | `comments(postId)`, `post(postId)` |
| `followUser/unfollowUser` | `profile(userId)`, `followers(userId)`, `following(currentUserId)`, `followingFeed` |
| `blockUser/unblockUser` | `blockedUsers`, `profile(userId)`, `discoverFeed`, `followingFeed` |
| `markNotificationRead` | `notifications`, `unreadCount` |
| `updateProfile` | `profile(userId)` |
| `updateNotificationSettings` | `notificationSettings` |

## Verification

- Health check script re-run passes all endpoints (including mutations with valid profile)
- All TanStack Query hooks use keys from `queryKeys.ts` registry
- No inline cache key strings remain in hooks
- All mutations have `onError` handlers
- Comments use `useInfiniteQuery` with proper cursor extraction
- Feature stubs export working hooks with correct GraphQL operations
