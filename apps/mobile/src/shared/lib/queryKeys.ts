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
  deletedMedia: () => ['deletedMedia'] as const,

  // Feedback
  feedbackCategories: () => ['feedbackCategories'] as const,

  // Tickets
  myTickets: (status?: string) => ['myTickets', status] as const,
  ticket: (ticketId: string) => ['ticket', ticketId] as const,
} as const;

// Invalidation helpers - groups of keys to invalidate together
export const invalidationGroups = {
  allFeeds: () => [queryKeys.discoverFeed(), queryKeys.followingFeed()],
  postEngagement: (postId: string) => [queryKeys.post(postId), ...invalidationGroups.allFeeds()],
};
