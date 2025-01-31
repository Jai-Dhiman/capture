import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'

type Props = {
  navigation: NativeStackNavigationProp<any>
}

export default function SignupScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isEmailFocused, setIsEmailFocused] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)

  const handleSignup = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      const token = data.session?.access_token
      const response = await fetch('http://localhost:8787/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to create profile')
      }

      Alert.alert('Success!', 'Check your email for confirmation.')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      Alert.alert('Error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#DCDCDE] rounded-[30px] overflow-hidden">
      <Image
        source={require('../assets/Fluid Background Coffee.png')}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        resizeMode="cover"
      />
      <View className="flex-1 px-[26px]">
        <Text className="text-[40px] font-roboto font-light text-center mt-[84px] mb-[26px]">
          Capture
        </Text>
        <View className="h-[1px] bg-black/10 mb-[30px]" />

        <View className="mb-[29px]">
          <Text className="text-base font-roboto mb-[6px]">Email</Text>
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => emailInputRef.current?.focus()}
            className={`bg-white h-[56px] rounded-[16px] shadow-md flex-row items-center px-[9px] ${isEmailFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
          >
            <Image
              source={require('../assets/icons/Email Icon.svg')}
              style={{ width: 35, height: 35, marginRight: 14 }}
              resizeMode="contain"
            />
            <TextInput
              ref={emailInputRef}
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
              placeholder="johndoe@gmail.com"
              placeholderTextColor="#C8C8C8"
              className="flex-1 text-base font-roboto text-black outline-none"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </TouchableOpacity>
        </View>

        <View>
          <Text className="text-base font-roboto mb-[6px]">Password</Text>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => passwordInputRef.current?.focus()}
            className={`bg-white h-[55px] rounded-[16px] shadow-md flex-row items-center px-[9px] relative ${isPasswordFocused ? 'border-2 border-[#E4CAC7]' : ''}`}
          >
            <Image
              source={require('../assets/icons/Lock Icon.svg')}
              style={{ width: 35, height: 35, marginRight: 14 }}
              resizeMode="contain"
            />
            <TextInput
              ref={passwordInputRef}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              secureTextEntry={!showPassword}
              className="flex-1 text-base font-roboto pr-[30px] outline-none"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity 
              className="absolute right-[9px]"
              onPress={() => setShowPassword(!showPassword)}
            >
              <Image
                source={showPassword ? require('../assets/icons/View Password Icon.svg') : require('../assets/icons/Dont Show Passoword Icon.svg')}
                style={{ width: 25, height: 25 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="bg-[#E4CAC7] h-[56px] rounded-[30px] shadow-md justify-center mt-[59px]"
          onPress={handleSignup}
          disabled={loading}
        >
          <Text className="text-base font-bold font-roboto text-center">
            {loading ? 'Loading...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <View className="h-[1px] bg-[#7B7B7B] my-[29px]" />

        <TouchableOpacity className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center mb-[23px]">
          <Image
            source={require('../assets/icons/google.svg')}
            style={{ width: 24, height: 24, marginRight: 7 }}
            resizeMode="contain"
          />
          <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
            Sign Up with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity className="bg-white h-[56px] rounded-[30px] shadow-md flex-row items-center justify-center">
          <Image
            source={require('../assets/icons/apple.svg')}
            style={{ width: 24, height: 24, marginRight: 7 }}
            resizeMode="contain"
          />
          <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
            Sign Up with Apple
          </Text>
        </TouchableOpacity>

        <View className="items-center mt-[32px]">
          <Text className="text-base font-roboto mb-[5px]">Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
              Login
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}