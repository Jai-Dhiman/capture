import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, Alert, ScrollView,
} from 'react-native';
import { useForm } from '@tanstack/react-form';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { AuthStackParamList } from '@navigation/types';
import { LoadingSpinner } from '@shared/components/LoadingSpinner';
import { useAlert } from '@shared/lib/AlertContext';
import { errorService } from '@shared/services/errorService';
import Header from '@shared/components/Header';
import LockIcon from '@assets/icons/LockIcon.svg';
import ViewPasswordIcon from '@assets/icons/ViewPasswordIcon.svg';
import HidePasswordIcon from '@assets/icons/HidePasswordIcon.svg';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
}

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasResetToken, setHasResetToken] = useState(false);
  const { showAlert } = useAlert();

  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const hasCapitalLetter = /[A-Z]/;
  const hasNumber = /[0-9]/;
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
  const hasMinLength = /.{8,}/;

  useEffect(() => {
    const checkResetToken = async () => {
      try {
        if (route.params?.token) {
          setHasResetToken(true);
          return;
        }

        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          if (hashParams.get('type') === 'recovery') {
            setHasResetToken(true);
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        const { data: { user } } = await supabase.auth.getUser();

        if (user && session?.access_token && user.recovery_sent_at) {
          const recoveryTimestamp = new Date(user.recovery_sent_at).getTime();
          const currentTime = new Date().getTime();
          if (currentTime - recoveryTimestamp < 60 * 60 * 1000) {
            setHasResetToken(true);
            return;
          }
        }

        Alert.alert(
          'Invalid Reset Link',
          'Your password reset link is invalid or has expired. Please request a new reset link.',
          [{ text: 'OK', onPress: () => navigation.navigate('ForgotPassword') }]
        );
      } catch (error) {
        console.error('Error checking reset token:', error);
        navigation.navigate('ForgotPassword');
      }
    };

    checkResetToken();
  }, [navigation, route.params]);

  const form = useForm({
    defaultValues: {
      password: '',
      confirmPassword: ''
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        showAlert('Passwords do not match', { type: 'warning' });
        return;
      }

      setIsLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({ password: value.password });

        if (error) throw error;

        Alert.alert(
          'Password Reset Successful',
          'Your password has been reset successfully. You can now log in with your new password.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      } catch (error) {
        const formattedError = errorService.handleAuthError(error);
        const alertType = errorService.getAlertType(formattedError.category);
        showAlert(formattedError.message, { type: alertType });
      } finally {
        setIsLoading(false);
      }
    }
  });

  if (!hasResetToken) {
    return (
      <View className="flex-1 items-center justify-center">
        <LoadingSpinner fullScreen message="Verifying reset link..." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
          <Image
            source={require('@assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />
          <View className="flex-1 px-[26px]">
            <Header />
            <View className="h-[1px] bg-black/10 mb-[30px]" />

            <Text className="text-2xl font-roboto font-bold text-center mb-6">
              Reset Your Password
            </Text>
            <Text className="text-base font-roboto text-center mb-8">
              Enter your new password below.
            </Text>

            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  const errors = [];

                  if (!hasMinLength.test(value)) {
                    errors.push('Password must be at least 8 characters');
                  }
                  if (!hasCapitalLetter.test(value)) {
                    errors.push('Password must contain at least 1 capital letter');
                  }
                  if (!hasNumber.test(value)) {
                    errors.push('Password must contain at least 1 number');
                  }
                  if (!hasSpecialChar.test(value)) {
                    errors.push('Password must contain at least 1 special character');
                  }

                  return errors.length > 0 ? errors.join(', ') : undefined;
                }
              }}
            >
              {(field) => (
                <View className="mb-[29px]">
                  <Text className="text-base font-roboto mb-[6px]">New Password</Text>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => passwordInputRef.current?.focus()}
                    className={`bg-white h-[55px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  >
                    <LockIcon width={35} height={35} style={{ marginRight: 14 }} />
                    <TextInput
                      ref={passwordInputRef}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => {
                        setIsPasswordFocused(false);
                        field.handleBlur();
                      }}
                      secureTextEntry={!showPassword}
                      className="flex-1 text-base font-roboto pr-[30px] outline-none"
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      placeholder="Enter new password"
                    />
                    <TouchableOpacity
                      className="absolute right-[9px]"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <ViewPasswordIcon width={25} height={25} />
                      ) : (
                        <HidePasswordIcon width={25} height={25} />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {field.state.meta.errors.length > 0 && (
                    <Text className="text-red-500 text-xs mt-1">
                      {field.state.meta.errors}
                    </Text>
                  )}
                </View>
              )}
            </form.Field>

            <form.Field
              name="confirmPassword"
              validators={{
                onChangeListenTo: ['password'],
                onChange: ({ value, fieldApi }) => {
                  if (value !== fieldApi.form.getFieldValue('password')) {
                    return 'Passwords do not match';
                  }
                  return undefined;
                }
              }}
            >
              {(field) => (
                <View className="mb-[29px]">
                  <Text className="text-base font-roboto mb-[6px]">Confirm Password</Text>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => confirmPasswordInputRef.current?.focus()}
                    className={`bg-white h-[55px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isConfirmPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  >
                    <LockIcon width={35} height={35} style={{ marginRight: 14 }} />
                    <TextInput
                      ref={confirmPasswordInputRef}
                      onFocus={() => setIsConfirmPasswordFocused(true)}
                      onBlur={() => {
                        setIsConfirmPasswordFocused(false);
                        field.handleBlur();
                      }}
                      secureTextEntry={!showConfirmPassword}
                      className="flex-1 text-base font-roboto pr-[30px] outline-none"
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      placeholder="Confirm new password"
                    />
                    <TouchableOpacity
                      className="absolute right-[9px]"
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <ViewPasswordIcon width={25} height={25} />
                      ) : (
                        <HidePasswordIcon width={25} height={25} />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {field.state.meta.errors.length > 0 && (
                    <Text className="text-red-500 text-xs mt-1">
                      {field.state.meta.errors}
                    </Text>
                  )}
                </View>
              )}
            </form.Field>

            <View className="px-2 mb-6">
              <Text className="text-[11px] font-normal font-roboto leading-normal">
                Password must contain {"\n"}
                At least 1 Capital Letter{"\n"}
                At least 1 Number{"\n"}
                At least 1 Special Character (@$&!)
              </Text>
            </View>

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <TouchableOpacity
                  className={`bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[20px] items-center ${!canSubmit ? 'opacity-70' : ''}`}
                  onPress={() => form.handleSubmit()}
                  disabled={!canSubmit || isLoading}
                >
                  {isLoading || isSubmitting ? (
                    <LoadingSpinner fullScreen message="Resetting password..." />
                  ) : (
                    <Text className="text-base font-bold font-roboto text-center">
                      Reset Password
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </form.Subscribe>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}