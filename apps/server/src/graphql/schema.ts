export const typeDefs = `
  type Query {
    feed(limit: Int, offset: Int): [Post!]!
    post(id: ID!): Post
    profile(id: ID!): Profile
    searchHashtags(query: String!, limit: Int, offset: Int): [Hashtag!]!
    searchUsers(query: String!): [Profile!]!
    comments(postId: ID!, limit: Int, offset: Int): [Comment!]!
  }

  type Mutation {
    createPost(input: PostInput!): Post!
    createComment(input: CommentInput!): Comment!
    updatePost(id: ID!, input: PostInput!): Post!
    updateProfile(input: ProfileInput!): Profile!
    createHashtag(name: String!): Hashtag!
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
`
