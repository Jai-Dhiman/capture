import {
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';
import type { Bindings } from '../types';

const RP_NAME = 'Capture';
const RP_ID = 'capture-api.jai-d.workers.dev'; // Your domain
const ORIGIN = ['https://capture-api.jai-d.workers.dev']; // Your app's origins

export interface PasskeyUser {
  id: string;
  email: string;
  displayName: string;
}

export interface PasskeyDevice {
  credentialID: Uint8Array;
  credentialPublicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

export class PasskeyService {
  private env: Bindings;

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Generate registration options for a new passkey
   */
  async generateRegistrationOptions(user: PasskeyUser, excludeCredentials: string[] = []) {
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userID: user.id,
      userDisplayName: user.displayName,
      attestationType: 'none',
      excludeCredentials: excludeCredentials.map((id) => ({
        id,
        type: 'public-key',
        transports: ['internal'] as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    // Store challenge temporarily (you might want to use KV or database)
    await this.storeChallenge(user.id, options.challenge);

    return options;
  }

  /**
   * Verify registration response
   */
  async verifyRegistrationResponse(
    userId: string,
    response: RegistrationResponseJSON,
  ): Promise<VerifiedRegistrationResponse> {
    const challenge = await this.getStoredChallenge(userId);
    if (!challenge) {
      throw new Error('Challenge not found or expired');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    // Clean up challenge
    await this.removeChallenge(userId);

    return verification;
  }

  /**
   * Generate authentication options
   */
  async generateAuthenticationOptions(allowCredentials: PasskeyDevice[] = []) {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: allowCredentials.map((device) => ({
        id: device.credentialID,
        type: 'public-key',
        transports: device.transports || ['internal'],
      })),
      userVerification: 'required',
    });

    return options;
  }

  /**
   * Verify authentication response
   */
  async verifyAuthenticationResponse(
    response: AuthenticationResponseJSON,
    device: PasskeyDevice,
    challenge: string,
  ): Promise<VerifiedAuthenticationResponse> {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: device.credentialID,
        credentialPublicKey: device.credentialPublicKey,
        counter: device.counter,
        transports: device.transports,
      },
      requireUserVerification: true,
    });

    return verification;
  }

  /**
   * Store challenge temporarily
   */
  private async storeChallenge(userId: string, challenge: string) {
    if (this.env.REFRESH_TOKEN_KV) {
      // Store with 5 minute expiration
      await this.env.REFRESH_TOKEN_KV.put(`passkey_challenge_${userId}`, challenge, {
        expirationTtl: 300, // 5 minutes
      });
    }
  }

  /**
   * Get stored challenge
   */
  private async getStoredChallenge(userId: string): Promise<string | null> {
    if (this.env.REFRESH_TOKEN_KV) {
      return await this.env.REFRESH_TOKEN_KV.get(`passkey_challenge_${userId}`);
    }
    return null;
  }

  /**
   * Remove challenge
   */
  private async removeChallenge(userId: string) {
    if (this.env.REFRESH_TOKEN_KV) {
      await this.env.REFRESH_TOKEN_KV.delete(`passkey_challenge_${userId}`);
    }
  }

  /**
   * Utility functions
   */
  public base64ToUint8Array(base64: string): Uint8Array {
    // Handle URL-safe base64
    const base64Padded = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = 4 - (base64Padded.length % 4);
    const paddedBase64 = base64Padded + '='.repeat(padding % 4);

    const binaryString = atob(paddedBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  public static uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binaryString);
  }
}
