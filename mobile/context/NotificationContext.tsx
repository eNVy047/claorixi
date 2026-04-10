import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

interface NotificationContextData {
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
  decrementUnreadCount: () => void;
  clearUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextData>({
  unreadCount: 0,
  fetchUnreadCount: async () => {},
  decrementUnreadCount: () => {},
  clearUnreadCount: () => {},
});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { isAuthenticated } = useAuth();

  const fetchUnreadCount = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await api.get('/api/v1/notifications/unread-count');
      if (response.data.success) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      // Silently fail or use a logger if needed
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
    }

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated) {
        fetchUnreadCount();
      }
    });

    const pushSubscription = Notifications.addNotificationReceivedListener(notification => {
      // Optimistically increment on new push
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      subscription.remove();
      pushSubscription.remove();
    };
  }, [isAuthenticated]);

  const decrementUnreadCount = () => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const clearUnreadCount = () => {
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, fetchUnreadCount, decrementUnreadCount, clearUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
