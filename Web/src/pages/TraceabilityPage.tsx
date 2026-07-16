import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../components/PageHeader';
import { fetchProducts, type Product } from '../api/auth';
import {
  createBatch,
  fetchBatches,
  fetchProductTraceability,
  type Batch,
  type ProductTraceability,
  type TraceabilityMovement,
} from '../api/batches';
import { MOVEMENT_LABELS } from '../api/stock';
import { getApiErrorMessage } from '../api/client';
import { formatDate } from '../utils/format';

const batchEmpty = { batch_number: '', expiry_date: '', quantity: '' };

export default function TraceabilityPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [trace, setTrace] = useState<ProductTraceability | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState(batchEmpty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts().then(setProducts);
    fetchBatches().then(setBatches);
  }, []);

  const loadTrace = useCallback(async (product: Product) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductTraceability(product.id);
      setTrace(data);
      setBatches(data.batches);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setTrace(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onSelectProduct = (product: Product | null) => {
    setSelected(product);
    if (product) loadTrace(product);
    else setTrace(null);
  };

  const openBatchDialog = () => {
    setBatchForm(batchEmpty);
    setError(null);
    setBatchOpen(true);
  };

  const saveBatch = async () => {
    if (!selected) return;
    if (!batchForm.batch_number || !batchForm.quantity) {
      setError('Numéro de lot et quantité sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createBatch({
        product: selected.id,
        batch_number: batchForm.batch_number,
        expiry_date: batchForm.expiry_date || null,
        quantity: batchForm.quantity,
      });
      setBatchOpen(false);
      loadTrace(selected);
      fetchBatches(selected.id).then(setBatches);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const stockColumns: GridColDef[] = [
    { field: 'branch_name', headerName: 'Magasin', width: 140 },
    { field: 'warehouse_name', headerName: 'Entrepôt', flex: 1, minWidth: 160 },
    { field: 'quantity', headerName: 'Quantité', width: 110 },
  ];

  const batchColumns: GridColDef<Batch>[] = [
    { field: 'batch_number', headerName: 'N° lot', width: 140 },
    { field: 'quantity', headerName: 'Quantité', width: 100 },
    { field: 'expiry_date', headerName: 'Expiration', width: 130, valueFormatter: (v) => formatDate(v) },
    { field: 'created_at', headerName: 'Créé le', width: 130, valueFormatter: (v) => formatDate(v) },
  ];

  const movementColumns: GridColDef<TraceabilityMovement>[] = [
    { field: 'created_at', headerName: 'Date', width: 130, valueFormatter: (v) => formatDate(v) },
    { field: 'warehouse_name', headerName: 'Entrepôt', width: 150 },
    {
      field: 'movement_type', headerName: 'Type', width: 120,
      valueFormatter: (v) => MOVEMENT_LABELS[v] || v,
      renderCell: (p) => <Chip size="small" label={MOVEMENT_LABELS[p.value] || p.value} variant="outlined" />,
    },
    { field: 'quantity', headerName: 'Qté', width: 80 },
    { field: 'reference', headerName: 'Réf.', width: 110 },
    { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 140 },
    { field: 'created_by', headerName: 'Par', width: 130, valueGetter: (v) => v || '—' },
  ];

  return (
    <Box>
      <PageHeader
        title="Traçabilité"
        subtitle="Historique des mouvements et lots par produit"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openBatchDialog} disabled={!selected}>
            Nouveau lot
          </Button>
        }
      />

      <Autocomplete
        options={products}
        getOptionLabel={(p) => `${p.name} (${p.sku})`}
        value={selected}
        onChange={(_, v) => onSelectProduct(v)}
        renderInput={(params) => <TextField {...params} label="Rechercher un produit" sx={{ mb: 2, maxWidth: 480 }} />}
      />

      {error && !batchOpen && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {selected && trace && (
        <Card>
          <Box sx={{ px: 2, pt: 2 }}>
            <Typography variant="h6" fontWeight={600}>{trace.product.name}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5, mb: 1 }}>
              <Chip size="small" label={`SKU: ${trace.product.sku}`} variant="outlined" />
              <Chip size="small" label={`Stock total: ${trace.product.total_stock}`} color="primary" variant="outlined" />
              {trace.product.track_batches && <Chip size="small" label="Lots activés" color="info" variant="outlined" />}
            </Stack>
          </Box>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label={`Stock (${trace.stock_levels.length})`} />
            <Tab label={`Lots (${batches.length})`} />
            <Tab label={`Mouvements (${trace.movements.length})`} />
          </Tabs>
          <Box sx={{ height: 440, p: tab === 0 ? 0 : 0 }}>
            {tab === 0 && (
              <DataGrid rows={trace.stock_levels.map((s, i) => ({ id: i, ...s }))} columns={stockColumns}
                loading={loading} disableRowSelectionOnClick sx={{ border: 'none' }}
                pageSizeOptions={[25]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
            )}
            {tab === 1 && (
              <DataGrid rows={batches} columns={batchColumns} loading={loading} disableRowSelectionOnClick
                sx={{ border: 'none' }} pageSizeOptions={[25]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
            )}
            {tab === 2 && (
              <DataGrid rows={trace.movements} columns={movementColumns} loading={loading} disableRowSelectionOnClick
                getRowId={(r) => r.id} sx={{ border: 'none' }}
                pageSizeOptions={[25]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
            )}
          </Box>
        </Card>
      )}

      {!selected && (
        <Typography color="text.secondary">Sélectionnez un produit pour afficher sa traçabilité.</Typography>
      )}

      <Dialog open={batchOpen} onClose={() => setBatchOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nouveau lot{selected ? ` — ${selected.name}` : ''}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Numéro de lot" value={batchForm.batch_number}
              onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })} fullWidth required />
            <TextField label="Quantité" type="number" value={batchForm.quantity}
              onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} fullWidth required />
            <TextField label="Date d'expiration" type="date" value={batchForm.expiry_date}
              onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })} fullWidth
              InputLabelProps={{ shrink: true }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBatchOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={saveBatch} disabled={saving || !selected}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
