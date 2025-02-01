import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as SecureStore from 'expo-secure-store'

type Props = {
  navigation: NativeStackNavigationProp<any>
}

export default function SignupScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)

  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Temporary authentication bypass for testing
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate async operation
      navigation.navigate('VerifyPhoneNumber');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Navigation failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 p-5 justify-center">
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        className="h-12 border border-gray-300 rounded-lg px-4 mb-4 text-base"
      />
      <View className="relative">
        <TextInput
          ref={passwordInputRef}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          className="h-12 border border-gray-300 rounded-lg px-4 mb-4 text-base"
        />
        <TouchableOpacity
          className="absolute right-2 top-2"
          onPress={() => setShowPassword(!showPassword)}
        >
          <Text>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
      {error && <Text className="text-red-500 mb-4 text-center">{error}</Text>}

      <TouchableOpacity
        className={`w-full bg-blue-600 rounded-lg p-3 ${loading ? 'opacity-50' : ''}`}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text className="text-white text-center font-semibold text-lg">
          {loading ? 'Creating account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>

      <View className="mt-6 flex-row justify-center">
        <Text className="text-gray-600">Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text className="text-blue-600 font-semibold">Log in instead</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}