import { hashtagResolvers } from './hashtag'
import { postResolvers } from './post'
import { profileResolvers } from './profile'
import { commentResolvers } from './comment'

export const resolvers = {
  Query: {
    ...postResolvers.Query,
    ...profileResolvers.Query,
    ...hashtagResolvers.Query,
    ...commentResolvers.Query,
  },
  Mutation: {
    ...postResolvers.Mutation,
    ...hashtagResolvers.Mutation,
    ...commentResolvers.Mutation,
  },
  Hashtag: hashtagResolvers.Hashtag || {},
  Post: postResolvers.Post || {},
  Comment: commentResolvers.Comment,
}
