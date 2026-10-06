import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import PageHeader from '../components/PageHeader';
import {
  createUser,
  fetchPermissionFlagsCatalog,
  fetchRoles,
  fetchUsers,
  updateUser,
  type CompanyUser,
  type PermissionFlagGroup,
  type Role,
  type RoleScopeRules,
  type UserPayload,
} from '../api/users';
import { fetchBranches } from '../api/sites';
import { fetchWarehouses } from '../api/stock';
import { fetchCashRegisters } from '../api/cashRegisters';
import { getApiErrorMessage } from '../api/client';
import { useLocale } from '../locale/useLocale';
import { tr as trPhrase } from '../locale/tr';

type FormState = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role_code: string;
  assigned_branch: number | '';
  assigned_warehouse: number | '';
  assigned_cash_register: number | '';
  permission_flags: Record<string, boolean>;
};

const emptyForm = (): FormState => ({
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  role_code: '',
  assigned_branch: '',
  assigned_warehouse: '',
  assigned_cash_register: '',
  permission_flags: {},
});

const DEFAULT_SCOPE: RoleScopeRules = {
  branch: 'optional',
  warehouse: 'optional',
  cash_register: 'optional',
};

const ROLE_FAMILY: Record<string, string> = {
  manager: 'Siège',
  accountant: 'Siège',
  warehouse_manager: 'Entrepôt',
  stock_keeper: 'Entrepôt',
  pos_manager: 'Point de vente',
  cashier: 'Point de vente',
};

function roleLabel(role: Role) {
  return role.display_name || role.name;
}

function scopeChainLabel(u: CompanyUser) {
  if (u.is_company_admin) return trPhrase('Toute l’entreprise');
  const parts = [
    u.assigned_branch_name,
    u.assigned_warehouse_name,
    u.assigned_cash_register_name,
  ].filter(Boolean);
  return parts.length ? parts.join(' → ') : trPhrase('Non rattaché');
}

