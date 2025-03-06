export type AuthStackParamList = {
  Login: undefined
  Signup: undefined
}

export type AppStackParamList = {
  Feed: undefined
  NewPost: undefined
  Profile: { userId?: string } | undefined
  SinglePost: { post: any }
  UserSearch: undefined
}

export type RootStackParamList = {
  Auth: undefined
  CreateProfile: undefined
  App: undefined
  Profile: undefined
}
