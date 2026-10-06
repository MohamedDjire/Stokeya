import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EditIcon from '@mui/icons-material/EditOutlined';
import PageHeader from '../components/PageHeader';
import ProductFormDialog from '../components/ProductFormDialog';
import { fetchProducts, type Product } from '../api/auth';
import { API_BASE_URL } from '../config/api';
import { formatCurrency, formatNumber } from '../utils/format';
import { STOCK_STATUS_COLORS, STOCK_STATUS_LABELS, resolveStockStatus, type StockStatus } from '../utils/stock';
import { useLocale } from '../locale/useLocale';

function imageUrl(image: string | null): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http')) return image;
  return `${API_BASE_URL.replace('/api/v1', '')}${image}`;
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const { tr, version } = useLocale();
  void version;
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const load = useCallback((q?: string) => {
    setLoading(true);
    fetchProducts(q)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const columns: GridColDef<Product>[] = [
    {
      field: 'image',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (params) => (
        <Avatar variant="rounded" src={imageUrl(params.value)} sx={{ width: 36, height: 36, bgcolor: '#EEF1F5' }}>
          <Inventory2 />
        </Avatar>
      ),
    },
    { field: 'name', headerName: tr('Produit'), flex: 1, minWidth: 180 },
    { field: 'sku', headerName: tr('SKU'), width: 120 },
    { field: 'category_name', headerName: tr('Catégorie'), width: 140, valueGetter: (v) => (v ? tr(String(v)) : '—') },
    {
      field: 'sale_price',
      headerName: tr('Détail / Gros'),
      width: 180,
      sortable: false,
      renderCell: (params) => {
        const wholesale = Number(params.row.wholesale_price || 0);
        const minQty = Number(params.row.wholesale_min_qty || 10);
        return (
          <Stack spacing={0} sx={{ lineHeight: 1.2, py: 0.5 }}>
            <span>{formatCurrency(params.row.sale_price)}</span>
            {wholesale > 0 && (
              <Typography variant="caption" color="success.main" fontWeight={700}>
                {formatCurrency(wholesale)} {tr('dès')} {minQty}
              </Typography>
            )}
          </Stack>
        );
      },
    },
    {
      field: 'total_stock',
      headerName: tr('Stock'),
      width: 140,
      renderCell: (params) => {
        const qty = Number(params.value || 0);
        const raw = (params.row.stock_status || resolveStockStatus(qty, params.row.min_stock)) as StockStatus;
        const status: StockStatus = raw in STOCK_STATUS_LABELS ? raw : resolveStockStatus(qty, params.row.min_stock);
        return (
          <Chip
            size="small"
            label={`${formatNumber(qty)} · ${tr(STOCK_STATUS_LABELS[status])}`}
            color={STOCK_STATUS_COLORS[status]}
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (params) => (
        <IconButton size="small" onClick={() => { setEditing(params.row); setDialogOpen(true); }}>
          <EditIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Produits"
        subtitle={`${rows.length} produit(s)`}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => navigate('/products/import')}>
              {tr('Importer')}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>
              {tr('Nouveau produit')}
            </Button>
          </Stack>
        }
      />

      <TextField
        placeholder={tr('Rechercher un produit...')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 400 }}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ height: 600, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          onRowClick={(params) => { setEditing(params.row as Product); setDialogOpen(true); }}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Box>

      <ProductFormDialog
        open={dialogOpen}
        product={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); load(search); }}
      />
    </Box>
  );
}

function Inventory2() {
  return <span style={{ fontSize: 18 }}>📦</span>;
}
