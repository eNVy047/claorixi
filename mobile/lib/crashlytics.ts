import { isExpoGo, hasNativeModule } from './environment';

/**
 * CrashlyticsService provides a unified interface for logging breadcrumbs,
 * reporting errors, and managing user identity in Firebase Crashlytics.
 * 
 * NOTE: This service safely handles environments without the native Firebase module 
 * (like Expo Go) by providing a no-op fallback.
 */
class CrashlyticsService {
  private crashlyticsModule: any = null;
  private isAvailable: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability() {
    // Check if the native module is actually registered in the bridge
    if (!hasNativeModule('RNFirebaseCrashlytics')) {
      this.isAvailable = false;
      return;
    }
    try {
      // Try to require the module dynamically to prevent top-level crashes
      const crashlytics = require('@react-native-firebase/crashlytics');
      
      // Specifically check if the module is functional. 
      // In Expo Go, require may work but the native initialization will fail.
      if (typeof crashlytics === 'function') {
        const instance = crashlytics();
        if (instance && typeof instance.log === 'function') {
          this.crashlyticsModule = crashlytics;
          this.isAvailable = true;
          return;
        }
      }
      throw new Error('Native Crashlytics instance unavailable');
    } catch (e) {
      if (__DEV__) {
        console.warn('[Crashlytics] Native module not found. Running in mock mode (likely Expo Go).');
      }
      this.isAvailable = false;
      this.crashlyticsModule = null;
    }
  }

  /**
   * Helper to access the native crashlytics function safely
   */
  private getModule() {
    if (this.isAvailable && this.crashlyticsModule) {
      return this.crashlyticsModule();
    }
    return null;
  }

  /**
   * Initialize Crashlytics collection.
   */
  async init() {
    const isDev = __DEV__;
    const mod = this.getModule();
    
    if (mod) {
      try {
        await mod.setCrashlyticsCollectionEnabled(!isDev);
      } catch (e) {
        this.recordError(e as Error, 'CrashlyticsInitError');
      }
    }
    if (__DEV__) {
      this.log(`Crashlytics initialized. Status: ${this.isAvailable ? 'Available' : 'Mock/Unavailable'}. Mode: ${isDev ? 'Development (Disabled)' : 'Production (Enabled)'}`);
    }
  }

  /**
   * Log a message (breadcrumb)
   */
  log(message: string) {
    if (__DEV__) {
      console.log(`[Crashlytics Log]: ${message}`);
    }
    const mod = this.getModule();
    if (mod) mod.log(message);
  }

  /**
   * Record a non-fatal error
   */
  recordError(error: Error, jsErrorName?: string) {
    if (__DEV__) {
      console.error(`[Crashlytics Error]: ${jsErrorName || error.name}`, error);
    }
    const mod = this.getModule();
    if (mod) mod.recordError(error, jsErrorName);
  }

  /**
   * Set user identity
   */
  async setUserIdentity(userId: string, email: string, subscriptionStatus: string) {
    const mod = this.getModule();
    if (mod) {
      try {
        await Promise.all([
          mod.setUserId(userId || ''),
          mod.setAttribute('email', email || ''),
          mod.setAttribute('subscriptionStatus', subscriptionStatus || 'none'),
        ]);
        this.log(`User identity set: ${userId}`);
      } catch (e: any) {
        this.recordError(e, 'SetUserIdentityError');
      }
    } else {
      this.log(`Attempted to set user identity: ${userId} (Native module unavailable)`);
    }
  }

  /**
   * Clear user identity
   */
  async clearUserIdentity() {
    const mod = this.getModule();
    if (mod) {
      try {
        await Promise.all([
          mod.setUserId(''),
          mod.setAttribute('email', ''),
          mod.setAttribute('subscriptionStatus', 'none'),
        ]);
        this.log('User identity cleared.');
      } catch (e: any) {
        this.recordError(e, 'ClearUserIdentityError');
      }
    }
  }

  /**
   * For testing purposes only
   */
  crash() {
    this.log('Testing crash...');
    const mod = this.getModule();
    if (mod) {
      mod.crash();
    } else if (__DEV__) {
      console.warn('[Crashlytics] Native crash only works in standalone/dev builds.');
    }
  }
}

export const CrashService = new CrashlyticsService();
