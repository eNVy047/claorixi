import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the base URL dynamically based on the platform
export const API_BASE_URL = Platform.OS === 'android'
  ? 'http://192.168.166.79:8000'
  : 'http://192.168.166.79:8000'; // Set to physical network IP for both temporarily to guarantee connection on same network.

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
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
