import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
} from 'react-native'
import { useAuth } from 'hooks/useAuth'

export const LoginScreen = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn, isPending, error } = useAuth()

  const handleLogin = () => {
    signIn(
      { email, password },
      {
        onError: (error) => {
          Alert.alert('Error', error.message)
        },
      }
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#DCDCDE]">
      <Image 
        source={require('../assets/Fluid Background Coffee.png')}
        className="absolute w-full h-full"
      />
      
      <View className="flex-1 p-5">
        <Text className="text-4xl font-roboto text-center my-8">Capture</Text>
        
        <View className="h-[1px] bg-black/10 my-5" />

        <View className="mb-5">
          <Text className="text-base font-roboto mb-2">Email</Text>
          <View className="bg-white rounded-2xl p-4 shadow-md flex-row items-center">
            <Image
              source={require('../assets/icons/Email Icon.svg')}
              className="w-6 h-6 mr-2"
            />
            <TextInput
              placeholder="johndoe@icloud.com"
              className="flex-1 text-base font-roboto"
              placeholderTextColor="#C8C8C8"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>

        <View className="mb-5">
          <Text className="text-base font-roboto mb-2">Password</Text>
          <View className="bg-white rounded-2xl p-4 shadow-md flex-row items-center">
            <Image
              source={require('../assets/icons/Lock Icon.svg')}
              className="w-6 h-6 mr-2"
            />
            <TextInput
              secureTextEntry={!showPassword}
              className="flex-1 text-base font-roboto"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Image 
                source={showPassword ? 
                  require('../assets/icons/View Password Icon.svg') :
                  require('../assets/icons/Dont Show Passoword Icon.svg')}
                className="w-6 h-6 ml-2"
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity>
            <Text className="text-xs underline mt-2">Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          className="bg-[#E4CAC7] rounded-3xl p-4 items-center shadow-md my-5"
          onPress={handleLogin}
          disabled={isPending}
        >
          <Text className="text-base font-bold font-roboto">
            {isPending ? 'Loading...' : 'Login'}
          </Text>
        </TouchableOpacity>

        <View className="h-[1px] bg-black/10 my-5" />

        <TouchableOpacity className="bg-white rounded-3xl p-4 items-center shadow-md my-2.5">
          <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
            Sign In with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity className="bg-white rounded-3xl p-4 items-center shadow-md my-2.5">
          <Text className="text-base font-bold font-roboto text-[#1C1C1C]">
            Sign In with Apple
          </Text>
        </TouchableOpacity>

        <View className="items-center mt-5">
          <Text className="text-base font-roboto mb-2">Don't have an account?</Text>
          <TouchableOpacity>
            <Text className="text-base font-semibold font-roboto text-[#827B85] underline">
              Register
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}