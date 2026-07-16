import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../components/PageHeader';
import {
  createSupplier,
  fetchSuppliers,
  updateSupplier,
  type Supplier,
} from '../api/suppliers';
import { getApiErrorMessage } from '../api/client';

const empty = { name: '', phone: '', email: '', address: '', contact_name: '' };

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchSuppliers().then(setRows).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(empty); setError(null); setOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', contact_name: s.contact_name || '' });
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) { setError('Le nom est obligatoire.'); return; }
    setSaving(true);
    try {
      if (editing) await updateSupplier(editing.id, form);
      else await createSupplier(form);
      setOpen(false);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef<Supplier>[] = [
    { field: 'name', headerName: 'Nom', flex: 1, minWidth: 180 },
    { field: 'contact_name', headerName: 'Contact', width: 150, valueGetter: (v) => v || '—' },
    { field: 'phone', headerName: 'Téléphone', width: 150 },
    { field: 'orders_count', headerName: 'Commandes', width: 120, valueGetter: (v) => v ?? 0 },
  ];

  return (
    <Box>
      <PageHeader title="Fournisseurs" subtitle={`${rows.length} fournisseur(s)`}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Nouveau fournisseur</Button>} />

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} disableRowSelectionOnClick
          onRowClick={(p) => openEdit(p.row as Supplier)}
          sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required />
            <TextField label="Personne de contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} fullWidth />
            <TextField label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
            <TextField label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={save} disabled={saving}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
