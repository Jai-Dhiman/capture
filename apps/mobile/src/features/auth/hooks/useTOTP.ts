import { useState } from 'react';
import type {
  TOTPSetupBeginResponse,
  TOTPSetupCompleteRequest,
  TOTPSetupCompleteResponse,
  TOTPVerifyRequest,
  TOTPVerifyResponse,
  TOTPBackupCodesResponse,
  TOTPDisableRequest,
  TOTPDisableResponse,
} from '../types';
import { workersAuthApi } from '../lib/workersAuthApi';

export const useTOTP = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupTOTPBegin = async (): Promise<TOTPSetupBeginResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await workersAuthApi.post('/auth/totp/setup/begin', {});
      return response as TOTPSetupBeginResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to begin TOTP setup';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const setupTOTPComplete = async (token: string): Promise<TOTPSetupCompleteResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const request: TOTPSetupCompleteRequest = { token };
      const response = await workersAuthApi.post('/auth/totp/setup/complete', request);
      return response as TOTPSetupCompleteResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete TOTP setup';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyTOTP = async (token: string, isBackupCode = false): Promise<TOTPVerifyResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const request: TOTPVerifyRequest = { token, isBackupCode };
      const response = await workersAuthApi.post('/auth/totp/verify', request);
      return response as TOTPVerifyResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify TOTP';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const generateBackupCodes = async (): Promise<TOTPBackupCodesResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await workersAuthApi.post('/auth/totp/backup-codes', {});
      return response as TOTPBackupCodesResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate backup codes';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const disableTOTP = async (token: string): Promise<TOTPDisableResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const request: TOTPDisableRequest = { token };
      const response = await workersAuthApi.delete('/auth/totp/disable', request);
      return response as TOTPDisableResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable TOTP';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    setupTOTPBegin,
    setupTOTPComplete,
    verifyTOTP,
    generateBackupCodes,
    disableTOTP,
  };
};