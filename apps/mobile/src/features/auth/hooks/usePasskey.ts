import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { PasskeyService } from '../lib/passkeyService';
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
      return PasskeyService.getDeviceCapabilities();
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
      try {
        // Begin registration with server
        const registrationOptions = await workersAuthApi.passkeyRegistrationBegin(data);

        // Use actual WebAuthn registration
        const credential = await PasskeyService.registerPasskey(registrationOptions);

        // Complete registration with server
        return await workersAuthApi.passkeyRegistrationComplete({
          credential,
          deviceName: data.deviceName,
        });
      } catch (error) {
        console.error('Passkey registration error:', error);
        throw error;
      }
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
      try {
        // Begin authentication with server
        const authenticationOptions = await workersAuthApi.passkeyAuthenticationBegin(data);

        // Use actual WebAuthn authentication
        const credential = await PasskeyService.authenticateWithPasskey(authenticationOptions);

        // Complete authentication with server
        return await workersAuthApi.passkeyAuthenticationComplete({
          credential,
        });
      } catch (error) {
        console.error('Passkey authentication error:', error);
        throw error;
      }
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
    return PasskeyService.getBiometricFriendlyName();
  };

  // Check if user has passkeys for email
  const checkUserHasPasskeys = useMutation({
    mutationFn: async (email: string) => {
      return workersAuthApi.checkUserHasPasskeys(email);
    },
  });

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
    checkUserHasPasskeys,

    // Utils
    getBiometricName,

    // Computed values
    isPasskeySupported: deviceCapabilitiesQuery.data?.supported || false,
    hasBiometrics: deviceCapabilitiesQuery.data?.biometricsAvailable || false,
    biometricTypes: deviceCapabilitiesQuery.data?.biometricTypes || [],
  };
}
