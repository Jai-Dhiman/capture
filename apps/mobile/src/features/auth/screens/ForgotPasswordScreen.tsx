import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, ScrollView,
} from 'react-native';
import { useForm } from '@tanstack/react-form';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@navigation/types';
import { LoadingSpinner } from '@shared/components/LoadingSpinner';
import Header from '@shared/components/Header';
import EmailIcon from '@assets/icons/EmailIcon.svg';
import { useAlert } from '@shared/lib/AlertContext';
import { errorService } from '@shared/services/errorService';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>
}

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const { showAlert } = useAlert();

  const form = useForm({
    defaultValues: {
      email: ''
    },
    onSubmit: async ({ value }) => {
      if (!value.email) {
        showAlert('Please enter your email address', { type: 'warning' });
        return;
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(value.email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) throw error;

        setResetEmailSent(true);
      } catch (error) {
        const formattedError = errorService.handleAuthError(error);
        const alertType = errorService.getAlertType(formattedError.category);
        showAlert(formattedError.message, { type: alertType });
      }
    }
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
          <Image
            source={require('@assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />
          <Header
            showBackButton={true}
            onBackPress={() => navigation.goBack()}
            showBackground={true}
          />
          <View className="h-[1px] bg-black/10 mb-[30px]" />

          <View className="flex-1 px-[26px]">
            {resetEmailSent ? (
              <View className="items-center justify-center mt-10">
                <Text className="text-2xl font-roboto font-bold text-center mb-6">
                  Check Your Email
                </Text>
                <Text className="text-base font-roboto text-center mb-8">
                  We've sent a password reset link to {form.getFieldValue('email')}. Please check your email and follow the instructions to reset your password.
                </Text>
                <TouchableOpacity
                  className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center w-full items-center"
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text className="text-base font-bold font-roboto text-center">
                    Return to Login
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text className="text-2xl font-roboto font-bold text-center mb-6">
                  Reset Your Password
                </Text>
                <Text className="text-base font-roboto text-center mb-8">
                  Enter your email address and we'll send you instructions to reset your password.
                </Text>

                <form.Field
                  name="email"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return 'Email is required';
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                        return 'Please enter a valid email address';
                      }
                      return undefined;
                    }
                  }}
                >
                  {(field) => (
                    <View className="mb-[29px]">
                      <Text className="text-base font-roboto mb-[6px]">Email</Text>
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => emailInputRef.current?.focus()}
                        className={`bg-white h-[56px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                      >
                        <EmailIcon width={35} height={35} style={{ marginRight: 14 }} />
                        <TextInput
                          ref={emailInputRef}
                          onFocus={() => setIsEmailFocused(true)}
                          onBlur={() => {
                            setIsEmailFocused(false);
                            field.handleBlur();
                          }}
                          placeholder="Enter your email address"
                          placeholderTextColor="#C8C8C8"
                          className="flex-1 text-base font-roboto text-black outline-none"
                          value={field.state.value}
                          onChangeText={field.handleChange}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                      </TouchableOpacity>
                      {field.state.meta.errors.length > 0 && (
                        <Text className="text-red-500 text-xs mt-1">
                          {field.state.meta.errors.join(', ')}
                        </Text>
                      )}
                    </View>
                  )}
                </form.Field>

                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                >
                  {([canSubmit, isSubmitting]) => (
                    <TouchableOpacity
                      className={`bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[20px] items-center ${!canSubmit ? 'opacity-70' : ''}`}
                      onPress={() => form.handleSubmit()}
                      disabled={!canSubmit || isSubmitting}
                    >
                      {isSubmitting ? (
                        <LoadingSpinner fullScreen message="Sending email..." />
                      ) : (
                        <Text className="text-base font-bold font-roboto text-center">
                          Send Reset Link
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </form.Subscribe>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}