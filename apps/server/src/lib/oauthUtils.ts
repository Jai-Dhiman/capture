import type { Bindings } from "../types";

// OAuth response types
export interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export interface AppleUserInfo {
  email: string;
  email_verified: boolean;
  sub: string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
}

// PKCE helper functions
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Convert to base64url
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(hashArray)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function verifyPKCE(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const computedChallenge = await generateCodeChallenge(codeVerifier);
  return computedChallenge === codeChallenge;
}

// Google OAuth functions
export async function exchangeGoogleCode(
  code: string, 
  codeVerifier: string, 
  redirectUri: string, 
  env: Bindings
): Promise<GoogleUserInfo> {

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || '',
      client_secret: env.GOOGLE_CLIENT_SECRET || '',
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Google token exchange failed:', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      error: errorText,
      requestBody: {
        client_id: env.GOOGLE_CLIENT_ID || 'MISSING',
        client_secret: env.GOOGLE_CLIENT_SECRET ? 'PRESENT' : 'MISSING',
        code: code ? `${code.substring(0, 10)}...` : 'MISSING',
        code_verifier: codeVerifier ? `${codeVerifier.substring(0, 10)}...` : 'MISSING',
        redirect_uri: redirectUri,
      },
      fullCodeVerifier: codeVerifier,
      codeVerifierLength: codeVerifier?.length || 0
    });
    throw new Error(`Failed to exchange Google authorization code: ${errorText}`);
  }

  const tokenData = await tokenResponse.json() as GoogleTokenResponse;
  
  // Get user info from Google
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to get Google user info');
  }

  const userInfo = await userResponse.json();
  return userInfo as GoogleUserInfo;
}

// Apple OAuth functions
export async function verifyAppleToken(identityToken: string, env: Bindings): Promise<AppleUserInfo> {
  // For Apple Sign In, we need to verify the identity token
  // This is a simplified version - in production you'd want to verify the JWT signature
  try {
    const payload = identityToken.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    
    if (decoded.aud !== env.APPLE_CLIENT_ID) {
      throw new Error('Invalid Apple client ID');
    }
    
    return {
      email: decoded.email,
      email_verified: decoded.email_verified !== 'false',
      sub: decoded.sub,
    };
  } catch (error) {
    throw new Error(`Invalid Apple identity token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Generate a random code verifier for PKCE
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
} 