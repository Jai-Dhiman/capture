import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import React, { useState, useRef } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { EmailIconSvg, ProfileIconSvg } from '@assets/icons/svgStrings';
import { svgToDataUri } from '@/shared/utils/svgUtils';
import { Image } from 'expo-image';


type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'EmailSignup'>;
};

export default function EmailSignupScreen({ navigation }: Props) {
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const { sendCode } = useAuth();

  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  const form = useForm({
    defaultValues: {
      email: '',
      phone: '',
    },
    onSubmit: async ({ value }) => {
      // Clean phone number to E.164 format for backend
      const cleanedPhone = value.phone.replace(/[^\d+]/g, '');

      sendCode.mutate(
        {
          email: value.email,
          phone: cleanedPhone,
        },
        {
          onSuccess: (data) => {
            navigation.navigate('EmailCodeVerification', {
              email: value.email,
              phone: cleanedPhone,
              isNewUser: data.isNewUser,
              message: data.message,
            });
          },
        },
      );
    },
  });

  const formatPhoneNumber = (text: string) => {
    // Remove all non-numeric characters except + at the beginning
    let cleaned = text.replace(/[^\d+]/g, '');

    // If no + prefix and starts with 1, assume US number with country code
    if (!cleaned.startsWith('+') && cleaned.startsWith('1') && cleaned.length > 1) {
      cleaned = `+${cleaned}`;
    }
    // If no + prefix and doesn't start with 1, assume US number without country code
    else if (!cleaned.startsWith('+') && !cleaned.startsWith('1')) {
      cleaned = `+1${cleaned}`;
    }
    // If starts with +, keep as is
    else if (!cleaned.startsWith('+')) {
      cleaned = `+1${cleaned}`;
    }

    // Format +1 (US) numbers
    if (cleaned.startsWith('+1')) {
      const digits = cleaned.substring(2); // Remove +1
      if (digits.length >= 10) {
        const match = digits.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
          return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
        }
      }

      // Format partial numbers
      if (digits.length >= 6) {
        const match = digits.match(/^(\d{3})(\d{3})(\d+)$/);
        if (match) {
          return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
        }
      }

      if (digits.length >= 3) {
        const match = digits.match(/^(\d{3})(\d+)$/);
        if (match) {
          return `+1 (${match[1]}) ${match[2]}`;
        }
      }

      if (digits.length > 0) {
        return `+1 ${digits}`;
      }

      return '+1 ';
    }

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
              opacity: 0.58,
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            resizeMode="cover"
          />

          <Header showBackButton={true} onBackPress={() => navigation.goBack()} />

          <View className="h-[40px]" />

          <View className="px-[26px] w-full mt-[170px]">
            <form.Field
              name="phone"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Phone number is required';
                  const cleaned = value.replace(/[^\d]/g, '');
                  if (cleaned.length < 11) return 'Please enter a valid phone number';
                  if (cleaned.length > 15) return 'Phone number is too long';
                  if (!value.startsWith('+1')) return 'Please enter a US phone number';
                  return undefined;
                },
              }}
            >
              {(field) => (
                <View className="mb-[32px]">
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => phoneInputRef.current?.focus()}
                    className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isPhoneFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  >
                    <Image
                      source={{ uri: svgToDataUri(ProfileIconSvg) }}
                      style={[{ width: 30, height: 30 }, { marginRight: 14 }]}
                    />
                    <TextInput
                      ref={phoneInputRef}
                      onFocus={() => setIsPhoneFocused(true)}
                      onBlur={() => {
                        setIsPhoneFocused(false);
                        field.handleBlur();
                      }}
                      className="flex-1 text-[16px] font-semibold font-roboto text-black outline-none"
                      style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                      value={field.state.value}
                      onChangeText={(text) => {
                        const formatted = formatPhoneNumber(text);
                        field.handleChange(formatted);
                      }}
                      keyboardType="phone-pad"
                      placeholder="Phone Number (+1)"
                      placeholderTextColor="#C8C8C8"
                      maxLength={18} // +1 (XXX) XXX-XXXX format
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
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => emailInputRef.current?.focus()}
                    className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  >
                    <Image
                      source={{ uri: svgToDataUri(EmailIconSvg) }}
                      style={[{ width: 30, height: 30 }, { marginRight: 14 }]}
                    />
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

            <Text className="text-center mt-[240px] mb-4">
              We recommend saving this information
            </Text>

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isFormSubmitting]) => (
                <TouchableOpacity
                  className={`h-[56px] ${canSubmit ? 'bg-[#e7cac4]' : 'bg-stone-300'} rounded-[30px] shadow-md justify-center items-center w-full mt-[-2px]`}
                  onPress={() => {
                    form.handleSubmit();
                  }}
                  disabled={Boolean(!canSubmit || isFormSubmitting || sendCode.isPending)}
                >
                  {isFormSubmitting || sendCode.isPending ? (
                    <LoadingSpinner message="Sending verification codes..." />
                  ) : (
                    <Text className="text-center text-black text-[16px] font-bold font-roboto">
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
