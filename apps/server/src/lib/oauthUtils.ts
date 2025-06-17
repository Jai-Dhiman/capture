import type { Bindings } from '../types';

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

export interface AppleJWTHeader {
  alg: string;
  kid: string;
  typ: string;
}

export interface AppleJWTPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  auth_time?: number;
  nonce_supported?: boolean;
}

export interface ApplePublicKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

export interface AppleKeysResponse {
  keys: ApplePublicKey[];
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
  env: Bindings,
  clientId?: string, // Optional client ID from frontend
): Promise<GoogleUserInfo> {
  // Use provided clientId or fallback to environment variable
  const googleClientId = clientId || env.GOOGLE_CLIENT_ID || '';
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: googleClientId,
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
        client_id: googleClientId,
        client_secret: env.GOOGLE_CLIENT_SECRET ? 'PRESENT' : 'MISSING',
        code: code ? `${code.substring(0, 10)}...` : 'MISSING',
        code_verifier: codeVerifier ? `${codeVerifier.substring(0, 10)}...` : 'MISSING',
        redirect_uri: redirectUri,
      },
      fullCodeVerifier: codeVerifier,
      codeVerifierLength: codeVerifier?.length || 0,
    });
    throw new Error(`Failed to exchange Google authorization code: ${errorText}`);
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

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
export async function verifyAppleToken(
  identityToken: string,
  env: Bindings,
): Promise<AppleUserInfo> {
  try {
    // Split the JWT into its parts
    const [headerB64, payloadB64, signatureB64] = identityToken.split('.');

    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid JWT format');
    }

    // Decode header and payload
    const _header = JSON.parse(atob(headerB64)) as AppleJWTHeader;
    const payload = JSON.parse(atob(payloadB64)) as AppleJWTPayload;

    // Validate basic claims
    if (payload.aud !== env.APPLE_CLIENT_ID) {
      throw new Error('Invalid audience claim');
    }

    if (payload.iss !== 'https://appleid.apple.com') {
      throw new Error('Invalid issuer claim');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token has expired');
    }

    if (payload.iat > now + 60) {
      // Allow 60 seconds clock skew
      throw new Error('Token issued in the future');
    }

    // For development/testing, we'll skip signature verification
    // In production, you should verify the signature against Apple's public keys
    // TODO: Add ENVIRONMENT variable to Bindings type and enable signature verification
    // if (env.ENVIRONMENT === 'production') {
    //   await verifyAppleJWTSignature(identityToken, header, env);
    // } else {
    console.warn(
      '⚠️ Apple JWT signature verification not implemented - should be added for production',
    );
    // }

    return {
      email: payload.email || '',
      email_verified: payload.email_verified === true || payload.email_verified === 'true',
      sub: payload.sub,
    };
  } catch (error) {
    console.error('Apple token verification failed:', error);
    throw new Error(
      `Invalid Apple identity token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// TODO: Implement Apple JWT signature verification for production
// This function would verify the JWT signature using Apple's public keys
// Requirements:
// 1. Fetch Apple's public keys from https://appleid.apple.com/auth/keys
// 2. Find the key matching the JWT header 'kid'
// 3. Verify the RS256 signature
// 4. Use a crypto library like 'node-jose' or Web Crypto API

// Generate a random code verifier for PKCE
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
