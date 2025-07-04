import { blockingResolvers } from './blocking';
import { commentResolvers } from './comment';
import { discoveryResolvers } from './discovery';
import { hashtagResolvers } from './hashtag';
import { mediaResolvers } from './media';
import { notificationResolvers } from './notification';
import { postResolvers } from './post';
import { profileResolvers } from './profile';
import { relationshipResolvers } from './relationship';
import { savedPostResolvers } from './savedPost';

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
    ...mediaResolvers.Mutation,
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
