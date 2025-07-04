export const typeDefs = `
  type Query {
    post(id: ID!): Post
    draftPost(id: ID!): DraftPost
    draftPosts(limit: Int = 10, offset: Int = 0): [DraftPost!]!
    postVersionHistory(postId: ID!, limit: Int = 10, offset: Int = 0): [PostVersion!]!
    postVersion(id: ID!): PostVersion
    profile(id: ID!): Profile
    searchHashtags(query: String!, limit: Int, offset: Int): [Hashtag!]!
    searchUsers(query: String!): [Profile!]!
    comments(postId: ID!, parentCommentId: ID, limit: Int, offset: Int, sortBy: CommentSortOption): [Comment!]!
    comment(id: ID!): Comment
    commentConnection(
      postId: ID!, 
      parentId: ID,
      sortBy: CommentSortOption,
      cursor: String,
      limit: Int
    ): CommentConnection!
    savedPosts(limit: Int, offset: Int): [Post!]!
    followers(userId: ID!): [Profile!]!
    following(userId: ID!): [Profile!]!
    blockedUsers: [Profile!]!
    isUserBlocked(userId: ID!): Boolean!
    discoverFeed(limit: Int = 10, cursor: String): FeedPayload
    notifications(limit: Int = 20, offset: Int = 0, includeRead: Boolean = false): [Notification!]!
    unreadNotificationCount: Int!
  }

  type Mutation {
    createPost(input: PostInput!): Post!
    saveDraftPost(input: PostInput!): DraftPost!
    updateDraftPost(id: ID!, input: PostInput!): DraftPost!
    publishDraftPost(id: ID!): Post!
    deleteDraftPost(id: ID!): DeleteDraftResponse!
    revertPostToVersion(postId: ID!, versionId: ID!): Post!
    uploadMedia(input: MediaUploadInput!): MediaUploadResponse!
    uploadMediaBatch(input: BatchMediaUploadInput!): BatchMediaUploadResponse!
    processEditedImage(input: ProcessImageInput!): ProcessImageResponse!
    createComment(input: CommentInput!): Comment!
    updatePost(id: ID!, input: PostInput!): Post!
    updateProfile(input: ProfileInput!): Profile!
    createHashtag(name: String!): Hashtag!
    deletePost(id: ID!): DeletePostResponse!
    deleteComment(id: ID!): DeleteCommentResponse!
    followUser(userId: ID!): FollowResponse!
    unfollowUser(userId: ID!): UnfollowResponse!
    savePost(postId: ID!): SavePostResponse!
    unsavePost(postId: ID!): UnsavePostResponse!
    updatePrivacySettings(isPrivate: Boolean!): Profile!
    blockUser(userId: ID!): BlockResponse!
    unblockUser(userId: ID!): UnblockResponse!
    markNotificationRead(id: ID!): NotificationReadResponse!
    markAllNotificationsRead: NotificationReadResponse!
    markPostsAsSeen(postIds: [ID!]!): SeenPostsResponse!
  }

  type Subscription {
    newComment(postId: ID!): Comment!
    newPost(userId: ID!): Post!
  }

  type Profile {
    id: ID!
    userId: String!
    username: String!
    profileImage: String
    bio: String
    verifiedType: String!
    isPrivate: Boolean!
    posts: [Post!]!
    followers: [Profile!]!
    following: [Profile!]!
    isFollowing: Boolean
    followersCount: Int!
    followingCount: Int!
    createdAt: String!
    updatedAt: String!
    isBlocked: Boolean
  }

  input ProfileInput {
    username: String
    bio: String
    profileImage: String
    phoneNumber: String
    isPrivate: Boolean
  }

  type Post {
    id: ID!
    userId: String!
    content: String!
    type: PostType!
    user: Profile!
    media: [Media!]!
    comments: [Comment!]!
    hashtags: [Hashtag!]!
    savedBy: [Profile!]!
    isSaved: Boolean!
    isDraft: Boolean!
    editingMetadata: EditingMetadata
    version: Int!
    createdAt: String!
    updatedAt: String!
    _commentCount: Int!
    _saveCount: Int!
  }

  type EditingMetadata {
    filters: [PhotoFilter!]!
    adjustments: PhotoAdjustments
    crops: [CropData!]!
    originalDimensions: Dimensions
  }

  type PhotoFilter {
    mediaId: ID!
    filterName: String!
    intensity: Float!
  }

  type PhotoAdjustments {
    mediaId: ID!
    brightness: Float
    contrast: Float
    saturation: Float
    exposure: Float
    shadows: Float
    highlights: Float
    temperature: Float
    tint: Float
  }

  type CropData {
    mediaId: ID!
    x: Float!
    y: Float!
    width: Float!
    height: Float!
    rotation: Float
  }

  type Dimensions {
    width: Int!
    height: Int!
  }

  input PostInput {
    content: String!
    type: PostType!
    mediaIds: [ID!]
    hashtagIds: [ID!]
    editingMetadata: EditingMetadataInput
    isDraft: Boolean
    draftId: ID
  }

  input EditingMetadataInput {
    filters: [PhotoFilterInput!]
    adjustments: PhotoAdjustmentsInput
    crops: [CropDataInput!]
    originalDimensions: DimensionsInput
  }

  input PhotoFilterInput {
    mediaId: ID!
    filterName: String!
    intensity: Float!
  }

  input PhotoAdjustmentsInput {
    mediaId: ID!
    brightness: Float
    contrast: Float
    saturation: Float
    exposure: Float
    shadows: Float
    highlights: Float
    temperature: Float
    tint: Float
  }

  input CropDataInput {
    mediaId: ID!
    x: Float!
    y: Float!
    width: Float!
    height: Float!
    rotation: Float
  }

  input DimensionsInput {
    width: Int!
    height: Int!
  }

  enum PostType {
    post
    thread
  }

  type Comment {
    id: ID!
    content: String!
    path: String!
    depth: Int!
    parentId: ID
    isDeleted: Boolean!
    user: Profile!
    post: Post!
    createdAt: String!
  }
    
  type CommentConnection {
    comments: [Comment!]!
    totalCount: Int!
    hasNextPage: Boolean!
    nextCursor: String
  }

  input CommentInput {
    postId: ID!
    content: String!
    parentId: ID
  }

  enum CommentSortOption {
    newest
    oldest
  }

  type DeleteCommentResponse {
    id: ID!
    success: Boolean!
  }

  type Media {
    id: ID!
    type: String!
    storageKey: String!
    order: Int!
    createdAt: String!
  }

  type Hashtag {
    id: ID!
    name: String!
    posts: [Post!]!
    createdAt: String!
  }

  type DeletePostResponse {
    id: ID!
    success: Boolean!
  }

  type FollowResponse {
    success: Boolean!
    relationship: Relationship
  }

  type UnfollowResponse {
    success: Boolean!
  }

  type Relationship {
    id: ID!
    followerId: ID!
    followedId: ID!
    createdAt: String!
  }

  type SavePostResponse {
    success: Boolean!
    post: Post
  }

  type UnsavePostResponse {
    success: Boolean!
  }

  type BlockResponse {
  success: Boolean!
  blockedUser: Profile
}

type UnblockResponse {
  success: Boolean!
}

type SeenPostsResponse {
  success: Boolean!
}

type FeedPayload {
  posts: [Post!]!
  nextCursor: String
}

type Notification {
  id: ID!
  type: NotificationType!
  actionUser: Profile
  resourceId: ID
  resourceType: String
  message: String!
  isRead: Boolean!
  createdAt: String!
}

enum NotificationType {
  FOLLOW_REQUEST
  NEW_FOLLOW
  NEW_COMMENT
  COMMENT_REPLY
  MENTION
  POST_SAVE
}

type NotificationReadResponse {
  success: Boolean!
  count: Int
}

type DraftPost {
  id: ID!
  userId: String!
  content: String!
  type: PostType!
  user: Profile!
  media: [Media!]!
  hashtags: [Hashtag!]!
  editingMetadata: EditingMetadata
  version: Int!
  createdAt: String!
  updatedAt: String!
}

type DeleteDraftResponse {
  id: ID!
  success: Boolean!
}

input MediaUploadInput {
  count: Int = 1
}

type MediaUploadResponse {
  uploads: [UploadUrl!]!
}

type UploadUrl {
  uploadURL: String!
  id: String!
}

input BatchMediaUploadInput {
  mediaItems: [MediaItemInput!]!
}

input MediaItemInput {
  imageId: String!
  order: Int
  postId: ID
  draftPostId: ID
}

type BatchMediaUploadResponse {
  media: [Media!]!
}

input ProcessImageInput {
  originalImageId: String!
  editingMetadata: EditingMetadataInput!
}

type ProcessImageResponse {
  processedImageId: String!
  variants: [String!]!
  originalImageId: String!
}

type PostVersion {
  id: ID!
  postId: ID!
  draftPostId: ID
  version: Int!
  content: String!
  editingMetadata: EditingMetadata
  changeType: ChangeType!
  changeDescription: String
  user: Profile!
  createdAt: String!
}

enum ChangeType {
  CREATED
  EDITED
  PUBLISHED
  REVERTED
}
`;
