import { useAlert } from '@/shared/lib/AlertContext';
import { errorService } from '@/shared/services/errorService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workersAuthApi } from '../lib/workersAuthApi';
import { useAuthStore } from '../stores/authStore';
import type {
  AuthResponse,
  BasicSuccessResponse,
  SendCodeRequest,
  SendCodeResponse,
  VerifyCodeRequest,
} from '../types';

export function useAuth() {
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();

  const setAuthData = useAuthStore((state) => state.setAuthData);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  // Send verification code mutation
  const sendCodeMutation = useMutation<SendCodeResponse, Error, SendCodeRequest>({
    mutationFn: async (data: SendCodeRequest) => {
      return await workersAuthApi.sendCode(data);
    },
    onError: (error) => {
      console.error('Send code error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // Verify code mutation
  const verifyCodeMutation = useMutation<AuthResponse, Error, VerifyCodeRequest>({
    mutationFn: async (data: VerifyCodeRequest) => {
      return await workersAuthApi.verifyCode(data);
    },
    onSuccess: (data) => {
      setAuthData(data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => {
      console.error('Verify code error:', error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      await clearAuth();
    },
    onSuccess: () => {
      queryClient.clear();
      showAlert('You have been logged out.', { type: 'info' });
    },
    onError: (error) => {
      console.error('Logout error:', error);
      const appError = errorService.createError(
        'Failed to sign out properly. Your local session is cleared.',
        'auth/logout-error',
        error instanceof Error ? error : undefined,
      );
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  return {
    sendCode: sendCodeMutation,
    verifyCode: verifyCodeMutation,
    logout: logoutMutation,
  };
}
