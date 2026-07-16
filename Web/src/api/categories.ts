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

export async function fetchCategoriesList(): Promise<Category[]> {
  const { data } = await api.get('/categories/');
  return data.results;
}

export async function createCategory(payload: Partial<Category>): Promise<Category> {
  const { data } = await api.post('/categories/', payload);
  return data;
}

export async function updateCategory(id: number, payload: Partial<Category>): Promise<Category> {
  const { data } = await api.patch(`/categories/${id}/`, payload);
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/categories/${id}/`);
}

export async function fetchTags(): Promise<Tag[]> {
  const { data } = await api.get('/tags/');
  return data.results;
}

export async function createTag(payload: Partial<Tag>): Promise<Tag> {
  const { data } = await api.post('/tags/', payload);
  return data;
}

export async function updateTag(id: number, payload: Partial<Tag>): Promise<Tag> {
  const { data } = await api.patch(`/tags/${id}/`, payload);
  return data;
}

export async function deleteTag(id: number): Promise<void> {
  await api.delete(`/tags/${id}/`);
}
