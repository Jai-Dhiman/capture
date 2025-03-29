import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, Image, ScrollView,
  Button,
} from 'react-native'
import { useForm } from '@tanstack/react-form'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import EmailIcon from '../../../assets/icons/EmailIcon.svg'
import LockIcon from '../../../assets/icons/LockIcon.svg'
import ViewPasswordIcon from '../../../assets/icons/ViewPasswordIcon.svg'
import HidePasswordIcon from '../../../assets/icons/HidePasswordIcon.svg'
import { AuthStackParamList } from '../../components/Navigators/types/navigation'
import { useAuth } from '../../hooks/auth/useAuth'
import { LoadingSpinner } from 'components/ui/LoadingSpinner'
import OAuth from '../../components/providers/OAuth';
import Header from 'components/ui/Header'
import { useAlert } from '../../lib/AlertContext';
import { errorService } from '../../services/errorService';
import * as Sentry from '@sentry/react-native'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>
}

export default function LoginScreen({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const {showAlert} = useAlert()
  const { login } = useAuth()

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
        onError: (error) => {
          const formattedError = errorService.handleAuthError(error);
          const alertType = errorService.getAlertType(formattedError.category);
          showAlert(formattedError.message, { type: alertType });
        }
      }
    )
  }
})

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ width: '100%', height: '100%', position: 'absolute' }}
            resizeMode="cover"
          />
          <View className="flex-1 px-[26px]">
            <Header />
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
                    className={`bg-white h-[56px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  >
                    <EmailIcon width={35} height={35} style={{ marginRight: 14 }} />
                    <TextInput
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
                    className={`bg-white h-[55px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
                  >
                    <LockIcon width={35} height={35} style={{ marginRight: 14 }} />
                    <TextInput
                      onFocus={() => {
                        setIsPasswordFocused(true);
                      }}
                      onBlur={() => {
                        setIsPasswordFocused(false);
                        field.handleBlur();
                      }}
                      secureTextEntry={!showPassword}
                      className="flex-1 text-base font-roboto pr-[30px] outline-none"
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

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <TouchableOpacity
                  className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[59px]"
                  onPress={() => form.handleSubmit()}
                  disabled={login.isPending || isSubmitting}
                >
                  {login.isPending ? (
                    <LoadingSpinner fullScreen message="Logging in..." />
                  ) : (
                    <Text className="text-base font-bold font-roboto text-center">
                      Log In
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </form.Subscribe>

            <View className="h-[1px] bg-[#7B7B7B] my-[29px]" />
            <OAuth />
            <View className="h-[1px] bg-[#7B7B7B] my-[29px]" />

            <View className="items-center mt-[32px]">
              <Text className="text-base font-roboto mb-[5px]">Don't have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
                  Register
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}