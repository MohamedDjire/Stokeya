import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid';
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
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import LocalShippingIcon from '@mui/icons-material/LocalShippingOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StockTransferDialog from '../components/StockTransferDialog';
import StockEntryExitDialog from '../components/StockEntryExitDialog';
import InventorySessionDialog from '../components/InventorySessionDialog';
import StockHistoryDialog from '../components/StockHistoryDialog';
import QuickStockEntry from '../components/QuickStockEntry';
import { BRAND } from '../theme';
import { fadeUpSx } from '../theme/motion';
import {
  cancelTransfer,
  exportStock,
  fetchInventorySessions,
  fetchProductRankings,
  fetchStockAlerts,
  fetchStockDashboard,
  fetchStockListItems,
  fetchStockMovements,
  fetchStockTransfers,
  fetchWarehouses,
  INVENTORY_STATUS_LABELS,
  MOVEMENT_LABELS,
  receiveTransfer,
  shipTransfer,
  TRANSFER_STATUS_COLORS,
  TRANSFER_STATUS_LABELS,
  type InventorySession,
  type ProductRanking,
  type StockAlert,
  type StockDashboardData,
  type StockListItem,
  type StockMovementItem,
  type StockTransfer,
  type WarehouseItem,
} from '../api/stock';
import { fetchProducts, type Product } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { API_BASE_URL } from '../config/api';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';
import { useLocale } from '../locale/useLocale';

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

function imageUrl(image: string | null): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http')) return image;
  return `${API_BASE_URL.replace('/api/v1', '')}${image}`;
}

interface ListFilters {
  search: string;
  status: string;
  warehouse: number | '';
}

const emptyFilters: ListFilters = { search: '', status: '', warehouse: '' };

