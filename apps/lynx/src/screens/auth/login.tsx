import { useNavigate } from 'react-router'
import styles from './login.module.scss'

export function Login() {
  const navigate = useNavigate()
  
  return (
    <view className={styles.captureLogIn}>
      <view className={styles.overlapWrapper}>
        <view className={styles.overlap}>
          <image
            className={styles.backgroundDecal}
            src="./assets/background.png"
          />

          <view className={styles.registerButton}>
            <text className={styles.registerText}>Register</text>
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

          <view className={styles.login} bindtap={() => navigate('/home')}>
            <text className={styles.loginText}>Login</text>
          </view>

          <view className={styles.passwordField}>
            <text className={styles.forgotPasswordText}>Forgot Password?</text>
            <text className={styles.yourPasswordText}>Your Password</text>
            <view className={styles.passwordPngs}>
              <view className={styles.passwordDots}>
                <view className={styles.dot}></view>
                <view className={styles.dot}></view>
                <view className={styles.dot}></view>
                <view className={styles.dot}></view>
                <view className={styles.dot}></view>
                <view className={styles.dot}></view>
                <view className={styles.dot}></view>
                <view className={styles.dot}></view>
                <view className={styles.dot}></view>
              </view>
              <image className={styles.fieldIcon} src="./assets/icons/hidepassword-icon.svg" />
              <image
                className={styles.showPassword}
                src="./assets/icons/showpassword-icon.svg"
              />
            </view>
          </view>

          <view className={styles.emailField}>
            <text className={styles.emailLabel}>Email</text>
            <view className={styles.emailInputFrame}>
              <text className={styles.emailPlaceholder}>johndoe@icloud.com</text>
              <image className={styles.fieldIcon} src="./assets/icons/email-icon.svg" />
            </view>
          </view>

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