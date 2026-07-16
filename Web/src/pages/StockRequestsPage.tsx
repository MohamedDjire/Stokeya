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
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import PageHeader from '../components/PageHeader';
import {
  approveStockRequest,
  cancelStockRequest,
  createStockRequest,
  fetchStockRequests,
  fulfillStockRequest,
  rejectStockRequest,
  type StockRequest,
} from '../api/stockRequests';
import { fetchProducts, type Product } from '../api/auth';
import { fetchWarehouses, type WarehouseItem } from '../api/stock';
import { getApiErrorMessage } from '../api/client';
import { formatDate } from '../utils/format';

interface Line { product: number | ''; quantity: string; }

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  draft: 'default',
  pending: 'warning',
  approved: 'info',
  rejected: 'error',
  fulfilled: 'success',
  cancelled: 'default',
};

export default function StockRequestsPage() {
  const [rows, setRows] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);

  const [open, setOpen] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState<number | ''>('');
  const [toWarehouse, setToWarehouse] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product: '', quantity: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchStockRequests().then(setRows).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetchProducts().then(setProducts);
    fetchWarehouses().then(setWarehouses);
  }, [load]);

  const addLine = () => setLines([...lines, { product: '', quantity: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setLine = (i: number, key: keyof Line, value: string) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [key]: key === 'product' ? Number(value) : value } : l)));

  const createRequest = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product && l.quantity);
    if (!toWarehouse || valid.length === 0) {
      setError('Choisissez un entrepôt destination et au moins un produit.');
      return;
    }
    setSaving(true);
    try {
      await createStockRequest({
        from_warehouse: fromWarehouse ? Number(fromWarehouse) : null,
        to_warehouse: Number(toWarehouse),
        notes,
        items: valid.map((l) => ({ product: Number(l.product), quantity: l.quantity })),
      });
      setOpen(false);
      setFromWarehouse('');
      setToWarehouse('');
      setNotes('');
      setLines([{ product: '', quantity: '' }]);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: number, action: 'approve' | 'reject' | 'fulfill' | 'cancel') => {
    setActionId(id);
    try {
      const fn = {
        approve: approveStockRequest,
        reject: rejectStockRequest,
        fulfill: fulfillStockRequest,
        cancel: cancelStockRequest,
      }[action];
      await fn(id);
      load();
    } catch (err) {
      alert(getApiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef<StockRequest>[] = [
    { field: 'reference', headerName: 'Référence', width: 150 },
    { field: 'from_warehouse_name', headerName: 'Source', width: 140, valueGetter: (v) => v || '—' },
    { field: 'to_warehouse_name', headerName: 'Destination', width: 140 },
    {
      field: 'status', headerName: 'Statut', width: 130,
      renderCell: (p) => (
        <Chip size="small" label={p.row.status_display} color={STATUS_COLORS[p.value] || 'default'} variant="outlined" />
      ),
    },
    { field: 'items', headerName: 'Articles', width: 90, valueGetter: (v) => (v as StockRequest['items'])?.length ?? 0 },
    { field: 'requested_by_name', headerName: 'Demandeur', width: 140, valueGetter: (v) => v || '—' },
    { field: 'created_at', headerName: 'Date', width: 120, valueFormatter: (v) => formatDate(v) },
    {
      field: 'actions', headerName: 'Actions', width: 220, sortable: false,
      renderCell: (p) => {
        const r = p.row;
        const busy = actionId === r.id;
        const canApprove = ['draft', 'pending'].includes(r.status);
        const canReject = ['draft', 'pending', 'approved'].includes(r.status);
        const canFulfill = ['pending', 'approved'].includes(r.status);
        const canCancel = r.status !== 'fulfilled';
        return (
          <Stack direction="row" spacing={0.5}>
            {canApprove && (
              <IconButton size="small" color="success" disabled={busy} title="Approuver"
                onClick={() => runAction(r.id, 'approve')}>
                <CheckIcon fontSize="small" />
              </IconButton>
            )}
            {canReject && (
              <IconButton size="small" color="error" disabled={busy} title="Rejeter"
                onClick={() => runAction(r.id, 'reject')}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
            {canFulfill && (
              <IconButton size="small" color="primary" disabled={busy} title="Servir"
                onClick={() => runAction(r.id, 'fulfill')}>
                <LocalShippingIcon fontSize="small" />
              </IconButton>
            )}
            {canCancel && (
              <IconButton size="small" disabled={busy} title="Annuler"
                onClick={() => runAction(r.id, 'cancel')}>
                <CancelIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Requêtes stock"
        subtitle="Demandes de réapprovisionnement inter-entrepôts"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setOpen(true); }}>
            Nouvelle requête
          </Button>
        }
      />

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} disableRowSelectionOnClick
          sx={{ border: 'none' }} pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle requête de stock</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label="Entrepôt source (optionnel)" value={fromWarehouse}
              onChange={(e) => setFromWarehouse(e.target.value ? Number(e.target.value) : '')} fullWidth>
              <MenuItem value="">— Aucun —</MenuItem>
              {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
            </TextField>
            <TextField select label="Entrepôt destination" value={toWarehouse} required
              onChange={(e) => setToWarehouse(Number(e.target.value))} fullWidth>
              {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
            </TextField>
            <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline rows={2} />
            <Divider />
            <Typography variant="subtitle2">Articles</Typography>
            {lines.map((line, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField select label="Produit" value={line.product} onChange={(e) => setLine(i, 'product', e.target.value)} sx={{ flex: 2 }}>
                  {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </TextField>
                <TextField label="Qté" type="number" value={line.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} sx={{ flex: 1 }} />
                <IconButton onClick={() => removeLine(i)} disabled={lines.length <= 1}><DeleteIcon /></IconButton>
              </Stack>
            ))}
            <Button size="small" onClick={addLine}>+ Ajouter une ligne</Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={createRequest} disabled={saving}>Créer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
