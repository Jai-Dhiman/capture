import React, { useState } from 'react';
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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Image */}
      <Image 
        source={require('../assets/Fluid Background Coffee.png')}
        style={styles.backgroundImage}
      />
      
      <View style={styles.content}>
        <Text style={styles.appTitle}>Capture</Text>
        
        <View style={styles.divider} />

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputWrapper}>
            <Image 
              source={require('../assets/icons/Email Icon.svg')}
              style={styles.inputIcon}
            />
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
            <Image 
              source={require('../assets/icons/Lock Icon.svg')}
              style={styles.inputIcon}
            />
            <TextInput
              secureTextEntry={!showPassword}
              style={styles.input}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Image 
                source={showPassword ? 
                  require('../assets/icons/View Password Icon.svg') :
                  require('../assets/icons/Dont Show Passoword Icon.svg')}
                style={styles.visibilityIcon}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity>
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loginButton}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.socialButton}>
          <Text style={styles.socialButtonText}>Sign In with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.socialButton}>
          <Text style={styles.socialButtonText}>Sign In with Apple</Text>
        </TouchableOpacity>

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
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    fontSize: 16,
    fontFamily: 'Roboto',
    flex: 1,
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
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  inputIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  visibilityIcon: {
    width: 24,
    height: 24,
    marginLeft: 10,
  },
});