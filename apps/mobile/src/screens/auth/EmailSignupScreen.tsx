import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Image, Dimensions
} from 'react-native';
import { useForm } from '@tanstack/react-form';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../components/Navigators/types/navigation';
import { useAuth } from '../../hooks/auth/useAuth';
import { LoadingSpinner } from 'components/ui/LoadingSpinner';
import Header from '../../components/ui/Header';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '../../lib/AlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmailIcon from '../../../assets/icons/EmailIcon.svg'
import LockIcon from '../../../assets/icons/LockIcon.svg'


type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>
}

export default function EmailSignupScreen({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { showAlert } = useAlert();
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  
  const getResponsiveSize = (size: number) => (screenWidth / 393) * size;

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const hasCapitalLetter = /[A-Z]/;
  const hasNumber = /[0-9]/;
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
  const hasMinLength = /.{8,}/;

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        showAlert('Passwords do not match', { type: 'warning' });
        return;
      }
      
      signup.mutate(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            navigation.navigate('EmailVerificationPending');
          }
        }
      );
    }
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ 
          flex: 1, 
          backgroundColor: '#DCDCDE',
          overflow: 'hidden'
        }}>
          <Image
            source={require('../../../assets/DefaultBackground.png')}
            style={{ 
              width: '100%', 
              height: '100%', 
              position: 'absolute',
              borderRadius: getResponsiveSize(20)
            }}
            resizeMode="cover"
          />

          <Header 
            showBackButton={true}
            onBackPress={() => navigation.goBack()}
          />

          <View style={{
            alignItems: 'center',
            marginTop: getResponsiveSize(100) - insets.top > 0 ? getResponsiveSize(84) - insets.top : getResponsiveSize(20)
          }}>

          </View>
          <View style={{
            paddingHorizontal: getResponsiveSize(25),
            width: '100%'
          }}>
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Email is required';
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
                  return undefined;
                }
              }}
            >
              {(field) => (
                <View style={{ marginBottom: getResponsiveSize(16) }}>
                  <TouchableOpacity 
                    activeOpacity={1}
                    onPress={() => emailInputRef.current?.focus()}
                    style={{
                      height: getResponsiveSize(56),
                      backgroundColor: 'white',
                      borderRadius: getResponsiveSize(16),
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      elevation: 4,
                      width: '100%'
                    }}
                  >
                    <View style={{
                      width: getResponsiveSize(56),
                      height: getResponsiveSize(56),
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      backgroundColor: 'white',
                      borderWidth: 0.5,
                      borderColor: '#c7c7c7',
                      borderTopLeftRadius: getResponsiveSize(16),
                      borderBottomLeftRadius: getResponsiveSize(16)
                    }} />
                    <View style={{
                      position: 'absolute',
                      left: getResponsiveSize(12),
                      top: getResponsiveSize(12)
                    }}>
                      <EmailIcon width={getResponsiveSize(30)} height={getResponsiveSize(30)} />
                    </View>
                    <TextInput
                      ref={emailInputRef}
                      style={{
                        position: 'absolute',
                        left: getResponsiveSize(65),
                        top: getResponsiveSize(16),
                        right: getResponsiveSize(12),
                        fontSize: getResponsiveSize(16),
                        fontWeight: '600',
                        fontFamily: 'Roboto',
                        color: 'black'
                      }}
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="Email"
                      placeholderTextColor="#c7c7c7"
                    />
                  </TouchableOpacity>
                  {field.state.meta.errors.length > 0 && (
                    <Text style={{
                      color: 'red',
                      fontSize: getResponsiveSize(12),
                      marginTop: getResponsiveSize(4),
                      marginLeft: getResponsiveSize(8)
                    }}>
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
                  const errors = [];
                  
                  if (!hasMinLength.test(value)) {
                    errors.push('Password must be at least 8 characters');
                  }
                  if (!hasCapitalLetter.test(value)) {
                    errors.push('Password must contain at least 1 capital letter');
                  }
                  if (!hasNumber.test(value)) {
                    errors.push('Password must contain at least 1 number');
                  }
                  if (!hasSpecialChar.test(value)) {
                    errors.push('Password must contain at least 1 special character');
                  }
                  
                  return errors.length > 0 ? errors.join(', ') : undefined;
                }
              }}
            >
              {(field) => (
                <View style={{ marginBottom: getResponsiveSize(16) }}>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => passwordInputRef.current?.focus()}
                    style={{
                      height: getResponsiveSize(56),
                      backgroundColor: 'white',
                      borderRadius: getResponsiveSize(16),
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      elevation: 4,
                      width: '100%'
                    }}
                  >
                    <View style={{
                      width: getResponsiveSize(56),
                      height: getResponsiveSize(56),
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      backgroundColor: 'white',
                      borderWidth: 0.5,
                      borderColor: '#c7c7c7',
                      borderTopLeftRadius: getResponsiveSize(16),
                      borderBottomLeftRadius: getResponsiveSize(16)
                    }} />
                    <View style={{
                      position: 'absolute',
                      left: getResponsiveSize(12),
                      top: getResponsiveSize(12)
                    }}>
                      <LockIcon width={getResponsiveSize(30)} height={getResponsiveSize(30)} />
                    </View>
                    <TextInput
                      ref={passwordInputRef}
                      style={{
                        position: 'absolute',
                        left: getResponsiveSize(64),
                        top: getResponsiveSize(16),
                        right: getResponsiveSize(40),
                        fontSize: getResponsiveSize(16),
                        fontWeight: '600',
                        fontFamily: 'Roboto',
                        color: 'black'
                      }}
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      secureTextEntry={!showPassword}
                      placeholder="Create Password"
                      placeholderTextColor="#c7c7c7"
                    />
                    <TouchableOpacity 
                      style={{
                        position: 'absolute',
                        right: getResponsiveSize(12),
                        top: getResponsiveSize(12)
                      }}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Feather name={showPassword ? "eye" : "eye-off"} size={getResponsiveSize(24)} color="#888" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {field.state.meta.errors.length > 0 && (
                    <Text style={{
                      color: 'red',
                      fontSize: getResponsiveSize(12),
                      marginTop: getResponsiveSize(4),
                      marginLeft: getResponsiveSize(8)
                    }}>
                      {field.state.meta.errors}
                    </Text>
                  )}
                </View>
              )}
            </form.Field>

            <form.Field
              name="confirmPassword"
              validators={{
                onChangeListenTo: ['password'],
                onChange: ({ value, fieldApi }) => {
                  if (value !== fieldApi.form.getFieldValue('password')) {
                    return 'Passwords do not match';
                  }
                  return undefined;
                }
              }}
            >
              {(field) => (
                <View style={{ marginBottom: getResponsiveSize(8) }}>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => confirmPasswordInputRef.current?.focus()}
                    style={{
                      height: getResponsiveSize(56),
                      backgroundColor: 'white',
                      borderRadius: getResponsiveSize(16),
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      elevation: 4,
                      width: '100%'
                    }}
                  >
                    <View style={{
                      width: getResponsiveSize(56),
                      height: getResponsiveSize(56),
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      backgroundColor: 'white',
                      borderWidth: 0.5,
                      borderColor: '#c7c7c7',
                      borderTopLeftRadius: getResponsiveSize(16),
                      borderBottomLeftRadius: getResponsiveSize(16)
                    }} />
                    <View style={{
                      position: 'absolute',
                      left: getResponsiveSize(12),
                      top: getResponsiveSize(12)
                    }}>
                      <LockIcon width={getResponsiveSize(30)} height={getResponsiveSize(30)} />
                    </View>
                    <TextInput
                      ref={confirmPasswordInputRef}
                      style={{
                        position: 'absolute',
                        left: getResponsiveSize(65),
                        top: getResponsiveSize(16),
                        right: getResponsiveSize(40),
                        fontSize: getResponsiveSize(16),
                        fontWeight: '600',
                        fontFamily: 'Roboto',
                        color: 'black'
                      }}
                      value={field.state.value}
                      onChangeText={field.handleChange}
                      onBlur={field.handleBlur}
                      secureTextEntry={!showConfirmPassword}
                      placeholder="Re-enter Password"
                      placeholderTextColor="#c7c7c7"
                    />
                    <TouchableOpacity 
                      style={{
                        position: 'absolute',
                        right: getResponsiveSize(12),
                        top: getResponsiveSize(12)
                      }}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={getResponsiveSize(24)} color="#888" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {field.state.meta.errors.length > 0 && (
                    <Text style={{
                      color: 'red',
                      fontSize: getResponsiveSize(12),
                      marginTop: getResponsiveSize(4),
                      marginLeft: getResponsiveSize(8)
                    }}>
                      {field.state.meta.errors}
                    </Text>
                  )}
                </View>
              )}
            </form.Field>

            <View style={{ 
              marginLeft: getResponsiveSize(8),
              marginBottom: getResponsiveSize(30)
            }}>
              <Text style={{
                fontSize: getResponsiveSize(12),
                fontWeight: '400',
                fontFamily: 'Roboto',
                lineHeight: getResponsiveSize(18),
                color: 'black'
              }}>
                Password must contain {"\n"}
                At least 1 Capital Letter{"\n"}
                At least 1 Number{"\n"}
                At least 1 Special Character (@$&!)
              </Text>
            </View>

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <TouchableOpacity
                  style={{
                    height: getResponsiveSize(56),
                    backgroundColor: canSubmit ? '#c7c7c7' : '#a9a9a9',
                    borderRadius: getResponsiveSize(30),
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 4,
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    marginTop: getResponsiveSize(80),
                    marginBottom: getResponsiveSize(30) + insets.bottom
                  }}
                  onPress={() => form.handleSubmit()}
                  disabled={!canSubmit || signup.isPending}
                >
                  {signup.isPending || isSubmitting ? (
                    <LoadingSpinner message="Creating account..." />
                  ) : (
                    <Text style={{
                      textAlign: 'center',
                      color: 'black',
                      fontSize: getResponsiveSize(16),
                      fontWeight: '700',
                      fontFamily: 'Roboto'
                    }}>
                      Create Account
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </form.Subscribe>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}