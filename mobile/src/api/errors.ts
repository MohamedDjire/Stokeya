import { isAxiosError } from 'axios';

export function getApiErrorMessage(
  err: unknown,
  fallback = 'Une erreur est survenue.',
): string {
  if (isAxiosError(err)) {
    if (!err.response) {
      if (err.code === 'ECONNABORTED') {
        return 'Délai dépassé. Vérifiez que le serveur est démarré.';
      }
      return 'Impossible de joindre le serveur. Vérifiez votre connexion et que le backend tourne sur le port 8000.';
    }

    const data = err.response.data;
    if (typeof data === 'string' && data.trim()) {
      return data;
    }
    if (data && typeof data === 'object') {
      const parts = Object.values(data as Record<string, unknown>).flatMap((value) => {
        if (Array.isArray(value)) {
          return value.map(String);
        }
        if (value && typeof value === 'object') {
          return Object.values(value as Record<string, unknown>).map(String);
        }
        return value != null ? [String(value)] : [];
      });
      if (parts.length) {
        return parts.join(' ');
      }
    }
  }

  return fallback;
}
