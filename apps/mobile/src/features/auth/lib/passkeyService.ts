import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { Passkey } from 'react-native-passkey';
import type {
  PasskeyAuthenticationCredential,
  PasskeyAuthenticationResponse,
  PasskeyCapabilities,
  PasskeyRegistrationCredential,
  PasskeyRegistrationResponse,
} from '../types';

export namespace PasskeyService {
  /**
   * Check if passkeys are supported on the current device
   */
  export async function getDeviceCapabilities(): Promise<PasskeyCapabilities> {
    try {
      // Check if device has biometric hardware
      const biometricsAvailable = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      // Check if passkeys are supported - using correct API
      let passkeySupported = false;
      try {
        // isSupported is a synchronous method, not async
        passkeySupported = Passkey.isSupported();
      } catch (passkeyError) {
        console.warn('Error checking passkey support:', passkeyError);
        passkeySupported = false;
      }

      // Map authentication types to friendly names
      const biometricTypes: string[] = [];
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricTypes.push(Platform.OS === 'ios' ? 'FaceID' : 'FaceUnlock');
      }
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricTypes.push(Platform.OS === 'ios' ? 'TouchID' : 'Fingerprint');
      }
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricTypes.push('Iris');
      }

      const deviceType =
        Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'unsupported';

      return {
        supported: passkeySupported && biometricsAvailable && isEnrolled,
        biometricsAvailable: biometricsAvailable && isEnrolled,
        deviceType,
        biometricTypes,
      };
    } catch (error) {
      console.error('Error checking passkey capabilities:', error);
      return {
        supported: false,
        biometricsAvailable: false,
        deviceType: 'unsupported',
        biometricTypes: [],
      };
    }
  }

  /**
   * Register a new passkey
   */
  export async function registerPasskey(
    registrationOptions: PasskeyRegistrationResponse,
  ): Promise<PasskeyRegistrationCredential> {
    try {
      const result = await Passkey.create({
        challenge: registrationOptions.challenge,
        rp: registrationOptions.rp,
        user: registrationOptions.user,
        pubKeyCredParams: registrationOptions.pubKeyCredParams,
        authenticatorSelection: registrationOptions.authenticatorSelection,
        attestation: registrationOptions.attestation as any,
        timeout: registrationOptions.timeout,
      });

      return {
        id: result.id,
        rawId: result.rawId,
        response: {
          attestationObject: result.response.attestationObject,
          clientDataJSON: result.response.clientDataJSON,
        },
        type: result.type,
      };
    } catch (error) {
      console.error('Passkey registration error:', error);
      throw handlePasskeyError(error);
    }
  }

  /**
   * Authenticate with an existing passkey
   */
  export async function authenticateWithPasskey(
    authenticationOptions: PasskeyAuthenticationResponse,
  ): Promise<PasskeyAuthenticationCredential> {
    try {
      const result = await Passkey.get({
        challenge: authenticationOptions.challenge,
        allowCredentials: authenticationOptions.allowCredentials as any,
        userVerification: authenticationOptions.userVerification as any,
        timeout: authenticationOptions.timeout,
        rpId: authenticationOptions.rpId as any,
      });

      return {
        id: result.id,
        rawId: result.rawId,
        response: {
          authenticatorData: result.response.authenticatorData,
          clientDataJSON: result.response.clientDataJSON,
          signature: result.response.signature,
          userHandle: result.response.userHandle,
        },
        type: result.type,
      };
    } catch (error) {
      console.error('Passkey authentication error:', error);
      throw handlePasskeyError(error);
    }
  }

  /**
   * Show biometric prompt for additional security
   */
  export async function authenticateWithBiometrics(
    reason = 'Authenticate to continue',
  ): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }

  /**
   * Handle passkey errors and provide user-friendly messages
   */
  function handlePasskeyError(error: any): Error {
    if (error && typeof error === 'object' && 'code' in error) {
      switch (error.code) {
        case 'UserCancel':
          return new Error('Authentication was cancelled by the user');
        case 'UserFallback':
          return new Error('User selected fallback authentication method');
        case 'SystemCancel':
          return new Error('Authentication was cancelled by the system');
        case 'TouchIDNotAvailable':
        case 'TouchIDNotEnrolled':
          return new Error('Biometric authentication is not available');
        case 'TouchIDLockout':
          return new Error('Biometric authentication is locked due to too many failed attempts');
        case 'AuthenticationFailed':
          return new Error('Authentication failed');
        case 'InvalidContext':
          return new Error('Invalid authentication context');
        case 'NotInteractive':
          return new Error('Authentication requires user interaction');
        default:
          return new Error(`Passkey error: ${error.message}`);
      }
    }

    if (error?.message) {
      return new Error(error.message);
    }

    return new Error('An unknown passkey error occurred');
  }

  /**
   * Check if specific biometric type is available
   */
  export async function isBiometricTypeAvailable(
    type: 'face' | 'fingerprint' | 'iris',
  ): Promise<boolean> {
    try {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      switch (type) {
        case 'face':
          return supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        case 'fingerprint':
          return supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
        case 'iris':
          return supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking biometric type availability:', error);
      return false;
    }
  }

  /**
   * Get friendly name for current biometric type
   */
  export async function getBiometricFriendlyName(): Promise<string> {
    try {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
      }

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      }

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris';
      }

      return 'Biometric';
    } catch (error) {
      console.error('Error getting biometric friendly name:', error);
      return 'Biometric';
    }
  }
}
