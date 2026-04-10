import { Redirect } from 'expo-router';

export default function Index() {
  // Let the navigation guard in _layout.tsx/AuthContext handle the redirection logic
  return <Redirect href="/(tabs)/(dashboard)" />;
}
