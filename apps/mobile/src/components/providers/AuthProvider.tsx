import React, { ReactNode } from 'react';
import { useSessionManager } from '../../hooks/auth/useSessionManager';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  useSessionManager();
  
  return <>{children}</>;
}