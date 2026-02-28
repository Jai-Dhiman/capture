import { useMutation } from '@tanstack/react-query';
import { workersAuthApi } from '../lib/workersAuthApi';
import type { TOTPBackupCodesResponse, TOTPSetupBeginResponse } from '../types';

export const useTOTP = () => {
  const setupBeginMutation = useMutation<TOTPSetupBeginResponse, Error, void>({
    mutationFn: () => workersAuthApi.totpSetupBegin(),
  });

  const setupCompleteMutation = useMutation<unknown, Error, string>({
    mutationFn: (token: string) => workersAuthApi.totpSetupComplete(token),
  });

  const verifyMutation = useMutation<unknown, Error, { token: string; isBackupCode?: boolean }>({
    mutationFn: ({ token, isBackupCode }) => workersAuthApi.totpVerify(token, isBackupCode),
  });

  const backupCodesMutation = useMutation<TOTPBackupCodesResponse, Error, void>({
    mutationFn: () => workersAuthApi.totpBackupCodes(),
  });

  const disableMutation = useMutation<unknown, Error, string>({
    mutationFn: (token: string) => workersAuthApi.totpDisable(token),
  });

  return {
    setupBegin: setupBeginMutation,
    setupComplete: setupCompleteMutation,
    verify: verifyMutation,
    backupCodes: backupCodesMutation,
    disable: disableMutation,
  };
};
