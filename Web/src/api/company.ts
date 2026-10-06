import { api } from './client';

export interface Company {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  slogan?: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  tax_id?: string;
  country: string;
  currency: string;
  tax_rate: string;
  is_active: boolean;
}

export async function fetchCompany(): Promise<Company> {
  const { data } = await api.get('/company/me/');
  return data;
}

export async function updateCompany(payload: Partial<Company>): Promise<Company> {
  const { data } = await api.patch('/company/me/', payload);
  return data;
}
