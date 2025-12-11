const config = {
  name: "Capture",
  slug: "Capture",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/CaptureLogo.png",
  newArchEnabled: false,
  userInterfaceStyle: "light",
  jsEngine: "hermes",
  splash: {
    image: "./assets/CaptureLogo.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.obscuratechnologies.capture",
    associatedDomains: ["webcredentials:capture-api.jai-d.workers.dev"],
    entitlements: {
      "com.apple.developer.associated-domains": ["webcredentials:capture-api.jai-d.workers.dev"],
      "com.apple.developer.authentication-services.autofill-credential-provider": true
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSFaceIDUsageDescription: "Use Face ID to securely sign in to your account",
      NSBiometricUsageDescription: "Use biometric authentication to securely access your account",
      NSPhotoLibraryUsageDescription: "This app needs access to your photo library to allow you to select and share photos in your posts",
      NSPhotoLibraryAddUsageDescription: "This app needs permission to save edited images to your photo library"
    }
  },
  android: {
    package: "com.obscuratechnologies.capture",
    softwareKeyboardLayoutMode: "pan",
    adaptiveIcon: {
      foregroundImage: "./assets/CaptureLogo.png",
      backgroundColor: "#ffffff"
    }
  },
  scheme: "capture",
  linking: {
    prefixes: [
      "com.obscuratechnologies.capture://",
      "capture://",
      "exp+capture://",
      "https://www.captureapp.org",
      "https://capture-api.jai-d.workers.dev"
    ],
    config: {
      screens: {
        Auth: {
          screens: {
            Login: "auth/login",
            Signup: "auth/signup",
            EmailSignup: "auth/email-signup",
            VerifyPhoneNumber: "auth/verify-phone",
            CreateProfile: "auth/create-profile",
            ForgotPassword: "auth/forgot-password",
            ResetPassword: "auth/reset-password",
            EmailVerificationPending: "auth/verify-email"
          }
        },
        App: {
          screens: {
            Feed: "feed",
            NewPost: "new-post",
            Profile: "profile/:userId?",
            Search: "search",
            Settings: {
              screens: {
                MainSettings: "settings",
                BlockedUsers: "settings/blocked-users",
                AccountSettings: "settings/account",
                VerifyPhone: "settings/verify-phone"
              }
            }
          }
        }
      }
    }
  },
  web: {
    bundler: "metro",
    favicon: "./assets/CaptureLogo.png",
    name: "Capture"
  },
  plugins: [
    "expo-secure-store",
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "capture",
        organization: "capture-7u",
        setCommits: false,
        enableAutoUpload: false,
        disableSourceMapUpload: true,
        suppressNativeWebpackWarning: true
      }
    ],
    "expo-asset",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: "com.googleusercontent.apps.562912588429-kjsb2br221rgfnlv11nimbsom1n69ju0"
      }
    ],
    "expo-apple-authentication",
    [
      "expo-notifications",
      {
        icon: "./assets/CaptureLogo.png",
        color: "#FF6B6B",
        sounds: []
      }
    ]
  ],
  updates: {
    url: "https://u.expo.dev/cad78a77-57e1-4d5e-b730-c779cdd2b6cb"
  },
  extra: {
    eas: {
      projectId: "4e5aa601-eda8-40fe-857e-44e547c19fa6"
    },
    API_URL: process.env.API_URL || "https://capture-api.jai-d.workers.dev",
    SHARE_URL: process.env.SHARE_URL || "https://www.captureapp.org"
  }
};

export default config;