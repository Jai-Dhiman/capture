import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform
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
import { authState } from 'stores/authState';

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
  const [isPhoneComplete, setIsPhoneComplete] = useState(false);
  const [isCodeComplete, setIsCodeComplete] = useState(false);

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
      setIsPhoneComplete(phoneWithoutCode.length === 10);
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

      // Check if error is Twilio-related to make it persistent
      const isTwilioError = formattedError.message.toLowerCase().includes('twilio') ||
        formattedError.code.includes('otp');

      showAlert(formattedError.message, {
        type: alertType,
        duration: isTwilioError ? undefined : 3000, // undefined makes it persist until dismissed
        action: isTwilioError ? {
          label: 'Dismiss',
          onPress: () => { }
        } : undefined
      });
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

      const isTwilioError = formattedError.message.toLowerCase().includes('twilio')
        || formattedError.code.includes('verify')
        || formattedError.code.includes('otp');

      showAlert(formattedError.message, {
        type: alertType,
        duration: isTwilioError ? undefined : 3000,
        action: isTwilioError ? {
          label: 'Dismiss',
          onPress: () => { }
        } : undefined
      });
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

      const isTwilioError = formattedError.message.toLowerCase().includes('twilio') || formattedError.code.includes('otp');

      showAlert(formattedError.message, {
        type: alertType,
        duration: isTwilioError ? undefined : 3000,
        action: isTwilioError ? {
          label: 'Dismiss',
          onPress: () => { }
        } : undefined
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    if (!/^\d*$/.test(text)) return;

    const newCode = [...form.getFieldValue('code')];
    newCode[index] = text;
    form.setFieldValue('code', newCode);

    // Check if all 6 digits are filled
    setIsCodeComplete(newCode.every(digit => digit !== ''));

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

  const handlePhoneChange = (text: string) => {
    // Update the phone field
    form.setFieldValue('phone', text);
    // Check if phone is complete (10 digits)
    setIsPhoneComplete(text.length === 10);
  };

  const handleDevSkip = () => {
    if (user) {
      const phoneToUse = formattedPhone || '+15555555555';

      authState.setUser({
        ...user,
        phone: phoneToUse,
        phone_confirmed_at: new Date().toISOString(),
      });

      showAlert('DEV MODE: Phone verification bypassed', {
        type: 'success',
        duration: 2000
      });

      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } else {
      showAlert('No active session', { type: 'error' });
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
        <View className="flex-1 bg-[#DCDCDE]">
          <Header
            showBackButton
            onBackPress={() => navigation.goBack()}
            showBackground={false}
          />

          <View className="flex-1 px-4 items-center pt-6">
            <View className="w-full bg-zinc-500 rounded-[10px] py-4 px-3 mb-6">
              <Text className="text-center text-white text-2xl font-medium font-roboto leading-loose tracking-wide">
                Let's Verify Your Phone
              </Text>
              <Text className="text-center text-white text-xs font-normal font-roboto tracking-tight mt-2">
                Enter your phone number below so we can send you a 6-digit verification code
              </Text>
            </View>

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
                      onChangeText={handlePhoneChange}
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

            {codeSent && (
              <View className="w-full mt-4 bg-zinc-500 rounded-[10px] py-8 px-4">
                <Text className="text-center text-white text-sm mb-4">
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

                <View className="flex-row justify-center mt-6">
                  <Text className="text-white text-sm font-normal tracking-wide">
                    Didn't receive the code?
                  </Text>
                  <TouchableOpacity onPress={handleResendCode} disabled={countdown > 0 || sendingCode}>
                    <Text className={`${countdown > 0 ? 'text-gray-400' : 'text-blue-200'} text-sm font-normal underline tracking-wide ml-1`}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View className="w-full mt-4">
              <Text className="text-center text-white text-xs font-light font-roboto tracking-tight">
                If you are having trouble receiving the SMS, ensure you have entered the correct Country Code,
                Area Code, and digits. If you continue to have problems reach out to captureapp@support.com
              </Text>
            </View>

            <TouchableOpacity
              className={`h-14 w-4/5 ${(codeSent && isCodeComplete) || (!codeSent && isPhoneComplete)
                ? 'bg-[#E4CAC7]'
                : 'bg-zinc-500'
                } rounded-[30px] shadow-md mt-8 justify-center items-center`}
              onPress={() => form.handleSubmit()}
              disabled={isLoading || sendingCode || (codeSent && !isCodeComplete) || (!codeSent && !isPhoneComplete)}
            >
              {isLoading || sendingCode ? (
                <LoadingSpinner message={sendingCode ? "Sending..." : "Verifying..."} />
              ) : (
                <Text className={`text-center ${(codeSent && isCodeComplete) || (!codeSent && isPhoneComplete)
                  ? 'text-black'
                  : 'text-white'
                  } text-base font-bold font-roboto leading-normal`}>
                  {codeSent ? "Verify Code" : "Send Code"}
                </Text>
              )}
            </TouchableOpacity>
            {__DEV__ && (
              <TouchableOpacity
                className="h-10 w-4/5 bg-yellow-300 rounded-[15px] mt-4 justify-center items-center border-2 border-red-500"
                onPress={handleDevSkip}
              >
                <Text className="text-center text-red-600 text-sm font-bold font-roboto">
                  DEV: Skip Verification
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

  );
}