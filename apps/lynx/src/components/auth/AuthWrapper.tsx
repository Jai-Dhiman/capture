import 'background-only';
import { useState, useEffect } from '@lynx-js/react';
import { useAuth } from '../../hooks/auth/useAuth.ts';
import { useSessionStore } from '../../stores/sessionStore.ts';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  'background only';
  const auth = useAuth();
  const { authUser, userProfile } = useSessionStore();
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data || {};
      
      if (type === 'AUTH_LOGIN') {
        auth.login.mutate({ 
          email: data.email, 
          password: data.password 
        });
      } 
      else if (type === 'AUTH_SIGNUP') {
        auth.signup.mutate({ 
          email: data.email, 
          password: data.password 
        });
      } 
      else if (type === 'AUTH_LOGOUT') {
        auth.logout.mutate();
      }
      else if (type === 'AUTH_GET_STATE') {
        window.postMessage({
          type: 'AUTH_STATE_UPDATE',
          isLoggedIn: !!authUser,
          hasProfile: !!userProfile,
          isLoading: auth.loading
        }, '*');
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [auth, authUser, userProfile]);

  useEffect(() => {
    window.postMessage({
      type: 'AUTH_STATE_UPDATE',
      isLoggedIn: !!authUser,
      hasProfile: !!userProfile,
      isLoading: auth.loading
    }, '*');
  }, [authUser, userProfile, auth.loading]);
  
  return children;
}