import { useNavigate } from 'react-router'
import { useState, useEffect } from '@lynx-js/react'
import styles from './login.module.scss'
import { useMainThreadAuth } from '../../hooks/auth/useMainThreadAuth.ts'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useAtom } from 'jotai'
import { showPasswordAtom, authErrorMessageAtom, authSuccessMessageAtom } from '../../atoms/authUIatoms.ts'

export function Login() {
  const navigate = useNavigate()
  const { login, isLoading, isLoggedIn } = useMainThreadAuth()
  const [showPassword, setShowPassword] = useAtom(showPasswordAtom)
  const [errorMessage, setErrorMessage] = useAtom(authErrorMessageAtom)
  const [successMessage, setSuccessMessage] = useAtom(authSuccessMessageAtom)
  
  const clearMessages = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }
  
  useEffect(() => {
    if (isLoggedIn && !isLoading) {
      navigate('/home')
    }
  }, [isLoggedIn, isLoading, navigate])
  
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => navigate('/home'), 1000)
      return () => clearTimeout(timer)
    }
  }, [successMessage, navigate])
  
  const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters')
  })
  
  const form = useForm({  
    defaultValues: {
      email: '',
      password: ''
    },
    onSubmit: async ({ value }) => {
      clearMessages()
      
      try {
        loginSchema.parse(value)
        login({ email: value.email, password: value.password })
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessages = error.errors.map(err => err.message).join(', ')
          window.postMessage({
            type: 'AUTH_LOGIN_ERROR',
            message: errorMessages
          }, '*')
        }
      }
    }
  })
  
  return (
    <view className={styles.captureLogIn}>
      <view className={styles.overlapWrapper}>
        <view className={styles.overlap}>
          <image
            className={styles.backgroundDecal}
            src="./assets/background.png"
          />

          {errorMessage && (
            <view style={{ 
              position: 'absolute', 
              top: '10px', 
              left: '26px', 
              right: '26px', 
              padding: '10px', 
              backgroundColor: '#ffdddd', 
              borderRadius: '8px',
              zIndex: 10
            }}>
              <text style={{ color: '#d32f2f', textAlign: 'center' }}>{errorMessage}</text>
            </view>
          )}
          
          {successMessage && (
            <view style={{ 
              position: 'absolute', 
              top: '10px', 
              left: '26px', 
              right: '26px', 
              padding: '10px', 
              backgroundColor: '#ddffdd', 
              borderRadius: '8px',
              zIndex: 10
            }}>
              <text style={{ color: '#388e3c', textAlign: 'center' }}>{successMessage}</text>
            </view>
          )}

          <view className={styles.registerButton}>
            <text className={styles.registerText} bindtap={() => navigate('/auth/signup')}>Register</text>
            <text className={styles.noAccountText}>Don't have an account?</text>
          </view>

          <view className={styles.appleSignUp} bindtap={() => console.log('Apple login')}>
            <text className={styles.signInWithAppleText}>Sign In with Apple</text>
            <image className={styles.appleLogo} src="./assets/icons/apple-logo.svg" />
          </view>

          <view className={styles.googleSignUp} bindtap={() => console.log('Google login')}>
            <image className={styles.logo} src="./assets/icons/google-logo.svg" />
            <text className={styles.signInWithGoogleText}>Sign In with Google</text>
          </view>

          <view className={styles.login} bindtap={() => form.handleSubmit()}>
            <text className={styles.loginText}>{isLoading ? 'Logging in...' : 'Login'}</text>
          </view>

          <form onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}>
            <view className={styles.passwordField}>
              <text className={styles.yourPasswordText}>Your Password</text>
              <view className={styles.passwordPngs}>
                {!showPassword ? (
                  <view className={styles.passwordDots}>
                    {[...Array(form.getFieldValue('password')?.length || 0)].map((_, index: number) => (
                      <view key={index} className={styles.dot}></view>
                    ))}
                  </view>
                ) : (
                  <text style={{ 
                    position: 'absolute',
                    left: '55px',
                    top: '14px',
                    fontSize: '16px'
                  }}>{form.getFieldValue('password')}</text>
                )}
                <image className={styles.fieldIcon} src="./assets/icons/hidepassword-icon.svg" />
                <image
                  className={styles.showPassword}
                  src="./assets/icons/showpassword-icon.svg"
                  bindtap={() => setShowPassword(!showPassword)}
                />
                
                {form.Field({
                  name: "password",
                  children: (field) => (
                    <input
                      name={field.name}
                      value={field.state.value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        field.handleChange(e.target.value)
                      }
                      type={showPassword ? "text" : "password"}
                      style={{ 
                        position: 'absolute',
                        left: '48px',
                        right: '40px',
                        top: '0',
                        height: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '16px',
                        opacity: 0,
                        zIndex: 1
                      }}
                    />
                  )
                })}
              </view>
              <text 
                className={styles.forgotPasswordText}
                bindtap={() => console.log('Forgot password')}
              >
                Forgot Password?
              </text>
            </view>

            <view className={styles.emailField}>
              <text className={styles.emailLabel}>Email</text>
              <view className={styles.emailInputFrame}>
                {!form.getFieldValue('email') && (
                  <text className={styles.emailPlaceholder}>johndoe@icloud.com</text>
                )}
                <image className={styles.fieldIcon} src="./assets/icons/email-icon.svg" />
                
                {form.Field({
                  name: "email",
                  children: (field) => (
                    <input
                      name={field.name}
                      value={field.state.value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        field.handleChange(e.target.value)
                      }
                      type="email"
                      style={{ 
                        position: 'absolute',
                        left: '48px',
                        right: '10px',
                        top: '0',
                        height: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '16px',
                        zIndex: 1
                      }}
                    />
                  )
                })}
              </view>
            </view>
          </form>

          <view className={styles.appTitleContainer}>
            <view className={styles.spacer}></view>
            <text className={styles.appTitle}>Capture</text>
          </view>

          <view className={styles.homeIndicator}>
            <view className={styles.homeIndicatorBar}></view>
          </view>
        </view>
      </view>
    </view>
  )
}