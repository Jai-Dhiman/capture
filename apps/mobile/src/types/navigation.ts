export type AuthStackParamList = {
  Login: undefined
  Signup: undefined
  EmailSignup: undefined
}

export type AppStackParamList = {
  Feed: undefined
  NewPost: undefined
  Profile: { userId?: string } | undefined
  SinglePost: { post: any }
  SavedPosts: undefined
  Search: undefined
}

export type RootStackParamList = {
  Auth: undefined
  CreateProfile: undefined
  App: undefined
  Profile: undefined
}
