import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { useAlert } from '@/shared/lib/AlertContext';
import AppleIcon from '@assets/icons/AppleLogo.svg';
import EmailIcon from '@assets/icons/EmailIcon.svg';
import GoogleLogo from '@assets/icons/GoogleLogo.svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import React, { useState, useRef } from 'react';
import { ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

export default function SignupScreen({ navigation }: Props) {
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const { showAlert } = useAlert();
  const { sendCode, loginWithGoogle, loginWithApple } = useAuth();

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
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1 bg-[#DCDCDE]  overflow-hidden">
        <Image
          source={require('@assets/DefaultBackground.png')}
          style={{
            opacity: '60%',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
          resizeMode="cover"
        />

        <Header
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          showBackground={false}
          height={140}
        />

        <View className="flex-1 px-[26px]">
          <View className="h-[1px] bg-black/10 mb-[30px]" />

          <Text className="text-2xl font-bold font-roboto text-center mb-6">Join Capture</Text>
          <Text className="text-base font-roboto text-center mb-8 text-gray-600">
            Enter your details to get started
          </Text>

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
                <Text className="text-base font-roboto mb-[6px]"></Text>
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

          <form.Field name="phone">
            {(field) => (
              <View className="mb-[30px]">
                <Text className="text-base font-roboto mb-[6px]">Phone</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => phoneInputRef.current?.focus()}
                  className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isPhoneFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                >
                  <Text className="mr-3 text-[20px]">📱</Text>
                  <TextInput
                    ref={phoneInputRef}
                    onFocus={() => setIsPhoneFocused(true)}
                    onBlur={() => {
                      setIsPhoneFocused(false);
                      field.handleBlur();
                    }}
                    className="flex-1 text-base font-roboto text-black outline-none"
                    style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    keyboardType="phone-pad"
                    placeholder="Phone number"
                    placeholderTextColor="#C8C8C8"
                  />
                </TouchableOpacity>
                <Text className="text-xs text-gray-500 mt-1 ml-2 font-roboto">
                  Helps with account recovery and security
                </Text>
              </View>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isFormSubmitting]) => (
              <TouchableOpacity
                className={`h-[56px] ${canSubmit ? 'bg-[#E4CAC7]' : 'bg-stone-300'} rounded-[30px] shadow-md justify-center items-center mb-[23px]`}
                onPress={() => form.handleSubmit()}
                disabled={!canSubmit || isFormSubmitting || sendCode.isPending}
              >
                {isFormSubmitting || sendCode.isPending ? (
                  <View className="flex-row justify-center items-center">
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-base font-bold font-roboto ml-2">Sending code...</Text>
                  </View>
                ) : (
                  <Text className="text-base font-bold font-roboto text-center">Continue</Text>
                )}
              </TouchableOpacity>
            )}
          </form.Subscribe>

          <View className="w-80 h-0 outline outline-1 outline-neutral-500 self-center opacity-50 mb-[23px]" />

          <TouchableOpacity
            onPress={() => loginWithGoogle.mutate()}
            disabled={loginWithGoogle.isPending}
            className={`bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px] ${loginWithGoogle.isPending ? 'opacity-50' : ''}`}
          >
            {loginWithGoogle.isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <GoogleLogo width={24} height={24} style={{ marginRight: 16 }} />
                <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => loginWithApple.mutate()}
            disabled={loginWithApple.isPending}
            className={`bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px] ${loginWithApple.isPending ? 'opacity-50' : ''}`}
          >
            {loginWithApple.isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <AppleIcon width={24} height={24} style={{ marginRight: 16 }} />
                <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
                  Continue with Apple
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View className="items-center mt-4">
            <Text className="text-base font-roboto mb-[5px]">Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                Sign In
              </Text>
            </TouchableOpacity>
          </View>

          <View className="items-center mt-4">
            <Text className="text-xs text-center text-gray-500 font-roboto">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
