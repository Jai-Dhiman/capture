import { hashtagResolvers } from "./hashtag";
import { postResolvers } from "./post";
import { profileResolvers } from "./profile";
import { commentResolvers } from "./comment";
import { relationshipResolvers } from "./relationship";
import { savedPostResolvers } from "./savedPost";
import { blockingResolvers } from "./blocking";
import { discoveryResolvers } from "./discovery";
import { notificationResolvers } from "./notification";

type ResolverMap = {
  Query: Record<string, any>;
  Mutation: Record<string, any>;
  [key: string]: any;
};

export const resolvers: ResolverMap = {
  Query: {
    ...postResolvers.Query,
    ...profileResolvers.Query,
    ...hashtagResolvers.Query,
    ...commentResolvers.Query,
    ...savedPostResolvers.Query,
    ...relationshipResolvers.Query,
    ...blockingResolvers.Query,
    ...discoveryResolvers.Query,
    ...notificationResolvers.Query,
  },
  Mutation: {
    ...postResolvers.Mutation,
    ...relationshipResolvers.Mutation,
    ...hashtagResolvers.Mutation,
    ...commentResolvers.Mutation,
    ...savedPostResolvers.Mutation,
    ...blockingResolvers.Mutation,
    ...notificationResolvers.Mutation,
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
  Notification: notificationResolvers.Notification,
};
