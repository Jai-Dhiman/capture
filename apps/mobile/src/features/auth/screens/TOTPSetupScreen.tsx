import type { AuthStackParamList } from '@/navigation/types';
import Header from '@/shared/components/Header';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTOTP } from '../hooks/useTOTP';
import { useAuthStore } from '../stores/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'TOTPSetup'>;
};

export default function TOTPSetupScreen({ navigation }: Props) {
  const authStage = useAuthStore((state) => state.stage);
  const [currentStep, setCurrentStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [verificationCode, setVerificationCode] = useState('');
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeData: string;
    totpId: string;
  } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { setupBegin, setupComplete } = useTOTP();

  const isMandatory = authStage === 'securitySetupRequired';

  useEffect(() => {
    initiateTOTPSetup();
  }, []);

  const initiateTOTPSetup = async () => {
    setIsLoading(true);
    try {
      const response = await setupBegin.mutateAsync();
      setSetupData(response);
    } catch (error) {
      console.error('Failed to initiate TOTP setup:', error);
      Alert.alert(
        'Setup Failed',
        'Failed to initiate TOTP setup. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await setupComplete.mutateAsync(verificationCode);
      setBackupCodes((response as any).backupCodes);
      setCurrentStep('backup');
    } catch (error) {
      console.error('TOTP verification failed:', error);
      Alert.alert(
        'Verification Failed',
        'The verification code is incorrect. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (setupData?.secret) {
      Clipboard.setString(setupData.secret);
      Alert.alert('Copied', 'Secret key copied to clipboard');
    }
  };

  const handleCopyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    Clipboard.setString(codesText);
    Alert.alert('Copied', 'Backup codes copied to clipboard');
  };

  const handleComplete = () => {
    if (authStage === 'securitySetupRequired') {
      const setStage = useAuthStore.getState().setStage;
      setStage('profileRequired');
      navigation.replace('CreateProfile');
    } else {
      navigation.goBack();
    }
  };

  const renderSetupStep = () => (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 p-6">
        <Text className="text-3xl font-bold text-center mb-4 text-gray-900 font-roboto">
          Set Up Authenticator
        </Text>

        <Text className="text-base text-center mb-8 leading-6 text-gray-600 font-roboto">
          Use an authenticator app like Google Authenticator, Authy, or 1Password to scan the QR code below.
        </Text>

        {isLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#E4CAC7" />
            <Text className="text-gray-600 mt-4 font-roboto">Setting up authenticator...</Text>
          </View>
        ) : setupData ? (
          <>
            {/* QR Code Placeholder - In a real app, you'd use a QR code library */}
            <View className="bg-gray-100 rounded-xl p-8 mb-6 items-center">
              <View className="w-48 h-48 bg-white rounded-lg items-center justify-center border-2 border-gray-200">
                <Text className="text-sm text-gray-500 text-center font-roboto">
                  QR Code Here{'\n'}(Use QR library in production)
                </Text>
              </View>
            </View>

            {/* Manual Entry Option */}
            <View className="mb-6 p-4 bg-gray-50 rounded-xl">
              <Text className="text-lg font-semibold mb-2 text-gray-900 font-roboto">
                Manual Entry
              </Text>
              <Text className="text-sm text-gray-600 mb-3 font-roboto">
                If you can't scan the QR code, enter this secret key manually:
              </Text>
              <View className="flex-row items-center bg-white p-3 rounded-lg border border-gray-200">
                <Text className="flex-1 font-mono text-sm text-gray-800 mr-2">
                  {setupData.secret}
                </Text>
                <TouchableOpacity
                  onPress={handleCopySecret}
                  className="bg-[#E4CAC7] px-3 py-2 rounded-lg"
                >
                  <Text className="text-black text-sm font-semibold font-roboto">Copy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Instructions */}
            <View className="mb-8 p-4 bg-blue-50 rounded-xl">
              <Text className="text-lg font-semibold mb-3 text-blue-900 font-roboto">
                Setup Instructions
              </Text>
              <Text className="text-base mb-2 text-blue-800 font-roboto">
                1. Open your authenticator app
              </Text>
              <Text className="text-base mb-2 text-blue-800 font-roboto">
                2. Scan the QR code or enter the secret key
              </Text>
              <Text className="text-base mb-2 text-blue-800 font-roboto">
                3. Enter the 6-digit code from your app below
              </Text>
            </View>

            <TouchableOpacity
              className="bg-[#E4CAC7] py-4 px-6 rounded-[30px] shadow-md items-center mb-4"
              onPress={() => setCurrentStep('verify')}
            >
              <Text className="text-base font-bold font-roboto text-black">
                I've Added the Account
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        {!isMandatory && (
          <TouchableOpacity
            className="bg-transparent py-4 px-6 rounded-xl items-center border border-gray-300"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-gray-600 text-base font-medium font-roboto">Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderVerifyStep = () => (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 p-6">
        <Text className="text-3xl font-bold text-center mb-4 text-gray-900 font-roboto">
          Verify Setup
        </Text>

        <Text className="text-base text-center mb-8 leading-6 text-gray-600 font-roboto">
          Enter the 6-digit code from your authenticator app to complete setup.
        </Text>

        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3 text-gray-900 font-roboto">
            Verification Code
          </Text>
          <TextInput
            className="border border-gray-300 rounded-xl p-4 text-lg font-mono text-center bg-white"
            placeholder="000000"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="numeric"
            maxLength={6}
            autoFocus
          />
        </View>

        <TouchableOpacity
          className={`py-4 px-6 rounded-[30px] shadow-md items-center mb-4 ${
            verificationCode.length === 6 ? 'bg-[#E4CAC7]' : 'bg-gray-300'
          }`}
          onPress={handleVerifyCode}
          disabled={verificationCode.length !== 6 || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="black" size="small" />
          ) : (
            <Text className="text-base font-bold font-roboto text-black">Verify & Enable</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-transparent py-4 px-6 rounded-xl items-center border border-gray-300"
          onPress={() => setCurrentStep('setup')}
        >
          <Text className="text-gray-600 text-base font-medium font-roboto">Go Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderBackupStep = () => (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 p-6">
        <Text className="text-3xl font-bold text-center mb-4 text-gray-900 font-roboto">
          Save Backup Codes
        </Text>

        <Text className="text-base text-center mb-8 leading-6 text-gray-600 font-roboto">
          These backup codes can be used to access your account if you lose your authenticator app.
          Save them in a secure location.
        </Text>

        <View className="mb-6 p-4 bg-yellow-50 rounded-xl">
          <Text className="text-lg font-semibold mb-3 text-yellow-900 font-roboto">
            ⚠️ Important
          </Text>
          <Text className="text-base text-yellow-800 font-roboto">
            Each backup code can only be used once. Make sure to save these codes securely before continuing.
          </Text>
        </View>

        <View className="mb-6 p-4 bg-gray-50 rounded-xl">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-gray-900 font-roboto">
              Backup Codes
            </Text>
            <TouchableOpacity
              onPress={handleCopyBackupCodes}
              className="bg-[#E4CAC7] px-3 py-2 rounded-lg"
            >
              <Text className="text-black text-sm font-semibold font-roboto">Copy All</Text>
            </TouchableOpacity>
          </View>
          <View className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, index) => (
              <Text
                key={index}
                className="font-mono text-sm text-gray-800 bg-white p-2 rounded border"
              >
                {code}
              </Text>
            ))}
          </View>
        </View>

        <TouchableOpacity
          className="bg-[#E4CAC7] py-4 px-6 rounded-[30px] shadow-md items-center mb-4"
          onPress={handleComplete}
        >
          <Text className="text-base font-bold font-roboto text-black">
            I've Saved My Backup Codes
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1 }}>
      <Header showBackButton={!isMandatory} onBackPress={() => navigation.goBack()} />

      {currentStep === 'setup' && renderSetupStep()}
      {currentStep === 'verify' && renderVerifyStep()}
      {currentStep === 'backup' && renderBackupStep()}
    </View>
  );
}