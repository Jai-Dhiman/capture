import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/authStore";
import { useProfileStore } from "../../stores/profileStore";
import { API_URL } from "@env";
import { useAlert } from "../../lib/AlertContext";
import { errorService } from "../../services/errorService";
import { authService } from "../../services/authService";

export function useAuth() {
  const { setUser, setSession, clearAuth } = useAuthStore();
  const { setProfile, clearProfile } = useProfileStore();
  const queryClient = useQueryClient();
  const { showAlert } = useAlert();

  const fetchUserProfile = async (userId: string, token: string) => {
    try {
      const checkResponse = await fetch(`${API_URL}/api/profile/check/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!checkResponse.ok) throw new Error("Profile check failed");

      const checkData = await checkResponse.json();

      if (checkData.exists) {
        const profileResponse = await fetch(`${API_URL}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `
              query GetProfile($userId: ID!) {
                profile(id: $userId) {
                  id
                  userId
                  username
                  bio
                  profileImage
                }
              }
            `,
            variables: { userId },
          }),
        });

        if (!profileResponse.ok) throw new Error("Failed to fetch profile");

        const data = await profileResponse.json();
        if (data.errors) {
          throw new Error(data.errors[0]?.message || "Failed to fetch profile");
        }

        return data.data.profile;
      }

      return null;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  };

  const login = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const authData = await authService.signIn(email, password);

      if (!authData.user?.email_confirmed_at) {
        throw new Error("Please verify your email before logging in");
      }

      const profileData = await fetchUserProfile(authData.user.id, authData.session.access_token);

      return {
        user: authData.user,
        session: authData.session,
        profile: profileData,
      };
    },
    onSuccess: (data) => {
      setUser({
        id: data.user.id,
        email: data.user.email || "",
        phone: data.user.phone || "",
        phone_confirmed_at: data.user.phone_confirmed_at || undefined,
      });

      setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: new Date(data.session.expires_at || "").getTime(),
      });

      if (data.profile) {
        setProfile({
          id: data.profile.id,
          userId: data.user.id,
          username: data.profile.username,
          bio: data.profile.bio || undefined,
          profileImage: data.profile.profileImage || undefined,
        });
      }

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
      clearAuth();
      clearProfile();
      queryClient.clear();
      return true;
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

  return {
    login,
    signup,
    logout,
  };
}
