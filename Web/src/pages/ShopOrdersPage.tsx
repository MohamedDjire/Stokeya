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
  MenuItem,
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
import PrintIcon from '@mui/icons-material/Print';
import PageHeader from '../components/PageHeader';
import {
  fetchPickingList,
  fetchShopOrder,
  fetchShopOrders,
  markShopOrderPaid,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SHOP_ORDER_NEXT,
  SHOP_ORDER_STATUS_COLORS,
  SHOP_ORDER_STATUS_LABELS,
  updateShopOrderItems,
  updateShopOrderStatus,
  type ShopOrder,
} from '../api/shop';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';
import { useLocale } from '../locale/useLocale';

export default function ShopOrdersPage() {
  const { tr, version } = useLocale();
  void version;

  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ShopOrder | null>(null);
  const [picking, setPicking] = useState<Awaited<ReturnType<typeof fetchPickingList>> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback((status?: string) => {
    setLoading(true);
    fetchShopOrders(status ? { status } : undefined)
      .then(setOrders)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(statusFilter || undefined); }, [statusFilter, load]);

  const openOrder = async (id: number) => {
    setError(null);
    try {
      const order = await fetchShopOrder(id);
      setSelected(order);
      setPicking(null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const changeStatus = async (status: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateShopOrderStatus(selected.id, status);
      setSelected(await fetchShopOrder(updated.id));
      load(statusFilter || undefined);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmPaid = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await markShopOrderPaid(selected.id, selected.payment_reference);
      setSelected(await fetchShopOrder(selected.id));
      load(statusFilter || undefined);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const showPicking = async () => {
    if (!selected) return;
    try {
      setPicking(await fetchPickingList(selected.id));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const printDoc = (title: string) => {
    if (!selected) return;
    const items = selected.items || [];
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${title} ${selected.reference}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 8px} table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;font-size:13px}
        .tot{margin-top:16px;text-align:right;font-size:14px}
      </style></head><body>
      <h1>${title}</h1>
      <div><strong>${selected.reference}</strong> — ${formatDate(selected.created_at)}</div>
      <div class="meta">
        <div><strong>${tr('Client')}</strong><br/>${selected.customer_name}<br/>${selected.customer_phone || selected.phone || ''}<br/>${selected.address || ''} ${selected.city || ''}</div>
        <div><strong>${tr('Statut')}</strong><br/>${tr(SHOP_ORDER_STATUS_LABELS[selected.status] || selected.status)}<br/>
        ${tr('Paiement')} : ${selected.payment_method}<br/>${tr('Livraison')} : ${selected.delivery_method}</div>
      </div>
      <table><thead><tr><th>${tr('Produit')}</th><th>${tr('Réf')}</th><th>${tr('Qté')}</th><th>${tr('Prix')}</th><th>${tr('Total')}</th></tr></thead>
      <tbody>${items.map((i) => `<tr><td>${i.product_name}</td><td>${i.sku || ''}</td><td>${i.quantity}</td><td>${formatCurrency(i.unit_price)}</td><td>${formatCurrency(i.total)}</td></tr>`).join('')}</tbody></table>
      <div class="tot">
        <div>${tr('Sous-total')} : ${formatCurrency(selected.subtotal)}</div>
        <div>${tr('TVA')} : ${formatCurrency(selected.tax_amount)}</div>
        <div>${tr('Livraison')} : ${formatCurrency(selected.delivery_fee)}</div>
        <div><strong>${tr('TOTAL')} : ${formatCurrency(selected.total)}</strong></div>
      </div>
      ${(selected.client_note || selected.comment) ? `<p><strong>${tr('Commentaire')} :</strong> ${selected.client_note || selected.comment}</p>` : ''}
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  const printPicking = () => {
    if (!picking) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${tr('Bon de préparation')} ${picking.reference}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px} .line{border-bottom:1px dashed #999;padding:12px 0;font-size:16px}</style></head><body>
      <h1>${tr('Bon de préparation')}</h1>
      <p>${picking.reference} — ${picking.customer}</p>
      ${picking.lines.map((l) => `<div class="line"><strong>${l.product_name}</strong><br/>${tr('Emplacement')} : ${l.location}<br/>${l.quantity} ${l.packaging ? tr(l.packaging) : ''} — ${tr('Réf')} ${l.sku || ''}</div>`).join('')}
      <script>window.print()</script></body></html>`);
    w.document.close();
  };

  const adjustQty = async (itemId: number, quantity: number) => {
    if (!selected?.items) return;
    const items = selected.items.map((i) => ({
      product_id: i.product,
      quantity: i.id === itemId ? quantity : Number(i.quantity),
      unit_price: Number(i.unit_price),
      discount: Number(i.discount || 0),
    })).filter((i) => i.quantity > 0);
    setSaving(true);
    try {
      await updateShopOrderItems(selected.id, items);
      setSelected(await fetchShopOrder(selected.id));
      load(statusFilter || undefined);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const nextStatuses = selected ? (SHOP_ORDER_NEXT[selected.status] || []) : [];

  const columns: GridColDef<ShopOrder>[] = [
    { field: 'created_at', headerName: tr('Date'), width: 120, valueFormatter: (v) => formatDate(v) },
    { field: 'reference', headerName: tr('N° commande'), width: 150 },
    { field: 'customer_name', headerName: tr('Client'), flex: 1, minWidth: 150 },
    { field: 'customer_phone', headerName: tr('Téléphone'), width: 130 },
    { field: 'items_count', headerName: tr('Lignes'), width: 80, valueFormatter: (v) => formatNumber(v ?? 0) },
    { field: 'total', headerName: tr('Total'), width: 120, valueFormatter: (v) => formatCurrency(v) },
    {
      field: 'payment_status', headerName: tr('Paiement'), width: 120,
      valueGetter: (_v, row) => tr(PAYMENT_STATUS_LABELS[row.payment_status || ''] || row.payment_status || '—'),
    },
    {
      field: 'status', headerName: tr('Statut'), width: 140,
      renderCell: (p) => (
        <Chip size="small" color={SHOP_ORDER_STATUS_COLORS[p.value] || 'default'}
          label={tr(SHOP_ORDER_STATUS_LABELS[p.value] || p.value)} />
      ),
    },
  ];

  return (
    <Box>
      <PageHeader title={tr('Commandes boutique')} subtitle={tr('Commandes B2B — préparation, stock réservé, facturation')} />
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField select label={tr('Statut')} value={statusFilter} size="small" sx={{ minWidth: 180 }}
          onChange={(e) => setStatusFilter(e.target.value)}>
          <MenuItem value="">{tr('Toutes')}</MenuItem>
          {Object.entries(SHOP_ORDER_STATUS_LABELS)
            .filter(([k]) => ['pending', 'validated', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'].includes(k))
            .map(([value, label]) => <MenuItem key={value} value={value}>{tr(label)}</MenuItem>)}
        </TextField>
      </Stack>

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid
          rows={orders}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          onRowClick={(p) => openOrder(p.row.id)}
          sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Box>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>
              {tr('Commande')} {selected.reference}
              <Typography variant="body2" color="text.secondary">
                {formatDate(selected.created_at)} · {tr(SHOP_ORDER_STATUS_LABELS[selected.status] || selected.status)}
                {selected.stock_reserved ? ` · ${tr('Stock réservé')}` : ''}
                {selected.stock_deducted ? ` · ${tr('Stock sorti')}` : ''}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 2 }}>
                <Box flex={1}>
                  <Typography variant="subtitle2">{tr('Client')}</Typography>
                  <Typography fontWeight={700}>{selected.customer_name}</Typography>
                  <Typography variant="body2">{selected.customer_phone || selected.phone}</Typography>
                  <Typography variant="body2">{selected.address} {selected.city}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="subtitle2">{tr('Paiement / Livraison')}</Typography>
                  <Typography variant="body2">
                    {tr('Mode')} : {tr(PAYMENT_METHOD_LABELS[selected.payment_method || ''] || selected.payment_method || '')}
                  </Typography>
                  <Typography variant="body2">
                    {tr('Statut')} : {tr(PAYMENT_STATUS_LABELS[selected.payment_status || ''] || selected.payment_status || '—')}
                  </Typography>
                  {selected.payment_reference && (
                    <Typography variant="body2">{tr('Réf. paiement')} : {selected.payment_reference}</Typography>
                  )}
                  {selected.sale && (
                    <Typography variant="body2" color="success.main">{tr('Vente liée')} #{selected.sale}</Typography>
                  )}
                  <Typography variant="body2">{tr('Livraison')} : {selected.delivery_method}</Typography>
                  {(selected.client_note || selected.comment) && (
                    <Typography variant="body2" sx={{ mt: 1 }}><strong>{tr('Note')} :</strong> {selected.client_note || selected.comment}</Typography>
                  )}
                </Box>
              </Stack>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{tr('Produit')}</TableCell>
                    <TableCell>{tr('Réf')}</TableCell>
                    <TableCell>{tr('Qté')}</TableCell>
                    <TableCell>{tr('Prix')}</TableCell>
                    <TableCell align="right">{tr('Total')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(selected.items || []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.product_name}</TableCell>
                      <TableCell>{i.sku || '—'}</TableCell>
                      <TableCell>
                        {['pending', 'validated', 'preparing', 'received', 'accepted'].includes(selected.status) ? (
                          <TextField
                            size="small" type="number" value={i.quantity} sx={{ width: 80 }}
                            onChange={(e) => adjustQty(i.id, Number(e.target.value))}
                            disabled={saving}
                          />
                        ) : i.quantity}
                      </TableCell>
                      <TableCell>{formatCurrency(i.unit_price)}</TableCell>
                      <TableCell align="right">{formatCurrency(i.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Stack alignItems="flex-end" spacing={0.5} sx={{ mt: 2 }}>
                <Typography variant="body2">{tr('Sous-total')} : {formatCurrency(selected.subtotal)}</Typography>
                <Typography variant="body2">{tr('Remise')} : {formatCurrency(selected.discount_amount)}</Typography>
                <Typography variant="body2">{tr('TVA')} : {formatCurrency(selected.tax_amount)}</Typography>
                <Typography variant="body2">{tr('Livraison')} : {formatCurrency(selected.delivery_fee)}</Typography>
                <Typography variant="h6">{tr('TOTAL')} : {formatCurrency(selected.total)}</Typography>
              </Stack>

              {selected.adjustment_note && (
                <Alert severity="warning" sx={{ mt: 2 }}>{selected.adjustment_note}</Alert>
              )}

              {picking && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#F7F9FC', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>{tr('Liste de préparation')}</Typography>
                  {picking.lines.map((l, idx) => (
                    <Box key={idx} sx={{ py: 1, borderBottom: '1px dashed #ccc' }}>
                      <Typography fontWeight={700}>{l.product_name}</Typography>
                      <Typography variant="body2">{tr('Emplacement')} : {l.location} — {l.quantity} {l.packaging ? tr(l.packaging) : ''}</Typography>
                    </Box>
                  ))}
                  <Button startIcon={<PrintIcon />} sx={{ mt: 1 }} onClick={printPicking}>{tr('Imprimer le picking')}</Button>
                </Box>
              )}

              {(selected.status_history || []).length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2">{tr('Historique')}</Typography>
                  {(selected.status_history || []).map((h, i) => (
                    <Typography key={i} variant="caption" display="block">
                      {h.at} — {tr(SHOP_ORDER_STATUS_LABELS[h.status] || h.status)} ({h.by}) {h.note || ''}
                    </Typography>
                  ))}
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Button startIcon={<PrintIcon />} onClick={() => printDoc(tr('Bon de commande'))}>{tr('Bon de commande')}</Button>
              <Button startIcon={<PrintIcon />} onClick={() => printDoc(tr('Facture'))}>{tr('Facture')}</Button>
              <Button startIcon={<PrintIcon />} onClick={() => printDoc(tr('Bon de livraison'))}>{tr('Bon de livraison')}</Button>
              {(selected.status === 'preparing' || selected.status === 'validated') && (
                <Button onClick={showPicking}>Picking list</Button>
              )}
              {selected.payment_status !== 'paid' && selected.payment_method !== 'cod' && (
                <Button variant="outlined" color="success" disabled={saving} onClick={confirmPaid}>
                  {tr('Confirmer le paiement')}
                </Button>
              )}
              {nextStatuses.map((st) => (
                <Button key={st} variant="contained" disabled={saving} onClick={() => changeStatus(st)}>
                  {tr(SHOP_ORDER_STATUS_LABELS[st] || st)}
                </Button>
              ))}
              <Button onClick={() => setSelected(null)}>{tr('Fermer')}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
