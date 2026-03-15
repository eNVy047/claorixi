import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { GoalProvider } from '../context/GoalContext';

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
  const { isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

// Root layout wraps everything in AuthProvider
export default function RootLayout() {
  return (
    <AuthProvider>
      <GoalProvider>
        <RootLayoutInner />
      </GoalProvider>
    </AuthProvider>
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
