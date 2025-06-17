import AppleIcon from '@assets/icons/AppleLogo.svg';
import GoogleLogo from '@assets/icons/GoogleLogo.svg';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useOAuth } from '../hooks/useOAuth';

interface OAuthButtonsProps {
  style?: 'default' | 'compact';
  showDivider?: boolean;
  dividerText?: string;
}

export function OAuthButtons({
  style = 'default',
  showDivider = true,
  dividerText = '',
}: OAuthButtonsProps) {
  const { loginWithGoogle, loginWithApple, isGoogleConfigured, isAppleConfigured } = useOAuth();

  const buttonHeight = style === 'compact' ? 'h-[48px]' : 'h-[56px]';
  const spacing = style === 'compact' ? 'mb-[16px]' : 'mb-[23px]';
  const dividerSpacing = style === 'compact' ? 'mt-[20px]' : 'mt-[29px]';

  return (
    <View>
      {/* Divider */}
      {showDivider && (
        <View className={`items-center ${dividerSpacing}`}>
          {dividerText ? (
            <View className="flex-row items-center w-full">
              <View className="flex-1 h-0 outline outline-1 outline-neutral-500 opacity-50" />
              <Text className="mx-4 text-sm font-roboto text-neutral-500">{dividerText}</Text>
              <View className="flex-1 h-0 outline outline-1 outline-neutral-500 opacity-50" />
            </View>
          ) : (
            <View className="w-80 h-0 outline outline-1 outline-neutral-500 self-center opacity-50" />
          )}
        </View>
      )}

      {/* Google OAuth Button */}
      <TouchableOpacity
        onPress={() => {
          if (!isGoogleConfigured) {
            throw new Error(
              'Google OAuth not configured. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID environment variable.',
            );
          }
          loginWithGoogle.mutate();
        }}
        disabled={loginWithGoogle.isPending}
        className={`bg-white ${buttonHeight} rounded-[30px] shadow-md flex-row items-center justify-center ${spacing} ${loginWithGoogle.isPending ? 'opacity-50' : ''
          }`}
        style={showDivider ? { marginTop: dividerSpacing === 'mt-[29px]' ? 29 : 20 } : {}}
      >
        {loginWithGoogle.isPending ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="#000" />
            <Text className="text-base font-bold font-roboto text-[#1C1C1C] ml-2">
              Signing in...
            </Text>
          </View>
        ) : (
          <>
            <GoogleLogo width={24} height={24} style={{ marginRight: 16 }} />
            <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
              Sign In with Google
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Apple OAuth Button */}
      <TouchableOpacity
        onPress={() => {
          if (!isAppleConfigured) {
            throw new Error(
              'Apple OAuth not configured. Please set EXPO_PUBLIC_APPLE_CLIENT_ID environment variable.',
            );
          }
          loginWithApple.mutate();
        }}
        disabled={loginWithApple.isPending}
        className={`bg-white ${buttonHeight} rounded-[30px] shadow-md flex-row items-center justify-center ${spacing} ${loginWithApple.isPending ? 'opacity-50' : ''
          }`}
      >
        {loginWithApple.isPending ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="#000" />
            <Text className="text-base font-bold font-roboto text-[#1C1C1C] ml-2">
              Signing in...
            </Text>
          </View>
        ) : (
          <>
            <AppleIcon width={24} height={24} style={{ marginRight: 16 }} />
            <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
              Sign In with Apple
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// Individual button components - Always show and throw errors when not configured
export function GoogleOAuthButton({
  disabled = false,
  style = 'default',
  onPress,
}: {
  disabled?: boolean;
  style?: 'default' | 'compact';
  onPress?: () => void;
}) {
  const { loginWithGoogle, isGoogleConfigured } = useOAuth();
  const buttonHeight = style === 'compact' ? 'h-[48px]' : 'h-[56px]';

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      if (!isGoogleConfigured) {
        throw new Error(
          'Google OAuth not configured. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID environment variable.',
        );
      }
      loginWithGoogle.mutate();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loginWithGoogle.isPending}
      className={`bg-white ${buttonHeight} rounded-[30px] shadow-md flex-row items-center justify-center ${disabled || loginWithGoogle.isPending ? 'opacity-50' : ''
        }`}
    >
      {loginWithGoogle.isPending ? (
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#000" />
          <Text className="text-base font-bold font-roboto text-[#1C1C1C] ml-2">Signing in...</Text>
        </View>
      ) : (
        <>
          <GoogleLogo width={24} height={24} style={{ marginRight: 16 }} />
          <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
            Sign In with Google
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function AppleOAuthButton({
  disabled = false,
  style = 'default',
  onPress,
}: {
  disabled?: boolean;
  style?: 'default' | 'compact';
  onPress?: () => void;
}) {
  const { loginWithApple, isAppleConfigured } = useOAuth();
  const buttonHeight = style === 'compact' ? 'h-[48px]' : 'h-[56px]';

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      if (!isAppleConfigured) {
        throw new Error(
          'Apple OAuth not configured. Please set EXPO_PUBLIC_APPLE_CLIENT_ID environment variable.',
        );
      }
      loginWithApple.mutate();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loginWithApple.isPending}
      className={`bg-white ${buttonHeight} rounded-[30px] shadow-md flex-row items-center justify-center ${disabled || loginWithApple.isPending ? 'opacity-50' : ''
        }`}
    >
      {loginWithApple.isPending ? (
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#000" />
          <Text className="text-base font-bold font-roboto text-[#1C1C1C] ml-2">Signing in...</Text>
        </View>
      ) : (
        <>
          <AppleIcon width={24} height={24} style={{ marginRight: 16 }} />
          <Text className="text-base font-bold font-roboto text-[#1C1C1C]">Sign In with Apple</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
