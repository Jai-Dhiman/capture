import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, Alert, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from 'components/ui/LoadingSpinner';
import Header from 'components/ui/Header';
import LockIcon from '../../../assets/icons/LockIcon.svg';
import ViewPasswordIcon from '../../../assets/icons/ViewPasswordIcon.svg';
import HidePasswordIcon from '../../../assets/icons/HidePasswordIcon.svg';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
}

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasResetToken, setHasResetToken] = useState(false);
  
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

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

  const handleResetPassword = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;
      
      Alert.alert(
        'Password Reset Successful',
        'Your password has been reset successfully. You can now log in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to reset password';
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
            source={require('../../../assets/DefaultBackground.png')}
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
                  onBlur={() => setIsPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  className="flex-1 text-base font-roboto pr-[30px] outline-none"
                  value={password}
                  onChangeText={setPassword}
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
            </View>

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
                  onBlur={() => setIsConfirmPasswordFocused(false)}
                  secureTextEntry={!showConfirmPassword}
                  className="flex-1 text-base font-roboto pr-[30px] outline-none"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
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
            </View>

            <View className="px-2 mb-6">
              <Text className="text-[11px] font-normal font-roboto leading-normal">
                Password must contain {"\n"}
                At least 1 Capital Letter{"\n"}
                At least 1 Number{"\n"}
                At least 1 Special Character (@$&!)
              </Text>
            </View>

            <TouchableOpacity
              className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[20px]"
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner fullScreen message="Resetting password..." />
              ) : (
                <Text className="text-base font-bold font-roboto text-center">
                  Reset Password
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}