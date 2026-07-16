import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import Grid from '@mui/material/Grid2';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoneyOutlined';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StockTransferDialog from '../components/StockTransferDialog';
import StockAdjustDialog from '../components/StockAdjustDialog';
import {
  fetchProductRankings,
  fetchStockAlerts,
  fetchStockMovements,
  fetchStockStats,
  fetchStockStatus,
  fetchStockTransfers,
  fetchWarehouses,
  MOVEMENT_LABELS,
  stockEntry,
  stockExit,
  type ProductRanking,
  type StockAlert,
  type StockMovementItem,
  type StockStats,
  type StockStatusItem,
  type StockTransfer,
  type WarehouseItem,
} from '../api/stock';
import { fetchProducts, type Product } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';

const STATUS_COLORS: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  out_of_stock: 'error',
  low: 'warning',
  ok: 'success',
};

const STATUS_LABELS: Record<string, string> = {
  out_of_stock: 'Rupture',
  low: 'Faible',
  ok: 'OK',
};

const ALERT_COLORS: Record<string, 'error' | 'warning' | 'info'> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
};

export default function StockPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [warehouse, setWarehouse] = useState<number | ''>('');
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [status, setStatus] = useState<StockStatusItem[]>([]);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [rankings, setRankings] = useState<{ top_sold: ProductRanking[]; least_sold: ProductRanking[] } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const [dialog, setDialog] = useState<'entry' | 'exit' | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '' as number | '', quantity: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWarehouses().then((w) => {
      setWarehouses(w);
      const def = w.find((x) => x.is_default) || w[0];
      if (def) setWarehouse(def.id);
    });
    fetchProducts().then(setProducts);
    fetchProductRankings().then(setRankings).catch(() => undefined);
  }, []);

  const load = useCallback((wid: number) => {
    setLoading(true);
    Promise.all([
      fetchStockStats(wid),
      fetchStockStatus(wid),
      fetchStockMovements(wid),
      fetchStockAlerts(wid),
      fetchStockTransfers(wid),
    ])
      .then(([s, st, mv, al, tr]) => {
        setStats(s);
        setStatus(st);
        setMovements(mv);
        setAlerts(al);
        setTransfers(tr);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (warehouse) load(Number(warehouse));
  }, [warehouse, load]);

  const submit = async () => {
    if (!warehouse || !form.product_id || !form.quantity) return;
    setError(null);
    setSaving(true);
    try {
      const payload = {
        product_id: Number(form.product_id),
        warehouse_id: Number(warehouse),
        quantity: form.quantity,
        notes: form.notes,
      };
      if (dialog === 'entry') await stockEntry(payload);
      else await stockExit(payload);
      setDialog(null);
      setForm({ product_id: '', quantity: '', notes: '' });
      load(Number(warehouse));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const statusColumns: GridColDef<StockStatusItem>[] = [
    { field: 'name', headerName: 'Produit', flex: 1, minWidth: 180 },
    { field: 'sku', headerName: 'SKU', width: 110 },
    { field: 'quantity', headerName: 'Qté', width: 90 },
    { field: 'min_stock', headerName: 'Min', width: 80 },
    { field: 'max_stock', headerName: 'Max', width: 80, valueFormatter: (v) => v || '—' },
    {
      field: 'status', headerName: 'État', width: 120,
      renderCell: (p) => (
        <Chip size="small" variant="outlined" color={STATUS_COLORS[p.value] || 'default'}
          label={STATUS_LABELS[p.value] || p.value} />
      ),
    },
  ];

  const movementColumns: GridColDef<StockMovementItem>[] = [
    { field: 'created_at', headerName: 'Date', width: 130, valueFormatter: (v) => formatDate(v) },
    { field: 'product_name', headerName: 'Produit', flex: 1, minWidth: 160 },
    {
      field: 'movement_type', headerName: 'Type', width: 120,
      valueFormatter: (v) => MOVEMENT_LABELS[v] || v,
      renderCell: (p) => <Chip size="small" label={MOVEMENT_LABELS[p.value] || p.value} variant="outlined" />,
    },
    { field: 'quantity', headerName: 'Qté', width: 80 },
    { field: 'notes', headerName: 'Motif', flex: 1, minWidth: 140 },
    { field: 'created_by', headerName: 'Par', width: 130 },
  ];

  const transferColumns: GridColDef<StockTransfer>[] = [
    { field: 'created_at', headerName: 'Date', width: 130, valueFormatter: (v) => formatDate(v) },
    { field: 'from_warehouse', headerName: 'Source', width: 140 },
    { field: 'to_warehouse', headerName: 'Destination', width: 140 },
    { field: 'items_count', headerName: 'Articles', width: 90 },
    { field: 'created_by', headerName: 'Par', width: 130 },
    { field: 'notes', headerName: 'Note', flex: 1, minWidth: 120 },
  ];

  return (
    <Box>
      <PageHeader
        title="Gestion des stocks"
        subtitle="Tableau de bord, mouvements, alertes et transferts inter-sites"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" color="success" startIcon={<AddIcon />} onClick={() => setDialog('entry')}>
              Entrée
            </Button>
            <Button variant="outlined" color="error" startIcon={<RemoveIcon />} onClick={() => setDialog('exit')}>
              Sortie
            </Button>
            <Button variant="outlined" startIcon={<SwapHorizIcon />} onClick={() => setTransferOpen(true)}
              disabled={warehouses.length < 2}>
              Transfert
            </Button>
            <Button variant="outlined" color="warning" startIcon={<FactCheckIcon />} onClick={() => setAdjustOpen(true)}
              disabled={!warehouse}>
              Inventaire
            </Button>
          </Stack>
        }
      />

      <TextField select label="Entrepôt" value={warehouse} onChange={(e) => setWarehouse(Number(e.target.value))}
        sx={{ mb: 2, minWidth: 280 }} size="small">
        {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
      </TextField>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
          <StatCard label="Valeur stock" value={formatCurrency(stats?.stock_value)} icon={<AttachMoneyIcon />} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
          <StatCard label="Produits" value={stats?.total_products ?? 0} icon={<InventoryIcon />} color="#1565C0" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
          <StatCard label="En stock" value={stats?.in_stock ?? 0} color="#2E7D32" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
          <StatCard label="Ruptures" value={stats?.out_of_stock ?? 0} icon={<WarningAmberIcon />} color="#C62828" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
          <StatCard label="Stock faible" value={stats?.low_stock ?? 0} color="#E65100" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
          <StatCard label="Max dépassé" value={stats?.over_max ?? 0} color="#8E24AA" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
          <StatCard label="Entrées (mois)" value={stats?.entries_month ?? 0} color="#00897B" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3, lg: 1.5 }}>
          <StatCard label="Sorties (mois)" value={stats?.exits_month ?? 0} color="#FF6F00" />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Tab label="État du stock" />
              <Tab label={`Mouvements (${movements.length})`} />
              <Tab label={`Transferts (${transfers.length})`} />
              <Tab label={`Alertes (${alerts.length})`} />
            </Tabs>
            <Box sx={{ height: 480, p: tab === 3 ? 2 : 0 }}>
              {tab === 0 && (
                <DataGrid rows={status} columns={statusColumns} loading={loading} disableRowSelectionOnClick
                  sx={{ border: 'none' }} pageSizeOptions={[25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
              )}
              {tab === 1 && (
                <DataGrid rows={movements} columns={movementColumns} loading={loading} disableRowSelectionOnClick
                  sx={{ border: 'none' }} pageSizeOptions={[25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
              )}
              {tab === 2 && (
                <DataGrid rows={transfers} columns={transferColumns} loading={loading} disableRowSelectionOnClick
                  sx={{ border: 'none' }} pageSizeOptions={[25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
              )}
              {tab === 3 && (
                <Stack spacing={1}>
                  {alerts.length === 0 ? (
                    <Alert severity="success">Aucune alerte — tout est en ordre.</Alert>
                  ) : (
                    alerts.map((a, i) => (
                      <Alert key={i} severity={ALERT_COLORS[a.severity]} variant="outlined">
                        {a.message}
                      </Alert>
                    ))
                  )}
                </Stack>
              )}
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <TrendingUpIcon color="success" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>Plus vendus (90j)</Typography>
              </Stack>
              <List dense disablePadding>
                {(rankings?.top_sold || []).slice(0, 5).map((p, i) => (
                  <ListItem key={p.product_id} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={`${i + 1}. ${p.name}`}
                      secondary={`${p.qty_sold} vendus — ${formatCurrency(p.revenue)}`}
                      primaryTypographyProps={{ fontSize: 14 }}
                      secondaryTypographyProps={{ fontSize: 12 }}
                    />
                  </ListItem>
                ))}
                {!rankings?.top_sold?.length && (
                  <Typography variant="body2" color="text.secondary">Pas encore de ventes</Typography>
                )}
              </List>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <TrendingDownIcon color="warning" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>Moins vendus (90j)</Typography>
              </Stack>
              <List dense disablePadding>
                {(rankings?.least_sold || []).slice(0, 5).map((p) => (
                  <ListItem key={p.product_id} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={p.name}
                      secondary={`${p.qty_sold} vendus`}
                      primaryTypographyProps={{ fontSize: 14 }}
                      secondaryTypographyProps={{ fontSize: 12 }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog === 'entry' ? 'Entrée de stock' : 'Sortie de stock'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label="Produit" value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: Number(e.target.value) })} fullWidth>
              {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
            <TextField label="Quantité" type="number" value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })} fullWidth />
            <TextField label="Motif / note" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(null)}>Annuler</Button>
          <Button variant="contained" onClick={submit} disabled={saving}>Valider</Button>
        </DialogActions>
      </Dialog>

      <StockTransferDialog
        open={transferOpen}
        warehouses={warehouses}
        products={products}
        defaultFrom={warehouse}
        onClose={() => setTransferOpen(false)}
        onDone={() => { setTransferOpen(false); if (warehouse) load(Number(warehouse)); }}
      />

      <StockAdjustDialog
        open={adjustOpen}
        warehouseId={warehouse}
        products={products}
        currentStock={status}
        onClose={() => setAdjustOpen(false)}
        onDone={() => { setAdjustOpen(false); if (warehouse) load(Number(warehouse)); }}
      />
    </Box>
  );
}
