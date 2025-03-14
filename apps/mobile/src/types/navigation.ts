export type RootStackParamList = {
  Auth: undefined
  CreateProfile: undefined
  App: undefined
  Profile: undefined
}

export type AuthStackParamList = {
  Landing: undefined
  Login: undefined
  Signup: undefined
  EmailSignup: undefined
  EnterPhone: undefined
  VerifyPhoneNumber: undefined
  ResetPassword: undefined
  CreateProfile: undefined
}

export type AppStackParamList = {
  Feed: undefined
  NewPost: undefined
  Profile: { userId?: string } | undefined
  SinglePost: { post: any }
  SavedPosts: undefined
  Search: undefined
}
