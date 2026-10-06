import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import SendIcon from '@mui/icons-material/Send';
import PageHeader from '../components/PageHeader';
import {
  approveStockRequest,
  cancelStockRequest,
  createStockRequest,
  fetchStockRequests,
  fulfillStockRequest,
  posValidateStockRequest,
  rejectStockRequest,
  type StockRequest,
} from '../api/stockRequests';
import { fetchProducts, type Product } from '../api/auth';
import { fetchWarehouses, type WarehouseItem } from '../api/stock';
import { getApiErrorMessage } from '../api/client';
import { formatDate } from '../utils/format';
import { useAppSelector } from '../store/hooks';
import { hasFlag } from '../utils/permissions';
import { useLocale } from '../locale/useLocale';

interface Line { product: number | ''; quantity: string; }

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  draft: 'default',
  pending: 'warning',
  pos_validated: 'info',
  approved: 'info',
  rejected: 'error',
  fulfilled: 'success',
  cancelled: 'default',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manuelle',
  cashier_alert: 'Alerte caissier',
  auto: 'Automatique',
  pos_manager: 'Responsable PDV',
};

export default function StockRequestsPage() {
  const { tr, version } = useLocale();
  void version;

  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const [searchParams, setSearchParams] = useSearchParams();
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

  const isAdmin = Boolean(user?.is_company_admin);
  const isPosManager = user?.role_code === 'pos_manager' || user?.scope?.is_pos_manager;
  const canCreate = hasFlag(user, 'can_request_stock') && !user?.scope?.is_cashier;

  const load = useCallback(() => {
    setLoading(true);
    fetchStockRequests().then(setRows).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetchProducts().then(setProducts);
    fetchWarehouses().then(setWarehouses);
  }, [load]);

  useEffect(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from || to) {
      setFromWarehouse(from ? Number(from) : '');
      setToWarehouse(to ? Number(to) : '');
      setNotes(tr('Demande d\'approvisionnement point de vente'));
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, tr]);

  const addLine = () => setLines([...lines, { product: '', quantity: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setLine = (i: number, key: keyof Line, value: string) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [key]: key === 'product' ? Number(value) : value } : l)));

  const createRequest = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product && l.quantity);
    if (!toWarehouse || valid.length === 0) {
      setError(tr('Choisissez un entrepôt destination et au moins un produit.'));
      return;
    }
    setSaving(true);
    try {
      await createStockRequest({
        from_warehouse: fromWarehouse ? Number(fromWarehouse) : null,
        to_warehouse: Number(toWarehouse),
        notes,
        source: isPosManager ? 'pos_manager' : 'manual',
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

  const runAction = async (
    id: number,
    action: 'approve' | 'reject' | 'fulfill' | 'cancel' | 'pos_validate',
  ) => {
    setActionId(id);
    try {
      if (action === 'pos_validate') await posValidateStockRequest(id);
      else if (action === 'approve') await approveStockRequest(id);
      else if (action === 'reject') await rejectStockRequest(id);
      else if (action === 'fulfill') {
        const req = await fulfillStockRequest(id);
        if (req.transfer_id) {
          navigate(`/transfers?highlight=${req.transfer_id}`);
        }
      } else await cancelStockRequest(id);
      load();
    } catch (err) {
      alert(getApiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef<StockRequest>[] = [
    { field: 'reference', headerName: tr('Référence'), width: 150 },
    {
      field: 'source', headerName: tr('Origine'), width: 130,
      valueGetter: (_v, row) => tr(SOURCE_LABELS[row.source || 'manual'] || row.source || '—'),
    },
    { field: 'from_warehouse_name', headerName: tr('Source'), width: 130, valueGetter: (v) => v || '—' },
    { field: 'to_warehouse_name', headerName: tr('Destination'), width: 130 },
    {
      field: 'status', headerName: tr('Statut'), width: 150,
      renderCell: (p) => (
        <Chip size="small" label={tr(p.row.status_display)} color={STATUS_COLORS[p.value] || 'default'} variant="outlined" />
      ),
    },
    { field: 'items', headerName: tr('Articles'), width: 80, valueGetter: (v) => (v as StockRequest['items'])?.length ?? 0 },
    { field: 'requested_by_name', headerName: tr('Demandeur'), width: 130, valueGetter: (v) => v || '—' },
    { field: 'created_at', headerName: tr('Date'), width: 110, valueFormatter: (v) => formatDate(v) },
    {
      field: 'actions', headerName: tr('Actions'), width: 260, sortable: false,
      renderCell: (p) => {
        const r = p.row;
        const busy = actionId === r.id;
        const canPosValidate = ['draft', 'pending'].includes(r.status) && (isPosManager || isAdmin);
        const canApprove = ['pos_validated', 'pending', 'draft'].includes(r.status) && isAdmin;
        const canReject = ['draft', 'pending', 'pos_validated', 'approved'].includes(r.status);
        const canFulfill = ['approved', 'pos_validated'].includes(r.status) && (isAdmin || hasFlag(user, 'can_transfer'));
        const canCancel = r.status !== 'fulfilled';
        return (
          <Stack direction="row" spacing={0.5}>
            {canPosValidate && (
              <IconButton size="small" color="info" disabled={busy} title={tr('Envoyer au siège')}
                onClick={() => runAction(r.id, 'pos_validate')}>
                <SendIcon fontSize="small" />
              </IconButton>
            )}
            {canApprove && (
              <IconButton size="small" color="success" disabled={busy} title={tr('Approuver (siège)')}
                onClick={() => runAction(r.id, 'approve')}>
                <CheckIcon fontSize="small" />
              </IconButton>
            )}
            {canReject && (
              <IconButton size="small" color="error" disabled={busy} title={tr('Rejeter')}
                onClick={() => runAction(r.id, 'reject')}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
            {canFulfill && (
              <IconButton size="small" color="primary" disabled={busy} title={tr('Créer le transfert')}
                onClick={() => runAction(r.id, 'fulfill')}>
                <LocalShippingIcon fontSize="small" />
              </IconButton>
            )}
            {canCancel && (
              <IconButton size="small" disabled={busy} title={tr('Annuler')}
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
        title={tr('Demandes d\'approvisionnement')}
        subtitle={tr('Caissier alerte → PDV valide → Siège crée le transfert → Entrepôt expédie → PDV reçoit')}
        action={canCreate ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setOpen(true); }}>
            {tr('Nouvelle demande')}
          </Button>
        ) : undefined}
      />

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} disableRowSelectionOnClick
          sx={{ border: 'none' }} pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{tr('Nouvelle demande d\'approvisionnement')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label={tr('Entrepôt source (optionnel)')} value={fromWarehouse}
              onChange={(e) => setFromWarehouse(e.target.value ? Number(e.target.value) : '')} fullWidth>
              <MenuItem value="">{tr('— Aucun —')}</MenuItem>
              {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
            </TextField>
            <TextField select label={tr('Entrepôt destination')} value={toWarehouse} required
              onChange={(e) => setToWarehouse(Number(e.target.value))} fullWidth>
              {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
            </TextField>
            <TextField label={tr('Notes')} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline rows={2} />
            <Divider />
            <Typography variant="subtitle2">{tr('Articles')}</Typography>
            {lines.map((line, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField select label={tr('Produit')} value={line.product} onChange={(e) => setLine(i, 'product', e.target.value)} sx={{ flex: 2 }}>
                  {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </TextField>
                <TextField label={tr('Qté')} type="number" value={line.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} sx={{ flex: 1 }} />
                <IconButton onClick={() => removeLine(i)} disabled={lines.length <= 1}><DeleteIcon /></IconButton>
              </Stack>
            ))}
            <Button size="small" onClick={addLine}>{tr('+ Ajouter une ligne')}</Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={createRequest} disabled={saving}>{tr('Créer')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
