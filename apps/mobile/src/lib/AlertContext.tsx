import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ThemedAlert, AlertType } from '../components/ui/Alert';

interface AlertContextProps {
  showAlert: (message: string, options?: {
    type?: AlertType;
    action?: {
      label: string;
      onPress: () => void;
    };
    duration?: number;
  }) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [alertType, setAlertType] = useState<AlertType>('info');
  const [action, setAction] = useState<{ label: string; onPress: () => void } | undefined>();
  const [duration, setDuration] = useState<number | undefined>();

  const showAlert = (msg: string, options?: {
    type?: AlertType;
    action?: {
      label: string;
      onPress: () => void;
    };
    duration?: number;
  }) => {
    setMessage(msg);
    setAlertType(options?.type || 'info');
    setAction(options?.action);
    setDuration(options?.duration);
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <ThemedAlert
        visible={visible}
        message={message}
        type={alertType}
        action={action}
        duration={duration}
        onDismiss={hideAlert}
      />
    </AlertContext.Provider>
  );
};