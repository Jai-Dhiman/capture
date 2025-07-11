import { vi } from 'vitest';

export const mockSendVerificationCode = vi.fn();

export const mockEmailService = {
  sendVerificationCode: mockSendVerificationCode,
};

export const createEmailService = vi.fn().mockReturnValue(mockEmailService); 