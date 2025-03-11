// src/components/Button/Button.tsx
import { type ReactNode } from 'react'
import styles from './Button.module.scss'

type ButtonProps = {
  children: ReactNode
  variant: 'primary' | 'secondary' | 'social'
  onTap?: () => void
  className?: string
  icon?: ReactNode
}

export function Button({ 
  children, 
  variant, 
  onTap, 
  className = '',
  icon
}: ButtonProps) {
  const buttonClass = 
    variant === 'primary' ? styles.primary :
    variant === 'secondary' ? styles.secondary :
    styles.social
    
  return (
    <view 
      className={`${styles.button} ${buttonClass} ${className}`} 
      bindtap={onTap}
    >
      {icon && <text className={styles.icon}>{icon}</text>}
      <text>{children}</text>
    </view>
  )
}