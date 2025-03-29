import { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  CreateProfile: undefined;
  App: NavigatorScreenParams<AppStackParamList> | undefined;
  PhoneVerification: NavigatorScreenParams<PhoneVerificationParamList> | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  EmailSignup: undefined;
  VerifyPhoneNumber: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  CreateProfile: undefined;
  EmailVerificationPending: undefined;
};

export type AppStackParamList = {
  Feed: undefined;
  NewPost: undefined;
  Profile: { userId?: string } | undefined;
  SavedPosts: undefined;
  Search: undefined;
};

export type PhoneVerificationParamList = {
  EnterPhone: undefined;
  VerifyPhoneNumber: undefined;
};
