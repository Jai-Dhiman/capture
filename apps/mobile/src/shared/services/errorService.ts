import type { AlertType } from '../components/Alert';

export type ErrorCategory = 'auth' | 'network' | 'validation' | 'server' | 'unknown';

export interface AppError {
  message: string;
  code: string;
  category: ErrorCategory;
  originalError?: Error;
}

export const errorService = {
  categorizeError(code: string): ErrorCategory {
    if (code.startsWith('auth/')) return 'auth';
    if (code.startsWith('network/')) return 'network';
    if (code.startsWith('validation/')) return 'validation';
    if (code.startsWith('server/')) return 'server';
    return 'unknown';
  },

  getAlertType(category: ErrorCategory): AlertType {
    switch (category) {
      case 'auth':
        return 'warning';
      case 'network':
        return 'error';
      case 'validation':
        return 'warning';
      case 'server':
        return 'error';
      default:
        return 'error';
    }
  },

  formatErrorMessage(error: Error | AppError | unknown): string {
    if (!error) return 'An unknown error occurred';

    if (typeof error === 'object' && 'category' in error && 'message' in error) {
      return error.message as string;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'An unexpected error occurred';
  },

  createError(message: string, code = 'unknown/error', originalError?: Error): AppError {
    return {
      message,
      code,
      category: this.categorizeError(code),
      originalError,
    };
  },

  handleAuthError(error: unknown): AppError {
    if (
      typeof error === 'object' &&
      error !== null &&
      'category' in error &&
      error.category === 'auth'
    ) {
      return error as AppError;
    }

    if (error instanceof Error && error.name === 'AuthError' && 'code' in error) {
      return {
        message: error.message,
        code: (error as any).code || 'auth/unknown',
        category: 'auth',
        originalError: error,
      };
    }

    // Handle API errors with specific auth error codes
    if (error instanceof Error && error.name === 'APIError') {
      const apiError = error as any;
      
      // Check for specific error messages that indicate account/email issues
      if (apiError.message.includes('Unable to send verification code') || 
          apiError.message.includes('check your email address')) {
        return this.createError(
          'Unable to send verification code. Please double-check your email address and try again.',
          'auth/email-send-failed',
          error
        );
      }
      
      if (apiError.message.includes('Email service is not configured')) {
        return this.createError(
          'Email service is temporarily unavailable. Please try again later or contact support.',
          'auth/email-service-unavailable',
          error
        );
      }
      
      if (apiError.statusCode === 404) {
        return this.createError(
          'Account not found. Please check your email address or create a new account.',
          'auth/user-not-found',
          error
        );
      }
    }

    const message = error instanceof Error ? error.message : 'Authentication failed';
    return this.createError(message, 'auth/unknown', error instanceof Error ? error : undefined);
  },

  getPhoneVerificationAction(navigation: any) {
    return {
      label: 'Verify Now!',
      onPress: () => navigation.navigate('PhoneVerification', { screen: 'EnterPhone' }),
    };
  },
};
