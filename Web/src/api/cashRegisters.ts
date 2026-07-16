import { api } from './client';

export interface CashRegister {
  id: number;
  branch: number;
  branch_name: string;
  name: string;
  is_open: boolean;
  opened_at: string | null;
  opening_balance: string | null;
  closing_balance: string | null;
  session_sales_total: string | null;
}

export async function fetchCashRegisters(branchId?: number): Promise<CashRegister[]> {
  const { data } = await api.get('/cash-registers/', {
    params: branchId ? { branch: branchId } : undefined,
  });
  return data.results;
}

export async function openCashRegister(id: number, openingBalance: string) {
  const { data } = await api.post(`/cash-registers/${id}/open/`, { opening_balance: openingBalance });
  return data as CashRegister;
}

export async function closeCashRegister(id: number, closingBalance: string) {
  const { data } = await api.post(`/cash-registers/${id}/close/`, { closing_balance: closingBalance });
  return data as CashRegister & { expected_balance: string };
}
