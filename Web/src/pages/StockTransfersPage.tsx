import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import PageHeader from '../components/PageHeader';
import TransferCreateDialog from '../components/transfers/TransferCreateDialog';
import TransferReceiveDialog from '../components/transfers/TransferReceiveDialog';
import { printTransferSlip } from '../components/transfers/printTransferSlip';
import {
  cancelTransfer,
  fetchStockTransfers,
  fetchWarehouses,
  prepareTransfer,
  shipTransfer,
  TRANSFER_STATUS_COLORS,
  TRANSFER_STATUS_LABELS,
  type StockTransfer,
  type WarehouseItem,
} from '../api/stock';
import { getApiErrorMessage } from '../api/client';
import { formatDate, formatNumber } from '../utils/format';
import { useAppSelector } from '../store/hooks';
import { useLocale } from '../locale/useLocale';

export default function StockTransfersPage() {
  const { tr, version } = useLocale();
  void version;

  const companyName = useAppSelector((s) => s.auth.user?.company_name || 'Stokeya');
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createFrom, setCreateFrom] = useState<number | ''>('');
  const [createTo, setCreateTo] = useState<number | ''>('');
  const [createSmart, setCreateSmart] = useState(false);
  const [receiveRow, setReceiveRow] = useState<StockTransfer | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchStockTransfers()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetchWarehouses().then(setWarehouses);
  }, [load]);

  useEffect(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const smart = searchParams.get('smart') === '1';
    const isReturn = searchParams.get('return') === '1';
    if (from || to || smart || isReturn) {
      setCreateFrom(from ? Number(from) : '');
      setCreateTo(to ? Number(to) : '');
      setCreateSmart(smart);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openCreate = () => {
    setCreateFrom('');
    setCreateTo('');
    setCreateSmart(false);
    setCreateOpen(true);
  };

  const runAction = async (id: number, action: () => Promise<unknown>, okMsg?: string) => {
    setActionError(null);
    setSuccess(null);
    setActionId(id);
    try {
      await action();
      if (okMsg) setSuccess(okMsg);
      load();
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  const columns: GridColDef<StockTransfer>[] = [
    {
      field: 'reference',
      headerName: tr('N°'),
      width: 120,
      valueGetter: (_v, row) => row.reference || `TRF-${String(row.id).padStart(6, '0')}`,
    },
    { field: 'created_at', headerName: tr('Date'), width: 110, valueFormatter: (v) => formatDate(v) },
    { field: 'from_warehouse', headerName: tr('Source'), flex: 1, minWidth: 130 },
    { field: 'to_warehouse', headerName: tr('Destination'), flex: 1, minWidth: 130 },
    { field: 'items_count', headerName: tr('Produits'), width: 90, valueFormatter: (v) => formatNumber(v ?? 0) },
    {
      field: 'total_quantity',
      headerName: tr('Qté'),
      width: 90,
      valueFormatter: (v) => (v == null ? '—' : formatNumber(v)),
    },
    {
      field: 'status',
      headerName: tr('Statut'),
      width: 140,
      renderCell: (p) => (
        <Chip
          size="small"
          color={TRANSFER_STATUS_COLORS[p.value] || 'default'}
          label={tr(TRANSFER_STATUS_LABELS[p.value] || p.value)}
        />
      ),
    },
    { field: 'created_by', headerName: tr('Créé par'), width: 120 },
    {
      field: 'actions',
      headerName: tr('Actions'),
      width: 340,
      sortable: false,
      renderCell: (p) => {
        const busy = actionId === p.row.id;
        const status = p.row.status;
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Tooltip title={tr('Imprimer le bon')}>
              <IconButton size="small" onClick={() => printTransferSlip(p.row, companyName)}>
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {status === 'pending' && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<InventoryIcon />}
                disabled={busy}
                onClick={() => runAction(p.row.id, () => prepareTransfer(p.row.id), tr('Transfert en préparation'))}
              >
                {tr('Préparer')}
              </Button>
            )}
            {(status === 'pending' || status === 'preparing') && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<LocalShippingIcon />}
                disabled={busy}
                onClick={() => runAction(p.row.id, () => shipTransfer(p.row.id), tr('Transfert expédié'))}
              >
                {tr('Expédier')}
              </Button>
            )}
            {(status === 'shipped' || status === 'in_transit') && (
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<CheckCircleIcon />}
                disabled={busy}
                onClick={() => setReceiveRow(p.row)}
              >
                {tr('Recevoir')}
              </Button>
            )}
            {(status === 'pending' || status === 'preparing') && (
              <IconButton
                size="small"
                color="error"
                disabled={busy}
                onClick={() => runAction(p.row.id, () => cancelTransfer(p.row.id), tr('Transfert annulé'))}
              >
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
        title={tr('Transferts de stock')}
        subtitle={tr('Approvisionnement entre siège, entrepôts et points de vente')}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            disabled={warehouses.length < 2}
          >
            {tr('Nouveau transfert')}
          </Button>
        }
      />

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        {tr('Un produit n\'existe qu\'une fois : seul le stock par emplacement change.')}
        {' '}
        {tr('Le stock est réservé à la création, retiré à l\'expédition, ajouté à la réception.')}
        {' '}
        {tr('Transfert direct entre points de vente interdit (passez par un entrepôt ou le siège).')}
      </Alert>

      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        sx={{ bgcolor: 'background.paper' }}
      />

      <TransferCreateDialog
        open={createOpen}
        warehouses={warehouses}
        recentTransfers={rows}
        initialFrom={createFrom}
        initialTo={createTo}
        autoSmart={createSmart}
        onClose={() => setCreateOpen(false)}
        onCreated={(transfer) => {
          setCreateOpen(false);
          setSuccess(`${tr('Transfert')} ${transfer.reference || `TRF-${transfer.id}`} ${tr('créé — stock réservé, en préparation.')}`);
          printTransferSlip(transfer, companyName);
          load();
        }}
      />

      <TransferReceiveDialog
        open={Boolean(receiveRow)}
        transfer={receiveRow}
        onClose={() => setReceiveRow(null)}
        onDone={() => {
          setReceiveRow(null);
          setSuccess(tr('Réception confirmée — stock destination mis à jour.'));
          load();
        }}
      />
    </Box>
  );
}
