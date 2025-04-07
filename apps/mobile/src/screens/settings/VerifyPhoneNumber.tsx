import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Image, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useForm } from '@tanstack/react-form';
import { SettingsStackParamList } from '../../components/Navigators/types/navigation';
import Header from '../../components/ui/Header';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from 'components/ui/LoadingSpinner';
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';
import { useAuth } from 'hooks/auth/useAuth';
import { authState } from '../../stores/authState';

type Props = {
  navigation: NativeStackNavigationProp<SettingsStackParamList, 'VerifyPhone'>
}

export default function VerifyPhoneScreen({ navigation }: Props) {
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState('');
  
  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);
  
  const { user, session } = useAuthStore(); 
  const { sendOTP, verifyOTP } = useAuth();
  const { showAlert } = useAlert();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (user?.phone) {
      const phoneWithoutCode = user.phone.replace('+1', '');
      form.setFieldValue('phone', phoneWithoutCode);
    }
  }, [user]);

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
      
      setCodeSent(true);
      setCountdown(60);
      
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

  const handleVerifyCode = async (code: string) => {
    if (!code || code.length !== 6) {
      showAlert('Please enter the complete 6-digit code', { type: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      await verifyOTP.mutateAsync({ phone: formattedPhone, code });
      
      showAlert('Phone number verified successfully!', { type: 'success' });
      navigation.goBack();
    } catch (error) {
      const formattedError = errorService.handleAuthError(error);
      const alertType = errorService.getAlertType(formattedError.category);
      showAlert(formattedError.message, { type: alertType });
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleCodeChange = (text: string, index: number) => {
    if (!/^\d*$/.test(text)) return;
    
    const newCode = [...form.getFieldValue('code')];
    newCode[index] = text;
    form.setFieldValue('code', newCode);
    
    if (text && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const newCode = [...form.getFieldValue('code')];
      
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
        <View className="flex-1 bg-white">
          <Header 
            showBackButton
            onBackPress={() => navigation.goBack()}
          />

          <View className="flex-1 px-4 items-center pt-6">
            {/* Title Area */}
            <View className="w-full bg-zinc-200 rounded-[10px] py-4 px-3 mb-6">
              <Text className="text-center text-black text-lg font-medium font-roboto leading-loose tracking-wide">
                Phone Verification
              </Text>
              <Text className="text-center text-black text-xs font-normal font-roboto tracking-tight mt-2">
                Phone verification helps keep our community safe and enables you to create content
              </Text>
            </View>

            {/* Phone Input */}
            <View className="w-full">
              <form.Field name="phone">
                {(field) => (
                  <TouchableOpacity 
                    activeOpacity={1}
                    onPress={() => phoneInputRef.current?.focus()}
                    className="h-14 bg-white rounded-2xl shadow-md w-full mb-4 border border-gray-200"
                  >
                    <View className="w-14 h-14 absolute left-0 top-0 bg-white rounded-tl-2xl rounded-bl-2xl border-r-[0.50px] border-stone-300 justify-center items-center">
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
                      maxLength={10}
                      editable={!codeSent || !formattedPhone}
                    />
                  </TouchableOpacity>
                )}
              </form.Field>
            </View>

            {/* Verification Code Input */}
            {codeSent && (
              <View className="w-full mt-4">
                <Text className="text-center text-gray-700 text-sm mb-3">
                  Enter the 6-digit code sent to your phone
                </Text>
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
            )}

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
              className="h-14 w-4/5 bg-zinc-500 rounded-[30px] shadow-md mt-8 justify-center items-center"
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
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}