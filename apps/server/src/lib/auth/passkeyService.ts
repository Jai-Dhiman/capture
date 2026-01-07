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
import type { Bindings } from '@/types';

const RP_NAME = 'Capture';
const RP_ID = 'capture-api.jai-d.workers.dev';
const ORIGIN = ['https://capture-api.jai-d.workers.dev'];

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
  credentialIdString?: string; // Keep the original string for SimpleWebAuthn
}

export class PasskeyService {
  private env: Bindings;

  constructor(env: Bindings) {
    this.env = env;
  }

  async generateRegistrationOptions(user: PasskeyUser, excludeCredentials: string[] = []) {
    const userIDBuffer = new TextEncoder().encode(user.id);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userID: userIDBuffer,
      userDisplayName: user.displayName,
      attestationType: 'none',
      excludeCredentials: excludeCredentials.map((id) => ({
        id: this.base64ToUint8Array(id),
        type: 'public-key' as const,
        transports: ['internal'] as AuthenticatorTransportFuture[],
      })) as any,
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

  async generateAuthenticationOptions(allowCredentials: PasskeyDevice[] = []) {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: allowCredentials.map((device) => ({
        id: device.credentialIdString || '',
        type: 'public-key' as const,
        transports: device.transports || ['internal'],
      })),
      userVerification: 'required',
    });

    return options;
  }

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
      credential: {
        id: device.credentialIdString || '',
        publicKey: device.credentialPublicKey,
        counter: device.counter,
        transports: device.transports,
      },
      requireUserVerification: true,
    });

    return verification;
  }

  private async storeChallenge(userId: string, challenge: string) {
    if (this.env.CAPTURE_KV) {
      try {
        await this.env.CAPTURE_KV.put(`auth:pk_reg:${userId}`, challenge, {
          expirationTtl: 300, // 5 minutes
        });
      } catch {
        throw new Error('Failed to store passkey challenge');
      }
    } else {
      throw new Error('KV storage not configured for passkey challenges');
    }
  }

  private async getStoredChallenge(userId: string): Promise<string | null> {
    if (this.env.CAPTURE_KV) {
      return await this.env.CAPTURE_KV.get(`auth:pk_reg:${userId}`);
    }
    return null;
  }

  private async removeChallenge(userId: string) {
    if (this.env.CAPTURE_KV) {
      await this.env.CAPTURE_KV.delete(`auth:pk_reg:${userId}`);
    }
  }

  public base64ToUint8Array(base64: string | null | undefined): Uint8Array {
    if (!base64 || typeof base64 !== 'string') {
      throw new Error(`Invalid base64 input: expected string, got ${typeof base64}`);
    }

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
