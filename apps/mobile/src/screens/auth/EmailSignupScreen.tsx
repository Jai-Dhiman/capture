import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Image
} from 'react-native';
import { useForm } from '@tanstack/react-form';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import { useAuth } from '../../hooks/auth/useAuth';
import { LoadingSpinner } from 'components/ui/LoadingSpinner';
import Header from '../../components/ui/Header';
import { useAlert } from '../../lib/AlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmailIcon from '../../../assets/icons/EmailIcon.svg'
import LockIcon from '../../../assets/icons/LockIcon.svg'
import ViewPasswordIcon from '../../../assets/icons/ViewPasswordIcon.svg'
import HidePasswordIcon from '../../../assets/icons/HidePasswordIcon.svg'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>
}

export default function EmailSignupScreen({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const { showAlert } = useAlert();
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();

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
            source={require('../../../assets/DefaultBackground.png')}
            className="w-full h-full absolute"
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
                    className="h-[56px] bg-white rounded-[16px] w-full"
                  >
                    <View className="w-[56px] h-[56px] absolute left-0 top-0 bg-white rounded-tl-[16px] rounded-bl-[16px] border-[0.5px] border-stone-300" />
                    <View className="absolute left-[12px] top-[12px]">
                      <EmailIcon width={30} height={30} />
                    </View>
                    <View className="h-[56px] w-[0.5px] absolute left-[56px] top-0 bg-black/10" />
                    <TextInput
                      ref={emailInputRef}
                      className="absolute left-[72px] top-[16px] right-[12px] text-[16px] font-semibold font-['Roboto'] text-black"
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="Email"
                      placeholderTextColor="#c7c7c7"
                    />
                  </TouchableOpacity>
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <Text className="text-red-500 text-xs mt-1 ml-2">
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
                      className="h-[56px] bg-white rounded-[16px] w-full"
                    >
                      <View className="w-[56px] h-[56px] absolute left-0 top-0 bg-white rounded-tl-[16px] rounded-bl-[16px] border-[0.5px] border-stone-300" />
                      <View className="absolute left-[12px] top-[12px]">
                        <LockIcon width={30} height={30} />
                      </View>
                      <View className="h-[56px] w-[0.5px] absolute left-[56px] top-0 bg-black/10" />
                      <TextInput
                        ref={passwordInputRef}
                        className="absolute left-[72px] top-[16px] right-[40px] text-[16px] font-semibold font-['Roboto'] text-black"
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        onBlur={field.handleBlur}
                        secureTextEntry={!showPassword}
                        placeholder="Create Password"
                        placeholderTextColor="#c7c7c7"
                      />
                      <TouchableOpacity
                        className="absolute right-[12px] top-[12px]"
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <ViewPasswordIcon width={24} height={24} />
                        ) : (
                          <HidePasswordIcon width={24} height={24} />
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {passwordErrors.length > 0 && (
                      <Text className="text-red-500 text-xs mt-1 ml-2">
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
                      className="h-[56px] bg-white rounded-[16px] w-full"
                    >
                      <View className="w-[56px] h-[56px] absolute left-0 top-0 bg-white rounded-tl-[16px] rounded-bl-[16px] border-[0.5px] border-stone-300" />
                      <View className="absolute left-[12px] top-[12px]">
                        <LockIcon width={30} height={30} />
                      </View>
                      <View className="h-[56px] w-[0.5px] absolute left-[56px] top-0 bg-black/10" />
                      <TextInput
                        ref={confirmPasswordInputRef}
                        className="absolute left-[72px] top-[16px] right-[40px] text-[16px] font-semibold font-['Roboto'] text-black"
                        value={field.state.value}
                        onChangeText={field.handleChange}
                        onBlur={field.handleBlur}
                        secureTextEntry={!showConfirmPassword}
                        placeholder="Re-enter Password"
                        placeholderTextColor="#c7c7c7"
                      />
                      <TouchableOpacity
                        className="absolute right-[12px] top-[12px]"
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <ViewPasswordIcon width={24} height={24} />
                        ) : (
                          <HidePasswordIcon width={24} height={24} />
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {confirmError && (
                      <Text className="text-red-500 text-xs mt-1 ml-2">
                        {confirmError}
                      </Text>
                    )}
                  </View>
                );
              }}
            </form.Field>

            <View className="ml-2 mt-[8px] mb-[30px]">
              <Text className="text-xs font-normal font-['Roboto'] leading-[18px] text-black">
                Password must contain {"\n"}
                At least 1 Capital Letter{"\n"}
                At least 1 Number{"\n"}
                At least 1 Special Character (@$&!)
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
              {([canSubmit, isSubmitting, password, confirmPassword]) => {
                const buttonColorChange = passwordsMatch(String(password), String(confirmPassword));

                return (
                  <TouchableOpacity
                    className={`h-[56px] ${buttonColorChange ? 'bg-[#e7cac4]' : 'bg-stone-300'} rounded-[30px] shadow-md justify-center items-center w-full mt-[-2px]`}
                    onPress={() => {
                      form.handleSubmit();
                    }}
                    disabled={!!isSubmitting || !!signup.isPending}
                  >
                    {signup.isPending || isSubmitting ? (
                      <LoadingSpinner message="Creating account..." />
                    ) : (
                      <Text className="text-center text-black text-[16px] font-bold font-['Roboto']">
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