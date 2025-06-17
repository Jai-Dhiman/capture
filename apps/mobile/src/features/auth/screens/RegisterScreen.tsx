import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator
} from 'react-native';
import { useForm } from '@tanstack/react-form';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import AppleIcon from '@assets/icons/AppleLogo.svg';
import GoogleLogo from '@assets/icons/GoogleLogo.svg';
import EmailIcon from '@assets/icons/EmailIcon.svg';
import Header from '@/shared/components/Header';
import { useAuth } from '../hooks/useAuth';
import { useAlert } from '@/shared/lib/AlertContext';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RegisterScreen'>
}

export default function RegisterScreen({ navigation }: Props) {
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const { showAlert } = useAlert();
  const { sendCode, loginWithGoogle, loginWithApple } = useAuth();


  const form = useForm({
    defaultValues: {
      email: '',
      phone: ''
    },
    onSubmit: async ({ value }) => {
      if (!value.email) {
        showAlert('Please enter your email address', { type: 'warning' });
        return;
      }

      sendCode.mutate(
        {
          email: value.email,
          phone: value.phone || undefined
        },
        {
          onSuccess: (response) => {
            navigation.navigate('CodeVerification', {
              email: value.email,
              phone: value.phone || undefined,
              isNewUser: response.isNewUser,
              message: response.message,
            });
          }
        }
      );
    }
  });

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
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

        <View className="flex-1 px-[26px] justify-center">

          <TouchableOpacity
            onPress={() => navigation.navigate('EmailSignup')}
            className="bg-white h-[56px] rounded-[30px] shadow-md items-center justify-center mb-[23px]"
            style={{ position: 'relative' }}
          >
            <EmailIcon width={24} height={24} style={{ position: 'absolute', left: 24, top: '50%', transform: [{ translateY: -12 }] }} />
            <Text className="text-base font-bold font-roboto text-[#1C1C1C]"
              style={{
                position: 'absolute',
                left: '30%',
                top: '50%',
                transform: [{ translateY: -10 }],
              }}>
              Continue with Email
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => loginWithGoogle.mutate()}
            disabled={loginWithGoogle.isPending}
            className={`bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px] ${loginWithGoogle.isPending ? 'opacity-50' : ''}`}
            style={{ position: 'relative' }}
          >
            {loginWithGoogle.isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <GoogleLogo width={24} height={24} style={{ position: 'absolute', left: 24, top: '50%', transform: [{ translateY: -12 }] }} />
                <Text className="text-base font-bold font-roboto text-[#1C1C1C]"
                  style={{
                    position: 'absolute',
                    left: '30%',
                    top: '50%',
                    transform: [{ translateY: -10 }],
                  }}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => loginWithApple.mutate()}
            disabled={loginWithApple.isPending}
            className={`bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px] ${loginWithApple.isPending ? 'opacity-50' : ''}`}
            style={{ position: 'relative' }}
          >
            {loginWithApple.isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <AppleIcon width={24} height={24} style={{ position: 'absolute', left: 24, top: '50%', transform: [{ translateY: -12 }] }} />
                <Text className="text-base font-bold font-roboto text-[#1C1C1C]"
                  style={{
                    position: 'absolute',
                    left: '30%',
                    top: '50%',
                    transform: [{ translateY: -10 }],
                  }}>
                  Continue with Apple
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
            className="bg-[#827B85] h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]"
          >
            <Text className="text-base font-bold font-roboto text-[#FFFFFF] text-center">
              Create Business Account
            </Text>
          </TouchableOpacity>
          {/* 
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
          </View> */}
        </View>
      </View>
    </View>
  );
}