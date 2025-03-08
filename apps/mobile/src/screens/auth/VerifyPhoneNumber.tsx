import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../../components/Header';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function VerifyPhoneNumberScreen({ navigation }: Props) {
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCodeComplete, setIsCodeComplete] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);

  useEffect(() => {
    const allDigitsFilled = verificationCode.every(digit => digit !== '');
    setIsCodeComplete(allDigitsFilled);
  }, [verificationCode]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...verificationCode];
    newCode[index] = text;
    setVerificationCode(newCode);
    
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      navigation.navigate('CreateProfile');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    Alert.alert('Resend Code', 'A new verification code has been sent to your phone number.');
  };

  return (
    <View className="flex-1 bg-[#dcdcde]">
      <Header showBackButton onBackPress={() => navigation.goBack()} />
      
      <View className="flex-1 items-center px-3">
        <View className="w-full h-[100px] bg-[#827b85] rounded-[10px] mt-6 items-center justify-center">
          <Text className="text-white text-2xl font-medium font-roboto tracking-wide text-center">
            Verify Your Phone Number
          </Text>
          <Text className="text-white text-[11px] font-normal font-roboto tracking-tight text-center mt-2">
            We've sent a 6-digit code to your number, please enter the code below
          </Text>
        </View>

        <View className="w-full h-[305px] bg-[#827b85] rounded-[10px] mt-3 items-center px-4">
          <View className="flex-row justify-center items-end gap-1 mt-16">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                className="w-12 h-11 bg-white rounded-md border border-[#cbd2e0] justify-center items-center text-center text-base font-medium"
                value={verificationCode[index]}
                onChangeText={(text) => handleCodeChange(text, index)}
                maxLength={1}
                keyboardType="number-pad"
                selectTextOnFocus
              />
            ))}
          </View>

          <Text className="text-white text-xs font-light font-roboto tracking-tight text-center mt-8">
            If you are having trouble receiving the SMS, ensure you have entered the correct Country Code, 
            Area Code, and digits. If you continue to have problems reach out to captureapp@support.com
          </Text>
        </View>

        <View className="flex-row justify-center mt-4">
          <Text className="text-white text-sm font-normal tracking-wide">
            Didn't see our text message?
          </Text>
          <TouchableOpacity onPress={handleResend}>
            <Text className="text-[#e4cac7] text-sm font-normal underline tracking-wide ml-1">
              Resend
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <Text className="text-red-500 mt-4 text-center">{error}</Text>
        )}

        <TouchableOpacity 
          className={`w-[343px] h-14 ${isCodeComplete ? 'bg-[#e4cac7]' : 'bg-[#827b85]'} rounded-[30px] shadow-md mt-10 justify-center items-center`}
          onPress={handleVerify}
          disabled={loading || !isCodeComplete}
        >
          <Text className="text-white text-base font-bold font-roboto">
            {loading ? 'Verifying...' : 'Verify'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="h-[21px] items-center justify-center mb-0">
        <View className="w-[139px] h-[5px] bg-black rounded-[100px]" />
      </View>
    </View>
  );
}