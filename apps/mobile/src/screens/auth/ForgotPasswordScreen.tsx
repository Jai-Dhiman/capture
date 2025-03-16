import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, Alert, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from 'components/LoadingSpinner';
import Header from 'components/Header';
import EmailIcon from '../../../assets/icons/EmailIcon.svg';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>
}

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const emailInputRef = useRef<TextInput>(null);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
      
      setResetEmailSent(true);
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to send password reset email';
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />
          <View className="flex-1 px-[26px]">
            <Header 
              showBackButton={true}
              onBackPress={() => navigation.goBack()}
            />
            <View className="h-[1px] bg-black/10 mb-[30px]" />

            {resetEmailSent ? (
              <View className="items-center justify-center mt-10">
                <Text className="text-2xl font-roboto font-bold text-center mb-6">
                  Check Your Email
                </Text>
                <Text className="text-base font-roboto text-center mb-8">
                  We've sent a password reset link to {email}. Please check your email and follow the instructions to reset your password.
                </Text>
                <TouchableOpacity
                  className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center w-full"
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
                      onBlur={() => setIsEmailFocused(false)}
                      placeholder="Enter your email address"
                      placeholderTextColor="#C8C8C8"
                      className="flex-1 text-base font-roboto text-black outline-none"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[20px]"
                  onPress={handleResetPassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <LoadingSpinner fullScreen message="Sending email..." />
                  ) : (
                    <Text className="text-base font-bold font-roboto text-center">
                      Send Reset Link
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}