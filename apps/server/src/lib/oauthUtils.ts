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
export async function validateGoogleAccessToken(accessToken: string): Promise<GoogleUserInfo> {

  // Get user info from Google using the access token
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResponse.ok) {
    console.error('❌ Failed to validate Google access token:', {
      status: userResponse.status,
      statusText: userResponse.statusText,
    });
    throw new Error('Invalid Google access token');
  }

  const userInfo = (await userResponse.json()) as GoogleUserInfo;
  
  return userInfo;
}

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  env: Bindings,
): Promise<GoogleUserInfo> {
  // Use the iOS client ID from environment variables 
  const clientId = env.GOOGLE_CLIENT_ID_IOS || env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error('Google Client ID not configured. Set GOOGLE_CLIENT_ID_IOS in environment.');
  }

  // Build token exchange parameters
  const tokenParams: Record<string, string> = {
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier, // PKCE parameter
  };

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(tokenParams),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('❌ Google token exchange failed:', {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      error: errorText,
      requestBody: {
        client_id: clientId ? `${clientId.substring(0, 20)}...` : 'MISSING',
        code: code ? `${code.substring(0, 10)}...` : 'MISSING',
        code_verifier: codeVerifier ? `${codeVerifier.substring(0, 10)}...` : 'MISSING',
        redirect_uri: redirectUri,
      },
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
    console.error('❌ Failed to get Google user info:', {
      status: userResponse.status,
      statusText: userResponse.statusText,
    });
    throw new Error('Failed to get Google user info');
  }

  const userInfo = (await userResponse.json()) as GoogleUserInfo;
  
  return userInfo;
}

// Apple OAuth functions

// Base64url decode helper
function base64UrlDecode(input: string): string {
  // Add padding if necessary
  const str = input + '===='.substring(0, (4 - (input.length % 4)) % 4);
  // Replace url-safe characters
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

// Fetch Apple's public keys
async function fetchApplePublicKeys(): Promise<ApplePublicKey[]> {
  try {
    const response = await fetch('https://appleid.apple.com/auth/keys');
    if (!response.ok) {
      throw new Error(`Failed to fetch Apple public keys: ${response.status}`);
    }
    const data = (await response.json()) as AppleKeysResponse;
    return data.keys;
  } catch (error) {
    console.error('❌ Failed to fetch Apple public keys:', error);
    throw new Error('Failed to fetch Apple public keys for JWT verification');
  }
}

// Convert Apple's public key to CryptoKey for Web Crypto API
async function importApplePublicKey(key: ApplePublicKey): Promise<CryptoKey> {
  // Create RSA public key in JWK format
  const jwk = {
    kty: 'RSA',
    n: key.n,
    e: key.e,
    alg: 'RS256',
    use: 'sig',
  };

  try {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );
  } catch (error) {
    console.error('❌ Failed to import Apple public key:', error);
    throw new Error('Failed to import Apple public key for signature verification');
  }
}

// Verify JWT signature using Apple's public key
async function verifyAppleJWTSignature(
  token: string,
  header: AppleJWTHeader,
): Promise<boolean> {
  try {
    // Fetch Apple's public keys
    const publicKeys = await fetchApplePublicKeys();
    
    // Find the key matching the JWT header kid
    const publicKey = publicKeys.find(key => key.kid === header.kid);
    if (!publicKey) {
      console.error('❌ No matching public key found for kid:', header.kid);
      throw new Error(`No matching Apple public key found for kid: ${header.kid}`);
    }

    // Import the public key
    const cryptoKey = await importApplePublicKey(publicKey);

    // Split the token to get signature and payload
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    const signedData = `${headerB64}.${payloadB64}`;
    
    // Decode the signature
    const signature = Uint8Array.from(base64UrlDecode(signatureB64), c => c.charCodeAt(0));
    
    // Verify the signature
    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      new TextEncoder().encode(signedData)
    );

    console.log('✅ Apple JWT signature verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ Apple JWT signature verification failed:', error);
    throw new Error(`Apple JWT signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

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
    const header = JSON.parse(base64UrlDecode(headerB64)) as AppleJWTHeader;
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as AppleJWTPayload;

    console.log('🔍 Apple JWT verification - header & payload decoded:', {
      alg: header.alg,
      kid: header.kid,
      aud: payload.aud,
      iss: payload.iss,
      exp: payload.exp,
      email: payload.email ? 'PRESENT' : 'MISSING',
    });

    // Validate basic claims
    if (payload.aud !== env.APPLE_CLIENT_ID) {
      console.error('❌ Invalid audience claim:', {
        expected: env.APPLE_CLIENT_ID,
        received: payload.aud,
      });
      throw new Error('Invalid audience claim - token not issued for this app');
    }

    if (payload.iss !== 'https://appleid.apple.com') {
      throw new Error('Invalid issuer claim - token not from Apple');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token has expired');
    }

    if (payload.iat > now + 60) {
      // Allow 60 seconds clock skew
      throw new Error('Token issued in the future');
    }

    // Verify JWT signature using Apple's public keys
    console.log('🔐 Verifying Apple JWT signature...');
    const signatureValid = await verifyAppleJWTSignature(identityToken, header);
    
    if (!signatureValid) {
      throw new Error('Invalid JWT signature - token may have been tampered with');
    }

    console.log('✅ Apple JWT verification successful');

    return {
      email: payload.email || '',
      email_verified: payload.email_verified === true || payload.email_verified === 'true',
      sub: payload.sub,
    };
  } catch (error) {
    console.error('❌ Apple token verification failed:', error);
    throw new Error(
      `Invalid Apple identity token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Generate a random code verifier for PKCE (matches client implementation)
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
