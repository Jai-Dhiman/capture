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
  MFACreation: undefined;
  TOTPSetup: undefined;
  TOTPVerification: undefined;
  CreateProfile: undefined;
  ForgotPassword: undefined;
  ResetPassword: {
    email: string;
  };
};

export type AppStackParamList = {
  Feed: undefined;
  NewPost: undefined;
  Profile: { userId?: string; filter?: string } | undefined;
  SavedPosts: undefined;
  Search: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
  ImageEditScreen: { 
    imageUri: string;
  };
  PhotoSelectionScreen: {
    maxSelection?: number;
    onPhotosSelected: (
      photos: Array<{
        uri: string;
        type: string;
        name: string;
        order: number;
      }>,
    ) => void;
  };
  PostSettingsScreen: {
    selectedPhotos: Array<{
      uri: string;
      type: string;
      name: string;
      order: number;
    }>;
  };
};

export type SettingsStackParamList = {
  MainSettings: undefined;
  BlockedUsers: undefined;
  AccountSettings: undefined;
  ReportBug: undefined;
  FeatureRequest: undefined;
  PrivacyPolicy: undefined;
  NotificationSettings: undefined;
  Appearance: undefined;
  ReportUser: { userId: string; username: string };
};
