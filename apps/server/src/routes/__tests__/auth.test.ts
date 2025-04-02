import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import authRouter from "../auth";
import { createMockBindings } from "../../test/utils/test-utils";
import type { Bindings, Variables } from "../../types";

interface ErrorResponse {
  error: string;
  code: string;
}

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockRefreshSession = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockSetSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        refreshSession: mockRefreshSession,
        resetPasswordForEmail: mockResetPasswordForEmail,
        updateUser: mockUpdateUser,
        signInWithOtp: mockSignInWithOtp,
        verifyOtp: mockVerifyOtp,
        signInWithOAuth: mockSignInWithOAuth,
        exchangeCodeForSession: mockExchangeCodeForSession,
        setSession: mockSetSession,
        getUser: mockGetUser,
      },
    })),
  };
});

vi.mock("../../middleware/rateLimit", () => ({
  authRateLimiter: vi.fn().mockImplementation((c, next) => next()),
  passwordResetRateLimiter: vi.fn().mockImplementation((c, next) => next()),
  otpRateLimiter: vi.fn().mockImplementation((c, next) => next()),
}));

describe("Auth Routes", () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>;
  let mockBindings: Bindings;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBindings = createMockBindings();

    app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

    app.use("*", async (c, next) => {
      c.env = mockBindings;
      await next();
    });

    app.route("/auth", authRouter);
  });

  describe("POST /signin", () => {
    it("should successfully sign in a user with valid credentials", async () => {
      // Setup
      const mockSessionData = {
        user: { id: "test-user-id", email: "test@example.com" },
        session: { access_token: "test-token", refresh_token: "test-refresh" },
      };

      mockSignInWithPassword.mockResolvedValue({ data: mockSessionData, error: null });

      // Execute
      const res = await app.request("/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockSessionData);
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    it("should return 400 with invalid credentials", async () => {
      // Setup
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: "Invalid login credentials" },
      });

      // Execute
      const res = await app.request("/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "wrongpassword",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "Invalid login credentials",
        code: "auth/invalid-credentials",
      });
    });

    it("should validate input and return 400 for invalid data", async () => {
      // Execute
      const res = await app.request("/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "not-an-email",
          password: "123", // too short
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("Invalid input");
      expect(data.code).toBe("auth/invalid-input");
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe("POST /signup", () => {
    it("should successfully sign up a new user", async () => {
      // Setup
      const mockSignupData = {
        user: { id: "new-user-id", email: "newuser@example.com" },
        session: null,
      };

      mockSignUp.mockResolvedValue({
        data: mockSignupData,
        error: null,
      });

      // Execute
      const res = await app.request("/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:8081",
        },
        body: JSON.stringify({
          email: "newuser@example.com",
          password: "password123",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockSignupData);
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "newuser@example.com",
        password: "password123",
        options: {
          emailRedirectTo: "http://localhost:8081/auth/callback",
        },
      });
    });

    it("should return 400 when signup fails", async () => {
      // Setup
      mockSignUp.mockResolvedValue({
        data: null,
        error: { message: "User already exists" },
      });

      // Execute
      const res = await app.request("/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:8081",
        },
        body: JSON.stringify({
          email: "existing@example.com",
          password: "password123",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "User already exists",
        code: "auth/signup-failed",
      });
    });
  });

  describe("POST /refresh", () => {
    it("should successfully refresh a token", async () => {
      // Setup
      const mockRefreshData = {
        session: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_at: 1234567890,
        },
      };

      mockRefreshSession.mockResolvedValue({
        data: mockRefreshData,
        error: null,
      });

      // Execute
      const res = await app.request("/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: "old-refresh-token",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_at: 1234567890,
      });
      expect(mockRefreshSession).toHaveBeenCalledWith({
        refresh_token: "old-refresh-token",
      });
    });

    it("should return 401 when refresh fails", async () => {
      // Setup
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid refresh token" },
      });

      // Execute
      const res = await app.request("/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: "invalid-refresh-token",
        }),
      });

      // Assert
      expect(res.status).toBe(401);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "Invalid refresh token",
        code: "auth/refresh-failed",
      });
    });
  });

  describe("POST /reset-password", () => {
    it("should successfully request a password reset", async () => {
      // Setup
      mockResetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      });

      // Execute
      const res = await app.request("/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:8081",
        },
        body: JSON.stringify({
          email: "user@example.com",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
        redirectTo: "http://localhost:8081/auth/reset-password",
      });
    });

    it("should return 400 when password reset fails", async () => {
      // Setup
      mockResetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { message: "Email not found" },
      });

      // Execute
      const res = await app.request("/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:8081",
        },
        body: JSON.stringify({
          email: "nonexistent@example.com",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "Email not found",
        code: "auth/reset-failed",
      });
    });
  });

  describe("POST /update-password", () => {
    it("should update password successfully with valid token", async () => {
      // Setup
      mockUpdateUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      });

      // Execute
      const res = await app.request("/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          password: "new-password123",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "new-password123",
      });
    });

    it("should return 401 when no token is provided", async () => {
      // Execute
      const res = await app.request("/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: "new-password123",
        }),
      });

      // Assert
      expect(res.status).toBe(401);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "No token provided",
        code: "auth/no-token",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("should return 400 when password update fails", async () => {
      // Setup
      mockUpdateUser.mockResolvedValue({
        data: null,
        error: { message: "Invalid token" },
      });

      // Execute
      const res = await app.request("/auth/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({
          password: "new-password123",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "Invalid token",
        code: "auth/update-failed",
      });
    });
  });

  describe("POST /send-otp", () => {
    it("should send OTP successfully", async () => {
      // Setup
      mockGetUser.mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      });

      mockSignInWithOtp.mockResolvedValue({
        data: {
          messageHash: "test-hash",
        },
        error: null,
      });

      // Execute
      const res = await app.request("/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          phone: "+1234567890",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        messageHash: "test-hash",
      });
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        phone: "+1234567890",
      });
    });

    it("should return 401 when no token is provided", async () => {
      // Execute
      const res = await app.request("/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "+1234567890",
        }),
      });

      // Assert
      expect(res.status).toBe(401);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "No token provided",
        code: "auth/no-token",
      });
      expect(mockSignInWithOtp).not.toHaveBeenCalled();
    });

    it("should return 401 when user token is invalid", async () => {
      // Setup
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token" },
      });

      // Execute
      const res = await app.request("/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({
          phone: "+1234567890",
        }),
      });

      // Assert
      expect(res.status).toBe(401);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "Invalid token",
        code: "auth/invalid-token",
      });
      expect(mockSignInWithOtp).not.toHaveBeenCalled();
    });
  });

  describe("POST /verify-otp", () => {
    it("should verify OTP successfully", async () => {
      // Setup
      const mockVerifyData = {
        user: { id: "test-user-id" },
        session: { access_token: "test-token" },
      };

      mockVerifyOtp.mockResolvedValue({
        data: mockVerifyData,
        error: null,
      });

      // Execute
      const res = await app.request("/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "+1234567890",
          token: "123456",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockVerifyData);
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        phone: "+1234567890",
        token: "123456",
        type: "sms",
      });
    });

    it("should return 400 when OTP verification fails", async () => {
      // Setup
      mockVerifyOtp.mockResolvedValue({
        data: null,
        error: { message: "Invalid OTP" },
      });

      // Execute
      const res = await app.request("/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "+1234567890",
          token: "invalid",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "Invalid OTP",
        code: "auth/verify-failed",
      });
    });
  });

  describe("POST /oauth", () => {
    it("should initiate OAuth sign in successfully", async () => {
      // Setup
      const mockOAuthData = {
        url: "https://oauth-provider.com/authorize?response_type=code&client_id=123&redirect_uri=http://localhost:8081/auth/callback",
      };

      mockSignInWithOAuth.mockResolvedValue({
        data: mockOAuthData,
        error: null,
      });

      // Execute
      const res = await app.request("/auth/oauth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:8081",
        },
        body: JSON.stringify({
          provider: "google",
          code_challenge: "abc123",
          code_challenge_method: "S256",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockOAuthData);
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:8081/auth/callback",
          queryParams: {
            code_challenge: "abc123",
            code_challenge_method: "S256",
          },
        },
      });
    });

    it("should return 400 when OAuth initiation fails", async () => {
      // Setup
      mockSignInWithOAuth.mockResolvedValue({
        data: null,
        error: { message: "Invalid provider" },
      });

      // Execute
      const res = await app.request("/auth/oauth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:8081",
        },
        body: JSON.stringify({
          provider: "google",
          code_challenge: "abc123",
          code_challenge_method: "S256",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as ErrorResponse;
      expect(data).toEqual({
        error: "Invalid provider",
        code: "auth/oauth-failed",
      });
    });
  });

  describe("POST /handle-callback", () => {
    it("should handle OAuth callback with hash fragment successfully", async () => {
      // Setup
      const mockSessionData = {
        session: { access_token: "new-token", refresh_token: "new-refresh" },
        user: { id: "user-id" },
      };

      mockSetSession.mockResolvedValue({
        data: mockSessionData,
        error: null,
      });

      // Execute
      const res = await app.request("/auth/handle-callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com/callback#access_token=test-token&refresh_token=test-refresh&type=signup",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        session: mockSessionData.session,
        user: mockSessionData.user,
        type: "signup",
      });
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: "test-token",
        refresh_token: "test-refresh",
      });
    });

    it("should handle OAuth callback with code parameter successfully", async () => {
      // Setup
      const mockSessionData = {
        session: { access_token: "new-token", refresh_token: "new-refresh" },
        user: { id: "user-id" },
      };

      mockExchangeCodeForSession.mockResolvedValue({
        data: mockSessionData,
        error: null,
      });

      // Execute
      const res = await app.request("/auth/handle-callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com/callback?code=auth-code",
          code_verifier: "code-verifier",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        session: mockSessionData.session,
        user: mockSessionData.user,
      });
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    });

    it("should return 400 for invalid callback URL", async () => {
      // Execute
      const res = await app.request("/auth/handle-callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com/callback",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toContain("Invalid auth callback URL");
      expect(data.code).toBe("auth/invalid-callback");
    });
  });
});
