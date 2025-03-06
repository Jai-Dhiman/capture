export const typeDefs = `
  type Query {
    feed(limit: Int, offset: Int): [Post!]!
    post(id: ID!): Post
    profile(id: ID!): Profile
    searchHashtags(query: String!, limit: Int, offset: Int): [Hashtag!]!
    searchUsers(query: String!): [Profile!]!
    comments(postId: ID!, parentCommentId: ID, limit: Int, offset: Int, sortBy: CommentSortOption): [Comment!]!
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
  }

  type Subscription {
    newComment(postId: ID!): Comment!
    newPost(userId: ID!): Post!
  }

  type Profile {
    id: ID!
    username: String!
    email: String!
    phoneNumber: String
    image: String
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
    user: Profile!
    media: [Media!]!
    comments: [Comment!]!
    hashtags: [Hashtag!]!
    savedBy: [Profile!]!
    createdAt: String!
    _commentCount: Int!
  }

  type Comment {
    id: ID!
    content: String!
    user: Profile!
    post: Post!
    parentComment: Comment
    replies: [Comment!]!
    createdAt: String!
  }

  type Media {
    id: ID!
    type: String!
    storageKey: String!
    thumbnailUrl: String
    order: Int!
    createdAt: String!
  }

  type Hashtag {
    id: ID!
    name: String!
    posts: [Post!]!
    createdAt: String!
  }

  input PostInput {
    content: String!
    mediaIds: [ID!]
    hashtagIds: [ID!]
  }

  input CommentInput {
    postId: ID!
    content: String!
    parentCommentId: ID
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

  enum CommentSortOption {
    newest
    oldest
  }

  type DeleteCommentResponse {
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
`
