import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import PageHeader from '../components/PageHeader';
import { fetchSaleReceipt, fetchSales, PAYMENT_LABELS, type Sale } from '../api/sales';
import { formatCurrency, formatDate } from '../utils/format';
import { useLocale } from '../locale/useLocale';

const STATUS_LABELS: Record<string, string> = {
  completed: 'Terminée',
  cancelled: 'Annulée',
  returned: 'Retournée',
  draft: 'Brouillon',
};

export default function SalesPage() {
  const { tr, version } = useLocale();
  void version;

  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Sale | null>(null);

  const load = () => {
    setLoading(true);
    fetchSales(search ? { search } : undefined)
      .then(setSales)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const printReceipt = async (saleId: number) => {
    const receipt = await fetchSaleReceipt(saleId);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(receipt.html);
      w.document.close();
      w.print();
    }
  };

  const columns: GridColDef<Sale>[] = useMemo(() => [
    { field: 'reference', headerName: tr('Référence'), width: 140 },
    { field: 'created_at', headerName: tr('Date'), width: 130, valueFormatter: (v) => formatDate(v) },
    { field: 'branch_name', headerName: tr('Boutique'), width: 130 },
    { field: 'customer_name', headerName: tr('Client'), flex: 1, minWidth: 140, valueFormatter: (v) => v || '—' },
    { field: 'seller_name', headerName: tr('Vendeur'), width: 130 },
    {
      field: 'total', headerName: tr('Total'), width: 120,
      valueFormatter: (v) => formatCurrency(v),
    },
    {
      field: 'status', headerName: tr('Statut'), width: 120,
      renderCell: (p) => (
        <Chip size="small" label={tr(STATUS_LABELS[p.value] || p.value)}
          color={p.value === 'completed' ? 'success' : p.value === 'cancelled' ? 'error' : 'default'}
          variant="outlined" />
      ),
    },
    {
      field: 'actions', headerName: '', width: 100, sortable: false,
      renderCell: (p) => (
        <Button size="small" onClick={() => setSelected(p.row)}>{tr('Détails')}</Button>
      ),
    },
  ], [tr, version]);

  return (
    <Box>
      <PageHeader
        title="Historique des ventes"
        subtitle="Tickets, paiements et détails par caisse"
        action={
          <Stack direction="row" spacing={1}>
            <TextField size="small" placeholder={tr('Rechercher une référence…')} value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()} />
            <Button variant="outlined" onClick={load}>{tr('Rechercher')}</Button>
          </Stack>
        }
      />

      <Card>
        <DataGrid
          rows={sales}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          sx={{ border: 'none', minHeight: 520 }}
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ReceiptIcon color="primary" />
                <Box>
                  <Typography fontWeight={700}>{selected.reference}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(selected.created_at)} — {selected.branch_name}
                  </Typography>
                </Box>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <Typography variant="body2"><strong>{tr('Client')} :</strong> {selected.customer_name || '—'}</Typography>
                  <Typography variant="body2"><strong>{tr('Vendeur')} :</strong> {selected.seller_name || '—'}</Typography>
                </Stack>
                <Divider />
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{tr('Produit')}</TableCell>
                      <TableCell align="right">{tr('Qté')}</TableCell>
                      <TableCell align="right">{tr('P.U.')}</TableCell>
                      <TableCell align="right">{tr('Total')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selected.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Divider />
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{tr('Sous-total')}</Typography>
                    <Typography variant="body2">{formatCurrency(selected.subtotal)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">{tr('TVA')}</Typography>
                    <Typography variant="body2">{formatCurrency(selected.tax_amount)}</Typography>
                  </Stack>
                  {Number(selected.discount_amount) > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">{tr('Remise')}</Typography>
                      <Typography variant="body2" color="error.main">-{formatCurrency(selected.discount_amount)}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight={700}>{tr('Total')}</Typography>
                    <Typography fontWeight={700} color="primary.main">{formatCurrency(selected.total)}</Typography>
                  </Stack>
                </Stack>
                {selected.payments.length > 0 && (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">{tr('Paiements')}</Typography>
                    {selected.payments.map((p, i) => (
                      <Stack key={i} direction="row" justifyContent="space-between">
                        <Typography variant="body2">{tr(PAYMENT_LABELS[p.method] || p.method)}</Typography>
                        <Typography variant="body2">{formatCurrency(p.amount)}</Typography>
                      </Stack>
                    ))}
                  </>
                )}
                <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => printReceipt(selected.id)}>
                  {tr('Imprimer le ticket')}
                </Button>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
