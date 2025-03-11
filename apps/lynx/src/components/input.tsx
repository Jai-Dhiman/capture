import { type ReactNode } from 'react'
import styles from './Input.module.scss'

type InputProps = {
  label: string
  placeholder?: string
  icon?: ReactNode
  focused?: boolean
}

export function Input({ label, placeholder, icon, focused = false }: InputProps) {
  return (
    <view className={styles.formGroup}>
      <text className={styles.label}>{label}</text>
      <view className={`${styles.container} ${focused ? styles.focused : ''}`}>
        {icon && (
          <view className={styles.icon}>
            <text>{icon}</text>
          </view>
        )}
        <view className={styles.field}>
          <text>{placeholder || ''}</text>
        </view>
      </view>
    </view>
  )
}