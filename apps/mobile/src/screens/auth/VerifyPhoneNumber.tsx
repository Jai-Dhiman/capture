import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Image, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from 'components/LoadingSpinner';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { isDevelopment } from '../../config/environment';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'VerifyPhoneNumber'>;
};

export default function VerifyPhoneNumberScreen({ navigation }: Props) {
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCodeComplete, setIsCodeComplete] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);
  const { user } = useAuthStore();
  const { completeStep } = useOnboardingStore();

  useEffect(() => {
    const allDigitsFilled = verificationCode.every(digit => digit !== '');
    setIsCodeComplete(allDigitsFilled);
  }, [verificationCode]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setResendDisabled(false);
    }
  }, [countdown]);

  const handleCodeChange = (text: string, index: number) => {
    if (!/^\d*$/.test(text)) return;
    
    const newCode = [...verificationCode];
    newCode[index] = text;
    setVerificationCode(newCode);
    
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!user?.phone) {
      Alert.alert('Error', 'No phone number found to verify');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fullCode = verificationCode.join('');
      
      const { error } = await supabase.auth.verifyOtp({
        phone: user.phone,
        token: fullCode,
        type: 'sms'
      });
      
      if (error) throw error;
      
      completeStep('phone-verification');
      navigation.navigate('CreateProfile');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!user?.phone) {
      Alert.alert('Error', 'No phone number found');
      return;
    }

    setResendDisabled(true);
    setCountdown(60);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: user.phone,
      });
      
      if (error) throw error;
      
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone number.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend code';
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#dcdcde] overflow-hidden">
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />
          <Header showBackButton onBackPress={() => navigation.goBack()} />
          
          <View className="flex-1 items-center px-6">
            <View className="w-full bg-[#827b85] rounded-[10px] mt-6 items-center justify-center p-4">
              <Text className="text-white text-2xl font-medium font-roboto tracking-wide text-center">
                Verify Your Phone Number
              </Text>
              <Text className="text-white text-[13px] font-normal font-roboto tracking-tight text-center mt-2">
                We've sent a 6-digit code to {user?.phone || 'your number'}, please enter the code below
              </Text>
            </View>

            <View className="w-full bg-[#827b85] rounded-[10px] mt-3 items-center p-6">
              <View className="flex-row justify-center items-end gap-2 mt-8">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    className="w-12 h-12 bg-white rounded-md border border-[#cbd2e0] justify-center items-center text-center text-xl font-medium"
                    value={verificationCode[index]}
                    onChangeText={(text) => handleCodeChange(text, index)}
                    onKeyPress={(e) => handleKeyDown(e, index)}
                    maxLength={1}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                ))}
              </View>

              <Text className="text-white text-xs font-light font-roboto tracking-tight text-center mt-8">
                If you are having trouble receiving the SMS, ensure you have entered the correct Country Code, 
                Area Code, and digits. If you continue to have problems reach out to support.
              </Text>
            </View>

            <View className="flex-row justify-center mt-4">
              <Text className="text-black text-sm font-normal tracking-wide">
                Didn't receive the code?
              </Text>
              <TouchableOpacity onPress={handleResend} disabled={resendDisabled}>
                <Text className={`${resendDisabled ? 'text-gray-400' : 'text-[#e4cac7]'} text-sm font-normal underline tracking-wide ml-1`}>
                  {resendDisabled ? `Resend in ${countdown}s` : 'Resend'}
                </Text>
              </TouchableOpacity>
            </View>

            {error && (
              <Text className="text-red-500 mt-4 text-center">{error}</Text>
            )}

            <TouchableOpacity 
              className={`w-full h-14 ${isCodeComplete ? 'bg-[#e4cac7]' : 'bg-gray-400'} rounded-[30px] shadow-md mt-10 justify-center items-center`}
              onPress={handleVerify}
              disabled={loading || !isCodeComplete}
            >
              {loading ? (
                <LoadingSpinner fullScreen message="Verifying..." />
              ) : (
                <Text className="text-black text-base font-bold font-roboto">
                  Verify
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="h-[21px] items-center justify-center mb-2">
            <View className="w-[139px] h-[5px] bg-black rounded-[100px]" />
          </View>
        </View>
        {isDevelopment && (
          <View className="bg-yellow-100 p-3 rounded mx-4 mb-4">
            <Text className="text-xs text-yellow-800 text-center mb-2">
              Development Testing Tools
            </Text>
            <TouchableOpacity
              className="bg-yellow-200 p-2 rounded mb-2"
              onPress={() => {
                useAuthStore.getState().simulatePhoneVerification();
                completeStep('phone-verification');
                navigation.navigate('CreateProfile');
              }}
            >
              <Text className="text-xs text-center">Simulate Successful Verification</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-yellow-200 p-2 rounded"
              onPress={() => navigation.goBack()}
            >
              <Text className="text-xs text-center">Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}