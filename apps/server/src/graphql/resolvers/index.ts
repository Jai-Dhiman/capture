import { blockingResolvers } from './blocking';
import { commentResolvers } from './comment';
import { discoveryResolvers } from './discovery';
import { feedbackResolvers } from './feedback';
import { hashtagResolvers } from './hashtag';
import { likeResolvers } from './like';
import { mediaResolvers } from './media';
import { notificationResolvers } from './notification';
import { notificationSettingsResolvers } from './notificationSettings';
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
    ...likeResolvers.Query,
    ...relationshipResolvers.Query,
    ...blockingResolvers.Query,
    ...discoveryResolvers.Query,
    ...notificationResolvers.Query,
    ...notificationSettingsResolvers.Query,
    ...feedbackResolvers.Query,
  },
  Mutation: {
    ...postResolvers.Mutation,
    ...mediaResolvers.Mutation,
    ...relationshipResolvers.Mutation,
    ...hashtagResolvers.Mutation,
    ...commentResolvers.Mutation,
    ...savedPostResolvers.Mutation,
    ...likeResolvers.Mutation,
    ...blockingResolvers.Mutation,
    ...discoveryResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...notificationSettingsResolvers.Mutation,
    ...feedbackResolvers.Mutation,
  },

  Post: {
    ...(postResolvers.Post || {}),
    ...(savedPostResolvers.Post || {}),
    ...(likeResolvers.Post || {}),
  },
  Profile: {
    ...relationshipResolvers.Profile,
    ...blockingResolvers.Profile,
  },
  Hashtag: hashtagResolvers.Hashtag || {},
  Comment: commentResolvers.Comment,
  Notification: notificationResolvers.Notification,
  NotificationSettings: notificationSettingsResolvers.NotificationSettings,
  FeedbackTicket: feedbackResolvers.FeedbackTicket || {},
  FeedbackResponse: feedbackResolvers.FeedbackResponse || {},
  FeedbackAttachment: feedbackResolvers.FeedbackAttachment || {},
};
