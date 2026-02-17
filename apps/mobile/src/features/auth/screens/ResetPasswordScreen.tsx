import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { useAlert } from '@/shared/lib/AlertContext';
import { apiClient } from '@/shared/lib/apiClient';
import { errorService } from '@/shared/services/errorService';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import * as React from 'react';
import { useRef } from 'react';
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
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
};

type ResetPasswordResponse = {
  success: boolean;
  message: string;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  user: {
    id: string;
    email: string;
  };
  profileExists: boolean;
};

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const { showAlert } = useAlert();
  const setAuthData = useAuthStore((state) => state.setAuthData);
  const codeInputRefs = useRef<(TextInput | null)[]>([]);

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

  const resetPassword = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiClient.post<ResetPasswordResponse>(
        '/auth/reset-password',
        { email, code }
      );
      return response;
    },
    onSuccess: (data) => {
      showAlert('Password reset successful!', { type: 'success' });

      // Set auth data to log the user in
      setAuthData(
        { id: data.user.id, email: data.user.email },
        {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
        data.profileExists ? 'authenticated' : 'profileRequired'
      );
    },
    onError: (error) => {
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, { type: errorService.getAlertType(appError.category) });
    },
  });

  const form = useForm({
    defaultValues: {
      code: ['', '', '', '', '', ''],
    },
    onSubmit: async ({ value }) => {
      const code = value.code.join('');
      if (code.length !== 6) {
        showAlert('Please enter the complete 6-digit code', { type: 'warning' });
        return;
      }
      resetPassword.mutate(code);
    },
  });

  const handleCodeChange = (index: number, value: string, field: any) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');

    if (numericValue.length <= 1) {
      const newCode = [...field.state.value];
      newCode[index] = numericValue;
      field.handleChange(newCode);

      // Move to next input if value entered
      if (numericValue && index < 5) {
        codeInputRefs.current[index + 1]?.focus();
      }
    } else if (numericValue.length === 6) {
      // Handle paste of full code
      const newCode = numericValue.split('');
      field.handleChange(newCode);
      codeInputRefs.current[5]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string, field: any) => {
    if (key === 'Backspace' && !field.state.value[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-[#DCDCDE]">
        <Header showBackButton title="" />
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
            Enter Reset Code
          </Text>
          <Text className="text-base text-gray-600 text-center mb-2">
            We sent a 6-digit code to
          </Text>
          <Text className="text-base font-semibold text-gray-800 mb-8">
            {email}
          </Text>

          <form.Field name="code">
            {(field) => (
              <View className="flex-row justify-center gap-2 mb-8">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { codeInputRefs.current[index] = ref; }}
                    className="w-12 h-14 bg-white rounded-lg text-center text-xl font-bold border border-gray-200"
                    value={field.state.value[index]}
                    onChangeText={(value) => handleCodeChange(index, value, field)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key, field)}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? 6 : 1}
                    selectTextOnFocus
                  />
                ))}
              </View>
            )}
          </form.Field>

          <TouchableOpacity
            className="w-full bg-[#E4CAC7] py-4 rounded-full"
            style={shadowStyle}
            onPress={() => form.handleSubmit()}
            disabled={resetPassword.isPending}
          >
            {resetPassword.isPending ? (
              <ActivityIndicator color="#1F2937" />
            ) : (
              <Text className="text-center text-gray-800 font-semibold text-base">
                Reset Password
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-6"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-gray-600 text-sm">
              Didn't receive it? Go back and try again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
