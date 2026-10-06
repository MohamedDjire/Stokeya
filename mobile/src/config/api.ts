import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PROD_API_URL = 'https://api.stokeya.com/api/v1';
const DEV_API_PORT = 8000;

function getDevHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    (Constants as { linkingUri?: string }).linkingUri,
    (Constants.manifest2 as { extra?: { expoClient?: { hostUri?: string } } } | null)
      ?.extra?.expoClient?.hostUri,
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const host = raw.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }

  return null;
}

function resolveDevApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const devHost = getDevHost();
  if (devHost) {
    return `http://${devHost}:${DEV_API_PORT}/api/v1`;
  }

  // Émulateur Android uniquement — un vrai téléphone doit utiliser l’IP LAN.
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEV_API_PORT}/api/v1`;
  }

  return `http://127.0.0.1:${DEV_API_PORT}/api/v1`;
}

export const API_BASE_URL = __DEV__ ? resolveDevApiUrl() : (process.env.EXPO_PUBLIC_API_URL || PROD_API_URL);
