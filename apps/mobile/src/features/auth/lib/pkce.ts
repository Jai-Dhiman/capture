import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

/**
 * PKCE (Proof Key for Code Exchange) utility functions for React Native
 * Uses a simpler, more standard approach for better Google OAuth compatibility
 */ 

// Generate a secure random code verifier (43-128 chars, base64url safe)
export function generateCodeVerifier(): string {
  // Generate 128 random characters from base64url safe charset (RFC 7636)
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  
  for (let i = 0; i < 128; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return result;
}

// Generate code challenge from code verifier using SHA256
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  try {
    // For React Native, we need to use expo-crypto for SHA256
    
    // For React Native, we need to use expo-crypto for SHA256
    const hexHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    // Convert hex string to Uint8Array
    const hashArray = new Uint8Array(hexHash.length / 2);
    for (let i = 0; i < hexHash.length; i += 2) {
      hashArray[i / 2] = Number.parseInt(hexHash.substr(i, 2), 16);
    }
    
    // Convert to base64url using Buffer
    const buffer = Buffer.from(hashArray);
    const base64 = buffer.toString('base64');
    return base64UrlEncode(base64);
  } catch (error) {
    console.error('Error generating code challenge:', error);
    throw new Error('Failed to generate code challenge');
  }
}

// Convert base64 to base64url encoding
function base64UrlEncode(str: string): string {
  return str
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate secure random state parameter
function generateState(): string {
  return generateCodeVerifier(); // Use same method for consistency
}

// Store PKCE parameters securely (in memory for now)
class PKCEStore {
  private static instance: PKCEStore;
  private store = new Map<string, { codeVerifier: string; codeChallenge: string; state: string }>();

  static getInstance(): PKCEStore {
    if (!PKCEStore.instance) {
      PKCEStore.instance = new PKCEStore();
    }
    return PKCEStore.instance;
  }

  async storePKCEParams(key: string): Promise<{ codeVerifier: string; codeChallenge: string; state: string }> {
    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();
      
      const params = { codeVerifier, codeChallenge, state };
      this.store.set(key, params);
      
      return params;
    } catch (error) {
      console.error('Failed to generate PKCE params:', error);
      throw new Error('Failed to generate PKCE parameters');
    }
  }

  getPKCEParams(key: string): { codeVerifier: string; codeChallenge: string; state: string } | null {
    return this.store.get(key) || null;
  }

  clearPKCEParams(key: string): void {
    this.store.delete(key);
  }
}

export const pkceStore = PKCEStore.getInstance(); 