import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  // While loading, return null — _layout.tsx shows the splash screen
  if (isLoading) return null;

  return <Redirect href={isAuthenticated ? '/(tabs)/(dashboard)' : '/(auth)/sign-in'} />;
}
