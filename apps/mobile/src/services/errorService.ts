export type ErrorCategory = 'auth' | 'network' | 'validation' | 'server' | 'unknown'

export interface AppError {
  message: string
  code: string
  category: ErrorCategory
  originalError?: Error
}

export const errorService = {
  categorizeError(code: string): ErrorCategory {
    if (code.startsWith('auth/')) return 'auth'
    if (code.startsWith('network/')) return 'network'
    if (code.startsWith('validation/')) return 'validation'
    if (code.startsWith('server/')) return 'server'
    return 'unknown'
  },

  formatErrorMessage(error: Error | AppError | unknown): string {
    if (!error) return 'An unknown error occurred'

    if (typeof error === 'object' && 'category' in error && 'message' in error) {
      return error.message as string
    }

    if (error instanceof Error) {
      return error.message
    }

    return 'An unexpected error occurred'
  },

  createError(message: string, code: string = 'unknown/error', originalError?: Error): AppError {
    return {
      message,
      code,
      category: this.categorizeError(code),
      originalError,
    }
  },

  handleAuthError(error: unknown): AppError {
    if (
      typeof error === 'object' &&
      error !== null &&
      'category' in error &&
      error.category === 'auth'
    ) {
      return error as AppError
    }

    if (error instanceof Error && error.name === 'AuthError' && 'code' in error) {
      return {
        message: error.message,
        code: (error as any).code || 'auth/unknown',
        category: 'auth',
        originalError: error,
      }
    }

    const message = error instanceof Error ? error.message : 'Authentication failed'
    return this.createError(message, 'auth/unknown', error instanceof Error ? error : undefined)
  },
}
