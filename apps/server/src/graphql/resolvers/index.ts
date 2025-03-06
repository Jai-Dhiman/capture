import { hashtagResolvers } from './hashtag'
import { postResolvers } from './post'
import { profileResolvers } from './profile'
import { commentResolvers } from './comment'
import { relationshipResolvers } from './relationship'

export const resolvers = {
  Query: {
    ...postResolvers.Query,
    ...profileResolvers.Query,
    ...hashtagResolvers.Query,
    ...commentResolvers.Query,
  },
  Mutation: {
    ...postResolvers.Mutation,
    ...relationshipResolvers.Mutation,
    ...hashtagResolvers.Mutation,
    ...commentResolvers.Mutation,
  },

  Post: postResolvers.Post || {},
  Profile: {
    ...relationshipResolvers.Profile,
  },
  Hashtag: hashtagResolvers.Hashtag || {},
  Comment: commentResolvers.Comment,
}
