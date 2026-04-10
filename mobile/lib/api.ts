import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CrashService } from './crashlytics';

// Define the base URL dynamically based on the platform
export const API_BASE_URL = Platform.OS === 'android'
  ? 'https://caloxi.xoraxi.cloud'
  : 'https://caloxi.xoraxi.cloud';


// Create a configured axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optionally add an interceptor to inject the token automatically
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Ignore async storage error
    }
    CrashService.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle offline queueing
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if it's a network error (no response)
    const isNetworkError = !error.response && error.code !== 'ECONNABORTED';

    if (isNetworkError) {
      const { method, url, data } = originalRequest;
      CrashService.log(`⚠️ Network Error (will queue): ${method?.toUpperCase()} ${url}`);
      const writeMethods = ['post', 'patch', 'put', 'delete'];

      if (writeMethods.includes(method?.toLowerCase() || '')) {
        // Import GoalStore here to avoid circular dependency
        const { useGoalStore } = require('../store/useGoalStore');

        useGoalStore.getState().addToQueue({
          url,
          method: method.toUpperCase(),
          body: data ? JSON.parse(data) : null,
        });

        CrashService.log(`✅ Request queued for offline sync: ${url}`);
        return Promise.resolve({ data: { success: true, offline: true } });
      }
    }

    // Log non-401/404 errors to Crashlytics
    const status = error.response?.status;
    if (status && status !== 401 && status !== 404) {
      CrashService.recordError(error, `API_Error_${status}`);
    } else if (!error.response) {
      CrashService.recordError(error, 'API_Network_Error');
    }

    return Promise.reject(error);
  }
);
