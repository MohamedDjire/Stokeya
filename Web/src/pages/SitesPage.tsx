import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PageHeader from '../components/PageHeader';
import ImportFromMainDialog from '../components/ImportFromMainDialog';
import {
  createBranch,
  createLocation,
  createWarehouse,
  fetchBranches,
  fetchLocations,
  fetchOnlineShop,
  fetchWarehousesCrud,
  updateBranch,
  updateLocation,
  updateOnlineShop,
  updateWarehouse,
  type Branch,
  type Location,
  type OnlineShop,
  type Warehouse,
} from '../api/sites';
import { fetchSubscription } from '../api/subscription';
import { getApiErrorMessage } from '../api/client';
import {
  FEATURE_MULTI_BRANCH,
  FEATURE_MULTI_WAREHOUSE,
  FEATURE_ONLINE_SHOP,
  hasPlanFeature,
} from '../utils/planFeatures';
import { formatNumber } from '../utils/format';
import { useLocale } from '../locale/useLocale';

const branchEmpty = {
  name: '',
  code: '',
  address: '',
  city: '',
  phone: '',
  manager_name: '',
  opening_hours: '',
  currency: 'XOF',
  default_supply_warehouse: '' as number | '',
  allow_supplier_receipts: false,
  is_active: true,
};
const warehouseEmpty = {
  name: '',
  code: '',
  manager_name: '',
  phone: '',
  address: '',
  city: '',
  description: '',
  branch: '' as number | '',
  is_default: false,
  is_active: true,
  is_pos_stock: false,
};
const locationEmpty = { code: '', name: '', warehouse: '' as number | '', is_active: true };

