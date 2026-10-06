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
  role_code?: string | null;
  permissions: string[];
  flags?: Record<string, boolean>;
  permission_flags?: Record<string, boolean>;
  assigned_branch?: number | null;
  assigned_branch_name?: string | null;
  assigned_warehouse?: number | null;
  assigned_warehouse_name?: string | null;
  assigned_cash_register?: number | null;
  assigned_cash_register_name?: string | null;
}

export interface RoleScopeRules {
  branch: 'required' | 'optional' | 'hidden';
  warehouse: 'required' | 'optional' | 'hidden';
  cash_register: 'required' | 'optional' | 'hidden';
}

export interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
  display_name?: string;
  is_active: boolean;
  scope_rules?: RoleScopeRules;
}

export interface PermissionFlagMeta {
  key: string;
  label: string;
}

export interface PermissionFlagGroup {
  key: string;
  label: string;
  flags: PermissionFlagMeta[];
}

export async function fetchUsers(): Promise<CompanyUser[]> {
  const { data } = await api.get('/users/');
  return data;
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await api.get('/roles/');
  return data;
}

export async function fetchPermissionFlagsCatalog(): Promise<{
  flags: PermissionFlagMeta[];
  groups: PermissionFlagGroup[];
  role_defaults: Record<string, Record<string, boolean>>;
  role_descriptions: Record<string, string>;
  role_scope_rules: Record<string, RoleScopeRules>;
  role_order: string[];
}> {
  const { data } = await api.get('/permission-flags/');
  return data;
}

export type UserPayload = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role_code?: string;
  is_active?: boolean;
  assigned_branch?: number | null;
  assigned_warehouse?: number | null;
  assigned_cash_register?: number | null;
  permission_flags?: Record<string, boolean>;
};

export async function createUser(payload: UserPayload): Promise<CompanyUser> {
  const { data } = await api.post('/users/', payload);
  return data;
}

export async function updateUser(id: number, payload: UserPayload): Promise<CompanyUser> {
  const { data } = await api.patch(`/users/${id}/`, payload);
  return data;
}