export default function StockPage() {
  const { tr, version } = useLocale();
  void version;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouse, setWarehouse] = useState<number | ''>('');
  const [tab, setTab] = useState(0);

  const [dashboard, setDashboard] = useState<StockDashboardData | null>(null);
  const [rankings, setRankings] = useState<{ top_sold: ProductRanking[]; least_sold: ProductRanking[] } | null>(null);

  const [listItems, setListItems] = useState<StockListItem[]>([]);
  const [listCount, setListCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [filters, setFilters] = useState<ListFilters>(() => {
    const status = searchParams.get('status') || '';
    return { ...emptyFilters, status: status === 'low' || status === 'out_of_stock' ? status : '' };
  });
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });

  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [inventories, setInventories] = useState<InventorySession[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [transferActionId, setTransferActionId] = useState<number | null>(null);

  const [entryExitDialog, setEntryExitDialog] = useState<{ open: boolean; mode: 'entry' | 'exit'; productId?: number | '' }>({ open: false, mode: 'entry' });
  const [transferOpen, setTransferOpen] = useState(false);
  const [inventoryDialog, setInventoryDialog] = useState<{ open: boolean; sessionId: number | null }>({ open: false, sessionId: null });
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; productId: number | null; productName?: string; warehouseId: number | '' }>({ open: false, productId: null, warehouseId: '' });
  const [rowMenu, setRowMenu] = useState<{ anchor: HTMLElement; row: StockListItem } | null>(null);

  useEffect(() => {
    fetchWarehouses().then((w) => {
      setWarehouses(w);
      const def = w.find((x) => x.is_default) || w[0];
      if (def) setWarehouse(def.id);
    });
    fetchProducts().then(setProducts);
    fetchProductRankings().then(setRankings).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchStockDashboard(warehouse || undefined).then(setDashboard).catch(() => undefined);
  }, [warehouse]);

  const loadSections = useCallback((wid: number) => {
    setSectionLoading(true);
    Promise.all([
      fetchStockMovements(wid).catch(() => [] as Awaited<ReturnType<typeof fetchStockMovements>>),
      fetchStockAlerts(wid).catch(() => [] as Awaited<ReturnType<typeof fetchStockAlerts>>),
      fetchStockTransfers(wid).catch(() => [] as Awaited<ReturnType<typeof fetchStockTransfers>>),
      fetchInventorySessions(wid).catch(() => [] as Awaited<ReturnType<typeof fetchInventorySessions>>),
    ])
      .then(([mv, al, transferList, inv]) => {
        setMovements(mv);
        setAlerts(al);
        setTransfers(transferList);
        setInventories(inv);
      })
      .finally(() => setSectionLoading(false));
  }, []);

  useEffect(() => {
    if (warehouse) loadSections(Number(warehouse));
  }, [warehouse, loadSections]);

  const loadList = useCallback(() => {
    setListLoading(true);
    fetchStockListItems({
      search: filters.search || undefined,
      status: filters.status || undefined,
      warehouse: filters.warehouse || undefined,
      page: paginationModel.page + 1,
      page_size: paginationModel.pageSize,
    })
      .then(({ results, count }) => {
        setListItems(results);
        setListCount(count);
      })
      .finally(() => setListLoading(false));
  }, [filters, paginationModel]);

  useEffect(() => {
    if (tab === 0) loadList();
  }, [tab, loadList]);

  const refreshAll = () => {
    if (warehouse) loadSections(Number(warehouse));
    if (tab === 0) loadList();
    fetchStockDashboard(warehouse || undefined).then(setDashboard).catch(() => undefined);
  };

  const openEntry = (productId?: number | '') => setEntryExitDialog({ open: true, mode: 'entry', productId });
  const openExit = (productId?: number | '') => setEntryExitDialog({ open: true, mode: 'exit', productId });

  const openHistory = (row: StockListItem) =>
    setHistoryDialog({ open: true, productId: row.product_id, productName: row.name, warehouseId: row.warehouse_id });

  const handleExport = async () => {
    try {
      const blob = await exportStock({
        warehouse: filters.warehouse || undefined,
        status: filters.status || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  };

  const handleShip = async (id: number) => {
    setActionError(null);
    setTransferActionId(id);
    try {
      await shipTransfer(id);
      refreshAll();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setTransferActionId(null);
    }
  };

  const handleReceive = async (id: number) => {
    setActionError(null);
    setTransferActionId(id);
    try {
      await receiveTransfer(id);
      refreshAll();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setTransferActionId(null);
    }
  };

  const handleCancelTransfer = async (id: number) => {
    setActionError(null);
    setTransferActionId(id);
    try {
      await cancelTransfer(id);
      refreshAll();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setTransferActionId(null);
    }
  };

  const listColumns: GridColDef<StockListItem>[] = useMemo(() => [
    {
      field: 'image', headerName: '', width: 52, sortable: false,
      renderCell: (p) => (
        <Avatar variant="rounded" src={imageUrl(p.row.image)} sx={{ width: 32, height: 32, bgcolor: '#EEF1F5', fontSize: 14 }}>
          {p.row.name?.[0]}
        </Avatar>
      ),
    },
    { field: 'name', headerName: tr('Produit'), flex: 1, minWidth: 160 },
    { field: 'sku', headerName: tr('SKU'), width: 100 },
    { field: 'barcode', headerName: tr('Code-barres'), width: 120, valueGetter: (v) => v || '—' },
    { field: 'category_name', headerName: tr('Catégorie'), width: 120, valueGetter: (v) => (v ? tr(String(v)) : '—') },
    { field: 'brand_name', headerName: tr('Marque'), width: 110, valueGetter: (v) => v || '—' },
    { field: 'warehouse_name', headerName: tr('Entrepôt'), width: 130 },
    { field: 'branch_name', headerName: tr('Magasin'), width: 130 },
    { field: 'quantity', headerName: tr('Qté'), width: 70, valueFormatter: (v) => formatNumber(v) },
    { field: 'reserved_quantity', headerName: tr('Réservé'), width: 80, valueGetter: (v) => v ?? 0, valueFormatter: (v) => formatNumber(v) },
    { field: 'available_quantity', headerName: tr('Dispo.'), width: 80, valueGetter: (v) => v ?? 0, valueFormatter: (v) => formatNumber(v) },
    {
      field: 'min_stock', headerName: tr('Min/Max'), width: 90,
      renderCell: (p) => <span>{formatNumber(p.row.min_stock)} / {p.row.max_stock != null ? formatNumber(p.row.max_stock) : '—'}</span>,
    },
    { field: 'purchase_price', headerName: tr('Prix achat'), width: 110, valueFormatter: (v) => formatCurrency(v) },
    { field: 'sale_price', headerName: tr('Prix vente'), width: 110, valueFormatter: (v) => formatCurrency(v) },
    { field: 'value', headerName: tr('Valeur'), width: 120, valueFormatter: (v) => formatCurrency(v) },
    {
      field: 'status', headerName: tr('État'), width: 100,
      renderCell: (p) => (
        <Chip size="small" variant="outlined" color={STATUS_COLORS[p.value] || 'default'}
          label={tr(STATUS_LABELS[p.value] || p.value)} />
      ),
    },
    {
      field: 'actions', headerName: tr('Actions'), width: 140, sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={() => openEntry(p.row.product_id)}
            sx={{ minWidth: 0, px: 1, fontWeight: 700 }}
          >
            {tr('+ Stock')}
          </Button>
          <IconButton size="small" onClick={(e) => setRowMenu({ anchor: e.currentTarget, row: p.row })}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ], [tr, version]);

  const movementColumns: GridColDef<StockMovementItem>[] = useMemo(() => [
    { field: 'created_at', headerName: tr('Date'), width: 130, valueFormatter: (v) => formatDate(v) },
    { field: 'product_name', headerName: tr('Produit'), flex: 1, minWidth: 160 },
    {
      field: 'movement_type', headerName: tr('Type'), width: 120,
      valueFormatter: (v) => tr(MOVEMENT_LABELS[v] || v),
      renderCell: (p) => <Chip size="small" label={tr(MOVEMENT_LABELS[p.value] || p.value)} variant="outlined" />,
    },
    { field: 'quantity', headerName: tr('Qté'), width: 80, valueFormatter: (v) => formatNumber(v) },
    { field: 'notes', headerName: tr('Motif'), flex: 1, minWidth: 140 },
    { field: 'created_by', headerName: tr('Par'), width: 130 },
  ], [tr, version]);

  const transferColumns: GridColDef<StockTransfer>[] = useMemo(() => [
    {
      field: 'reference',
      headerName: tr('N°'),
      width: 110,
      valueGetter: (_v, row) => row.reference || `TRF-${String(row.id).padStart(6, '0')}`,
    },
    { field: 'created_at', headerName: tr('Date'), width: 120, valueFormatter: (v) => formatDate(v) },
    { field: 'from_warehouse', headerName: tr('Source'), width: 130 },
    { field: 'to_warehouse', headerName: tr('Destination'), width: 130 },
    { field: 'items_count', headerName: tr('Articles'), width: 80, valueFormatter: (v) => formatNumber(v ?? 0) },
    {
      field: 'status', headerName: tr('Statut'), width: 130,
      renderCell: (p) => (
        <Chip size="small" color={TRANSFER_STATUS_COLORS[p.value] || 'default'}
          label={tr(TRANSFER_STATUS_LABELS[p.value] || p.value)} />
      ),
    },
    { field: 'created_by', headerName: tr('Par'), width: 120 },
    {
      field: 'transfer_actions', headerName: tr('Actions'), width: 260, sortable: false,
      renderCell: (p) => {
        const busy = transferActionId === p.row.id;
        const status = p.row.status;
        return (
          <Stack direction="row" spacing={0.5}>
            {(status === 'pending' || status === 'preparing') && (
              <Button size="small" variant="outlined" startIcon={<LocalShippingIcon />} disabled={busy}
                onClick={() => handleShip(p.row.id)}>{tr('Expédier')}</Button>
            )}
            {(status === 'shipped' || status === 'in_transit') && (
              <Button size="small" variant="outlined" color="success" startIcon={<CheckCircleIcon />} disabled={busy}
                onClick={() => handleReceive(p.row.id)}>{tr('Recevoir')}</Button>
            )}
            {(status === 'pending' || status === 'preparing') && (
              <IconButton size="small" color="error" disabled={busy} onClick={() => handleCancelTransfer(p.row.id)}>
                <CancelIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        );
      },
    },
  ], [tr, version, transferActionId]);

  const inventoryColumns: GridColDef<InventorySession>[] = useMemo(() => [
    { field: 'created_at', headerName: tr('Date'), width: 120, valueFormatter: (v) => formatDate(v) },
    { field: 'warehouse_name', headerName: tr('Entrepôt'), flex: 1, minWidth: 140 },
    {
      field: 'status', headerName: tr('Statut'), width: 120,
      renderCell: (p) => <Chip size="small" label={tr(INVENTORY_STATUS_LABELS[p.value] || p.value)} variant="outlined" />,
    },
    { field: 'items_count', headerName: tr('Articles'), width: 90, valueFormatter: (v) => formatNumber(v ?? 0) },
    { field: 'counted_count', headerName: tr('Comptés'), width: 90, valueFormatter: (v) => formatNumber(v ?? 0) },
    { field: 'created_by', headerName: tr('Par'), width: 130 },
    { field: 'notes', headerName: tr('Note'), flex: 1, minWidth: 120, valueGetter: (v) => v || '—' },
  ], [tr, version]);

  return (
    <Box>
      <PageHeader
        title={tr('Gestion des stocks')}
        subtitle={tr('Ajoutez, suivez et contrôlez votre stock en quelques clics')}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => openEntry()}
              sx={{ fontWeight: 800, px: 2.5 }}
            >
              {tr('Ajouter du stock')}
            </Button>
            <Button variant="outlined" color="error" startIcon={<RemoveIcon />} onClick={() => openExit()}>
              {tr('Retirer')}
            </Button>
            <Button variant="outlined" startIcon={<SwapHorizIcon />} onClick={() => navigate('/transfers')}
              disabled={warehouses.length < 2}>
              {tr('Transférer')}
            </Button>
            <Button variant="outlined" color="warning" startIcon={<FactCheckIcon />}
              onClick={() => setInventoryDialog({ open: true, sessionId: null })}>
              {tr('Inventaire')}
            </Button>
          </Stack>
        }
      />

      <QuickStockEntry
        warehouses={warehouses}
        products={products}
        defaultWarehouse={warehouse}
        onDone={refreshAll}
        onOpenAdvanced={(productId) => openEntry(productId)}
      />

      <Grid container spacing={2} sx={{ mb: 3, ...fadeUpSx(80) }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Box
            onClick={() => {
              setFilters({ ...filters, status: '' });
              setPaginationModel((m) => ({ ...m, page: 0 }));
              setTab(0);
            }}
            sx={{ cursor: 'pointer' }}
          >
            <StatCard index={0} label={tr('Produits')} value={dashboard?.products_count ?? 0} icon={<InventoryIcon />} color={BRAND.primary} />
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Box
            onClick={() => {
              setFilters({ ...filters, status: 'out_of_stock' });
              setPaginationModel((m) => ({ ...m, page: 0 }));
              setTab(0);
            }}
            sx={{ cursor: 'pointer' }}
          >
            <StatCard index={1} label={tr('Ruptures')} value={dashboard?.out_of_stock ?? 0} icon={<WarningAmberIcon />} color="#C62828" />
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Box
            onClick={() => {
              setFilters({ ...filters, status: 'low' });
              setPaginationModel((m) => ({ ...m, page: 0 }));
              setTab(0);
            }}
            sx={{ cursor: 'pointer' }}
          >
            <StatCard index={2} label={tr('Stock faible')} value={dashboard?.low_stock ?? 0} color={BRAND.coral} />
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard index={3} label={tr('Valeur stock')} value={formatCurrency(dashboard?.stock_value)} icon={<AttachMoneyIcon />} color="#2E7D32" />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={fadeUpSx(120)}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
              sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Tab label={tr('Mes stocks')} />
              <Tab label={`${tr('Mouvements')} (${formatNumber(movements.length)})`} />
              <Tab label={`${tr('Transferts')} (${formatNumber(transfers.length)})`} />
              <Tab label={`${tr('Inventaires')} (${formatNumber(inventories.length)})`} />
              <Tab label={`${tr('Alertes')} (${formatNumber(alerts.length)})`} />
            </Tabs>

            {actionError && (
              <Alert severity="error" onClose={() => setActionError(null)} sx={{ m: 2 }}>{actionError}</Alert>
            )}

              {tab === 0 && (
              <Box sx={{ p: 2 }}>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                  <TextField
                    placeholder={tr('Rechercher un produit…')}
                    value={filters.search}
                    onChange={(e) => {
                      setFilters({ ...filters, search: e.target.value });
                      setPaginationModel((m) => ({ ...m, page: 0 }));
                    }}
                    size="small" sx={{ minWidth: { xs: '100%', sm: 260 }, flex: 1 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                  <TextField select label={tr('État')} value={filters.status} size="small" sx={{ minWidth: 130 }}
                    onChange={(e) => {
                      setFilters({ ...filters, status: e.target.value });
                      setPaginationModel((m) => ({ ...m, page: 0 }));
                    }}>
                    <MenuItem value="">{tr('Tous')}</MenuItem>
                    <MenuItem value="ok">{tr('OK')}</MenuItem>
                    <MenuItem value="low">{tr('Faible')}</MenuItem>
                    <MenuItem value="out_of_stock">{tr('Rupture')}</MenuItem>
                  </TextField>
                  <TextField select label={tr('Entrepôt')} value={filters.warehouse} size="small" sx={{ minWidth: 160 }}
                    onChange={(e) => {
                      setFilters({ ...filters, warehouse: e.target.value ? Number(e.target.value) : '' });
                      setPaginationModel((m) => ({ ...m, page: 0 }));
                    }}>
                    <MenuItem value="">{tr('Tous')}</MenuItem>
                    {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                  </TextField>
                  <Button variant="text" startIcon={<DownloadIcon />} onClick={() => void handleExport()}>
                    {tr('Exporter')}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {tr('Astuce : utilisez « + Stock » sur une ligne pour ajouter rapidement ce produit.')}
                </Typography>
                <Box sx={{ height: 460 }}>
                  <DataGrid
                    rows={listItems}
                    columns={listColumns}
                    loading={listLoading}
                    disableRowSelectionOnClick
                    paginationMode="server"
                    rowCount={listCount}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[25, 50, 100]}
                    sx={{
                      border: 'none',
                      '& .MuiDataGrid-row:hover': { bgcolor: 'rgba(13,148,136,0.04)' },
                    }}
                    columnVisibilityModel={{
                      barcode: false,
                      brand_name: false,
                      purchase_price: false,
                      reserved_quantity: false,
                      min_stock: false,
                    }}
                  />
                </Box>
              </Box>
            )}

            {tab !== 0 && (
              <>
                {sectionLoading && <LinearProgress sx={{ borderRadius: 0 }} />}
                <Box sx={{ height: 500, p: tab === 4 ? 2 : 0 }}>
              {tab === 1 && (
                    <DataGrid rows={movements} columns={movementColumns} loading={sectionLoading} disableRowSelectionOnClick
                  sx={{ border: 'none' }} pageSizeOptions={[25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
              )}
              {tab === 2 && (
                    <DataGrid rows={transfers} columns={transferColumns} loading={sectionLoading} disableRowSelectionOnClick
                  sx={{ border: 'none' }} pageSizeOptions={[25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
              )}
              {tab === 3 && (
                    <DataGrid rows={inventories} columns={inventoryColumns} loading={sectionLoading} disableRowSelectionOnClick
                      onRowClick={(p) => setInventoryDialog({ open: true, sessionId: (p.row as InventorySession).id })}
                      sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }} pageSizeOptions={[25, 50]}
                      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
                  )}
                  {tab === 4 && (
                <Stack spacing={1}>
                  {alerts.length === 0 ? (
                    <Alert severity="success">{tr('Aucune alerte — tout est en ordre.')}</Alert>
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
              </>
            )}
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <TextField select label={tr('Entrepôt actif')} value={warehouse}
            onChange={(e) => setWarehouse(Number(e.target.value))}
            sx={{ mb: 2, width: '100%' }} size="small"
            helperText={tr('Pour mouvements, alertes et inventaires')}>
            {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
          </TextField>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <TrendingUpIcon color="success" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>{tr('Plus vendus (90j)')}</Typography>
              </Stack>
              <List dense disablePadding>
                {(rankings?.top_sold || []).slice(0, 5).map((p, i) => (
                  <ListItem key={p.product_id} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={`${i + 1}. ${p.name}`}
                      secondary={tr(`${p.qty_sold} vendus — ${formatCurrency(p.revenue)}`)}
                      primaryTypographyProps={{ fontSize: 14 }}
                      secondaryTypographyProps={{ fontSize: 12 }}
                    />
                  </ListItem>
                ))}
                {!rankings?.top_sold?.length && (
                  <Typography variant="body2" color="text.secondary">{tr('Pas encore de ventes')}</Typography>
                )}
              </List>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <TrendingDownIcon color="warning" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600}>{tr('Moins vendus (90j)')}</Typography>
              </Stack>
              <List dense disablePadding>
                {(rankings?.least_sold || []).slice(0, 5).map((p) => (
                  <ListItem key={p.product_id} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={p.name}
                      secondary={tr(`${p.qty_sold} vendus`)}
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

      <Menu anchorEl={rowMenu?.anchor} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        <MenuItem onClick={() => { if (rowMenu) openHistory(rowMenu.row); setRowMenu(null); }}>
          {tr('Voir l’historique')}
        </MenuItem>
        <MenuItem onClick={() => { if (rowMenu) openEntry(rowMenu.row.product_id); setRowMenu(null); }}>
          {tr('Ajouter du stock')}
        </MenuItem>
        <MenuItem onClick={() => { if (rowMenu) openExit(rowMenu.row.product_id); setRowMenu(null); }}>
          {tr('Retirer du stock')}
        </MenuItem>
        <MenuItem onClick={() => { setTransferOpen(true); setRowMenu(null); }}>
          {tr('Transférer')}
        </MenuItem>
      </Menu>

      <StockEntryExitDialog
        open={entryExitDialog.open}
        mode={entryExitDialog.mode}
        warehouses={warehouses}
        products={products}
        defaultWarehouse={warehouse}
        defaultProductId={entryExitDialog.productId}
        onClose={() => setEntryExitDialog({ ...entryExitDialog, open: false })}
        onDone={() => { setEntryExitDialog({ ...entryExitDialog, open: false }); refreshAll(); }}
      />

      <StockTransferDialog
        open={transferOpen}
        warehouses={warehouses}
        products={products}
        defaultFrom={warehouse}
        onClose={() => setTransferOpen(false)}
        onDone={() => { setTransferOpen(false); refreshAll(); }}
      />

      <InventorySessionDialog
        open={inventoryDialog.open}
        warehouses={warehouses}
        defaultWarehouse={warehouse}
        sessionId={inventoryDialog.sessionId}
        onClose={() => setInventoryDialog({ open: false, sessionId: null })}
        onDone={() => { setInventoryDialog({ open: false, sessionId: null }); refreshAll(); }}
      />

      <StockHistoryDialog
        open={historyDialog.open}
        productId={historyDialog.productId}
        productName={historyDialog.productName}
        warehouseId={historyDialog.warehouseId}
        onClose={() => setHistoryDialog({ ...historyDialog, open: false })}
      />
    </Box>
  );
}
