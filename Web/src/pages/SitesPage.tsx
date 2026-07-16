import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../components/PageHeader';
import {
  createBranch,
  createLocation,
  createWarehouse,
  fetchBranches,
  fetchLocations,
  fetchWarehousesCrud,
  updateBranch,
  updateLocation,
  updateWarehouse,
  type Branch,
  type Location,
  type Warehouse,
} from '../api/sites';
import { getApiErrorMessage } from '../api/client';

const branchEmpty = { name: '', address: '', phone: '', is_active: true };
const warehouseEmpty = { name: '', branch: '' as number | '', is_default: false, is_active: true };
const locationEmpty = { code: '', name: '', warehouse: '' as number | '', is_active: true };

export default function SitesPage() {
  const [tab, setTab] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('');

  const [open, setOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [branchForm, setBranchForm] = useState(branchEmpty);
  const [warehouseForm, setWarehouseForm] = useState(warehouseEmpty);
  const [locationForm, setLocationForm] = useState(locationEmpty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadBranches = useCallback(() => fetchBranches().then(setBranches), []);
  const loadWarehouses = useCallback(() => fetchWarehousesCrud().then(setWarehouses), []);
  const loadLocations = useCallback((wid?: number) => {
    fetchLocations(wid || undefined).then(setLocations);
  }, []);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([loadBranches(), loadWarehouses(), loadLocations()])
      .finally(() => setLoading(false));
  }, [loadBranches, loadWarehouses, loadLocations]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (tab === 2) loadLocations(warehouseFilter ? Number(warehouseFilter) : undefined);
  }, [tab, warehouseFilter, loadLocations]);

  const openBranchDialog = (b?: Branch) => {
    setEditingBranch(b || null);
    setBranchForm(b ? { name: b.name, address: b.address || '', phone: b.phone || '', is_active: b.is_active } : branchEmpty);
    setError(null);
    setOpen(true);
  };

  const openWarehouseDialog = (w?: Warehouse) => {
    setEditingWarehouse(w || null);
    setWarehouseForm(w
      ? { name: w.name, branch: w.branch, is_default: w.is_default, is_active: w.is_active }
      : { ...warehouseEmpty, branch: branches[0]?.id || '' });
    setError(null);
    setOpen(true);
  };

  const openLocationDialog = (l?: Location) => {
    setEditingLocation(l || null);
    setLocationForm(l
      ? { code: l.code, name: l.name, warehouse: l.warehouse, is_active: l.is_active }
      : { ...locationEmpty, warehouse: warehouseFilter || warehouses[0]?.id || '' });
    setError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingBranch(null);
    setEditingWarehouse(null);
    setEditingLocation(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (tab === 0) {
        if (!branchForm.name) { setError('Le nom est obligatoire.'); return; }
        if (editingBranch) await updateBranch(editingBranch.id, branchForm);
        else await createBranch(branchForm);
        await loadBranches();
      } else if (tab === 1) {
        if (!warehouseForm.name || !warehouseForm.branch) { setError('Nom et magasin sont obligatoires.'); return; }
        const payload = { ...warehouseForm, branch: Number(warehouseForm.branch) };
        if (editingWarehouse) await updateWarehouse(editingWarehouse.id, payload);
        else await createWarehouse(payload);
        await loadWarehouses();
      } else {
        if (!locationForm.code || !locationForm.name || !locationForm.warehouse) {
          setError('Code, nom et entrepôt sont obligatoires.');
          return;
        }
        const payload = { ...locationForm, warehouse: Number(locationForm.warehouse) };
        if (editingLocation) await updateLocation(editingLocation.id, payload);
        else await createLocation(payload);
        loadLocations(warehouseFilter ? Number(warehouseFilter) : undefined);
      }
      closeDialog();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const branchColumns: GridColDef<Branch>[] = [
    { field: 'name', headerName: 'Nom', flex: 1, minWidth: 160 },
    { field: 'address', headerName: 'Adresse', flex: 1, minWidth: 180, valueGetter: (v) => v || '—' },
    { field: 'phone', headerName: 'Téléphone', width: 140, valueGetter: (v) => v || '—' },
    {
      field: 'is_active', headerName: 'Actif', width: 90,
      valueGetter: (v) => (v ? 'Oui' : 'Non'),
    },
  ];

  const warehouseColumns: GridColDef<Warehouse>[] = [
    { field: 'name', headerName: 'Nom', flex: 1, minWidth: 160 },
    { field: 'branch_name', headerName: 'Magasin', width: 160 },
    {
      field: 'is_default', headerName: 'Par défaut', width: 110,
      valueGetter: (v) => (v ? 'Oui' : 'Non'),
    },
    { field: 'locations_count', headerName: 'Emplacements', width: 120, valueGetter: (v) => v ?? 0 },
  ];

  const locationColumns: GridColDef<Location>[] = [
    { field: 'code', headerName: 'Code', width: 120 },
    { field: 'name', headerName: 'Nom', flex: 1, minWidth: 160 },
    { field: 'warehouse_name', headerName: 'Entrepôt', width: 180 },
    {
      field: 'is_active', headerName: 'Actif', width: 90,
      valueGetter: (v) => (v ? 'Oui' : 'Non'),
    },
  ];

  const dialogTitle = tab === 0
    ? (editingBranch ? 'Modifier le magasin' : 'Nouveau magasin')
    : tab === 1
      ? (editingWarehouse ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt')
      : (editingLocation ? 'Modifier l\'emplacement' : 'Nouvel emplacement');

  const newLabel = tab === 0 ? 'Nouveau magasin' : tab === 1 ? 'Nouvel entrepôt' : 'Nouvel emplacement';

  return (
    <Box>
      <PageHeader
        title="Sites & magasins"
        subtitle="Magasins, entrepôts et emplacements de stockage"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
            if (tab === 0) openBranchDialog();
            else if (tab === 1) openWarehouseDialog();
            else openLocationDialog();
          }}>
            {newLabel}
          </Button>
        }
      />

      <Card sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`Magasins (${branches.length})`} />
          <Tab label={`Entrepôts (${warehouses.length})`} />
          <Tab label={`Emplacements (${locations.length})`} />
        </Tabs>
      </Card>

      {tab === 2 && (
        <TextField select label="Filtrer par entrepôt" value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value ? Number(e.target.value) : '')}
          sx={{ mb: 2, minWidth: 280 }} size="small">
          <MenuItem value="">Tous les entrepôts</MenuItem>
          {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
        </TextField>
      )}

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        {tab === 0 && (
          <DataGrid rows={branches} columns={branchColumns} loading={loading} disableRowSelectionOnClick
            onRowClick={(p) => openBranchDialog(p.row as Branch)}
            sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
        )}
        {tab === 1 && (
          <DataGrid rows={warehouses} columns={warehouseColumns} loading={loading} disableRowSelectionOnClick
            onRowClick={(p) => openWarehouseDialog(p.row as Warehouse)}
            sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
        )}
        {tab === 2 && (
          <DataGrid rows={locations} columns={locationColumns} loading={loading} disableRowSelectionOnClick
            onRowClick={(p) => openLocationDialog(p.row as Location)}
            sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
        )}
      </Box>

      <Dialog open={open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {tab === 0 && (
              <>
                <TextField label="Nom" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} fullWidth required />
                <TextField label="Adresse" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} fullWidth multiline rows={2} />
                <TextField label="Téléphone" value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} fullWidth />
                <FormControlLabel control={<Checkbox checked={branchForm.is_active} onChange={(e) => setBranchForm({ ...branchForm, is_active: e.target.checked })} />} label="Actif" />
              </>
            )}
            {tab === 1 && (
              <>
                <TextField label="Nom" value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} fullWidth required />
                <TextField select label="Magasin" value={warehouseForm.branch} onChange={(e) => setWarehouseForm({ ...warehouseForm, branch: Number(e.target.value) })} fullWidth required>
                  {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </TextField>
                <FormControlLabel control={<Checkbox checked={warehouseForm.is_default} onChange={(e) => setWarehouseForm({ ...warehouseForm, is_default: e.target.checked })} />} label="Entrepôt par défaut" />
                <FormControlLabel control={<Checkbox checked={warehouseForm.is_active} onChange={(e) => setWarehouseForm({ ...warehouseForm, is_active: e.target.checked })} />} label="Actif" />
              </>
            )}
            {tab === 2 && (
              <>
                <TextField label="Code" value={locationForm.code} onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })} fullWidth required />
                <TextField label="Nom" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} fullWidth required />
                <TextField select label="Entrepôt" value={locationForm.warehouse} onChange={(e) => setLocationForm({ ...locationForm, warehouse: Number(e.target.value) })} fullWidth required>
                  {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
                </TextField>
                <FormControlLabel control={<Checkbox checked={locationForm.is_active} onChange={(e) => setLocationForm({ ...locationForm, is_active: e.target.checked })} />} label="Actif" />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Annuler</Button>
          <Button variant="contained" onClick={save} disabled={saving}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
