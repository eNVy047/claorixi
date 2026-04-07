import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { GoalProvider } from '../context/GoalContext';
import { NotificationProvider } from '../context/NotificationContext';
import { registerStepBackgroundSync } from '../lib/stepsBackground';
import PaywallPopup from '../components/PaywallPopup';

import { registerForPushNotificationsAsync, syncPushToken } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  React.useEffect(() => {
    registerStepBackgroundSync().catch(() => {
      // Best-effort; background fetch availability varies by platform/settings.
    });
  }, []);

  React.useEffect(() => {
    async function setupNotifications() {
      if (user) {
        const token = await registerForPushNotificationsAsync();
        const userToken = await AsyncStorage.getItem('authToken');
        if (token && userToken) {
          await syncPushToken(token, userToken);
        }
      }
    }
    setupNotifications();
  }, [user]);

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
      <AuthProvider>
        <GoalProvider>
          <NotificationProvider>
            <RootLayoutInner />
          </NotificationProvider>
        </GoalProvider>
      </AuthProvider>
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
