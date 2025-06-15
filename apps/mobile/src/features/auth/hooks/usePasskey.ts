import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { workersAuthApi } from '../lib/workersAuthApi';
import { useAuthStore } from '../stores/authStore';
import type {
  AuthResponse,
  PasskeyAuthenticationRequest,
  PasskeyCapabilities,
  PasskeyRegistrationRequest,
} from '../types';

export function usePasskey() {
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  const setAuthData = useAuthStore((state) => state.setAuthData);

  // Check device capabilities
  const deviceCapabilitiesQuery = useQuery({
    queryKey: ['passkey', 'capabilities'],
    queryFn: async (): Promise<PasskeyCapabilities> => {
      try {
        // Check if device has biometric hardware
        const biometricsAvailable = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

        // For now, we'll consider passkeys supported if biometrics are available
        // In a real implementation, you'd check actual passkey support
        const passkeySupported = biometricsAvailable && isEnrolled;

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
          supported: passkeySupported,
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
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get user's passkeys
  const passkeysQuery = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => workersAuthApi.getPasskeys(),
    enabled: !!useAuthStore.getState().user,
  });

  // Register passkey mutation
  const registerPasskeyMutation = useMutation({
    mutationFn: async (data: PasskeyRegistrationRequest) => {
      // First, check if biometrics are available
      const biometricsResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to set up passkey',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (!biometricsResult.success) {
        throw new Error('Biometric authentication failed');
      }

      // Begin registration
      await workersAuthApi.passkeyRegistrationBegin(data);

      // For demonstration, we'll complete the registration
      // In a real implementation, you'd use actual WebAuthn/Passkey APIs
      const mockCredential = {
        id: 'mock-credential-id',
        rawId: 'mock-raw-id',
        response: {
          attestationObject: 'mock-attestation',
          clientDataJSON: 'mock-client-data',
        },
        type: 'public-key',
      };

      // Complete registration
      return workersAuthApi.passkeyRegistrationComplete({
        credential: mockCredential,
        deviceName: data.deviceName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      showAlert('Passkey registered successfully!', { type: 'success' });
    },
    onError: (error) => {
      console.error('Passkey registration error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Authenticate with passkey mutation
  const authenticateWithPasskeyMutation = useMutation<
    AuthResponse,
    Error,
    PasskeyAuthenticationRequest
  >({
    mutationFn: async (data: PasskeyAuthenticationRequest) => {
      // Check if biometrics are available
      const biometricsResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in with your biometric',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (!biometricsResult.success) {
        throw new Error('Biometric authentication failed');
      }

      // Begin authentication
      await workersAuthApi.passkeyAuthenticationBegin(data);

      // For demonstration, we'll complete the authentication
      // In a real implementation, you'd use actual WebAuthn/Passkey APIs
      const mockCredential = {
        id: 'mock-credential-id',
        rawId: 'mock-raw-id',
        response: {
          authenticatorData: 'mock-auth-data',
          clientDataJSON: 'mock-client-data',
          signature: 'mock-signature',
          userHandle: 'mock-user-handle',
        },
        type: 'public-key',
      };

      // Complete authentication
      return workersAuthApi.passkeyAuthenticationComplete({
        credential: mockCredential,
      });
    },
    onSuccess: (data) => {
      setAuthData(data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      showAlert('Signed in successfully!', { type: 'success' });
    },
    onError: (error) => {
      console.error('Passkey authentication error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Delete passkey mutation
  const deletePasskeyMutation = useMutation({
    mutationFn: (passkeyId: string) => workersAuthApi.deletePasskey(passkeyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      showAlert('Passkey deleted successfully!', { type: 'success' });
    },
    onError: (error) => {
      console.error('Delete passkey error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Utility function to get biometric friendly name
  const getBiometricName = async (): Promise<string> => {
    try {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
      }

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      }

      return 'Biometric';
    } catch {
      return 'Biometric';
    }
  };

  return {
    // Queries
    deviceCapabilities: deviceCapabilitiesQuery.data,
    isCapabilitiesLoading: deviceCapabilitiesQuery.isLoading,
    passkeys: passkeysQuery.data?.passkeys || [],
    isPasskeysLoading: passkeysQuery.isLoading,

    // Mutations
    registerPasskey: registerPasskeyMutation,
    authenticateWithPasskey: authenticateWithPasskeyMutation,
    deletePasskey: deletePasskeyMutation,

    // Utils
    getBiometricName,

    // Computed values
    isPasskeySupported: deviceCapabilitiesQuery.data?.supported || false,
    hasBiometrics: deviceCapabilitiesQuery.data?.biometricsAvailable || false,
    biometricTypes: deviceCapabilitiesQuery.data?.biometricTypes || [],
  };
}
