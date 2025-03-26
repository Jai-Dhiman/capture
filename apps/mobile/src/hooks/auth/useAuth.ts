import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAlert } from "../../lib/AlertContext";
import { errorService } from "../../services/errorService";
import { authService } from "../../services/authService";
import { authState } from "../../stores/authState";

export function useAuth() {
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();

  const login = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return await authService.signIn(email, password);
    },
    onSuccess: (data) => {
      authState.setAuthenticated(data.user, data.session, data.profile);
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
      authState.clearAuth();
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
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  const verifyOTP = useMutation({
    mutationFn: async ({ phone, code }: { phone: string; code: string }) => {
      return await authService.verifyOTP(phone, code);
    },
    onSuccess: (_, variables) => {
      authState.setPhoneVerified(variables.phone);
      authState.setAuthStage("complete");
    },
    onError: (error) => {
      const appError = errorService.handleAuthError(error);
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
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
