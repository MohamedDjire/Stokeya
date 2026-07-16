import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../components/PageHeader';
import {
  createUser,
  fetchRoles,
  fetchUsers,
  updateUser,
  type CompanyUser,
  type Role,
} from '../api/users';
import { getApiErrorMessage } from '../api/client';

const empty = { email: '', password: '', first_name: '', last_name: '', phone: '', role_code: '' };

export default function UsersPage() {
  const [rows, setRows] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchRoles()])
      .then(([u, r]) => { setRows(u); setRoles(r.filter((role) => role.code !== 'company_admin')); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setError(null);
    if (!form.email || form.password.length < 8) {
      setError('Email valide et mot de passe de 8 caractères minimum requis.');
      return;
    }
    setSaving(true);
    try {
      await createUser(form);
      setOpen(false);
      setForm(empty);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: CompanyUser) => {
    try {
      const updated = await updateUser(u.id, { is_active: !u.is_active });
      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const columns: GridColDef<CompanyUser>[] = [
    { field: 'full_name', headerName: 'Nom', flex: 1, minWidth: 160, valueGetter: (_v, row) => row.full_name || row.email },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
    {
      field: 'roles', headerName: 'Rôle', width: 180,
      renderCell: (p) =>
        p.row.is_company_admin ? (
          <Chip size="small" label="Administrateur" color="primary" variant="outlined" />
        ) : p.row.roles.length ? (
          <Chip size="small" label={p.row.roles[0].name} variant="outlined" />
        ) : (
          <Chip size="small" label="Sans rôle" />
        ),
    },
    {
      field: 'is_active', headerName: 'Actif', width: 100,
      renderCell: (p) => (
        <Switch checked={p.row.is_active} disabled={p.row.is_company_admin} onChange={() => toggleActive(p.row)} />
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title="Utilisateurs" subtitle={`${rows.length} compte(s)`}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setOpen(true); }}>Nouvel utilisateur</Button>} />

      {error && !open && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} disableRowSelectionOnClick
          sx={{ border: 'none' }} pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nouvel utilisateur</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth required />
            <TextField label="Mot de passe" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} fullWidth required />
            <Stack direction="row" spacing={2}>
              <TextField label="Prénom" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} fullWidth />
              <TextField label="Nom" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} fullWidth />
            </Stack>
            <TextField select label="Rôle" value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })} fullWidth>
              <MenuItem value="">Sans rôle</MenuItem>
              {roles.map((r) => <MenuItem key={r.id} value={r.code}>{r.name}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={create} disabled={saving}>Créer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
