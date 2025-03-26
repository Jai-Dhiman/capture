import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "../../stores/authStore";

export function useSessionManager() {
  const { session, refreshSession } = useAuthStore();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        refreshSession();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!session?.access_token) return;

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const timeUntilExpiry = Math.max(0, session.expires_at - Date.now() - 5 * 60 * 1000);

    refreshTimerRef.current = setTimeout(() => {
      refreshSession();
    }, timeUntilExpiry);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [session?.access_token, session?.expires_at, refreshSession]);

  return null;
}
