import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../components/PageHeader';
import {
  createExpense,
  createExpenseCategory,
  fetchExpenseCategories,
  fetchExpenses,
  type Expense,
  type ExpenseCategory,
} from '../api/expenses';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';
import { useLocale } from '../locale/useLocale';

export default function ExpensesPage() {
  const { tr, version } = useLocale();
  void version;

  const [rows, setRows] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: '' as number | '', amount: '', description: '', date: new Date().toISOString().slice(0, 10), newCategory: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchExpenses(), fetchExpenseCategories()])
      .then(([e, c]) => { setRows(e); setCategories(c); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError(null);
    if (!form.amount) { setError(tr('Le montant est obligatoire.')); return; }
    setSaving(true);
    try {
      let categoryId = form.category;
      if (!categoryId && form.newCategory) {
        const cat = await createExpenseCategory(form.newCategory);
        categoryId = cat.id;
      }
      if (!categoryId) { setError(tr('Choisissez ou créez une catégorie.')); setSaving(false); return; }
      await createExpense({
        category: Number(categoryId),
        amount: form.amount,
        description: form.description,
        date: form.date,
      });
      setOpen(false);
      setForm({ category: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10), newCategory: '' });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef<Expense>[] = [
    { field: 'date', headerName: tr('Date'), width: 130, valueFormatter: (v) => formatDate(v) },
    { field: 'category_name', headerName: tr('Catégorie'), width: 180 },
    { field: 'description', headerName: tr('Description'), flex: 1, minWidth: 200 },
    { field: 'amount', headerName: tr('Montant'), width: 150, valueFormatter: (v) => formatCurrency(v) },
  ];

  return (
    <Box>
      <PageHeader title={tr('Dépenses')} subtitle={tr(`${rows.length} dépense(s)`)}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setOpen(true); }}>{tr('Nouvelle dépense')}</Button>} />

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} disableRowSelectionOnClick
          sx={{ border: 'none' }} pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{tr('Nouvelle dépense')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label={tr('Catégorie')} value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value ? Number(e.target.value) : '' })} fullWidth>
              <MenuItem value="">{tr('— Nouvelle catégorie —')}</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            {!form.category && (
              <TextField label={tr('Nom de la nouvelle catégorie')} value={form.newCategory}
                onChange={(e) => setForm({ ...form, newCategory: e.target.value })} fullWidth />
            )}
            <TextField label={tr('Montant')} type="number" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} fullWidth />
            <TextField label={tr('Date')} type="date" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label={tr('Description')} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={save} disabled={saving}>{tr('Enregistrer')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
