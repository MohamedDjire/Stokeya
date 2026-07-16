export const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_URL || 'https://inventra.sn';

export function webPaymentUrl(path: string) {
  return `${WEB_APP_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
