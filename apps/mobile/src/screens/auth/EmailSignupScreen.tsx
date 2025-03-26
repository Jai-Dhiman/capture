import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert
} from 'react-native';
import { useForm } from '@tanstack/react-form';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import { useAuth } from '../../hooks/auth/useAuth';
import { LoadingSpinner } from 'components/ui/LoadingSpinner';
import Header from '../../components/ui/Header';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '../../lib/AlertContext';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>
}

export default function EmailSignupScreen({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const { showAlert } = useAlert();
  const { signup, isLoading } = useAuth();

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null)

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
      if (value.password !== value.confirmPassword) {
        showAlert('Passwords do not match', { type: 'warning' });
        return;
      }
      
      signup.mutate(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            showAlert(
              'Account Created Successfully! Please check your email for a verification link to complete your registration.',
              { 
                type: 'success',
                action: {
                  label: 'Go to Login',
                  onPress: () => navigation.navigate('Login')
                },
                duration: 5000
              }
            );
          }
        }
      );
    }
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />

          <Header 
            showBackButton={true}
            onBackPress={() => navigation.goBack()}
          />

          <View className="flex-1 px-5 items-center">
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
                <View className="mt-12 mb-4 w-full items-center">
                  <TouchableOpacity 
                    activeOpacity={1}
                    onPress={() => emailInputRef.current?.focus()}
                    className="h-[55px] bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] w-full"
                  >
                    <View className="w-[55px] h-[55px] absolute left-0 top-0 bg-white border border-[#c7c7c7] rounded-l-2xl" />
                    <View className="absolute left-[12px] top-[12px]">
                      <MaterialIcons name="email" size={30} color="black" />
                    </View>
                    <TextInput
                      onFocus={() => {
                        setIsEmailFocused(true);
                      }}
                      onBlur={() => {
                        setIsEmailFocused(false);
                        field.handleBlur();
                      }}
                      className="absolute left-[65px] top-[20px] right-[12px] text-base font-semibold font-roboto"
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="Email"
                      placeholderTextColor="#c7c7c7"
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
                <View className="mb-4 w-full items-center">
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => passwordInputRef.current?.focus()}
                    className="h-[55px] bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] w-full"
                  >
                    <View className="w-[55px] h-[55px] absolute left-0 top-0 bg-white border border-[#c7c7c7] rounded-l-2xl" />
                    <View className="absolute left-[12px] top-[12px]">
                      <Feather name="lock" size={30} color="black" />
                    </View>
                    <TextInput
                      onFocus={() => {
                        setIsPasswordFocused(true);
                      }}
                      onBlur={() => {
                        setIsPasswordFocused(false);
                        field.handleBlur();
                      }}
                      className="absolute left-[64px] top-[20px] right-[40px] text-base font-semibold font-roboto"
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      secureTextEntry={!showPassword}
                      placeholder="Create Password"
                      placeholderTextColor="#c7c7c7"
                    />
                    <TouchableOpacity 
                      className="absolute right-[12px] top-[12px]"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Feather name={showPassword ? "eye" : "eye-off"} size={24} color="#888" />
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
                <View className="mb-1 w-full items-center">
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => confirmPasswordInputRef.current?.focus()}
                    className="h-[55px] bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] w-full"
                  >
                    <View className="w-[55px] h-[55px] absolute left-0 top-0 bg-white border border-[#c7c7c7] rounded-l-2xl" />
                    <View className="absolute left-[12px] top-[12px]">
                      <Feather name="lock" size={30} color="black" />
                    </View>
                    <TextInput
                      onFocus={() => {
                        setIsConfirmPasswordFocused(true);
                      }}
                      onBlur={() => {
                        setIsConfirmPasswordFocused(false);
                        field.handleBlur();
                      }}
                      className="absolute left-[65px] top-[20px] right-[40px] text-base font-semibold font-roboto"
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      secureTextEntry={!showConfirmPassword}
                      placeholder="Re-enter Password"
                      placeholderTextColor="#c7c7c7"
                    />
                    <TouchableOpacity 
                      className="absolute right-[12px] top-[12px]"
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={24} color="#888" />
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

            <View className="w-full px-2 mb-6">
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
                  className={`h-14 ${canSubmit ? 'bg-[#e4cac7]' : 'bg-gray-400'} rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] backdrop-blur-sm justify-center items-center mt-4 w-full`}
                  onPress={() => form.handleSubmit()}
                  disabled={!canSubmit || isLoading}
                >
                  {isLoading || isSubmitting ? (
                    <LoadingSpinner message="Creating account..." />
                  ) : (
                    <Text className="text-center text-black text-base font-bold font-roboto leading-normal">
                      Create Account
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