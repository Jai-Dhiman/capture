import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAlert } from "@shared/lib/AlertContext";
import { errorService } from "@shared/services/errorService";
import { workersAuthApi } from "../lib/workersAuthApi";
import { useAuthStore } from "../stores/authStore";
import type { User, Session, AuthResponse, LoginCredentials, RegisterData, BasicSuccessResponse, RegisterResponse as ApiRegisterResponse } from "../types";

interface LoginMutationParams extends LoginCredentials {}
interface SignupMutationParams extends RegisterData {}

export function useAuth() {
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();
  
  const setAuthData = useAuthStore((state) => state.setAuthData);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  // const setStage = useAuthStore((state) => state.setStage); // Corrected, but may not be frequently used here
  // User and Session can be accessed if needed for specific logic, but mutations primarily call actions.
  // const user = useAuthStore((state) => state.user);
  // const session = useAuthStore((state) => state.session);

  const loginMutation = useMutation<AuthResponse, Error, LoginMutationParams>({
    mutationFn: async ({ email, password }: LoginMutationParams) => {
      return await workersAuthApi.login({ email, password });
    },
    onSuccess: (data) => {
      setAuthData(data); 
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

  const signupMutation = useMutation<ApiRegisterResponse, Error, SignupMutationParams>({
    mutationFn: async ({ email, password }: SignupMutationParams) => {
      return await workersAuthApi.register({ email, password });
    },
    onSuccess: (data) => {
      showAlert(data.message || "Signup successful! Please check your email to verify your account, then login.", { type: "success" });
    },
    onError: (error) => {
      console.error("Signup error:", error);
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
      showAlert("You have been logged out.", { type: "info" });
    },
    onError: (error) => {
      console.error("Logout error:", error);
      const appError = errorService.createError(
        "Failed to sign out properly. Your local session is cleared.",
        "auth/logout-error",
        error instanceof Error ? error : undefined
      );
      showAlert(appError.message, {
        type: errorService.getAlertType(appError.category),
      });
    },
  });

  // OTP and OAuth are commented out as they are being phased out.
  /*
  // ... (commented out OTP and OAuth code)
  */

  return {
    login: loginMutation, 
    signup: signupMutation, 
    logout: logoutMutation, 
  };
}
