import { postResolvers } from './post'
import { profileResolvers } from './profile'

export const resolvers = {
  Query: {
    ...postResolvers.Query,
    ...profileResolvers.Query,
  },
  Mutation: {
    ...postResolvers.Mutation,
  },
}
