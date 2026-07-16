import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PROD_API_URL = 'https://api.inventra.sn/api/v1';
const DEV_API_PORT = 8000;

function getDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri
    ?? Constants.expoGoConfig?.debuggerHost
    ?? (Constants.manifest2 as { extra?: { expoClient?: { hostUri?: string } } } | null)
      ?.extra?.expoClient?.hostUri;

  if (hostUri) {
    return hostUri.split(':')[0];
  }

  return null;
}

function resolveDevApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const devHost = getDevHost();
  if (devHost && devHost !== 'localhost' && devHost !== '127.0.0.1') {
    return `http://${devHost}:${DEV_API_PORT}/api/v1`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEV_API_PORT}/api/v1`;
  }

  return `http://localhost:${DEV_API_PORT}/api/v1`;
}

export const API_BASE_URL = __DEV__ ? resolveDevApiUrl() : (process.env.EXPO_PUBLIC_API_URL || PROD_API_URL);