export default function UsersPage() {
  const { tr, version } = useLocale();
  void version;

  const [rows, setRows] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [flagGroups, setFlagGroups] = useState<PermissionFlagGroup[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<Record<string, Record<string, boolean>>>({});
  const [scopeRulesMap, setScopeRulesMap] = useState<Record<string, RoleScopeRules>>({});
  const [branches, setBranches] = useState<Array<{ id: number; name: string; is_main?: boolean }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{
    id: number;
    name: string;
    branch: number;
    branch_name: string;
    is_pos_stock?: boolean;
  }>>([]);
  const [registers, setRegisters] = useState<Array<{ id: number; name: string; branch: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchUsers(),
      fetchRoles(),
      fetchPermissionFlagsCatalog().catch(() => ({
        flags: [],
        groups: [],
        role_defaults: {},
        role_descriptions: {},
        role_scope_rules: {},
        role_order: [],
      })),
      fetchBranches().catch(() => []),
      fetchWarehouses().catch(() => []),
      fetchCashRegisters().catch(() => []),
    ])
      .then(([u, r, catalog, b, w, c]) => {
        setRows(u);
        setRoles(r);
        setFlagGroups(catalog.groups?.length
          ? catalog.groups
          : [{ key: 'all', label: 'Autorisations', flags: catalog.flags || [] }]);
        setRoleDefaults(catalog.role_defaults || {});
        setScopeRulesMap(catalog.role_scope_rules || {});
        setBranches(b.map((x) => ({ id: x.id, name: x.name, is_main: x.is_main })));
        setWarehouses(w.map((x) => ({
          id: x.id,
          name: x.name,
          branch: x.branch_id,
          branch_name: x.branch_name,
          is_pos_stock: x.is_pos_stock,
        })));
        setRegisters(c.map((x) => ({ id: x.id, name: x.name, branch: x.branch })));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.code === form.role_code) || null,
    [roles, form.role_code],
  );

  const scopeRules: RoleScopeRules = useMemo(() => {
    if (!form.role_code) return DEFAULT_SCOPE;
    return (
      selectedRole?.scope_rules
      || scopeRulesMap[form.role_code]
      || DEFAULT_SCOPE
    );
  }, [form.role_code, selectedRole, scopeRulesMap]);

  const posBranches = useMemo(
    () => branches.filter((b) => !b.is_main),
    [branches],
  );
  const branchOptions = useMemo(() => {
    // PDV pour caissier / responsable PDV ; sinon toutes les boutiques
    if (form.role_code === 'cashier' || form.role_code === 'pos_manager') {
      return posBranches.length ? posBranches : branches;
    }
    return branches;
  }, [form.role_code, posBranches, branches]);

  const warehouseOptions = useMemo(() => {
    // Entrepôts « vrais » (pas stock PDV) pour magasinier / responsable entrepôt
    if (form.role_code === 'warehouse_manager' || form.role_code === 'stock_keeper') {
      const real = warehouses.filter((w) => !w.is_pos_stock);
      return real.length ? real : warehouses;
    }
    if (!form.assigned_branch) return warehouses;
    return warehouses.filter((w) => w.branch === form.assigned_branch);
  }, [warehouses, form.assigned_branch, form.role_code]);

  const registerOptions = useMemo(() => {
    if (!form.assigned_branch) return registers;
    return registers.filter((r) => r.branch === form.assigned_branch);
  }, [registers, form.assigned_branch]);

  const applyRole = (roleCode: string) => {
    const defaults = roleDefaults[roleCode] || {};
    const rules = scopeRulesMap[roleCode] || roles.find((r) => r.code === roleCode)?.scope_rules;
    setForm((prev) => ({
      ...prev,
      role_code: roleCode,
      permission_flags: { ...defaults },
      assigned_branch: rules?.branch === 'hidden' ? '' : prev.assigned_branch,
      assigned_warehouse: rules?.warehouse === 'hidden' ? '' : prev.assigned_warehouse,
      assigned_cash_register: rules?.cash_register === 'hidden' ? '' : prev.assigned_cash_register,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  };

  const openEdit = (u: CompanyUser) => {
    if (u.is_company_admin) return;
    const roleCode = u.role_code || u.roles[0]?.code || '';
    setEditing(u);
    setForm({
      email: u.email,
      password: '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      phone: u.phone || '',
      role_code: roleCode,
      assigned_branch: u.assigned_branch ?? '',
      assigned_warehouse: u.assigned_warehouse ?? '',
      assigned_cash_register: u.assigned_cash_register ?? '',
      permission_flags: {
        ...(roleDefaults[roleCode] || {}),
        ...(u.permission_flags || {}),
      },
    });
    setError(null);
    setOpen(true);
  };

  const validateClient = (): string | null => {
    if (!form.role_code) return tr('Choisissez un rôle.');
    if (!editing && (!form.email || form.password.length < 8)) {
      return tr('Email valide et mot de passe de 8 caractères minimum requis.');
    }
    if (!form.first_name.trim() && !form.last_name.trim()) {
      return tr('Indiquez au moins un prénom ou un nom.');
    }
    if (scopeRules.branch === 'required' && !form.assigned_branch) {
      return tr('Point de vente obligatoire pour ce rôle.');
    }
    if (scopeRules.warehouse === 'required' && !form.assigned_warehouse) {
      return tr('Entrepôt obligatoire pour ce rôle.');
    }
    if (scopeRules.cash_register === 'required' && !form.assigned_cash_register) {
      return tr('Caisse obligatoire pour un caissier.');
    }
    return null;
  };

  const save = async () => {
    setError(null);
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }
    setSaving(true);

    const clearHidden = (rule: 'required' | 'optional' | 'hidden', value: number | '') =>
      (rule === 'hidden' ? null : (value === '' ? null : Number(value)));

    const payload: UserPayload = {
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      role_code: form.role_code,
      assigned_branch: clearHidden(scopeRules.branch, form.assigned_branch),
      assigned_warehouse: clearHidden(scopeRules.warehouse, form.assigned_warehouse),
      assigned_cash_register: clearHidden(scopeRules.cash_register, form.assigned_cash_register),
      permission_flags: form.permission_flags,
    };

    try {
      if (editing) {
        await updateUser(editing.id, payload);
      } else {
        await createUser({
          ...payload,
          email: form.email,
          password: form.password,
        });
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
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

  const rolesByFamily = useMemo(() => {
    const groups: Array<{ family: string; items: Role[] }> = [
      { family: 'Siège', items: [] },
      { family: 'Entrepôt', items: [] },
      { family: 'Point de vente', items: [] },
    ];
    for (const role of roles) {
      const family = ROLE_FAMILY[role.code] || 'Siège';
      const bucket = groups.find((g) => g.family === family);
      if (bucket) bucket.items.push(role);
      else groups[0].items.push(role);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [roles]);

  const columns: GridColDef<CompanyUser>[] = [
    {
      field: 'full_name',
      headerName: tr('Utilisateur'),
      flex: 1.4,
      minWidth: 220,
      sortable: true,
      renderCell: (p) => (
        <Stack sx={{ minWidth: 0, width: '100%', justifyContent: 'center' }} spacing={0.15}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {p.row.full_name || p.row.email}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {p.row.email}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'roles',
      headerName: tr('Rôle'),
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (p) => (
        <Chip
          size="small"
          label={
            p.row.is_company_admin
              ? tr('Administrateur entreprise')
              : p.row.roles[0]?.name || tr('Sans rôle')
          }
          color={p.row.is_company_admin ? 'primary' : p.row.roles.length ? 'default' : 'warning'}
          variant={p.row.is_company_admin ? 'filled' : 'outlined'}
          sx={{ maxWidth: '100%', fontWeight: 600 }}
        />
      ),
    },
    {
      field: 'scope',
      headerName: tr('Rattachement'),
      flex: 1.2,
      minWidth: 180,
      sortable: false,
      valueGetter: (_v, row) => scopeChainLabel(row),
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary" noWrap title={String(p.value)} sx={{ width: '100%' }}>
          {String(p.value)}
        </Typography>
      ),
    },
    {
      field: 'is_active',
      headerName: tr('Actif'),
      width: 100,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      renderCell: (p) => (
        <Switch
          size="small"
          checked={p.row.is_active}
          disabled={p.row.is_company_admin}
          onChange={() => toggleActive(p.row)}
        />
      ),
    },
    {
      field: 'edit',
      headerName: tr('Actions'),
      width: 120,
      align: 'right',
      headerAlign: 'right',
      sortable: false,
      renderCell: (p) => (
        p.row.is_company_admin ? (
          <Typography variant="caption" color="text.disabled">—</Typography>
        ) : (
          <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(p.row)}>
            {tr('Fiche')}
          </Button>
        )
      ),
    },
  ];

  const previewName = [form.first_name, form.last_name].filter(Boolean).join(' ') || '—';

  return (
    <Box>
      <PageHeader
        title={tr('Utilisateurs')}
        subtitle={tr('Hiérarchie : siège → entrepôt / point de vente → caisse. Les caissiers ne gèrent jamais le stock.')}
        action={(
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {tr('Nouvel utilisateur')}
          </Button>
        )}
      />

      {error && !open && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          disableColumnMenu
          rowHeight={72}
          columnHeaderHeight={52}
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700,
              fontSize: 13,
              color: 'text.secondary',
              textTransform: 'none',
            },
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
              borderColor: 'divider',
              py: 0,
            },
            '& .MuiDataGrid-row:hover': {
              bgcolor: 'rgba(13,148,136,0.04)',
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: '1px solid',
              borderColor: 'divider',
            },
          }}
        />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle>
          {editing ? tr('Fiche utilisateur') : tr('Nouvel utilisateur')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}

            {/* Identité */}
            <Box>
              <Typography variant="overline" color="text.secondary">{tr('Identité')}</Typography>
              <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                {!editing && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      label={tr('Email')}
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      fullWidth
                      required
                    />
                    <TextField
                      label={tr('Mot de passe')}
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      fullWidth
                      required
                      helperText={tr('8 caractères minimum')}
                    />
                  </Stack>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    label={tr('Prénom')}
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    label={tr('Nom')}
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    label={tr('Téléphone')}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    fullWidth
                  />
                </Stack>
              </Stack>
            </Box>

            <Divider />

            {/* Rôle — hiérarchie */}
            <Box>
              <Typography variant="overline" color="text.secondary">{tr('Rôle')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {tr('Choisissez le niveau dans la hiérarchie Stokeya. Les champs de rattachement s’adaptent automatiquement.')}
              </Typography>
              <RadioGroup
                value={form.role_code}
                onChange={(e) => applyRole(e.target.value)}
              >
                <Stack spacing={1.5}>
                  {rolesByFamily.map((group) => (
                    <Box key={group.family}>
                      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>{tr(group.family)}</Typography>
                      <Stack spacing={1}>
                        {group.items.map((role) => {
                          const selected = form.role_code === role.code;
                          return (
                            <Box
                              key={role.code}
                              onClick={() => applyRole(role.code)}
                              sx={{
                                border: '1px solid',
                                borderColor: selected ? 'primary.main' : 'divider',
                                bgcolor: selected ? 'action.selected' : 'background.paper',
                                borderRadius: 1.5,
                                px: 1.5,
                                py: 1,
                                cursor: 'pointer',
                              }}
                            >
                              <FormControlLabel
                                value={role.code}
                                control={<Radio size="small" />}
                                onClick={(e) => e.stopPropagation()}
                                label={(
                                  <Box>
                                    <Typography variant="body2" fontWeight={600}>
                                      {roleLabel(role)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {role.description}
                                    </Typography>
                                  </Box>
                                )}
                                sx={{ m: 0, alignItems: 'flex-start', width: '100%' }}
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </RadioGroup>
            </Box>

            {/* Rattachement conditionnel */}
            {form.role_code && (
              <>
                <Divider />
                <Box>
                  <Typography variant="overline" color="text.secondary">{tr('Rattachement')}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {form.role_code === 'cashier' && (
                      <>{tr('Entreprise → Point de vente → Caisse → Utilisateur')}</>
                    )}
                    {form.role_code === 'pos_manager' && (
                      <>{tr('Rattaché à un point de vente (voit uniquement ce magasin)')}</>
                    )}
                    {(form.role_code === 'warehouse_manager' || form.role_code === 'stock_keeper') && (
                      <>{tr('Rattaché à un entrepôt (stock de cet entrepôt uniquement)')}</>
                    )}
                    {(form.role_code === 'manager' || form.role_code === 'accountant') && (
                      <>{tr('Accès siège — rattachement boutique optionnel')}</>
                    )}
                  </Typography>

                  <Stack spacing={1.5}>
                    {scopeRules.branch !== 'hidden' && (
                      <TextField
                        select
                        label={tr('Point de vente')}
                        value={form.assigned_branch}
                        required={scopeRules.branch === 'required'}
                        onChange={(e) => setForm({
                          ...form,
                          assigned_branch: e.target.value ? Number(e.target.value) : '',
                          assigned_cash_register: '',
                          assigned_warehouse: scopeRules.warehouse === 'hidden' ? '' : form.assigned_warehouse,
                        })}
                        fullWidth
                        helperText={
                          scopeRules.branch === 'required'
                            ? tr('Obligatoire')
                            : tr('Optionnel')
                        }
                      >
                        <MenuItem value="">{tr('— Aucun —')}</MenuItem>
                        {branchOptions.map((b) => (
                          <MenuItem key={b.id} value={b.id}>
                            {b.name}{b.is_main ? tr(' (siège)') : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {scopeRules.warehouse !== 'hidden' && (
                      <TextField
                        select
                        label={tr('Entrepôt')}
                        value={form.assigned_warehouse}
                        required={scopeRules.warehouse === 'required'}
                        onChange={(e) => setForm({
                          ...form,
                          assigned_warehouse: e.target.value ? Number(e.target.value) : '',
                        })}
                        fullWidth
                        helperText={scopeRules.warehouse === 'required' ? tr('Obligatoire') : tr('Optionnel')}
                      >
                        <MenuItem value="">{tr('— Aucun —')}</MenuItem>
                        {warehouseOptions.map((w) => (
                          <MenuItem key={w.id} value={w.id}>
                            {w.name} — {w.branch_name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}

                    {scopeRules.cash_register !== 'hidden' && (
                      <TextField
                        select
                        label={tr('Caisse')}
                        value={form.assigned_cash_register}
                        required={scopeRules.cash_register === 'required'}
                        disabled={!form.assigned_branch && scopeRules.branch !== 'hidden'}
                        onChange={(e) => setForm({
                          ...form,
                          assigned_cash_register: e.target.value ? Number(e.target.value) : '',
                        })}
                        fullWidth
                        helperText={
                          !form.assigned_branch && scopeRules.branch !== 'hidden'
                            ? tr('Choisissez d’abord le point de vente')
                            : scopeRules.cash_register === 'required'
                              ? tr('Le caissier ne voit que cette caisse')
                              : tr('Optionnel')
                        }
                      >
                        <MenuItem value="">{tr('— Aucune —')}</MenuItem>
                        {registerOptions.map((r) => (
                          <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                        ))}
                      </TextField>
                    )}

                    {/* Aperçu type fiche Aminata */}
                    <Box
                      sx={{
                        mt: 0.5,
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: 'grey.50',
                        border: '1px dashed',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">{tr('Aperçu fiche')}</Typography>
                      <Typography variant="body2"><strong>{tr('Nom')}</strong> — {previewName}</Typography>
                      <Typography variant="body2">
                        <strong>{tr('Rôle')}</strong> — {selectedRole ? roleLabel(selectedRole) : '—'}
                      </Typography>
                      {scopeRules.branch !== 'hidden' && (
                        <Typography variant="body2">
                          <strong>{tr('Point de vente')}</strong> —{' '}
                          {branchOptions.find((b) => b.id === form.assigned_branch)?.name || '—'}
                        </Typography>
                      )}
                      {scopeRules.warehouse !== 'hidden' && (
                        <Typography variant="body2">
                          <strong>{tr('Entrepôt')}</strong> —{' '}
                          {warehouseOptions.find((w) => w.id === form.assigned_warehouse)?.name || '—'}
                        </Typography>
                      )}
                      {scopeRules.cash_register !== 'hidden' && (
                        <Typography variant="body2">
                          <strong>{tr('Caisse')}</strong> —{' '}
                          {registerOptions.find((r) => r.id === form.assigned_cash_register)?.name || '—'}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              </>
            )}

            {/* Autorisations groupées */}
            {form.role_code && (
              <>
                <Divider />
                <Box>
                  <Typography variant="overline" color="text.secondary">{tr('Autorisations')}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {tr('Préremplies selon le rôle. Vous pouvez affiner (ex. deux caissiers avec des droits différents).')}
                  </Typography>
                  <Stack spacing={2}>
                    {flagGroups.map((group) => (
                      <Box key={group.key}>
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{tr(group.label)}</Typography>
                        <FormGroup
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                            gap: 0.25,
                          }}
                        >
                          {group.flags.map((f) => (
                            <FormControlLabel
                              key={f.key}
                              control={(
                                <Checkbox
                                  size="small"
                                  checked={Boolean(form.permission_flags[f.key])}
                                  onChange={(e) => setForm({
                                    ...form,
                                    permission_flags: {
                                      ...form.permission_flags,
                                      [f.key]: e.target.checked,
                                    },
                                  })}
                                />
                              )}
                              label={<Typography variant="body2">{tr(f.label)}</Typography>}
                            />
                          ))}
                        </FormGroup>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.role_code}>
            {editing ? tr('Enregistrer') : tr('Créer l’utilisateur')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
