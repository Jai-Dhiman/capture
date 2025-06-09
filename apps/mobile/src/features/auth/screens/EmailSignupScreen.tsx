import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Image
} from 'react-native';
import { useForm } from '@tanstack/react-form';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import Header from '@/shared/components/Header';
import { useAlert } from '@/shared/lib/AlertContext';
import EmailIcon from '@assets/icons/EmailIcon.svg'
import LockIcon from '@assets/icons/LockIcon.svg'
import ViewPasswordIcon from '@assets/icons/ViewPasswordIcon.svg'
import HidePasswordIcon from '@assets/icons/HidePasswordIcon.svg'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>
}

export default function EmailSignupScreen({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const { showAlert } = useAlert();
  const { signup } = useAuth();

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const hasCapitalLetter = /[A-Z]/;
  const hasNumber = /[0-9]/;
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
  const hasMinLength = /.{8,}/;

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    onSubmit: async ({ value }) => {
      const errors = validatePasswordRequirements(value.password);

      if (errors.length > 0 || value.password !== value.confirmPassword) {
        setShowValidationErrors(true);
        showAlert('Please fix the errors before submitting', { type: 'warning' });
        return;
      }

      signup.mutate(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            navigation.navigate('EmailVerificationPending');
          }
        }
      );
    }
  });

  const validatePasswordRequirements = (password: string) => {
    const errors = [];

    if (!hasMinLength.test(password)) {
      errors.push('Password must be at least 8 characters');
    }
    if (!hasCapitalLetter.test(password)) {
      errors.push('Password must contain at least 1 capital letter');
    }
    if (!hasNumber.test(password)) {
      errors.push('Password must contain at least 1 number');
    }
    if (!hasSpecialChar.test(password)) {
      errors.push('Password must contain at least 1 special character');
    }

    return errors;
  };

  const passwordsMatch = (password: string, confirmPassword: string) => {
    return password !== '' && confirmPassword !== '' && password === confirmPassword;
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
              left: 0
            }}
            resizeMode="cover"
          />

          <Header
            showBackButton={true}
            onBackPress={() => navigation.goBack()}
          />

          <View className="h-[40px]" />

          <View className="px-[26px] w-full">
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Email is required';
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
                  return undefined;
                }
              }}
            >
              {(field) => (
                <View className="mb-[24px]">
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => emailInputRef.current?.focus()}
                    className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  >
                    <EmailIcon width={30} height={30} style={{ marginRight: 14 }} />
                    <TextInput
                      ref={emailInputRef}
                      onFocus={() => setIsEmailFocused(true)}
                      onBlur={() => {
                        setIsEmailFocused(false);
                        field.handleBlur();
                      }}
                      className="flex-1 text-[16px] font-semibold font-roboto text-black outline-none"
                      style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="Email"
                      placeholderTextColor="#C8C8C8"
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

            <form.Field
              name="password"
            >
              {(field) => {
                const passwordErrors = showValidationErrors ? validatePasswordRequirements(field.state.value) : [];

                return (
                  <View className="mb-[24px]">
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => passwordInputRef.current?.focus()}
                      className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                    >
                      <LockIcon width={30} height={30} style={{ marginRight: 14 }} />
                      <TextInput
                        ref={passwordInputRef}
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => {
                          setIsPasswordFocused(false);
                          field.handleBlur();
                        }}
                        className="flex-1 text-[16px] font-semibold font-roboto text-black outline-none pr-[30px]"
                        style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        secureTextEntry={!showPassword}
                        placeholder="Create Password"
                        placeholderTextColor="#C8C8C8"
                      />
                      <TouchableOpacity
                        className="absolute right-[9px] top-[17.5px] items-center justify-center"
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <ViewPasswordIcon width={25} height={25} />
                        ) : (
                          <HidePasswordIcon width={25} height={25} />
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {passwordErrors.length > 0 && (
                      <Text className="text-red-500 text-xs mt-1 ml-2 font-roboto">
                        {passwordErrors.join(', ')}
                      </Text>
                    )}
                  </View>
                );
              }}
            </form.Field>

            <form.Field
              name="confirmPassword"
            >
              {(field) => {
                const passwordValue = form.getFieldValue('password');
                const confirmError = showValidationErrors &&
                  field.state.value !== '' &&
                  passwordValue !== field.state.value
                  ? 'Passwords do not match'
                  : undefined;

                return (
                  <View className="mb-2">
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => confirmPasswordInputRef.current?.focus()}
                      className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isConfirmPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                    >
                      <LockIcon width={30} height={30} style={{ marginRight: 14 }} />
                      <TextInput
                        ref={confirmPasswordInputRef}
                        onFocus={() => setIsConfirmPasswordFocused(true)}
                        onBlur={() => {
                          setIsConfirmPasswordFocused(false);
                          field.handleBlur();
                        }}
                        className="flex-1 text-[16px] font-semibold font-roboto text-black outline-none pr-[30px]"
                        style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        secureTextEntry={!showConfirmPassword}
                        placeholder="Re-enter Password"
                        placeholderTextColor="#C8C8C8"
                      />
                      <TouchableOpacity
                        className="absolute right-[9px] top-[17.5px] items-center justify-center"
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <ViewPasswordIcon width={25} height={25} />
                        ) : (
                          <HidePasswordIcon width={25} height={25} />
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {confirmError && (
                      <Text className="text-red-500 text-xs mt-1 ml-2 font-roboto">
                        {confirmError}
                      </Text>
                    )}
                  </View>
                );
              }}
            </form.Field>

            <View className="ml-2 mt-[8px] mb-[30px]">
              <Text className="text-xs font-normal font-roboto leading-[18px] text-black">
                Password must contain: {"\n"}
                - At least 1 Capital Letter{"\n"}
                - At least 1 Number{"\n"}
                - At least 1 Special Character (@$&!)
              </Text>
            </View>

            <form.Subscribe
              selector={(state) => [
                state.canSubmit,
                state.isSubmitting,
                state.values.password,
                state.values.confirmPassword
              ]}
            >
              {([canSubmit, isFormSubmitting, password, confirmPassword]) => {
                const buttonColorChange = passwordsMatch(String(password), String(confirmPassword));

                return (
                  <TouchableOpacity
                    className={`h-[56px] ${buttonColorChange ? 'bg-[#e7cac4]' : 'bg-stone-300'} rounded-[30px] shadow-md justify-center items-center w-full mt-[-2px]`}
                    onPress={() => {
                      form.handleSubmit();
                    }}
                    disabled={Boolean(!canSubmit || isFormSubmitting || signup.isPending)}
                  >
                    {isFormSubmitting || signup.isPending ? (
                      <LoadingSpinner message="Creating account..." />
                    ) : (
                      <Text className="text-center text-black text-[16px] font-bold font-roboto">
                        Create Account
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            </form.Subscribe>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}