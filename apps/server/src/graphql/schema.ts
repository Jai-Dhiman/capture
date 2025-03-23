export const typeDefs = `
  type Query {
    feed(limit: Int, offset: Int, dateThreshold: String): [Post!]!
    post(id: ID!): Post
    profile(id: ID!): Profile
    searchHashtags(query: String!, limit: Int, offset: Int): [Hashtag!]!
    searchUsers(query: String!): [Profile!]!
    comments(postId: ID!, parentCommentId: ID, limit: Int, offset: Int, sortBy: CommentSortOption): [Comment!]!
    comment(id: ID!): Comment
    commentConnection(
      postId: ID!, 
      parentPath: String,
      sortBy: CommentSortOption,
      page: Int,
      limit: Int
    ): CommentConnection!
    savedPosts(limit: Int, offset: Int): [Post!]!
    followers(userId: ID!): [Profile!]!
    following(userId: ID!): [Profile!]!
  }

  type Mutation {
    createPost(input: PostInput!): Post!
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
    posts: [Post!]!
    followers: [Profile!]!
    following: [Profile!]!
    isFollowing: Boolean
    followersCount: Int!
    followingCount: Int!
    createdAt: String!
    updatedAt: String!
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
    createdAt: String!
    updatedAt: String!
    _commentCount: Int!
  }

  input PostInput {
    content: String!
    type: PostType!
    mediaIds: [ID!]
    hashtagIds: [ID!]
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

  input ProfileInput {
    username: String
    bio: String
    image: String
    phoneNumber: String
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
`;
