import { NativeModules } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Utility to detect the current execution environment.
 * Used to guard native modules that are not available in Expo Go.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

/**
 * Checks if a specific native module is registered in the React Native bridge.
 * This is the most robust way to check for module existence before require().
 */
export const hasNativeModule = (moduleName: string): boolean => {
  return !!NativeModules[moduleName];
};

if (__DEV__) {
  console.log(`[Env] ${isExpoGo ? 'Expo Go' : 'Dev Build'} | Auth: ${Constants.appOwnership || 'standalone'} | Mode: ${Constants.executionEnvironment}`);
}
