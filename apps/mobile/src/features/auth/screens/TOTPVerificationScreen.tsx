import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useTOTP } from '../hooks/useTOTP';
import { useAuthStore } from '../stores/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'TOTPVerification'>;
};

export default function TOTPVerificationScreen({ navigation }: Props) {
  const [verificationCode, setVerificationCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore((state) => state.user);

  const { verifyTOTP } = useTOTP();

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Invalid Code', 'Please enter a verification code.');
      return;
    }

    if (!isBackupCode && verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit verification code.');
      return;
    }

    if (isBackupCode && verificationCode.length !== 8) {
      Alert.alert('Invalid Code', 'Please enter an 8-digit backup code.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyTOTP(verificationCode, isBackupCode);
      
      // TOTP verification successful - proceed to authenticated state
      const setStage = useAuthStore.getState().setStage;
      setStage('authenticated');
      
      // Navigate to appropriate screen based on profile status
      // This would typically be handled by the auth flow
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error) {
      console.error('TOTP verification failed:', error);
      Alert.alert(
        'Verification Failed',
        isBackupCode
          ? 'The backup code is incorrect or has already been used. Please try again.'
          : 'The verification code is incorrect. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCodeType = () => {
    setIsBackupCode(!isBackupCode);
    setVerificationCode('');
  };

  return (
    <View style={{ flex: 1 }}>
      <Header showBackButton onBackPress={() => navigation.goBack()} />

      <ScrollView className="flex-1 bg-white">
        <View className="flex-1 p-6 justify-center">
          <Text className="text-3xl font-bold text-center mb-4 text-gray-900 font-roboto">
            Two-Factor Authentication
          </Text>

          <Text className="text-base text-center mb-2 leading-6 text-gray-600 font-roboto">
            Welcome back, {user?.email}
          </Text>

          <Text className="text-base text-center mb-8 leading-6 text-gray-600 font-roboto">
            {isBackupCode
              ? 'Enter one of your backup codes to continue.'
              : 'Enter the 6-digit code from your authenticator app to continue.'}
          </Text>

          <View className="mb-6">
            <Text className="text-lg font-semibold mb-3 text-gray-900 font-roboto">
              {isBackupCode ? 'Backup Code' : 'Verification Code'}
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl p-4 text-lg font-mono text-center bg-white"
              placeholder={isBackupCode ? '00000000' : '000000'}
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="numeric"
              maxLength={isBackupCode ? 8 : 6}
              autoFocus
            />
          </View>

          <TouchableOpacity
            className={`py-4 px-6 rounded-[30px] shadow-md items-center mb-4 ${
              verificationCode.length === (isBackupCode ? 8 : 6) ? 'bg-[#E4CAC7]' : 'bg-gray-300'
            }`}
            onPress={handleVerifyCode}
            disabled={verificationCode.length !== (isBackupCode ? 8 : 6) || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="black" size="small" />
            ) : (
              <Text className="text-base font-bold font-roboto text-black">Verify</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-transparent py-4 px-6 rounded-xl items-center border border-gray-300 mb-4"
            onPress={toggleCodeType}
          >
            <Text className="text-gray-600 text-base font-medium font-roboto">
              {isBackupCode
                ? 'Use authenticator code instead'
                : 'Use backup code instead'}
            </Text>
          </TouchableOpacity>

          <View className="mb-8 p-5 bg-gray-50 rounded-xl">
            <Text className="text-lg font-semibold mb-3 text-gray-900 font-roboto">
              Need Help?
            </Text>
            <Text className="text-base mb-2 text-gray-700 font-roboto">
              • Check that your device's time is synchronized
            </Text>
            <Text className="text-base mb-2 text-gray-700 font-roboto">
              • Use backup codes if you've lost access to your authenticator
            </Text>
            <Text className="text-base text-gray-700 font-roboto">
              • Contact support if you've lost both your authenticator and backup codes
            </Text>
          </View>

          {/* Emergency access notice */}
          <Text className="text-sm text-center text-gray-400 italic font-roboto">
            If you no longer have access to your authenticator app or backup codes,
            please contact support for assistance.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}