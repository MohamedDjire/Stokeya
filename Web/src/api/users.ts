import { api } from './client';

export interface CompanyUser {
  id: number;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_company_admin: boolean;
  is_active: boolean;
  roles: Array<{ id: number; name: string; code: string }>;
  permissions: string[];
}

export interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export async function fetchUsers(): Promise<CompanyUser[]> {
  const { data } = await api.get('/users/');
  return data;
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await api.get('/roles/');
  return data;
}

export async function createUser(payload: {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role_code?: string;
}): Promise<CompanyUser> {
  const { data } = await api.post('/users/', payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: {
    is_active?: boolean;
    role_code?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  },
): Promise<CompanyUser> {
  const { data } = await api.patch(`/users/${id}/`, payload);
  return data;
}
