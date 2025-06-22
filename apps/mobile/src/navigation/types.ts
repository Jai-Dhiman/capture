import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  AuthFallback: NavigatorScreenParams<AuthStackParamList> | undefined;
  CreateProfile: undefined;
  App: NavigatorScreenParams<AppStackParamList> | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  RegisterScreen: undefined;
  EmailSignup: undefined;
  EmailCodeVerification: {
    email: string;
    phone?: string;
    isNewUser: boolean;
    message: string;
  };
  PhoneCodeVerification: {
    email: string;
    phone: string;
    isNewUser: boolean;
    message: string;
  };
  PasskeySetup: undefined;
  CreateProfile: undefined;
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
};