function absoluteShopLink(path?: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${window.location.origin}${path}`;
}

type SiteTabKey = 'main' | 'pos' | 'warehouses' | 'online' | 'locations';

export default function SitesPage() {
  const { tr, version } = useLocale();
  void version;

  const navigate = useNavigate();
  const [tabKey, setTabKey] = useState<SiteTabKey>('main');
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [onlineShop, setOnlineShop] = useState<OnlineShop | null>(null);
  const [shopForm, setShopForm] = useState<Partial<OnlineShop>>({});
  const [loading, setLoading] = useState(true);
  const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('');

  const [open, setOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [branchForm, setBranchForm] = useState(branchEmpty);
  const [warehouseForm, setWarehouseForm] = useState(warehouseEmpty);
  const [locationForm, setLocationForm] = useState(locationEmpty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importWarehouse, setImportWarehouse] = useState<Warehouse | null>(null);

  const mainBranch = useMemo(() => branches.find((b) => b.is_main) || null, [branches]);
  const posBranches = useMemo(() => branches.filter((b) => !b.is_main), [branches]);
  const storageWarehouses = useMemo(() => warehouses.filter((w) => !w.is_pos_stock), [warehouses]);
  const posWarehouses = useMemo(() => warehouses.filter((w) => w.is_pos_stock), [warehouses]);

  const canMultiBranch = hasPlanFeature(planFeatures, FEATURE_MULTI_BRANCH);
  const canMultiWarehouse = hasPlanFeature(planFeatures, FEATURE_MULTI_WAREHOUSE);
  const canOnlineShop = hasPlanFeature(planFeatures, FEATURE_ONLINE_SHOP)
    || onlineShop?.feature_available === true;

  const siteTabs = useMemo(() => {
    const tabs: { key: SiteTabKey; label: string }[] = [
      { key: 'main', label: tr('Boutique principale') },
    ];
    if (canMultiBranch) {
      tabs.push({ key: 'pos', label: `${tr('Points de vente')} (${posBranches.length})` });
    }
    if (canMultiWarehouse) {
      tabs.push({ key: 'warehouses', label: `${tr('Entrepôts')} (${storageWarehouses.length})` });
    }
    tabs.push({ key: 'online', label: tr('Boutique en ligne') });
    if (canMultiBranch || canMultiWarehouse) {
      tabs.push({ key: 'locations', label: `${tr('Emplacements')} (${locations.length})` });
    }
    return tabs;
  }, [
    canMultiBranch, canMultiWarehouse, posBranches.length,
    storageWarehouses.length, locations.length, tr, version,
  ]);

  const tabIndex = Math.max(0, siteTabs.findIndex((t) => t.key === tabKey));

  const loadBranches = useCallback(() => fetchBranches().then(setBranches), []);
  const loadWarehouses = useCallback(() => fetchWarehousesCrud().then(setWarehouses), []);
  const loadLocations = useCallback((wid?: number) => {
    fetchLocations(wid || undefined).then(setLocations);
  }, []);
  const loadShop = useCallback(() => fetchOnlineShop().then((s) => {
    setOnlineShop(s);
    setShopForm(s);
  }).catch(() => undefined), []);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      loadBranches(),
      loadWarehouses(),
      loadLocations(),
      loadShop(),
      fetchSubscription().then((s) => setPlanFeatures(s.features || [])).catch(() => setPlanFeatures([])),
    ]).finally(() => setLoading(false));
  }, [loadBranches, loadWarehouses, loadLocations, loadShop]);

  useEffect(() => {
    if (!siteTabs.some((t) => t.key === tabKey)) {
      setTabKey('main');
    }
  }, [siteTabs, tabKey]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (tabKey === 'locations') loadLocations(warehouseFilter ? Number(warehouseFilter) : undefined);
  }, [tabKey, warehouseFilter, loadLocations]);

  const openBranchDialog = (b?: Branch) => {
    setEditingBranch(b || null);
    const mainPosWh = warehouses.find((w) => w.branch === mainBranch?.id && w.is_pos_stock);
    const defaultSupply = storageWarehouses[0]?.id || mainPosWh?.id || '';
    setBranchForm(b ? {
      name: b.name,
      code: b.code || '',
      address: b.address || '',
      city: b.city || '',
      phone: b.phone || '',
      manager_name: b.manager_name || '',
      opening_hours: b.opening_hours || '',
      currency: b.currency || 'XOF',
      default_supply_warehouse: b.default_supply_warehouse || '',
      allow_supplier_receipts: b.is_main ? true : Boolean(b.allow_supplier_receipts),
      is_active: b.is_active,
    } : {
      ...branchEmpty,
      default_supply_warehouse: defaultSupply,
      allow_supplier_receipts: false,
    });
    setError(null);
    setOpen(true);
  };

  const openWarehouseDialog = (w?: Warehouse) => {
    setEditingWarehouse(w || null);
    setWarehouseForm(w
      ? {
        name: w.name,
        code: w.code || '',
        manager_name: w.manager_name || '',
        phone: w.phone || '',
        address: w.address || '',
        city: w.city || '',
        description: w.description || '',
        branch: w.branch,
        is_default: w.is_default,
        is_active: w.is_active,
        is_pos_stock: w.is_pos_stock || false,
      }
      : { ...warehouseEmpty, branch: mainBranch?.id || '', is_pos_stock: false });
    setError(null);
    setOpen(true);
  };

  const openLocationDialog = (l?: Location) => {
    setEditingLocation(l || null);
    setLocationForm(l
      ? { code: l.code, name: l.name, warehouse: l.warehouse, is_active: l.is_active }
      : { ...locationEmpty, warehouse: warehouseFilter || warehouses[0]?.id || '' });
    setError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingBranch(null);
    setEditingWarehouse(null);
    setEditingLocation(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (tabKey === 'main' || tabKey === 'pos' || editingBranch) {
        if (!branchForm.name) { setError(tr('Le nom est obligatoire.')); return; }
        const payload = {
          name: branchForm.name,
          code: branchForm.code,
          address: branchForm.address,
          city: branchForm.city,
          phone: branchForm.phone,
          manager_name: branchForm.manager_name,
          opening_hours: branchForm.opening_hours,
          currency: branchForm.currency || 'XOF',
          is_active: branchForm.is_active,
          allow_supplier_receipts: editingBranch?.is_main
            ? true
            : Boolean(branchForm.allow_supplier_receipts),
          default_supply_warehouse: branchForm.default_supply_warehouse
            ? Number(branchForm.default_supply_warehouse)
            : null,
        };
        if (editingBranch) await updateBranch(editingBranch.id, payload);
        else await createBranch(payload);
        await loadBranches();
        await loadWarehouses();
      } else if (tabKey === 'warehouses' || editingWarehouse) {
        if (!warehouseForm.name || !warehouseForm.branch) {
          setError(tr('Nom et boutique principale sont obligatoires.'));
          return;
        }
        const payload = {
          ...warehouseForm,
          branch: Number(warehouseForm.branch),
          is_pos_stock: false,
        };
        if (editingWarehouse) await updateWarehouse(editingWarehouse.id, payload);
        else await createWarehouse(payload);
        await loadWarehouses();
      } else if (tabKey === 'online') {
        // handled by saveShop
      } else {
        if (!locationForm.code || !locationForm.name || !locationForm.warehouse) {
          setError(tr('Code, nom et entrepôt sont obligatoires.'));
          return;
        }
        const payload = { ...locationForm, warehouse: Number(locationForm.warehouse) };
        if (editingLocation) await updateLocation(editingLocation.id, payload);
        else await createLocation(payload);
        loadLocations(warehouseFilter ? Number(warehouseFilter) : undefined);
      }
      closeDialog();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveShop = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateOnlineShop({
        enabled: shopForm.enabled,
        name: shopForm.name,
        description: shopForm.description,
        primary_color: shopForm.primary_color,
        secondary_color: shopForm.secondary_color,
        phone: shopForm.phone,
        whatsapp: shopForm.whatsapp,
        address: shopForm.address,
        maps_url: shopForm.maps_url,
        hours: shopForm.hours,
        social_facebook: shopForm.social_facebook,
        social_instagram: shopForm.social_instagram,
        social_tiktok: shopForm.social_tiktok,
        terms_of_sale: shopForm.terms_of_sale,
        return_policy: shopForm.return_policy,
        show_prices: shopForm.show_prices,
        show_stock: shopForm.show_stock,
        payment_timing: shopForm.payment_timing,
        wave_number: shopForm.wave_number,
        orange_money_number: shopForm.orange_money_number,
        accept_cod: shopForm.accept_cod,
        accept_wave: shopForm.accept_wave,
        accept_orange_money: shopForm.accept_orange_money,
      });
      setOnlineShop(updated);
      setShopForm(updated);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (path?: string) => {
    const link = absoluteShopLink(path);
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const whatsappShare = () => {
    const link = absoluteShopLink(onlineShop?.shop_url);
    const phone = (onlineShop?.whatsapp || '').replace(/\D/g, '');
    const text = encodeURIComponent(`${tr('Découvrez notre boutique :')} ${link}`);
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, '_blank');
  };

  const posColumns: GridColDef<Branch>[] = [
    { field: 'name', headerName: tr('Nom'), flex: 1, minWidth: 140 },
    { field: 'code', headerName: tr('Code'), width: 90, valueGetter: (v) => v || '—' },
    { field: 'city', headerName: tr('Ville'), width: 110, valueGetter: (v) => v || '—' },
    { field: 'manager_name', headerName: tr('Responsable'), width: 130, valueGetter: (v) => v || '—' },
    { field: 'phone', headerName: tr('Téléphone'), width: 120, valueGetter: (v) => v || '—' },
    {
      field: 'default_supply_warehouse_name',
      headerName: tr('Appro. depuis'),
      width: 140,
      valueGetter: (v) => v || '—',
    },
    {
      field: 'is_active', headerName: tr('Actif'), width: 90,
      renderCell: (p) => <Chip size="small" color={p.value ? 'success' : 'default'} label={p.value ? tr('Oui') : tr('Non')} />,
    },
  ];

  const warehouseColumns: GridColDef<Warehouse>[] = [
    { field: 'name', headerName: tr('Nom'), flex: 1, minWidth: 140 },
    { field: 'code', headerName: tr('Code'), width: 100, valueGetter: (v) => v || '—' },
    { field: 'city', headerName: tr('Ville'), width: 120, valueGetter: (v) => v || '—' },
    { field: 'manager_name', headerName: tr('Responsable'), width: 140, valueGetter: (v) => v || '—' },
    { field: 'branch_name', headerName: tr('Rattaché à'), width: 140 },
    {
      field: 'is_default', headerName: tr('Par défaut'), width: 100,
      valueGetter: (v) => (v ? tr('Oui') : tr('Non')),
    },
    { field: 'locations_count', headerName: tr('Emplacements'), width: 110, valueGetter: (v) => v ?? 0, valueFormatter: (v) => formatNumber(v) },
  ];

  const locationColumns: GridColDef<Location>[] = [
    { field: 'code', headerName: tr('Code'), width: 120 },
    { field: 'name', headerName: tr('Nom'), flex: 1, minWidth: 160 },
    { field: 'warehouse_name', headerName: tr('Entrepôt'), width: 180 },
    {
      field: 'is_active', headerName: tr('Actif'), width: 90,
      valueGetter: (v) => (v ? tr('Oui') : tr('Non')),
    },
  ];

  const showNewButton = tabKey === 'pos' || tabKey === 'warehouses' || tabKey === 'locations';
  const newLabel = tabKey === 'pos'
    ? tr('Nouveau point de vente')
    : tabKey === 'warehouses'
      ? tr('Nouvel entrepôt')
      : tr('Nouvel emplacement');

  return (
    <Box>
      <PageHeader
        title={tr('Sites & boutique')}
        subtitle={
          canMultiBranch || canOnlineShop
            ? tr('Boutique principale, points de vente, entrepôts et boutique en ligne')
            : tr("Votre boutique principale sert de point de vente et d'entrepôt (Pack Starter)")
        }
        action={showNewButton ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
            if (tabKey === 'pos') openBranchDialog();
            else if (tabKey === 'warehouses') openWarehouseDialog();
            else openLocationDialog();
          }}>
            {newLabel}
          </Button>
        ) : undefined}
      />

      {error && tabKey === 'online' && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {!canMultiBranch && (
        <Alert severity="info" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => navigate('/subscription')}>{tr('Voir les packs')}</Button>
        }>
          {tr('Pack Starter : un seul site (votre boutique principale = caisse + stock). Points de vente, entrepôts et boutique en ligne dès le pack Business (5 000 F).')}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabKey(siteTabs[v]?.key || 'main')}
          variant="scrollable"
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {siteTabs.map((t) => (
            <Tab key={t.key} label={t.label} />
          ))}
        </Tabs>
      </Card>

      {tabKey === 'main' && (
        <Card sx={{ p: 3 }}>
          {mainBranch ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" fontWeight={700}>{mainBranch.name}</Typography>
                <Chip size="small" color="primary" label={tr('Principale')} />
                <Chip size="small" label={mainBranch.is_active ? tr('Active') : tr('Inactive')} color={mainBranch.is_active ? 'success' : 'default'} />
              </Stack>
              <Typography variant="body2" color="text.secondary">{mainBranch.address || tr('Adresse non renseignée')}</Typography>
              <Typography variant="body2">{mainBranch.phone || '—'}</Typography>
              <Typography variant="caption" color="text.secondary">
                {tr(`Stock : ${posWarehouses.filter((w) => w.branch === mainBranch.id).map((w) => w.name).join(', ') || tr('aucun')}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {canOnlineShop
                  ? tr('La boutique principale ne peut pas être supprimée. Les commandes en ligne sont préparées depuis son stock.')
                  : tr("Sur votre pack, ce site est à la fois le point de vente et l'entrepôt. Aucun autre site à créer.")}
              </Typography>
              <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => openBranchDialog(mainBranch)}>
                {tr('Modifier')}
              </Button>
            </Stack>
          ) : (
            <Alert severity="warning">{tr('Aucune boutique principale. Contactez le support ou recréez le compte.')}</Alert>
          )}
        </Card>
      )}

      {tabKey === 'pos' && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            {tr("Un point de vente sert à vendre (caisse + stock local). Son stock part de zéro et s'approvisionne depuis le siège ou un entrepôt — pas d'achat fournisseur direct (sauf option).")}
          </Alert>
          <Box sx={{ height: 520, bgcolor: 'background.paper', borderRadius: 2 }}>
            <DataGrid
              rows={posBranches}
              columns={posColumns}
              loading={loading}
              disableRowSelectionOnClick
              onRowClick={(p) => navigate(`/sites/pos/${(p.row as Branch).id}`)}
              sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            />
          </Box>
        </Box>
      )}

      {tabKey === 'warehouses' && (
        <Box sx={{ height: 520, bgcolor: 'background.paper', borderRadius: 2 }}>
          <DataGrid
            rows={storageWarehouses}
            columns={warehouseColumns}
            loading={loading}
            disableRowSelectionOnClick
            onRowClick={(p) => openWarehouseDialog(p.row as Warehouse)}
            sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            pageSizeOptions={[25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          />
        </Box>
      )}

      {tabKey === 'online' && !canOnlineShop && (
        <Card sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {tr('La boutique en ligne est disponible à partir du pack Business (5 000 F / mois).')}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tr('Avec le Pack Starter, vous gérez vos ventes en caisse sur votre boutique principale. Passez au Business pour publier un catalogue en ligne et recevoir des commandes.')}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/subscription')}>
            {tr('Passer au pack Business')}
          </Button>
        </Card>
      )}

      {tabKey === 'online' && canOnlineShop && onlineShop && (
        <Card sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" gutterBottom>{tr('Lien permanent')}</Typography>
                <TextField
                  fullWidth size="small"
                  value={absoluteShopLink(onlineShop.shop_url)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={copied ? tr('Copié !') : tr('Copier')}>
                          <IconButton onClick={() => copyLink(onlineShop.shop_url)}><ContentCopyIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {tr('Court :')} {absoluteShopLink(onlineShop.short_url)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copyLink(onlineShop.shop_url)}>{tr('Copier')}</Button>
                <Button variant="contained" color="success" startIcon={<WhatsAppIcon />} onClick={whatsappShare}>WhatsApp</Button>
              </Stack>
            </Stack>

            <FormControlLabel
              control={<Checkbox checked={!!shopForm.enabled} onChange={(e) => setShopForm({ ...shopForm, enabled: e.target.checked })} />}
              label={tr('Boutique en ligne activée')}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label={tr('Nom affiché')} value={shopForm.name || ''} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} fullWidth />
              <TextField label={tr('Couleur principale')} type="color" value={shopForm.primary_color || '#0E8A9A'} onChange={(e) => setShopForm({ ...shopForm, primary_color: e.target.value })} sx={{ width: 160 }} InputLabelProps={{ shrink: true }} />
              <TextField label={tr('Couleur secondaire')} type="color" value={shopForm.secondary_color || '#0B2A3A'} onChange={(e) => setShopForm({ ...shopForm, secondary_color: e.target.value })} sx={{ width: 160 }} InputLabelProps={{ shrink: true }} />
            </Stack>
            <TextField label={tr('Description')} value={shopForm.description || ''} onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })} fullWidth multiline rows={2} />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label={tr('Téléphone')} value={shopForm.phone || ''} onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })} fullWidth />
              <TextField label="WhatsApp" value={shopForm.whatsapp || ''} onChange={(e) => setShopForm({ ...shopForm, whatsapp: e.target.value })} fullWidth />
              <TextField label={tr('Horaires')} value={shopForm.hours || ''} onChange={(e) => setShopForm({ ...shopForm, hours: e.target.value })} fullWidth />
            </Stack>
            <TextField label={tr('Adresse')} value={shopForm.address || ''} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} fullWidth />
            <TextField label={tr('Lien Google Maps')} value={shopForm.maps_url || ''} onChange={(e) => setShopForm({ ...shopForm, maps_url: e.target.value })} fullWidth />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="Facebook" value={shopForm.social_facebook || ''} onChange={(e) => setShopForm({ ...shopForm, social_facebook: e.target.value })} fullWidth />
              <TextField label="Instagram" value={shopForm.social_instagram || ''} onChange={(e) => setShopForm({ ...shopForm, social_instagram: e.target.value })} fullWidth />
              <TextField label="TikTok" value={shopForm.social_tiktok || ''} onChange={(e) => setShopForm({ ...shopForm, social_tiktok: e.target.value })} fullWidth />
            </Stack>
            <TextField label={tr('Conditions de vente')} value={shopForm.terms_of_sale || ''} onChange={(e) => setShopForm({ ...shopForm, terms_of_sale: e.target.value })} fullWidth multiline rows={2} />
            <TextField label={tr('Politique de retour')} value={shopForm.return_policy || ''} onChange={(e) => setShopForm({ ...shopForm, return_policy: e.target.value })} fullWidth multiline rows={2} />
            <Stack direction="row" spacing={2}>
              <FormControlLabel control={<Checkbox checked={!!shopForm.show_prices} onChange={(e) => setShopForm({ ...shopForm, show_prices: e.target.checked })} />} label={tr('Afficher les prix')} />
              <FormControlLabel control={<Checkbox checked={!!shopForm.show_stock} onChange={(e) => setShopForm({ ...shopForm, show_stock: e.target.checked })} />} label={tr('Afficher le stock')} />
            </Stack>

            <Typography variant="subtitle2" sx={{ pt: 1 }}>{tr('Paiement clients')}</Typography>
            <TextField
              select label={tr('Moment du paiement')} value={shopForm.payment_timing || 'on_delivery'}
              onChange={(e) => setShopForm({ ...shopForm, payment_timing: e.target.value as OnlineShop['payment_timing'] })}
              fullWidth
            >
              <MenuItem value="on_delivery">{tr('À la livraison')}</MenuItem>
              <MenuItem value="before_delivery">{tr('Avant la livraison')}</MenuItem>
              <MenuItem value="both">{tr('Les deux (choix du client)')}</MenuItem>
            </TextField>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label={tr('Numéro Wave')} value={shopForm.wave_number || ''} onChange={(e) => setShopForm({ ...shopForm, wave_number: e.target.value })} fullWidth />
              <TextField label={tr('Numéro Orange Money')} value={shopForm.orange_money_number || ''} onChange={(e) => setShopForm({ ...shopForm, orange_money_number: e.target.value })} fullWidth />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControlLabel control={<Checkbox checked={shopForm.accept_cod !== false} onChange={(e) => setShopForm({ ...shopForm, accept_cod: e.target.checked })} />} label={tr('Paiement à la livraison')} />
              <FormControlLabel control={<Checkbox checked={shopForm.accept_wave !== false} onChange={(e) => setShopForm({ ...shopForm, accept_wave: e.target.checked })} />} label={tr('Accepter Wave')} />
              <FormControlLabel control={<Checkbox checked={shopForm.accept_orange_money !== false} onChange={(e) => setShopForm({ ...shopForm, accept_orange_money: e.target.checked })} />} label={tr('Accepter Orange Money')} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {tr('Les clients paient directement sur vos numéros. Préparation :')} {onlineShop.fulfillment_branch_name}.
            </Typography>
            <Button variant="contained" onClick={saveShop} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
              {tr('Enregistrer la boutique')}
            </Button>
          </Stack>
        </Card>
      )}

      {tabKey === 'locations' && (
        <>
          <TextField select label={tr('Filtrer par entrepôt')} value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value ? Number(e.target.value) : '')}
            sx={{ mb: 2, minWidth: 280 }} size="small">
            <MenuItem value="">{tr('Tous les entrepôts')}</MenuItem>
            {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
          </TextField>
          <Box sx={{ height: 520, bgcolor: 'background.paper', borderRadius: 2 }}>
            <DataGrid
              rows={locations}
              columns={locationColumns}
              loading={loading}
              disableRowSelectionOnClick
              onRowClick={(p) => openLocationDialog(p.row as Location)}
              sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            />
          </Box>
        </>
      )}

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingBranch
            ? (editingBranch.is_main ? tr('Modifier la boutique principale') : tr('Modifier le point de vente'))
            : editingWarehouse
              ? tr("Modifier l'entrepôt")
              : editingLocation
                ? tr("Modifier l'emplacement")
                : tabKey === 'pos' ? tr('Nouveau point de vente') : tabKey === 'warehouses' ? tr('Nouvel entrepôt') : tr('Nouvel emplacement')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {(editingBranch || tabKey === 'main' || tabKey === 'pos') && !editingWarehouse && !editingLocation && (
              <>
                <TextField label={tr('Nom')} value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} fullWidth required />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label={tr('Code')} value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} fullWidth />
                  <TextField label={tr('Responsable')} value={branchForm.manager_name} onChange={(e) => setBranchForm({ ...branchForm, manager_name: e.target.value })} fullWidth />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label={tr('Téléphone')} value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} fullWidth />
                  <TextField label={tr('Ville')} value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} fullWidth />
                </Stack>
                <TextField label={tr('Adresse')} value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} fullWidth multiline rows={2} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label={tr('Horaires')} value={branchForm.opening_hours} onChange={(e) => setBranchForm({ ...branchForm, opening_hours: e.target.value })} fullWidth placeholder="Lun–Sam 8h–20h" />
                  <TextField label={tr('Devise')} value={branchForm.currency} onChange={(e) => setBranchForm({ ...branchForm, currency: e.target.value })} fullWidth />
                </Stack>
                {(!editingBranch || !editingBranch.is_main) && (
                  <>
                    <TextField
                      select
                      label={tr("Entrepôt d'approvisionnement par défaut")}
                      value={branchForm.default_supply_warehouse}
                      onChange={(e) => setBranchForm({
                        ...branchForm,
                        default_supply_warehouse: e.target.value ? Number(e.target.value) : '',
                      })}
                      fullWidth
                      helperText={tr('Siège ou entrepôt qui alimente ce magasin')}
                    >
                      <MenuItem value="">{tr('— Non défini —')}</MenuItem>
                      {warehouses
                        .filter((w) => !w.is_pos_stock || w.branch === mainBranch?.id)
                        .map((w) => (
                          <MenuItem key={w.id} value={w.id}>
                            {w.name} — {w.branch_name}{!w.is_pos_stock ? tr(' (entrepôt)') : tr(' (siège)')}
                          </MenuItem>
                        ))}
                    </TextField>
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={Boolean(branchForm.allow_supplier_receipts)}
                          onChange={(e) => setBranchForm({
                            ...branchForm,
                            allow_supplier_receipts: e.target.checked,
                          })}
                        />
                      )}
                      label={tr('Autoriser les achats fournisseurs directement sur ce PDV')}
                    />
                    <Alert severity="info">
                      {tr("À la création, le stock du point de vente est à zéro. Approvisionnez-le via Transferts ou une demande d'approvisionnement.")}
                    </Alert>
                  </>
                )}
                <FormControlLabel control={<Checkbox checked={branchForm.is_active} onChange={(e) => setBranchForm({ ...branchForm, is_active: e.target.checked })} />} label={tr('Actif')} />
                {editingBranch?.is_main && (
                  <Alert severity="info">{tr('La boutique principale (siège) ne peut pas être supprimée. Elle peut recevoir les achats fournisseurs.')}</Alert>
                )}
                {editingBranch && !editingBranch.is_main && (
                  <Button variant="outlined" onClick={() => { closeDialog(); navigate(`/sites/pos/${editingBranch.id}`); }}>
                    {tr('Ouvrir le tableau de bord')}
                  </Button>
                )}
              </>
            )}
            {editingWarehouse || (tabKey === 'warehouses' && open && !editingBranch && !editingLocation) ? (
              <>
                <TextField label={tr('Nom')} value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} fullWidth required />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label={tr('Code')} value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })} fullWidth />
                  <TextField label={tr('Responsable')} value={warehouseForm.manager_name} onChange={(e) => setWarehouseForm({ ...warehouseForm, manager_name: e.target.value })} fullWidth />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label={tr('Téléphone')} value={warehouseForm.phone} onChange={(e) => setWarehouseForm({ ...warehouseForm, phone: e.target.value })} fullWidth />
                  <TextField label={tr('Ville')} value={warehouseForm.city} onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })} fullWidth />
                </Stack>
                <TextField label={tr('Adresse')} value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} fullWidth multiline minRows={2} />
                <TextField label={tr('Description')} value={warehouseForm.description} onChange={(e) => setWarehouseForm({ ...warehouseForm, description: e.target.value })} fullWidth multiline minRows={2} />
                <TextField select label={tr('Rattaché à (siège)')} value={warehouseForm.branch} onChange={(e) => setWarehouseForm({ ...warehouseForm, branch: Number(e.target.value) })} fullWidth required>
                  {branches.filter((b) => b.is_main).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </TextField>
                <FormControlLabel control={<Checkbox checked={warehouseForm.is_default} onChange={(e) => setWarehouseForm({ ...warehouseForm, is_default: e.target.checked })} />} label={tr('Entrepôt par défaut')} />
                <FormControlLabel control={<Checkbox checked={warehouseForm.is_active} onChange={(e) => setWarehouseForm({ ...warehouseForm, is_active: e.target.checked })} />} label={tr('Actif')} />
                <Alert severity="info">{tr('Les entrepôts servent uniquement au stockage (pas de caisse ni boutique en ligne). Pour les remplir : transférez depuis le siège (Approvisionnement) ou recevez un achat fournisseur directement.')}</Alert>
                {editingWarehouse && !editingWarehouse.is_pos_stock && (
                  <Button variant="outlined" onClick={() => {
                    setImportWarehouse(editingWarehouse);
                    closeDialog();
                    setImportOpen(true);
                  }}>
                    {tr('Approvisionner depuis la boutique principale')}
                  </Button>
                )}
              </>
            ) : null}
            {editingLocation || (tabKey === 'locations' && open && !editingBranch && !editingWarehouse) ? (
              <>
                <TextField label={tr('Code')} value={locationForm.code} onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })} fullWidth required />
                <TextField label={tr('Nom')} value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} fullWidth required />
                <TextField select label={tr('Entrepôt')} value={locationForm.warehouse} onChange={(e) => setLocationForm({ ...locationForm, warehouse: Number(e.target.value) })} fullWidth required>
                  {warehouses.map((w) => <MenuItem key={w.id} value={w.id}>{w.name} — {w.branch_name}</MenuItem>)}
                </TextField>
                <FormControlLabel control={<Checkbox checked={locationForm.is_active} onChange={(e) => setLocationForm({ ...locationForm, is_active: e.target.checked })} />} label={tr('Actif')} />
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={save} disabled={saving}>{tr('Enregistrer')}</Button>
        </DialogActions>
      </Dialog>

      {importWarehouse && (
        <ImportFromMainDialog
          open={importOpen}
          toWarehouseId={importWarehouse.id}
          toWarehouseName={importWarehouse.name}
          onClose={() => {
            setImportOpen(false);
            setImportWarehouse(null);
          }}
          onDone={() => {
            setImportOpen(false);
            setImportWarehouse(null);
            loadWarehouses();
          }}
        />
      )}
    </Box>
  );
}
