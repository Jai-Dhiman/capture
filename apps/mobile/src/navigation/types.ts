import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  AuthFallback: NavigatorScreenParams<AuthStackParamList> | undefined;
  CreateProfile: undefined;
  App: NavigatorScreenParams<AppStackParamList> | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  EmailSignup: undefined;
  CodeVerification: {
    email: string;
    phone?: string;
    isNewUser: boolean;
    message: string;
  };
  CreateProfile: undefined;
  EmailVerificationPending: undefined;
  RegisterScreen: undefined;
};

export type AppStackParamList = {
  Feed: undefined;
  NewPost: undefined;
  Profile: { userId?: string; filter?: string } | undefined;
  SavedPosts: undefined;
  Search: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
  ImageEditScreen: { imageUri: string };
};

export type SettingsStackParamList = {
  MainSettings: undefined;
  BlockedUsers: undefined;
  AccountSettings: undefined;
  VerifyPhone: undefined;
};
