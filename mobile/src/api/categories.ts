import { api } from './client';

export interface Category {
  id: number;
  name: string;
  parent: number | null;
  parent_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchCategories(search?: string): Promise<Category[]> {
  const { data } = await api.get('/categories/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function createCategory(payload: { name: string; parent?: number | null }) {
  const { data } = await api.post('/categories/', payload);
  return data as Category;
}

export async function fetchTags(search?: string): Promise<Tag[]> {
  const { data } = await api.get('/tags/', {
    params: search ? { search } : undefined,
  });
  return data.results;
}

export async function createTag(payload: { name: string; color?: string }) {
  const { data } = await api.post('/tags/', payload);
  return data as Tag;
}
