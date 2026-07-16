import { api } from './client';

export interface ExpenseCategory {
  id: number;
  name: string;
}

export interface Expense {
  id: number;
  category: number;
  category_name: string;
  amount: string;
  description: string;
  date: string;
}

export async function fetchExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data } = await api.get('/expense-categories/');
  return data.results;
}

export async function fetchExpenses(): Promise<Expense[]> {
  const { data } = await api.get('/expenses/');
  return data.results;
}

export async function createExpense(payload: {
  category: number;
  amount: string;
  description: string;
  date: string;
  branch?: number | null;
}) {
  const { data } = await api.post('/expenses/', payload);
  return data as Expense;
}

export async function createExpenseCategory(name: string) {
  const { data } = await api.post('/expense-categories/', { name });
  return data as ExpenseCategory;
}
