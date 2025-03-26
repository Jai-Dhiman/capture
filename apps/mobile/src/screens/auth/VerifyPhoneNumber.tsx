import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, ScrollView
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import Header from '../../components/ui/Header';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from 'components/ui/LoadingSpinner';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'EnterPhone'>
}

enum VerificationStep {
  ENTER_PHONE,
  ENTER_CODE
}

export default function PhoneVerificationScreen({ navigation }: Props) {
  const [verificationStep, setVerificationStep] = useState<VerificationStep>(VerificationStep.ENTER_PHONE);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState('');
  
  // References
  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);
  
  // State
  const { user, setUser, setOtpMessageId } = useAuthStore();
  const { completeStep } = useOnboardingStore();
  const { showAlert } = useAlert();

  // Start countdown for resend code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Form setup with TanStack Form
  const form = useForm({
    defaultValues: {
      phone: '',
      code: ['', '', '', '', '', '']
    },
    onSubmit: async ({ value }) => {
      if (verificationStep === VerificationStep.ENTER_PHONE) {
        handleSendCode(value.phone);
      } else {
        handleVerifyCode(value.code.join(''));
      }
    }
  });

  // Send verification code
  const handleSendCode = async (phone: string) => {
    if (!phone || phone.length < 10) {
      showAlert('Please enter a valid phone number', { type: 'warning' });
      return;
    }

    setSendingCode(true);
    try {
      const formatted = `+1${phone.replace(/\D/g, '')}`;  
      setFormattedPhone(formatted);
      
      const { error } = await supabase.auth.updateUser({
        phone: formatted
      });
      
      if (error) throw error;

      const { error: otpError, data } = await supabase.auth.signInWithOtp({
        phone: formatted,
      });
      
      if (otpError) throw otpError;
      
      if (user) {
        setUser({
          ...user,
          phone: formatted
        });
      }
      
      if (data?.messageId) {
        setOtpMessageId(data.messageId);
      }
      
      // Move to verification code step
      setVerificationStep(VerificationStep.ENTER_CODE);
      setCountdown(60); // Start countdown for resend
      
      // Focus the first input field
      setTimeout(() => {
        codeInputRefs.current[0]?.focus();
      }, 100);
      
    } catch (error) {
      const formattedError = errorService.handleAuthError(error);
      const alertType = errorService.getAlertType(formattedError.category);
      showAlert(formattedError.message, { type: alertType });
    } finally {
      setSendingCode(false);
    }
  };

  // Verify the OTP code
  const handleVerifyCode = async (code: string) => {
    if (!code || code.length !== 6) {
      showAlert('Please enter the complete 6-digit code', { type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: 'sms'
      });
      
      if (error) throw error;
      
      completeStep('phone-verification');
      navigation.navigate('CreateProfile');
    } catch (error) {
      const formattedError = errorService.handleAuthError(error);
      const alertType = errorService.getAlertType(formattedError.category);
      showAlert(formattedError.message, { type: alertType });
    } finally {
      setIsLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    try {
      setSendingCode(true);
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });
      
      if (error) throw error;

      setCountdown(60);
      showAlert('A new verification code has been sent to your phone number.', { type: 'success' });
    } catch (error) {
      const formattedError = errorService.handleAuthError(error);
      const alertType = errorService.getAlertType(formattedError.category);
      showAlert(formattedError.message, { type: alertType });
    } finally {
      setSendingCode(false);
    }
  };

  // Handle code input changes
  const handleCodeChange = (text: string, index: number) => {
    if (!/^\d*$/.test(text)) return;
    
    // Update the code in the form
    const newCode = [...form.getFieldValue('code')];
    newCode[index] = text;
    form.setFieldValue('code', newCode);
    
    // Auto-advance to next field
    if (text && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace key in code inputs
  const handleKeyDown = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const newCode = [...form.getFieldValue('code')];
      
      // If current field is already empty and we're not at the first field, move focus back
      if (!newCode[index] && index > 0) {
        codeInputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />

          <Header 
            showBackButton
            onBackPress={() => {
              if (verificationStep === VerificationStep.ENTER_CODE) {
                setVerificationStep(VerificationStep.ENTER_PHONE);
              } else {
                navigation.goBack();
              }
            }}
          />

          <View className="flex-1 px-5 items-center">
            {verificationStep === VerificationStep.ENTER_PHONE ? (
              <>
                <Text className="text-[32px] font-roboto text-center mt-12 mb-6">
                  Enter Your Phone Number
                </Text>
                
                <Text className="text-base font-roboto text-center mb-8">
                  We'll send a verification code to this number to confirm your identity.
                </Text>

                <form.Field name="phone">
                  {(field) => (
                    <View className="mb-8 w-full items-center">
                      <TouchableOpacity 
                        activeOpacity={1}
                        onPress={() => phoneInputRef.current?.focus()}
                        className="h-[55px] bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] w-full"
                      >
                        <View className="w-[55px] h-[55px] absolute left-0 top-0 bg-white border border-[#c7c7c7] rounded-l-2xl" />
                        <Text className="absolute left-[16px] top-[18px] text-xl font-roboto">+1</Text>
                        <TextInput
                          ref={phoneInputRef}
                          onFocus={() => setIsPhoneFocused(true)}
                          onBlur={() => {
                            setIsPhoneFocused(false);
                            field.handleBlur();
                          }}
                          className="absolute left-[65px] top-[20px] right-[12px] text-base font-semibold font-roboto"
                          value={field.state.value}
                          onChangeText={field.handleChange}
                          keyboardType="phone-pad"
                          placeholder="Phone Number"
                          placeholderTextColor="#c7c7c7"
                          maxLength={10}
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

                <TouchableOpacity
                  className="h-14 bg-[#e4cac7] rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] backdrop-blur-sm justify-center items-center mt-4 w-full"
                  onPress={() => form.handleSubmit()}
                  disabled={sendingCode}
                >
                  {sendingCode ? (
                    <LoadingSpinner message="Sending verification code..." />
                  ) : (
                    <Text className="text-center text-black text-base font-bold font-roboto leading-normal">
                      Send Verification Code
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              // Code verification UI
              <>
                <View className="w-full bg-[#827b85] rounded-[10px] mt-6 items-center justify-center p-4">
                  <Text className="text-white text-2xl font-medium font-roboto tracking-wide text-center">
                    Verify Your Phone Number
                  </Text>
                  <Text className="text-white text-[13px] font-normal font-roboto tracking-tight text-center mt-2">
                    We've sent a 6-digit code to {formattedPhone || 'your number'}, please enter the code below
                  </Text>
                </View>

                <View className="w-full bg-[#827b85] rounded-[10px] mt-3 items-center p-6">
                  <Text className="text-white text-base font-roboto mb-4">Enter verification code:</Text>
                  
                  <form.Field name="code">
                    {(field) => (
                      <View className="flex-row justify-center items-center gap-2 mt-4">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <TextInput
                            key={index}
                            ref={(ref) => (codeInputRefs.current[index] = ref)}
                            className="w-12 h-12 bg-white rounded-md border border-[#cbd2e0] justify-center items-center text-center text-xl font-medium"
                            value={field.state.value[index]}
                            onChangeText={(text) => handleCodeChange(text, index)}
                            onKeyPress={(e) => handleKeyDown(e, index)}
                            maxLength={1}
                            keyboardType="number-pad"
                            selectTextOnFocus
                          />
                        ))}
                      </View>
                    )}
                  </form.Field>

                  <Text className="text-white text-xs font-light font-roboto tracking-tight text-center mt-8">
                    If you are having trouble receiving the SMS, ensure you have entered the correct Country Code, 
                    Area Code, and digits. If you continue to have problems reach out to support.
                  </Text>
                </View>

                <View className="flex-row justify-center mt-4">
                  <Text className="text-black text-sm font-normal tracking-wide">
                    Didn't receive the code?
                  </Text>
                  <TouchableOpacity onPress={handleResendCode} disabled={countdown > 0 || sendingCode}>
                    <Text className={`${countdown > 0 ? 'text-gray-400' : 'text-[#e4cac7]'} text-sm font-normal underline tracking-wide ml-1`}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  className="w-full h-14 bg-[#e4cac7] rounded-[30px] shadow-md mt-10 justify-center items-center"
                  onPress={() => form.handleSubmit()}
                  disabled={isLoading || form.getFieldValue('code').some(digit => !digit)}
                >
                  {isLoading ? (
                    <LoadingSpinner message="Verifying..." />
                  ) : (
                    <Text className="text-black text-base font-bold font-roboto">
                      Verify
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          <View className="h-[21px] items-center justify-center mb-2">
            <View className="w-[139px] h-[5px] bg-black rounded-[100px]" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}