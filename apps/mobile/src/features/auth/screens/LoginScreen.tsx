import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, Image, Button, ActivityIndicator,
} from 'react-native'
import { useForm } from '@tanstack/react-form'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import EmailIcon from '@assets/icons/EmailIcon.svg'
import LockIcon from '@assets/icons/LockIcon.svg'
import ViewPasswordIcon from '@assets/icons/ViewPasswordIcon.svg'
import HidePasswordIcon from '@assets/icons/HidePasswordIcon.svg'
import GoogleLogo from '@assets/icons/GoogleLogo.svg'
import AppleIcon from '@assets/icons/AppleLogo.svg'
import type { AuthStackParamList } from '@navigation/types'
import { useAuth } from '../hooks/useAuth'
import Header from '@shared/components/Header'
import { useAlert } from '@shared/lib/AlertContext'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>
}

export default function LoginScreen({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const { showAlert } = useAlert()
  const { login, loginWithGoogle, loginWithApple } = useAuth()

  const form = useForm({
    defaultValues: {
      email: '',
      password: ''
    },
    onSubmit: async ({ value }) => {
      if (!value.email || !value.password) {
        showAlert('Please enter both email and password', { type: 'warning' });
        return;
      }

      login.mutate(
        { email: value.email, password: value.password },
        {
          onError: () => {
            // Error is already handled by the useAuth hook's onError, 
            // but if specific screen handling is needed, it can be done here.
            // For now, relying on the hook's alert.
          }
        }
      )
    }
  })

  return (
    <View style={{ flex: 1 }}>
      <Header height={140} showBackground={true} />
      <View className="flex-1 bg-[#DCDCDE] overflow-hidden">
        <Image
          source={require('@assets/DefaultBackground.png')}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
          resizeMode="cover"
        />
        <View className="flex-1 px-[26px]">
          <View className="h-[1px] bg-black/10 mb-[30px]" />

          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                if (!value) return 'Email is required';
                return undefined;
              }
            }}
          >
            {(field) => (
              <View className="mb-[29px]">
                <Text className="text-base font-roboto mb-[6px]">Email</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => emailInputRef.current?.focus()}
                  className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                >
                  <EmailIcon width={35} height={35} style={{ marginRight: 14 }} />
                  <TextInput
                    ref={emailInputRef}
                    onFocus={() => {
                      setIsEmailFocused(true);
                    }}
                    onBlur={() => {
                      setIsEmailFocused(false);
                      field.handleBlur();
                    }}
                    placeholder="johndoe@gmail.com"
                    placeholderTextColor="#C8C8C8"
                    className="flex-1 text-base font-roboto text-black outline-none"
                    style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
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

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => {
                if (!value) return 'Password is required';
                return undefined;
              }
            }}
          >
            {(field) => (
              <View>
                <Text className="text-base font-roboto mb-[6px]">Your Password</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => passwordInputRef.current?.focus()}
                  className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                >
                  <LockIcon width={35} height={35} style={{ marginRight: 14 }} />
                  <TextInput
                    ref={passwordInputRef}
                    onFocus={() => {
                      setIsPasswordFocused(true);
                    }}
                    onBlur={() => {
                      setIsPasswordFocused(false);
                      field.handleBlur();
                    }}
                    secureTextEntry={!showPassword}
                    className="flex-1 text-base font-roboto pr-[30px] outline-none"
                    style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                    value={field.state.value}
                    onChangeText={field.handleChange}
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
                {field.state.meta.errors.length > 0 && (
                  <Text className="text-red-500 text-xs mt-1">
                    {field.state.meta.errors.join(', ')}
                  </Text>
                )}
                <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text className="text-xs font-roboto underline mt-[12px]">Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            )}
          </form.Field>

          {login.isError && (
            <Text className="text-red-500 text-xs mt-2 mb-4 text-center">
              {"Incorrect Username or Password"}
            </Text>
          )}

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isFormSubmitting]) => (
              <TouchableOpacity
                className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[40px]"
                onPress={() => form.handleSubmit()}
                disabled={!canSubmit || isFormSubmitting || login.isPending}
              >
                {isFormSubmitting || login.isPending ? (
                  <View className="flex-row justify-center items-center">
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-base font-bold font-roboto ml-2">Logging in...</Text>
                  </View>
                ) : (
                  <Text className="text-base font-bold font-roboto text-center">
                    Log In
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </form.Subscribe>

          <View className="w-80 h-0 outline outline-1 outline-neutral-500 mt-[29px] self-center opacity-50" />

          <TouchableOpacity
            onPress={() => loginWithGoogle.mutate()}
            disabled={loginWithGoogle.isPending}
            className={`bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px] mt-[29px] ${loginWithGoogle.isPending ? 'opacity-50' : ''}`}
          >
            {loginWithGoogle.isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <GoogleLogo width={24} height={24} style={{ marginRight: 16 }} />
                <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
                  Sign In with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple login button */}
          <TouchableOpacity
            onPress={() => loginWithApple.mutate()}
            disabled={loginWithApple.isPending}
            className={`bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px] ${loginWithApple.isPending ? 'opacity-50' : ''}`}
          >
            {loginWithApple.isPending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <AppleIcon width={24} height={24} style={{ marginRight: 16 }} />
                <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
                  Sign In with Apple
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View className="items-center">
            <Text className="text-base font-roboto mb-[5px]">Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                Register
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}