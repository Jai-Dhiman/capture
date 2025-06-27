import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useAlert } from '@/shared/lib/AlertContext';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import React, { useState, useRef, useEffect } from 'react';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'EmailCodeVerification'>;
  route: RouteProp<AuthStackParamList, 'EmailCodeVerification'>;
};

export default function CodeVerificationScreen({ navigation, route }: Props) {
  const { email, phone, isNewUser, message } = route.params;
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const codeInputRef = useRef<TextInput>(null);
  const { showAlert } = useAlert();
  const { verifyCode, sendCode } = useAuth();

  const form = useForm({
    defaultValues: {
      code: '',
    },
    onSubmit: async ({ value }) => {
      if (value.code.length !== 6) {
        showAlert('Please enter the complete 6-digit code', { type: 'warning' });
        return;
      }

      verifyCode.mutate(
        {
          email,
          code: value.code,
          phone,
        },
        {
          onSuccess: (data) => {
            if (isNewUser && phone) {
              navigation.navigate('PhoneCodeVerification', {
                email,
                phone,
                isNewUser,
                message: "We've sent a verification code to your phone number.",
              });
            } else {
              // Handle navigation based on the auth response
              if (data.securitySetupRequired) {
                navigation.navigate('PasskeySetup');
              } else if (!data.profileExists) {
                navigation.navigate('CreateProfile');
              } else {
                // User is fully authenticated, the main navigator will handle routing to the app
                // We don't need to navigate here as the main navigator will automatically switch
                // to the AppNavigator when the auth store is updated
              }
            }
          },
          onError: () => {
            form.setFieldValue('code', ''); // Clear the code input on error
          },
        },
      );
    },
  });

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    setCanResend(true);
  }, [resendCountdown]);

  const handleResendCode = async () => {
    if (!canResend) return;

    setIsLoading(true);
    sendCode.mutate(
      { email, phone },
      {
        onSuccess: () => {
          showAlert('Verification code sent!', { type: 'success' });
          setCanResend(false);
          setResendCountdown(60);
          setIsLoading(false);
        },
        onError: () => {
          setIsLoading(false);
        },
      },
    );
  };

  const formatCode = (text: string) => {
    // Only allow numbers and limit to 6 digits
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    return cleaned;
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
          <Image
            source={require('@assets/DefaultBackground.png')}
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            resizeMode="cover"
          />

          <Header showBackButton={true} onBackPress={() => navigation.goBack()} />

          <View className="h-[40px]" />

          <View className="px-[26px] w-full">
            <Text className="text-3xl font-bold font-roboto text-center mb-2">
              Check Your Email
            </Text>
            <Text className="text-base font-roboto text-center mb-2 text-gray-600">{message}</Text>
            <Text className="text-sm font-roboto text-center mb-8 text-gray-500">
              Sent to {email}
            </Text>

            <form.Field
              name="code"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Verification code is required';
                  if (value.length !== 6) return 'Code must be 6 digits';
                  if (!/^\d{6}$/.test(value)) return 'Code must contain only numbers';
                  return undefined;
                },
              }}
            >
              {(field) => (
                <View className="mb-[30px]">
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => codeInputRef.current?.focus()}
                    className="bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center justify-center px-[9px]"
                  >
                    <TextInput
                      ref={codeInputRef}
                      className="text-[24px] font-bold font-roboto text-black text-center tracking-[8px]"
                      style={{
                        paddingVertical: 0,
                        textAlignVertical: 'center',
                        height: '100%',
                        letterSpacing: 8,
                      }}
                      value={field.state.value}
                      onChangeText={(text) => field.handleChange(formatCode(text))}
                      keyboardType="number-pad"
                      placeholder="000000"
                      placeholderTextColor="#C8C8C8"
                      maxLength={6}
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

            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting, state.values.code] as const
              }
            >
              {([canSubmit, isFormSubmitting, code]) => (
                <TouchableOpacity
                  className={`h-[56px] ${canSubmit && typeof code === 'string' && code.length === 6 ? 'bg-[#e7cac4]' : 'bg-stone-300'} rounded-[30px] shadow-md justify-center items-center w-full mb-6`}
                  onPress={() => form.handleSubmit()}
                  disabled={
                    !canSubmit ||
                    isFormSubmitting ||
                    verifyCode.isPending ||
                    typeof code !== 'string' ||
                    code.length !== 6
                  }
                >
                  {isFormSubmitting || verifyCode.isPending ? (
                    <LoadingSpinner message="Verifying..." />
                  ) : (
                    <Text className="text-center text-black text-[16px] font-bold font-roboto">
                      {isNewUser ? 'Create Account' : 'Sign In'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </form.Subscribe>

            <View className="items-center">
              <Text className="text-sm text-gray-600 font-roboto mb-2">
                Didn't receive the code?
              </Text>
              <TouchableOpacity
                onPress={handleResendCode}
                disabled={!canResend || isLoading || sendCode.isPending}
              >
                <Text
                  className={`text-sm font-semibold font-roboto ${canResend && !isLoading && !sendCode.isPending ? 'text-[#e7cac4]' : 'text-gray-400'}`}
                >
                  {canResend && !isLoading && !sendCode.isPending
                    ? 'Resend Code'
                    : `Resend in ${resendCountdown}s`}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mt-8">
              <Text className="text-xs text-center text-gray-500 font-roboto">
                The verification code expires in 10 minutes
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
