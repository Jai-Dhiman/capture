export type AuthStackParamList = {
  Login: undefined
  Signup: undefined
}

export type AppStackParamList = {
  Feed: undefined
  NewPost: undefined
  Profile: undefined
  SinglePost: { post: any }
}

export type RootStackParamList = {
  Auth: undefined
  CreateProfile: undefined
  App: undefined
  Profile: undefined
}
