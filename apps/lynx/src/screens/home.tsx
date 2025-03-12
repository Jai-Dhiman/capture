import { useNavigate } from 'react-router'
import styles from './Home.module.scss'

const api_url = process.env.API_URL || 'No URL Found'

export function Home() {
  const navigate = useNavigate()
  
  return (
    <view className={styles.container}>
      <image 
        className={styles.containerFluidBg} 
        src="https://source.unsplash.com/random/800x1200/?fluid" 
      />
      
      <view className={styles.header}>
        <view className={styles.headerBack}></view>
        <text className={styles.textTitle}>Capture</text>
        <view></view>
      </view>
      
      <view className={styles.content}>
        <view className={styles.card}>
          <view className={styles.cardContent}>
            <text className={styles.cardTitle}>Welcome to Capture</text>
            <text className={styles.textBody}>Privacy-first social media platform</text>
          </view>
        </view>
        
        <view className={styles.divider}></view>
        
        <view className={styles.formGroup}>
          <text className={styles.formLabel}>Email</text>
          <view className={styles.inputContainer}>
            <view className={styles.inputIcon}>
              <text>📧</text>
            </view>
            <view className={styles.inputField}>
              <text>youremail@example.com</text>
            </view>
          </view>
        </view>
        
        <view className={styles.formGroup}>
          <text className={styles.formLabel}>Password</text>
          <view className={styles.inputContainer}>
            <view className={styles.inputIcon}>
              <text>🔒</text>
            </view>
            <view className={styles.inputField}>
              <text>••••••••</text>
            </view>
          </view>
        </view>
        
        <view className={styles.btnPrimary} bindtap={() => navigate('/page2')}>
          <text>Log In</text>
        </view>
        
        <view className={styles.divider}></view>
        
        <view className={styles.btnSocial} bindtap={() => console.log('Google login')}>
          <text className={styles.socialIcon}>G</text>
          <text>Continue with Google</text>
        </view>
        
        <view 
          className={styles.btnSocial} 
          style={{marginTop: '10px'}} 
          bindtap={() => console.log('Apple login')}
        >
          <text className={styles.socialIcon}>🍎</text>
          <text>Continue with Apple</text>
        </view>
        
        <view className={styles.flexCenter} style={{marginTop: '20px'}}>
          <text className={styles.textBody}>Don't have an account? </text>
          <text 
            className={styles.textLinkPrimary} 
            bindtap={() => console.log('Register')}
          >Register</text>
        </view>
      </view>
      
      <view className={styles.navBar}>
        <view className={`${styles.navBarItem} ${styles.navBarItemActive}`}>
          <text>Home</text>
        </view>
        <view className={styles.navBarItem}>
          <text>Search</text>
        </view>
        <view className={styles.navBarItem}>
          <text>Profile</text>
        </view>
      </view>
    </view>
  )
}