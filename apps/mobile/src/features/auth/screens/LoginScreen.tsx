import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { useAlert } from '@/shared/lib/AlertContext';
import EmailIcon from '@assets/icons/EmailIcon.svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import React, { useState, useRef, useEffect } from 'react';
import { ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppleOAuthButton, GoogleOAuthButton } from '../components/OAuthButtons';
import { useAuth } from '../hooks/useAuth';
import { usePasskey } from '../hooks/usePasskey';
import { Platform } from 'react-native';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

type LoginState = 'email' | 'checking-user' | 'user-not-found' | 'checking-passkeys' | 'passkey' | 'email-verification';

export default function LoginScreen({ navigation }: Props) {
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [loginState, setLoginState] = useState<LoginState>('email');
  const [biometricName, setBiometricName] = useState<string>('Biometric');
  const emailInputRef = useRef<TextInput>(null);
  const { showAlert } = useAlert();
  const { sendCode } = useAuth();
  const {
    authenticateWithPasskey,
    checkUserHasPasskeys,
    getBiometricName,
    isPasskeySupported,
    hasBiometrics
  } = usePasskey();

  useEffect(() => {
    const loadBiometricName = async () => {
      if (isPasskeySupported && hasBiometrics) {
        const name = await getBiometricName();
        setBiometricName(name);
      }
    };
    loadBiometricName();
  }, [getBiometricName, isPasskeySupported, hasBiometrics]);

  const shadowStyle = {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  };

  const form = useForm({
    defaultValues: {
      email: '',
      phone: '',
    },
    onSubmit: async ({ value }) => {
      if (!value.email) {
        showAlert('Please enter your email address', { type: 'warning' });
        return;
      }

      if (loginState === 'email') {
        // First, check if user exists and has passkeys
        setLoginState('checking-user');

        try {
          const result = await checkUserHasPasskeys.mutateAsync(value.email);

          if (!result.userExists) {
            setLoginState('user-not-found');
            return;
          }

          // User exists, check if they have passkeys
          if (result.hasPasskeys && isPasskeySupported && hasBiometrics) {
            setLoginState('passkey');
            return;
          }

          // User exists but no passkeys, proceed with email verification
          setLoginState('email-verification');
          sendCode.mutate(
            {
              email: value.email,
              phone: value.phone || undefined,
            },
            {
              onSuccess: (response) => {
                navigation.navigate('EmailCodeVerification', {
                  email: value.email,
                  phone: value.phone || undefined,
                  isNewUser: response.isNewUser,
                  message: response.message,
                });
              },
              onError: () => {
                setLoginState('email');
              },
            },
          );
        } catch (error) {
          console.error('Error checking user:', error);
          setLoginState('email');
          showAlert('Unable to verify account. Please try again.', { type: 'error' });
        }
      } else if (loginState === 'passkey') {
        // Handle passkey authentication
        try {
          await authenticateWithPasskey.mutateAsync({
            email: value.email,
          });
        } catch (error) {
          console.error('Passkey login failed:', error);
          // Fall back to email verification
          setLoginState('email-verification');
          sendCode.mutate(
            {
              email: value.email,
              phone: value.phone || undefined,
            },
            {
              onSuccess: (response) => {
                navigation.navigate('EmailCodeVerification', {
                  email: value.email,
                  phone: value.phone || undefined,
                  isNewUser: response.isNewUser,
                  message: response.message,
                });
              },
              onError: () => {
                setLoginState('email');
              },
            },
          );
        }
      } else if (loginState === 'user-not-found') {
        // Navigate to registration
        navigation.navigate('RegisterScreen');
      }
    },
  });

  const isLoading = sendCode.isPending || authenticateWithPasskey.isPending || checkUserHasPasskeys.isPending;

  const getButtonText = () => {
    if (isLoading) {
      if (checkUserHasPasskeys.isPending) return 'Checking account...';
      if (authenticateWithPasskey.isPending) return 'Authenticating...';
      if (sendCode.isPending) return 'Sending code...';
    }

    switch (loginState) {
      case 'email':
        return 'Continue';
      case 'checking-user':
        return 'Checking account...';
      case 'user-not-found':
        return 'Create Account';
      case 'passkey':
        return `Sign in with ${biometricName}`;
      case 'email-verification':
        return 'Send Code';
      default:
        return 'Continue';
    }
  };

  const getErrorMessage = () => {
    const error = sendCode.error;
    if (!error) return 'Failed to send verification code. Please try again.';

    const errorMessage = error.message || 'Failed to send verification code';

    // Check for specific error messages
    if (errorMessage.includes('check your email address')) {
      return 'Unable to send verification code. Please double-check your email address and try again.';
    }

    if (errorMessage.includes('Email service') || errorMessage.includes('temporarily unavailable')) {
      return 'Email service is temporarily unavailable. Please try again in a few minutes.';
    }

    if (errorMessage.includes('Account not found') || errorMessage.includes('user not found')) {
      return 'No account found with this email address. Please check your email or create a new account.';
    }

    // Default message
    return 'Unable to send verification code. Please try again or contact support if the problem persists.';
  };

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
        <Image
          source={require('@assets/DefaultBackground.png')}
          style={{
            opacity: 0.58,
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          resizeMode="cover"
        />
        <Header height={140} showBackground={false} />
        <View className="flex-1 px-[26px] pt-[80px]">

          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                if (!value) return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
                return undefined;
              },
            }}
          >
            {(field) => (
              <View className="mb-[24px]">
                <Text className="text-base font-roboto mb-[6px]">Email</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => emailInputRef.current?.focus()}
                  className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  style={shadowStyle}
                >
                  <EmailIcon width={35} height={35} style={{ marginRight: 14 }} />
                  <TextInput
                    ref={emailInputRef}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => {
                      setIsEmailFocused(false);
                      field.handleBlur();
                    }}
                    placeholder="johndoe@gmail.com"
                    placeholderTextColor="#C8C8C8"
                    className="flex-1 text-base font-roboto text-black outline-none"
                    style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                    value={field.state.value}
                    onChangeText={(text) => {
                      field.handleChange(text);
                      // Reset state when email changes
                      if (loginState !== 'email') {
                        setLoginState('email');
                      }
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isLoading}
                  />
                </TouchableOpacity>
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <Text className="text-red-500 text-xs mt-1 ml-2 font-roboto">
                    {field.state.meta.errors.join(', ')}
                  </Text>
                )}
              </View>
            )}
          </form.Field>

          {/* Error Messages */}
          {(sendCode.isError || authenticateWithPasskey.isError || checkUserHasPasskeys.isError) && (
            <View className="mt-2 mb-4 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
              <Text className="text-red-600 text-sm text-center font-roboto font-medium">
                {loginState === 'passkey'
                  ? 'Authentication failed. Please try again.'
                  : getErrorMessage()}
              </Text>
            </View>
          )}

          {/* User Not Found Message */}
          {loginState === 'user-not-found' && (
            <View className="mt-2 mb-4 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <Text className="text-blue-600 text-sm text-center font-roboto font-medium">
                No account found with this email address. Please create an account to continue.
              </Text>
            </View>
          )}

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isFormSubmitting]) => (
              <TouchableOpacity
                className={`h-[56px] ${canSubmit && !isLoading ? 'bg-[#E4CAC7]' : 'bg-stone-300'} rounded-[30px] shadow-md justify-center items-center`}
                onPress={() => form.handleSubmit()}
                disabled={!canSubmit || isFormSubmitting || isLoading}
              >
                {isFormSubmitting || isLoading ? (
                  <View className="flex-row justify-center items-center">
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-base font-bold font-roboto ml-2">
                      {getButtonText()}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-base font-bold font-roboto text-center">
                    {getButtonText()}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </form.Subscribe>

          {/* Fallback option for passkey */}
          {loginState === 'passkey' && (
            <View className="items-center mt-[16px]">
              <TouchableOpacity
                onPress={() => {
                  setLoginState('email-verification');
                  form.handleSubmit();
                }}
                disabled={isLoading}
              >
                <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                  Use Email Verification Instead
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="items-center mt-[24px]">
            <TouchableOpacity onPress={() => navigation.navigate('RegisterScreen')}>
              <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                Account Recovery
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-[29px] mb-[23px]">
            <GoogleOAuthButton />
          </View>

          <View className="mb-[23px]">
            <AppleOAuthButton />
          </View>

          <View className="items-center">
            <TouchableOpacity onPress={() => navigation.navigate('RegisterScreen')}>
              <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                Don't Have an Account?
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
