import Constants from 'expo-constants'
const apiUrl = Constants?.expoConfig?.extra?.API_URL ?? 'http://localhost:8787/api'

export const signIn = async ({ email, password }: { email: string; password: string }) => {
  const response = await fetch(`${apiUrl}/auth/sign-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    mode: 'cors',
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    console.log(email, password)
    throw new Error('Invalid credentials')
  }
  return response.json()
}
