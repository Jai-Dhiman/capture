import { hashtagResolvers } from './hashtag'
import { postResolvers } from './post'
import { profileResolvers } from './profile'

export const resolvers = {
  Query: {
    ...postResolvers.Query,
    ...profileResolvers.Query,
    ...hashtagResolvers.Query,
  },
  Mutation: {
    ...postResolvers.Mutation,
    ...hashtagResolvers.Mutation,
  },
  Hashtag: hashtagResolvers.Hashtag || {},
  Post: postResolvers.Post || {},
}
