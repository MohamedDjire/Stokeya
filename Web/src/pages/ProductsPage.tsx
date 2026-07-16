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
import { formatCurrency } from '../utils/format';

function imageUrl(image: string | null): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http')) return image;
  return `${API_BASE_URL.replace('/api/v1', '')}${image}`;
}

export default function ProductsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const load = useCallback((q?: string) => {
    setLoading(true);
    fetchProducts(q)
      .then(setRows)
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
    { field: 'name', headerName: 'Produit', flex: 1, minWidth: 180 },
    { field: 'sku', headerName: 'SKU', width: 120 },
    { field: 'category_name', headerName: 'Catégorie', width: 140, valueGetter: (v) => v || '—' },
    {
      field: 'sale_price',
      headerName: 'Prix vente',
      width: 130,
      valueFormatter: (v) => formatCurrency(v),
    },
    {
      field: 'total_stock',
      headerName: 'Stock',
      width: 110,
      renderCell: (params) => {
        const qty = Number(params.value || 0);
        const min = Number(params.row.min_stock || 0);
        return (
          <Chip
            size="small"
            label={qty}
            color={qty <= 0 ? 'error' : qty <= min ? 'warning' : 'success'}
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
              Importer
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>
              Nouveau produit
            </Button>
          </Stack>
        }
      />

      <TextField
        placeholder="Rechercher un produit..."
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
