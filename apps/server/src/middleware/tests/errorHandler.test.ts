import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../errorHandler';

describe('Error Handler Middleware', () => {
  let mockContext;
  let consoleSpy;

  beforeEach(() => {
    // Mock Hono context
    mockContext = {
      json: vi.fn().mockReturnValue('json-response'),
      env: {
        ENV: 'development', // Default to development for most tests
      },
      get: vi.fn(),
    };

    // Spy on console.error to verify logging
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should log the error and return a JSON response', () => {
    // Create test error
    const testError = new Error('Test error message');

    // Call error handler
    const response = errorHandler(testError, mockContext);

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] Test error message'),
      testError,
    );

    // Verify JSON response was returned
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: 'Test error message', // In development mode, we return the actual error message
      },
      500,
    );

    // Verify the response was returned
    expect(response).toBe('json-response');
  });

  it('should send a generic error message in production', () => {
    // Set environment to production
    mockContext.env.ENV = 'production';

    // Create test error
    const testError = new Error('Sensitive error message');

    // Call error handler
    errorHandler(testError, mockContext);

    // Verify generic error message was returned
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        error: 'Internal Server Error', // In production, we hide the actual error message
      },
      500,
    );
  });

  it('should capture the exception with Sentry if available', () => {
    // Create mock Sentry instance
    const mockSentry = {
      captureException: vi.fn(),
    };

    // Set up context to return Sentry
    mockContext.get.mockImplementation((key) => {
      if (key === 'sentry') {
        return mockSentry;
      }
      return null;
    });

    // Create test error
    const testError = new Error('Test error message');

    // Call error handler
    errorHandler(testError, mockContext);

    // Verify Sentry was called
    expect(mockSentry.captureException).toHaveBeenCalledWith(testError);
  });
});
