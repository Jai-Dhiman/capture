import { config } from 'dotenv'
config()

const API_URL = process.env.ClOUDFLARE_API_URL

export const signIn = async ({ email, password }: { email: string; password: string }) => {
  const response = await fetch(`${API_URL}/auth/sign-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error('Invalid credentials')
  }

  return response.json()
}
