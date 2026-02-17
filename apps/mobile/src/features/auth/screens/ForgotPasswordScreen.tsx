import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { useAlert } from '@/shared/lib/AlertContext';
import { apiClient } from '@/shared/lib/apiClient';
import { errorService } from '@/shared/services/errorService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import * as React from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Platform,
} from 'react-native';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [emailSent, setEmailSent] = useState(false);
  const { showAlert } = useAlert();

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

  const forgotPassword = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        '/auth/forgot-password',
        { email }
      );
      return response;
    },
    onSuccess: (data) => {
      setEmailSent(true);
      showAlert(data.message, { type: 'success' });
    },
    onError: (error) => {
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, { type: errorService.getAlertType(appError.category) });
    },
  });

  const form = useForm({
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value }) => {
      if (!value.email) {
        showAlert('Please enter your email address', { type: 'warning' });
        return;
      }
      forgotPassword.mutate(value.email);
    },
  });

  if (emailSent) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-[#DCDCDE]">
          <Header showBackButton title="" />
          <View className="flex-1 justify-center items-center px-6">
            <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
              Check Your Email
            </Text>
            <Text className="text-base text-gray-600 text-center mb-8">
              If an account exists with that email, we've sent a password reset code.
            </Text>
            <TouchableOpacity
              className="w-full bg-[#E4CAC7] py-4 rounded-full"
              style={shadowStyle}
              onPress={() => navigation.navigate('ResetPassword', { email: form.state.values.email })}
            >
              <Text className="text-center text-gray-800 font-semibold text-base">
                Enter Reset Code
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-4"
              onPress={() => {
                setEmailSent(false);
                forgotPassword.reset();
              }}
            >
              <Text className="text-gray-600 text-sm">
                Didn't receive it? Try again
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-[#DCDCDE]">
        <Header showBackButton title="" />
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
            Forgot Password?
          </Text>
          <Text className="text-base text-gray-600 text-center mb-8">
            Enter your email address and we'll send you a code to reset your password.
          </Text>

          <form.Field name="email">
            {(field) => (
              <View className="w-full mb-6">
                <TextInput
                  className="bg-white rounded-full px-6 py-4 text-base border border-gray-200"
                  placeholder="Email address"
                  placeholderTextColor="#9CA3AF"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
            )}
          </form.Field>

          <TouchableOpacity
            className="w-full bg-[#E4CAC7] py-4 rounded-full"
            style={shadowStyle}
            onPress={() => form.handleSubmit()}
            disabled={forgotPassword.isPending}
          >
            {forgotPassword.isPending ? (
              <ActivityIndicator color="#1F2937" />
            ) : (
              <Text className="text-center text-gray-800 font-semibold text-base">
                Send Reset Code
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-6"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-gray-600 text-sm">
              Back to Login
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
