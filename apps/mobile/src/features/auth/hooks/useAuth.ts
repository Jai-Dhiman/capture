import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAlert } from "@shared/lib/AlertContext";
import { errorService } from "@shared/services/errorService";
import { authService } from "../lib/authService";
import { useAuthStore } from "../stores/authStore";
import type { UserProfile, AuthUser, AuthSession, AuthStage } from "../types/authTypes";

interface SignInServiceResponse {
  session: AuthSession;
  user: AuthUser;
  profileExists: boolean;
  profile?: UserProfile;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  const setAuthenticatedData = useAuthStore((state) => state.setAuthenticatedData);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setAuthStage = useAuthStore((state) => state.setAuthStage);
  const storeUser = useAuthStore((state) => state.user);
  const storeSession = useAuthStore((state) => state.session);
  const storeProfileExists = useAuthStore((state) => state.profileExists);

  const login = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }): Promise<SignInServiceResponse> => {
      return await authService.signIn(email, password) as SignInServiceResponse;
    },
    onSuccess: async (data) => {
      setAuthenticatedData(data.user, data.session, data.profileExists);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      console.error("Login error:", error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  const signup = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return await authService.signUp(email, password);
    },
    onSuccess: (_data) => {
      showAlert("Signup successful! Please check your email to verify your account.", { type: "success" });
    },
    onError: (error) => {
      console.error("Signup error:", error);
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      return await authService.logout();
    },
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
    },
    onError: (error) => {
      console.error("Logout error:", error);
      const appError = errorService.createError(
        "Failed to sign out. Please try again.",
        "auth/logout-error",
        error instanceof Error ? error : undefined
      );
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  const sendOTP = useMutation({
    mutationFn: async ({ phone, token }: { phone: string; token: string }) => {
      return await authService.sendOTP(phone, token);
    },
    onError: (error) => {
      const appError = errorService.handleAuthError(error);

      const isTwilioError =
        appError.message.toLowerCase().includes("twilio") ||
        appError.code.includes("otp") ||
        appError.code.includes("verify");

      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
        duration: isTwilioError ? undefined : 3000,
        action: isTwilioError
          ? {
              label: "Dismiss",
              onPress: () => {},
            }
          : undefined,
      });
    },
  });

  const verifyOTP = useMutation({
    mutationFn: async ({ phone, code }: { phone: string; code: string }) => {
      return await authService.verifyOTP(phone, code);
    },
    onSuccess: (_data, variables) => {
      if (storeUser && storeSession) {
        const updatedUser: AuthUser = {
          ...storeUser,
          phone: variables.phone,
          phone_confirmed_at: new Date().toISOString()
        };
        setAuthenticatedData(updatedUser, storeSession, storeProfileExists, "complete");
      } else {
        setAuthStage("complete");
      }
      showAlert("Phone verified successfully!", { type: "success" });
    },
    onError: (error) => {
      const appError = errorService.handleAuthError(error);

      const isTwilioError =
        appError.message.toLowerCase().includes("twilio") ||
        appError.code.includes("otp") ||
        appError.code.includes("verify");

      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
        duration: isTwilioError ? undefined : 3000,
        action: isTwilioError
          ? {
              label: "Dismiss",
              onPress: () => {},
            }
          : undefined,
      });
    },
  });

  const oauthSignIn = useMutation({
    mutationFn: async (provider: "google" | "apple") => {
      return await authService.signInWithProvider(provider);
    },
    onError: (error) => {
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  return {
    login,
    signup,
    logout,
    sendOTP,
    verifyOTP,
    oauthSignIn,
  };
}
