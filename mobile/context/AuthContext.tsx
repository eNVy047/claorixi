import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { api } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email: string;
  subscriptionTier: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check AsyncStorage for a stored token and validate it
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          // No token — user is logged out
          setUser(null);
          return;
        }

        // Validate token with backend
        const response = await api.get('/api/v1/auth/verify');
        if (response.data.success) {
          setUser(response.data.data.user);
        } else {
          // Unexpected non-success — clear token
          await AsyncStorage.removeItem('authToken');
          setUser(null);
        }
      } catch (_error) {
        // Token expired or invalid — clear it silently
        await AsyncStorage.removeItem('authToken');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  // Navigation guard: redirect based on auth state when segments change
  useEffect(() => {
    if (isLoading) return; // Don't navigate while still checking

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (user && inAuthGroup) {
      // Logged in but on an auth screen — send to dashboard
      router.replace('/(tabs)/(dashboard)');
    } else if (!user && inTabsGroup) {
      // Not logged in but on a dashboard screen — send to login
      router.replace('/(auth)/sign-in');
    }
  }, [user, segments, isLoading]);

  const login = useCallback(async (token: string, authUser: AuthUser) => {
    await AsyncStorage.setItem('authToken', token);
    setUser(authUser);
    router.replace('/(tabs)/(dashboard)');
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (_) {
      // Ignore network errors on logout
    }
    await AsyncStorage.removeItem('authToken');
    setUser(null);
    router.replace('/(auth)/sign-in');
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
