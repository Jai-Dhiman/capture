import { authService } from "../services/authService";
import { useAuthStore } from "../stores/authStore";

export async function handleSupabaseDeepLink(url: string): Promise<string | null> {
  try {
    const data = await authService.handleAuthCallback(url);

    if (data.session) {
      const { setUser, setSession } = useAuthStore.getState();

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

      if (url.includes("type=recovery")) {
        return "/auth/reset-password";
      } else if (url.includes("type=signup")) {
        return "/auth/login";
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to handle deep link:", error);
    return null;
  }
}
