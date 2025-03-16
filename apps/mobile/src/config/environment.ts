const getEnvironment = () => {
  if (__DEV__) return 'development'
  return 'production'
}

export const isDevelopment = getEnvironment() === 'development'
export const isProduction = getEnvironment() === 'production'

export const TEST_EMAILS = ['test@gmail.com', 'test2@gmail.com', 'test3@gmail.com']

export const canSkipPhoneVerification = (email?: string | null) => {
  if (isProduction) return false
  if (!email) return true
  return TEST_EMAILS.includes(email)
}
