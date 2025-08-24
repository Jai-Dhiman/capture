import { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SessionInfo {
  sessionId: string;
  isNewSession: boolean;
  sessionStartTime: number;
}

/**
 * Hook to track user sessions for context-aware recommendation devaluation
 * Helps the backend understand when to apply lighter devaluation to seen posts
 */
export const useSessionTracking = () => {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    sessionId: '',
    isNewSession: false,
    sessionStartTime: Date.now(),
  });

  const initializeSession = useRef<() => Promise<void>>();

  // Initialize session tracking
  initializeSession.current = async () => {
    try {
      const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      const now = Date.now();

      // Check for existing session
      const lastSession = await AsyncStorage.getItem('@session_info');
      let isNewSession = true;
      let sessionId = `session_${now}_${Math.random().toString(36).substr(2, 9)}`;

      if (lastSession) {
        const parsed = JSON.parse(lastSession);
        const timeSinceLastSession = now - parsed.lastActivity;

        // If last activity was within timeout, continue existing session
        if (timeSinceLastSession < SESSION_TIMEOUT) {
          isNewSession = false;
          sessionId = parsed.sessionId;
        }
      }

      // Save current session info
      const sessionData = {
        sessionId,
        lastActivity: now,
        startTime: isNewSession ? now : (lastSession ? JSON.parse(lastSession).startTime : now),
      };

      await AsyncStorage.setItem('@session_info', JSON.stringify(sessionData));

      setSessionInfo({
        sessionId,
        isNewSession,
        sessionStartTime: sessionData.startTime,
      });

    } catch (error) {
      console.warn('Failed to initialize session tracking:', error);
      // Fallback to basic session
      const fallbackSessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionInfo({
        sessionId: fallbackSessionId,
        isNewSession: true,
        sessionStartTime: Date.now(),
      });
    }
  };

  // Update last activity timestamp
  const updateActivity = async () => {
    try {
      const sessionData = await AsyncStorage.getItem('@session_info');
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        parsed.lastActivity = Date.now();
        await AsyncStorage.setItem('@session_info', JSON.stringify(parsed));
      }
    } catch (error) {
      console.warn('Failed to update session activity:', error);
    }
  };

  // Initialize session on mount
  useEffect(() => {
    initializeSession.current?.();
  }, []);

  // Update activity when component is focused/used
  useEffect(() => {
    updateActivity();
  }, []);

  return {
    sessionId: sessionInfo.sessionId,
    isNewSession: sessionInfo.isNewSession,
    sessionStartTime: sessionInfo.sessionStartTime,
    updateActivity,
  };
};