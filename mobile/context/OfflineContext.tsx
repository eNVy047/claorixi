import React, { createContext, useContext, useEffect, useState } from 'react';
import { useGoalStore } from '../store/useGoalStore';
import { isExpoGo, hasNativeModule } from '../lib/environment';


/**
 * SafeNetInfo handles the native module access to NetInfo while providing
 * a graceful fallback for environments (like Expo Go) where it may be missing.
 */
const getNetInfo = () => {
  if (!hasNativeModule('RNCNetInfo')) return null;
  try {
    const NetInfo = require('@react-native-community/netinfo').default;
    // In Expo Go, the JS module may exist but the native implementation (RNCNetInfo) is null.
    // We check for addEventListener to ensure it's functional.
    if (NetInfo && typeof NetInfo.addEventListener === 'function') {
      return NetInfo;
    }
    throw new Error('NetInfo native module missing');
  } catch (e) {
    if (__DEV__) {
      console.warn('[OfflineContext] NetInfo native module not found. Defaulting to online state.');
    }
    return null;
  }
};

interface OfflineContextType {
  isOffline: boolean;
}

const OfflineContext = createContext<OfflineContextType>({
  isOffline: false,
});

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const NetInfo = getNetInfo();
    
    if (!NetInfo) {
      // Mock online state for development if native module is missing
      setIsOffline(false);
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state: any) => {
      // isInternetReachable is null | boolean. We consider it "offline" only if explicitly false.
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
      
      // If we just went from offline to online, trigger queue processing
      if (!offline) {
        useGoalStore.getState().processQueue();
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <OfflineContext.Provider value={{ isOffline }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => useContext(OfflineContext);
