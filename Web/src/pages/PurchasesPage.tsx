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
import PageHeader from '../components/PageHeader';
import {
  createPurchaseOrder,
  fetchPurchaseOrders,
  receivePurchaseOrder,
  type PurchaseOrder,
} from '../api/purchases';
import { fetchSuppliers, type Supplier } from '../api/suppliers';
import { fetchProducts, type Product } from '../api/auth';
import { fetchWarehouses, type WarehouseItem } from '../api/stock';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';
import { useLocale } from '../locale/useLocale';

interface Line { product_id: number | ''; quantity: string; unit_price: string; }

export default function PurchasesPage() {
  const { tr, version } = useLocale();
  void version;

  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);

  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState<number | ''>('');
  const [lines, setLines] = useState<Line[]>([{ product_id: '', quantity: '', unit_price: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null);
  const [warehouse, setWarehouse] = useState<number | ''>('');

  const load = useCallback(() => {
    setLoading(true);
    fetchPurchaseOrders().then(setRows).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetchSuppliers().then(setSuppliers);
    fetchProducts().then(setProducts);
    fetchWarehouses().then((w) => { setWarehouses(w); const d = w.find((x) => x.is_default) || w[0]; if (d) setWarehouse(d.id); });
  }, [load]);

  const addLine = () => setLines([...lines, { product_id: '', quantity: '', unit_price: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setLine = (i: number, key: keyof Line, value: string) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [key]: key === 'product_id' ? Number(value) : value } : l)));

  const createOrder = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product_id && l.quantity);
    if (!supplier || valid.length === 0) { setError(tr('Choisissez un fournisseur et au moins un produit.')); return; }
    setSaving(true);
    try {
      await createPurchaseOrder({
        supplier_id: Number(supplier),
        items: valid.map((l) => ({ product_id: Number(l.product_id), quantity: l.quantity, unit_price: l.unit_price || undefined })),
      });
      setOpen(false);
      setSupplier('');
      setLines([{ product_id: '', quantity: '', unit_price: '' }]);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doReceive = async () => {
    if (!receiveOrder || !warehouse) return;
    setSaving(true);
    try {
      await receivePurchaseOrder(receiveOrder.id, {
        warehouse_id: Number(warehouse),
        items: receiveOrder.items.map((it) => ({ order_item_id: it.id, quantity_received: it.quantity })),
      });
      setReceiveOrder(null);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef<PurchaseOrder>[] = [
    { field: 'reference', headerName: tr('Référence'), width: 150 },
    { field: 'supplier_name', headerName: tr('Fournisseur'), flex: 1, minWidth: 160 },
    { field: 'created_at', headerName: tr('Date'), width: 120, valueFormatter: (v) => formatDate(v) },
    { field: 'total', headerName: tr('Total'), width: 140, valueFormatter: (v) => formatCurrency(v) },
    {
      field: 'status', headerName: tr('Statut'), width: 130,
      renderCell: (p) => <Chip size="small" label={p.value} variant="outlined"
        color={p.value === 'received' ? 'success' : p.value === 'cancelled' ? 'error' : 'warning'} />,
    },
    {
      field: 'actions', headerName: '', width: 130, sortable: false,
      renderCell: (p) => p.row.status !== 'received' ? (
        <Button size="small" onClick={(e) => { e.stopPropagation(); setReceiveOrder(p.row); }}>{tr('Réceptionner')}</Button>
      ) : null,
    },
  ];

  return (
    <Box>
      <PageHeader title={tr('Achats')} subtitle={tr(`${rows.length} commande(s)`)}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setOpen(true); }}>{tr('Nouvelle commande')}</Button>} />

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} disableRowSelectionOnClick
          sx={{ border: 'none' }} pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{tr('Nouvelle commande d\'achat')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label={tr('Fournisseur')} value={supplier}
              onChange={(e) => setSupplier(Number(e.target.value))} fullWidth>
              {suppliers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <Divider>{tr('Articles')}</Divider>
            {lines.map((l, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField select label={tr('Produit')} value={l.product_id}
                  onChange={(e) => setLine(i, 'product_id', e.target.value)} sx={{ flex: 2 }} size="small">
                  {products.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </TextField>
                <TextField label={tr('Qté')} type="number" value={l.quantity}
                  onChange={(e) => setLine(i, 'quantity', e.target.value)} sx={{ flex: 1 }} size="small" />
                <TextField label={tr('P.U.')} type="number" value={l.unit_price}
                  onChange={(e) => setLine(i, 'unit_price', e.target.value)} sx={{ flex: 1 }} size="small" />
                <IconButton size="small" color="error" onClick={() => removeLine(i)}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            <Button startIcon={<AddIcon />} onClick={addLine} size="small" sx={{ alignSelf: 'flex-start' }}>
              {tr('Ajouter un article')}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={createOrder} disabled={saving}>{tr('Créer')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!receiveOrder} onClose={() => setReceiveOrder(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{tr('Réceptionner la commande')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {receiveOrder?.reference} — {receiveOrder?.items.length} {tr('article(s)')}
            </Typography>
            <TextField select label={tr('Entrepôt de réception')} value={warehouse}
              onChange={(e) => setWarehouse(Number(e.target.value))} fullWidth>
              {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
            </TextField>
            <Alert severity="info">{tr('La totalité des quantités commandées sera ajoutée au stock.')}</Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReceiveOrder(null)}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={doReceive} disabled={saving}>{tr('Confirmer la réception')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
