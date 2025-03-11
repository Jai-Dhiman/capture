import { useNavigate } from 'react-router'
import styles from './Page2.module.scss'

export function PageTwo() {
  const navigate = useNavigate()
  
  return (
    <view className={styles.container}>
      <view className={styles.header}>
        <view className={styles.headerBack} bindtap={() => navigate('/')}>
          <text>←</text>
        </view>
        <text className={styles.headerTitle}>Page 2</text>
        <view></view>
      </view>
      
      <view className={styles.content}>
        <view className={styles.card}>
          <view className={styles.cardContent}>
            <text className={styles.cardTitle}>Your Content</text>
            <text className={styles.textBody}>This is page 2 of your application.</text>
          </view>
        </view>
        
        <view className={styles.formGroup} style={{marginTop: '20px'}}>
          <text className={styles.formLabel}>Your Input</text>
          <view className={`${styles.inputContainer} ${styles.inputContainerFocused}`}>
            <view className={styles.inputField}>
              <text>Type here...</text>
            </view>
          </view>
        </view>
        
        <view className={styles.btnSecondary} bindtap={() => navigate('/')}>
          <text>Back to Home</text>
        </view>
      </view>
      
      <view className={styles.navBar}>
        <view className={styles.navBarItem}>
          <text>Home</text>
        </view>
        <view className={`${styles.navBarItem} ${styles.navBarItemActive}`}>
          <text>Page 2</text>
        </view>
        <view className={styles.navBarItem}>
          <text>Profile</text>
        </view>
      </view>
    </view>
  )
}