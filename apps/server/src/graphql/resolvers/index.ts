import { hashtagResolvers } from "./hashtag";
import { postResolvers } from "./post";
import { profileResolvers } from "./profile";
import { commentResolvers } from "./comment";
import { relationshipResolvers } from "./relationship";
import { savedPostResolvers } from "./savedPost";
import { blockingResolvers } from "./blocking";

export const resolvers = {
  Query: {
    ...postResolvers.Query,
    ...profileResolvers.Query,
    ...hashtagResolvers.Query,
    ...commentResolvers.Query,
    ...savedPostResolvers.Query,
    ...relationshipResolvers.Query,
    ...blockingResolvers.Query,
  },
  Mutation: {
    ...postResolvers.Mutation,
    ...relationshipResolvers.Mutation,
    ...hashtagResolvers.Mutation,
    ...commentResolvers.Mutation,
    ...savedPostResolvers.Mutation,
    ...blockingResolvers.Mutation,
  },

  Post: {
    ...(postResolvers.Post || {}),
    ...(savedPostResolvers.Post || {}),
  },
  Profile: {
    ...relationshipResolvers.Profile,
    ...blockingResolvers.Profile,
  },
  Hashtag: hashtagResolvers.Hashtag || {},
  Comment: commentResolvers.Comment,
};
