import { api } from './client';

export interface AppNotification {
  id: number;
  notification_type: string;
  type_display: string;
  title: string;
  message: string;
  data: {
    link?: string;
    order_id?: number;
    reference?: string;
    [key: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(params?: { is_read?: boolean }): Promise<AppNotification[]> {
  const { data } = await api.get('/notifications/', { params });
  return data.results ?? data;
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count/');
  return data.count ?? 0;
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  const { data } = await api.post(`/notifications/${id}/mark-read/`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/mark-all-read/');
}
