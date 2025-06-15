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

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [showPasskeyLogin, setShowPasskeyLogin] = useState(false);
  const [biometricName, setBiometricName] = useState<string>('Biometric');
  const emailInputRef = useRef<TextInput>(null);
  const { showAlert } = useAlert();
  const { sendCode } = useAuth();
  const { authenticateWithPasskey, getBiometricName, isPasskeySupported, hasBiometrics } =
    usePasskey();

  useEffect(() => {
    const loadBiometricName = async () => {
      if (isPasskeySupported && hasBiometrics) {
        const name = await getBiometricName();
        setBiometricName(name);
      }
    };
    loadBiometricName();
  }, [getBiometricName, isPasskeySupported, hasBiometrics]);

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

      if (showPasskeyLogin) {
        // Handle passkey authentication
        try {
          await authenticateWithPasskey.mutateAsync({
            email: value.email,
          });
        } catch (error) {
          console.error('Passkey login failed:', error);
        }
      } else {
        // Handle email code authentication
        sendCode.mutate(
          {
            email: value.email,
            phone: value.phone || undefined,
          },
          {
            onSuccess: (response) => {
              navigation.navigate('CodeVerification', {
                email: value.email,
                phone: value.phone || undefined,
                isNewUser: response.isNewUser,
                message: response.message,
              });
            },
          },
        );
      }
    },
  });

  const canShowPasskey = isPasskeySupported && hasBiometrics;
  const isLoading = sendCode.isPending || authenticateWithPasskey.isPending;

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
          {/* Auth Method Toggle */}
          {canShowPasskey && (
            <View className="mb-6">
              <View className="bg-white rounded-2xl p-1 flex-row shadow-md">
                <TouchableOpacity
                  onPress={() => setShowPasskeyLogin(false)}
                  className={`flex-1 py-3 px-4 rounded-xl ${!showPasskeyLogin ? 'bg-[#E4CAC7]' : 'bg-transparent'}`}
                >
                  <Text
                    className={`text-center font-semibold ${!showPasskeyLogin ? 'text-black' : 'text-gray-600'}`}
                  >
                    Email
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowPasskeyLogin(true)}
                  className={`flex-1 py-3 px-4 rounded-xl ${showPasskeyLogin ? 'bg-[#E4CAC7]' : 'bg-transparent'}`}
                >
                  <Text
                    className={`text-center font-semibold ${showPasskeyLogin ? 'text-black' : 'text-gray-600'}`}
                  >
                    {biometricName}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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
                    onChangeText={field.handleChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoFocus
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

          {(sendCode.isError || authenticateWithPasskey.isError) && (
            <Text className="text-red-500 text-xs mt-2 mb-4 text-center font-roboto">
              {showPasskeyLogin
                ? 'Passkey authentication failed. Please try again.'
                : 'Failed to send verification code. Please try again.'}
            </Text>
          )}

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isFormSubmitting]) => (
              <TouchableOpacity
                className={`h-[56px] ${canSubmit ? 'bg-[#E4CAC7]' : 'bg-stone-300'} rounded-[30px] shadow-md justify-center items-center`}
                onPress={() => form.handleSubmit()}
                disabled={!canSubmit || isFormSubmitting || isLoading}
              >
                {isFormSubmitting || isLoading ? (
                  <View className="flex-row justify-center items-center">
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-base font-bold font-roboto ml-2">
                      {showPasskeyLogin ? 'Authenticating...' : 'Sending code...'}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-base font-bold font-roboto text-center">
                    {showPasskeyLogin ? `Sign in with ${biometricName}` : 'Sign-In'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </form.Subscribe>

          {/* Toggle back to email if passkey fails */}
          {showPasskeyLogin && (
            <View className="items-center mt-[16px]">
              <TouchableOpacity onPress={() => setShowPasskeyLogin(false)}>
                <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                  Use Email Verification Instead
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="items-center mt-[24px]">
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
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
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                Don't Have an Account?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Passkey info for new users */}
          {!showPasskeyLogin && canShowPasskey && (
            <View className="items-center mt-4">
              <Text className="text-sm text-center text-gray-500 font-roboto">
                Don't have a passkey? Sign in with email to set one up.
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
