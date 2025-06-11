import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, Image, ActivityIndicator,
} from 'react-native'
import { useForm } from '@tanstack/react-form'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import EmailIcon from '@assets/icons/EmailIcon.svg'
import GoogleLogo from '@assets/icons/GoogleLogo.svg'
import AppleIcon from '@assets/icons/AppleLogo.svg'
import type { AuthStackParamList } from '@/navigation/types'
import { useAuth } from '../hooks/useAuth'
import Header from '@/shared/components/Header'
import { useAlert } from '@/shared/lib/AlertContext'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>
}

export default function LoginScreen({ navigation }: Props) {
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const emailInputRef = useRef<TextInput>(null)
  const { showAlert } = useAlert()
  const { sendCode, loginWithGoogle, loginWithApple } = useAuth()

  const form = useForm({
    defaultValues: {
      email: '',
      phone: ''
    },
    onSubmit: async ({ value }) => {
      if (!value.email) {
        showAlert('Please enter your email address', { type: 'warning' })
        return
      }

      sendCode.mutate(
        {
          email: value.email,
          phone: value.phone || undefined
        },
        {
          onSuccess: (response) => {
            navigation.navigate('CodeVerification', {
              email: value.email,
              phone: value.phone || undefined,
              isNewUser: response.isNewUser,
              message: response.message,
            })
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
                if (!value) return 'Email is required'
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format'
                return undefined
              }
            }}
          >
            {(field) => (
              <View className="mb-[24px]">
                <Text className="text-base font-roboto mb-[6px]">Email</Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => emailInputRef.current?.focus()}
                  className={`bg-white h-[60px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                >
                  <EmailIcon width={35} height={35} style={{ marginRight: 14 }} />
                  <TextInput
                    ref={emailInputRef}
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => {
                      setIsEmailFocused(false)
                      field.handleBlur()
                    }}
                    placeholder="johndoe@gmail.com"
                    placeholderTextColor="#C8C8C8"
                    className="flex-1 text-base font-roboto text-black outline-none"
                    style={{ paddingVertical: 0, textAlignVertical: 'center', height: '100%' }}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoFocus
                  />
                </TouchableOpacity>
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <Text className="text-red-500 text-xs mt-1 ml-2 font-roboto">
                    {field.state.meta.errors.join(', ')}
                  </Text>
                )}
              </View>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isFormSubmitting]) => (
              <TouchableOpacity
                className={`h-[56px] ${canSubmit ? 'bg-[#E4CAC7]' : 'bg-stone-300'} rounded-[30px] shadow-md justify-center items-center`}
                onPress={() => form.handleSubmit()}
                disabled={!canSubmit || isFormSubmitting || sendCode.isPending}
              >
                {isFormSubmitting || sendCode.isPending ? (
                  <View className="flex-row justify-center items-center">
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-base font-bold font-roboto ml-2">Sending code...</Text>
                  </View>
                ) : (
                  <Text className="text-base font-bold font-roboto text-center">
                    Sign In
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

          <View className="items-center mt-4">
            <Text className="text-xs text-center text-gray-500 font-roboto">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}