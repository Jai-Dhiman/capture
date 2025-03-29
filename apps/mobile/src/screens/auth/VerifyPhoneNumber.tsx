import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import Header from '../../components/ui/Header';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from 'components/ui/LoadingSpinner';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';
import { useAuth } from 'hooks/auth/useAuth';
import { authState } from '../../stores/authState';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'VerifyPhoneNumber'>
}

export default function PhoneVerificationScreen({ navigation }: Props) {
  // State for verification process
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState('');
  
  // References
  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);
  
  // Store hooks
  const { user, session, simulatePhoneVerification } = useAuthStore(); 
  const { sendOTP, verifyOTP } = useAuth();
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
      if (!codeSent) {
        handleSendCode(value.phone);
      } else {
        handleVerifyCode(value.code.join(''));
      }
    }
  });
  
  // Debug function to bypass phone verification
  const handleDebugBypass = () => {
    // Get the current phone number or use a dummy one
    const phone = formattedPhone || '+15555555555';
    
    // Update the user state with simulated verification
    simulatePhoneVerification();
    
    // Update auth state to mark verification as complete
    authState.setPhoneVerified(phone.replace('+1', ''));
    authState.setAuthStage('complete');
    
    // Complete the onboarding step
    completeStep('phone-verification');
    
    // Show a success message
    showAlert('DEBUG: Phone verification bypassed', { type: 'success' });
    
    // Navigate to the next screen
    navigation.navigate('CreateProfile');
  };

  // Send verification code
  const handleSendCode = async (phone: string) => {
    if (!phone || phone.length < 10) {
      showAlert('Please enter a valid 10-digit phone number', { type: 'warning' });
      return;
    }

    setSendingCode(true);
    try {
      const formatted = `+1${phone.replace(/\D/g, '')}`;  
      setFormattedPhone(formatted);
      
      if (session?.access_token) {
        await sendOTP.mutateAsync({ 
          phone: formatted, 
          token: session.access_token 
        });
      } else {
        throw new Error("No active session");
      }
      
      // Update state to show verification code inputs
      setCodeSent(true);
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
      await verifyOTP.mutateAsync({ phone: formattedPhone, code });
      
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
      
      if (session?.access_token) {
        await sendOTP.mutateAsync({ 
          phone: formattedPhone, 
          token: session.access_token 
        });
      } else {
        throw new Error("No active session");
      }

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 bg-zinc-300 overflow-hidden">
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />

          <Header 
            showBackButton
            onBackPress={() => navigation.goBack()}
          />

          <View className="flex-1 px-4 items-center">
            {/* Title Area */}
            <View className="w-full bg-zinc-500 rounded-[10px] mt-6 py-4 px-3">
              <Text className="text-center text-white text-2xl font-medium font-roboto leading-loose tracking-wide">
                Let's Verify Your Phone
              </Text>
              <Text className="text-center text-white text-xs font-normal font-roboto tracking-tight mt-2">
                Enter your phone number below so we can send you a 6-digit verification code
              </Text>
            </View>

            {/* Phone Input */}
            <View className="w-full mt-5">
              <form.Field name="phone">
                {(field) => (
                  <TouchableOpacity 
                    activeOpacity={1}
                    onPress={() => phoneInputRef.current?.focus()}
                    className="h-14 bg-white rounded-2xl shadow-md w-full mb-4"
                  >
                    <View className="w-14 h-14 absolute left-0 top-0 bg-white rounded-tl-2xl rounded-bl-2xl border-[0.50px] border-stone-300 justify-center items-center">
                      <Text className="text-black text-xl font-normal font-roboto">+1</Text>
                    </View>
                    <TextInput
                      ref={phoneInputRef}
                      onFocus={() => setIsPhoneFocused(true)}
                      onBlur={() => {
                        setIsPhoneFocused(false);
                        field.handleBlur();
                      }}
                      className="absolute left-16 top-0 right-3 h-14 text-base font-semibold font-roboto"
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      keyboardType="phone-pad"
                      placeholder="Phone Number"
                      placeholderTextColor="#c7c7c7"
                      maxLength={10} // Ensure 10 digits can be entered
                      editable={!codeSent || !formattedPhone}
                    />
                  </TouchableOpacity>
                )}
              </form.Field>
            </View>

            {/* Verification Code Input */}
            <View className="w-full mt-4">
              <form.Field name="code">
                {(field) => (
                  <View className="flex-row justify-center items-center gap-[5px] mt-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <TextInput
                        key={index}
                        ref={(ref) => (codeInputRefs.current[index] = ref)}
                        className="w-12 h-11 px-3 py-2.5 bg-white rounded-md outline outline-1 outline-offset-[-1px] outline-slate-300 justify-center items-center text-center"
                        value={field.state.value[index]}
                        onChangeText={(text) => handleCodeChange(text, index)}
                        onKeyPress={(e) => handleKeyDown(e, index)}
                        maxLength={1}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        placeholder="-"
                        placeholderTextColor="#94a3b8"
                      />
                    ))}
                  </View>
                )}
              </form.Field>
            </View>

            {/* Instructions */}
            <View className="w-full mt-4">
              <Text className="text-center text-white text-xs font-light font-roboto tracking-tight">
                If you are having trouble receiving the SMS, ensure you have entered the correct Country Code, 
                Area Code, and digits. If you continue to have problems reach out to captureapp@support.com
              </Text>
            </View>

            {/* Resend Link (Only shown when code has been sent) */}
            {codeSent && (
              <View className="flex-row justify-center mt-6">
                <Text className="text-black text-sm font-normal tracking-wide">
                  Didn't receive the code?
                </Text>
                <TouchableOpacity onPress={handleResendCode} disabled={countdown > 0 || sendingCode}>
                  <Text className={`${countdown > 0 ? 'text-gray-400' : 'text-blue-600'} text-sm font-normal underline tracking-wide ml-1`}>
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity 
              className="h-14 w-4/5 bg-zinc-500 rounded-[30px] shadow-md mt-8 justify-center items-center absolute bottom-24"
              onPress={() => form.handleSubmit()}
              disabled={isLoading || sendingCode || (codeSent && form.getFieldValue('code').some(digit => !digit))}
            >
              {isLoading || sendingCode ? (
                <LoadingSpinner message={sendingCode ? "Sending..." : "Verifying..."} />
              ) : (
                <Text className="text-center text-white text-base font-bold font-roboto leading-normal">
                  {codeSent ? "Verify Code" : "Send Code"}
                </Text>
              )}
            </TouchableOpacity>
            
            {/* Debug Button - For testing only */}
            <TouchableOpacity 
              className="h-10 w-4/5 bg-red-400 rounded-[30px] shadow-md justify-center items-center absolute bottom-10"
              onPress={handleDebugBypass}
            >
              <Text className="text-center text-white text-xs font-bold font-roboto leading-normal">
                DEBUG: Skip Verification
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Indicator */}
          <View className="h-5 items-center justify-center mb-2">
            <View className="w-36 h-[5px] bg-black rounded-[100px]" />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}