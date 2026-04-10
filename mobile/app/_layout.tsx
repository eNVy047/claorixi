import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
// import * as NavigationBar from 'expo-navigation-bar'; // Moved to dynamic import to avoid crash
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { registerStepBackgroundSync } from '../lib/stepsBackground';
import PaywallPopup from '../components/PaywallPopup';
import { isExpoGo, hasNativeModule } from '../lib/environment';


import { registerForPushNotificationsAsync, syncPushToken } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGoalStore } from '../store/useGoalStore';
import Toast from 'react-native-toast-message';
import { api } from '../lib/api';
import { format, addDays, startOfToday, differenceInMilliseconds } from 'date-fns';
import { Pedometer } from 'expo-sensors';
import { OfflineProvider, useOffline } from '../context/OfflineContext';
import { OfflineBanner } from '../components/OfflineBanner';
import { CrashService } from '../lib/crashlytics';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Splash/Loading screen shown while token is being verified
function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashLogo}>🔥 Caloxi</Text>
      <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 24 }} />
    </View>
  );
}

// Inner layout that can use the AuthContext
function RootLayoutInner() {
  const { isLoading, user, logout } = useAuth();
  const [popupVisible, setPopupVisible] = React.useState(false);
  const store = useGoalStore();
  const { isOffline } = useOffline();
  
  const localStepsRef = React.useRef(0);

  React.useEffect(() => {
    // Initialize Crashlytics
    CrashService.init();
    
    registerStepBackgroundSync().catch((err) => {
      CrashService.recordError(err, 'RegisterBackgroundSyncError');
    });
  }, []);

  React.useEffect(() => {
    if (Platform.OS === 'android' && hasNativeModule('ExpoNavigationBar')) {
      try {
        // Use require to avoid top-level import crash when native module is missing
        const NavigationBar = require('expo-navigation-bar');
        if (NavigationBar && typeof NavigationBar.setVisibilityAsync === 'function') {
          NavigationBar.setVisibilityAsync('hidden');
          NavigationBar.setBehaviorAsync('overlay-swipe');
        }
      } catch (error) {
        // Silent fail for environmental reasons
      }
    }
  }, []);

  React.useEffect(() => {
    async function setupNotifications() {
      if (user) {
        // Fetch global overview (goals + consumed) on login/session start
        useGoalStore.getState().fetchOverview();

        const token = await registerForPushNotificationsAsync();
        const userToken = await AsyncStorage.getItem('authToken');
        if (token && userToken) {
          await syncPushToken(token, userToken);
        }
      }
    }
    setupNotifications();
  }, [user]);

  // Midnight Reset Timer
  React.useEffect(() => {
    let timer: NodeJS.Timeout;

    const setupMidnightReset = () => {
      const now = new Date();
      const tomorrow = startOfToday();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      timer = setTimeout(() => {
        useGoalStore.getState().midnightReset();
        setupMidnightReset(); // Reschedule for next day
      }, msUntilMidnight) as any;
    };

    setupMidnightReset();
    return () => clearTimeout(timer);
  }, []);

  // Global Step Tracker
  React.useEffect(() => {
    let subscription: Pedometer.Subscription | null = null;
    let lastCumulative = 0;

    const startTracking = async () => {
      const perm = await Pedometer.requestPermissionsAsync();
      if (perm.status !== 'granted') return;

      const isAvailable = await Pedometer.isAvailableAsync();
      if (isAvailable) {
        subscription = Pedometer.watchStepCount(result => {
          const delta = result.steps - lastCumulative;
          lastCumulative = result.steps;
          if (delta > 0) {
            localStepsRef.current += delta;
          }
        });
      }
    };

    if (user) startTracking();
    return () => subscription?.remove();
  }, [user]);

  // Persist steps every 30 seconds
  React.useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      if (localStepsRef.current > 0) {
        const delta = localStepsRef.current;
        localStepsRef.current = 0;
        store.updateConsumed({
          stepsTaken: store.stepsTaken + delta,
        });

        // Sync to backend if online
        if (!isOffline) {
          api.patch('/api/v1/activity/steps', { 
            steps: store.stepsTaken + delta,
            date: format(new Date(), 'yyyy-MM-dd') 
          }).catch(() => {});
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, isOffline]);

  React.useEffect(() => {
    if (user && (user.subscriptionStatus === 'expired' ||
      (user.subscriptionStatus === 'none' && user.subscriptionEndDate && new Date(user.subscriptionEndDate) < new Date()))) {
      setPopupVisible(true);
    } else {
      setPopupVisible(false);
    }
  }, [user]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <OfflineBanner />
      <PaywallPopup
        visible={popupVisible}
        onSuccess={() => setPopupVisible(false)}
        onLogout={logout}
      />
    </>
  );
}


// Root layout wraps everything in AuthProvider
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <OfflineProvider>
            <NotificationProvider>
              <RootLayoutInner />
            </NotificationProvider>
          </OfflineProvider>
        </AuthProvider>
      </ErrorBoundary>
      <Toast />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
  },
});
