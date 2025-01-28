// src/screens/LoginScreen.tsx
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  TextInput,
  Image 
} from 'react-native';

export const LoginScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* App Title */}
        <Text style={styles.appTitle}>Capture</Text>
        
        <View style={styles.divider} />

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="johndoe@icloud.com"
              style={styles.input}
              placeholderTextColor="#C8C8C8"
            />
          </View>
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              secureTextEntry
              style={styles.input}
            />
          </View>
          <TouchableOpacity>
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Social Login Buttons */}
        <TouchableOpacity style={styles.socialButton}>
          <Text style={styles.socialButtonText}>Sign In with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.socialButton}>
          <Text style={styles.socialButtonText}>Sign In with Apple</Text>
        </TouchableOpacity>

        {/* Register Link */}
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account?</Text>
          <TouchableOpacity>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DCDCDE',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  appTitle: {
    fontSize: 40,
    fontFamily: 'Roboto',
    textAlign: 'center',
    marginVertical: 30,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Roboto',
  },
  inputWrapper: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  input: {
    fontSize: 16,
    fontFamily: 'Roboto',
  },
  forgotPassword: {
    fontSize: 12,
    textDecorationLine: 'underline',
    marginTop: 8,
  },
  loginButton: {
    backgroundColor: '#E4CAC7',
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    marginVertical: 20,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  socialButton: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    marginVertical: 10,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto',
    color: '#1C1C1C',
  },
  registerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 16,
    fontFamily: 'Roboto',
    marginBottom: 8,
  },
  registerLink: {
    fontSize: 16,
    fontFamily: 'Roboto',
    fontWeight: '600',
    color: '#827B85',
    textDecorationLine: 'underline',
  },
});