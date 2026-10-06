import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import CakeIcon from '@mui/icons-material/Cake';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import {
  addCustomerNote,
  assignCustomerTag,
  backfillCustomerStats,
  createCustomer,
  CREDIT_PAYMENT_LABELS,
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_STATUS_LABELS,
  fetchCrmDashboard,
  fetchCustomerProfile,
  fetchCustomersEnriched,
  LOYALTY_LEVEL_LABELS,
  recordCustomerPayment,
  updateCustomer,
  type CrmDashboard,
  type Customer,
  type CustomerProfile,
} from '../api/customers';
import { fetchSubscription } from '../api/subscription';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';
import { FEATURE_CUSTOMER_CREDIT, hasPlanFeature } from '../utils/planFeatures';
import { useLocale } from '../locale/useLocale';

const emptyForm = {
  name: '', phone: '', whatsapp: '', email: '', address: '',
  city: '', commune: '', quartier: '', birth_date: '', gender: '', profession: '',
  credit_limit: '0',
};

export default function CustomersPage() {
  const { tr, version } = useLocale();
  void version;

  const [rows, setRows] = useState<Customer[]>([]);
  const [dashboard, setDashboard] = useState<CrmDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [tagName, setTagName] = useState('');
  const [canCredit, setCanCredit] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [paySaleId, setPaySaleId] = useState<number | ''>('');
  const [payRef, setPayRef] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, list, sub] = await Promise.all([
        fetchCrmDashboard(),
        fetchCustomersEnriched({
          search: search || undefined,
          status: statusFilter || undefined,
          level: levelFilter || undefined,
          city: cityFilter || undefined,
        }),
        fetchSubscription().catch(() => null),
      ]);
      setDashboard(dash);
      setRows(list);
      setCanCredit(hasPlanFeature(sub?.features, FEATURE_CUSTOMER_CREDIT));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, levelFilter, cityFilter]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      whatsapp: c.whatsapp || '',
      email: c.email || '',
      address: c.address || '',
      city: c.city || '',
      commune: c.commune || '',
      quartier: c.quartier || '',
      birth_date: c.birth_date || '',
      gender: c.gender || '',
      profession: c.profession || '',
      credit_limit: c.credit_limit || '0',
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setError(tr('Le nom est obligatoire.')); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        birth_date: form.birth_date || null,
        credit_limit: form.credit_limit || '0',
      };
      if (editing) await updateCustomer(editing.id, payload);
      else await createCustomer(payload);
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openPay = () => {
    if (!profile) return;
    setPayAmount(profile.balance || '');
    setPayMethod('cash');
    setPaySaleId('');
    setPayRef('');
    setPayOpen(true);
  };

  const submitPayment = async () => {
    if (!profile) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setError(tr('Indiquez un montant valide.'));
      return;
    }
    setSaving(true);
    try {
      await recordCustomerPayment(profile.id, {
        amount,
        method: payMethod,
        reference: payRef || undefined,
        sale_id: paySaleId || undefined,
      });
      setPayOpen(false);
      setProfile(await fetchCustomerProfile(profile.id));
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openProfile = async (id: number) => {
    setError(null);
    try {
      const data = await fetchCustomerProfile(id);
      setProfile(data);
      setProfileOpen(true);
      setNoteText('');
      setTagName('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const submitNote = async () => {
    if (!profile || !noteText.trim()) return;
    await addCustomerNote(profile.id, noteText.trim());
    setProfile(await fetchCustomerProfile(profile.id));
    setNoteText('');
  };

  const submitTag = async () => {
    if (!profile || !tagName.trim()) return;
    await assignCustomerTag(profile.id, { name: tagName.trim() });
    setProfile(await fetchCustomerProfile(profile.id));
    setTagName('');
  };

  const recalculate = async () => {
    setSaving(true);
    try {
      await backfillCustomerStats();
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const columns: GridColDef<Customer>[] = useMemo(() => [
    {
      field: 'name', headerName: tr('Client'), flex: 1.2, minWidth: 180,
      renderCell: (p) => (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
          <Avatar src={p.row.photo || undefined} sx={{ width: 32, height: 32 }}>{p.row.name?.[0]}</Avatar>
          <Typography variant="body2" fontWeight={600}>{p.row.name}</Typography>
        </Stack>
      ),
    },
    { field: 'phone', headerName: tr('Téléphone'), width: 130 },
    {
      field: 'whatsapp', headerName: tr('WhatsApp'), width: 130,
      valueGetter: (_v, row) => row.whatsapp || row.phone || '—',
    },
    { field: 'email', headerName: tr('Email'), flex: 1, minWidth: 150 },
    { field: 'city', headerName: tr('Ville'), width: 110, valueGetter: (v) => v || '—' },
    {
      field: 'last_order_at', headerName: tr('Dernière cmd'), width: 120,
      valueFormatter: (v) => formatDate(v),
    },
    { field: 'orders_count', headerName: tr('Commandes'), width: 110, valueFormatter: (v) => formatNumber(v ?? 0) },
    {
      field: 'total_spent', headerName: tr('Total dépensé'), width: 140,
      valueFormatter: (v) => formatCurrency(v),
    },
    {
      field: 'balance', headerName: tr('Dette'), width: 120,
      valueFormatter: (v) => formatCurrency(v || 0),
      renderCell: (p) => {
        const bal = Number(p.row.balance || 0);
        return (
          <Typography variant="body2" color={bal > 0 ? 'error.main' : 'text.secondary'} fontWeight={bal > 0 ? 700 : 400}>
            {formatCurrency(bal)}
          </Typography>
        );
      },
    },
    { field: 'loyalty_points', headerName: tr('Points'), width: 90 },
    {
      field: 'loyalty_level', headerName: tr('Niveau'), width: 100,
      renderCell: (p) => (
        <Chip size="small" label={tr(LOYALTY_LEVEL_LABELS[p.value] || p.value || '—')} color="warning" variant="outlined" />
      ),
    },
    {
      field: 'status', headerName: tr('Statut'), width: 110,
      renderCell: (p) => (
        <Chip
          size="small"
          label={tr(CUSTOMER_STATUS_LABELS[p.value] || p.value)}
          color={CUSTOMER_STATUS_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'tags', headerName: tr('Tags'), flex: 1, minWidth: 160, sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5} sx={{ overflow: 'hidden' }}>
          {(p.row.tags || []).slice(0, 3).map((t) => (
            <Chip key={t.id} size="small" label={t.name} sx={{ bgcolor: `${t.color}22`, color: t.color }} />
          ))}
        </Stack>
      ),
    },
  ], [tr, version]);

  return (
    <Box>
      <PageHeader
        title="CRM Clients"
        subtitle="Relation client, fidélité et fiche 360°"
        action={(
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} onClick={recalculate} disabled={saving}>{tr('Recalculer')}</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>{tr('Nouveau client')}</Button>
          </Stack>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Clients')} value={dashboard?.total_customers ?? 0} icon={<GroupsIcon />} /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Nouveaux (mois)')} value={dashboard?.new_this_month ?? 0} icon={<PersonAddIcon />} color="#2E7D32" /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('CA clients')} value={formatCurrency(dashboard?.revenue)} icon={<TrendingUpIcon />} color="#0F766E" /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('VIP')} value={dashboard?.vip_count ?? 0} icon={<StarIcon />} color="#F9A825" /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Actifs')} value={dashboard?.active_count ?? 0} color="#0D9488" /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Inactifs')} value={dashboard?.inactive_count ?? 0} color="#757575" /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Paniers abandonnés')} value={dashboard?.abandoned_carts ?? 0} icon={<ShoppingCartIcon />} color="#E65100" /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Fidélisation')} value={`${formatNumber(dashboard?.retention_rate ?? 0)}%`} color="#6A1B9A" /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Panier moyen')} value={formatCurrency(dashboard?.avg_order_value)} /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Commandes')} value={dashboard?.orders_count ?? 0} /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Avis')} value={dashboard?.reviews_count ?? 0} /></Grid>
        <Grid size={{ xs: 6, sm: 4, md: 3 }}><StatCard label={tr('Anniversaires')} value={dashboard?.birthdays_this_month ?? 0} icon={<CakeIcon />} color="#C2185B" /></Grid>
        {canCredit && (
          <>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label={tr('Créances')} value={formatCurrency(dashboard?.total_receivables)} color="#C62828" />
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <StatCard label={tr('Clients débiteurs')} value={dashboard?.debtors_count ?? 0} color="#E65100" />
            </Grid>
          </>
        )}
      </Grid>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField size="small" label={tr('Recherche')} value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
        <TextField select size="small" label={tr('Statut')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">{tr('Tous')}</MenuItem>
          {Object.entries(CUSTOMER_STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{tr(v)}</MenuItem>)}
        </TextField>
        <TextField select size="small" label={tr('Niveau')} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">{tr('Tous')}</MenuItem>
          {Object.entries(LOYALTY_LEVEL_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{tr(v)}</MenuItem>)}
        </TextField>
        <TextField size="small" label={tr('Ville')} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} sx={{ minWidth: 140 }} />
      </Stack>

      <Box sx={{ height: 520, bgcolor: 'background.paper', borderRadius: 2 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          onRowClick={(p) => openProfile(p.row.id)}
          sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? tr('Modifier le client') : tr('Nouveau client')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={tr('Nom')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
            <Stack direction="row" spacing={1}>
              <TextField label={tr('Téléphone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
              <TextField label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} fullWidth />
            </Stack>
            <TextField label={tr('Email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
            <Stack direction="row" spacing={1}>
              <TextField label={tr('Ville')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} fullWidth />
              <TextField label={tr('Commune')} value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} fullWidth />
            </Stack>
            <TextField label={tr('Adresse')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} fullWidth multiline rows={2} />
            <Stack direction="row" spacing={1}>
              <TextField label={tr('Anniversaire')} type="date" InputLabelProps={{ shrink: true }} value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} fullWidth />
              <TextField select label={tr('Sexe')} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} fullWidth>
                <MenuItem value="">—</MenuItem>
                <MenuItem value="male">{tr('Homme')}</MenuItem>
                <MenuItem value="female">{tr('Femme')}</MenuItem>
                <MenuItem value="other">{tr('Autre')}</MenuItem>
              </TextField>
            </Stack>
            <TextField label={tr('Profession')} value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} fullWidth />
            {canCredit && (
              <TextField
                label={tr('Plafond de crédit (0 = illimité)')}
                type="number"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                fullWidth
                helperText={editing && Number(editing.balance) > 0 ? tr(`Dette actuelle : ${formatCurrency(editing.balance)}`) : undefined}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)}>{tr('Annuler')}</Button>
          {editing && <Button onClick={() => { setFormOpen(false); openProfile(editing.id); }}>{tr('Fiche 360°')}</Button>}
          <Button variant="contained" onClick={save} disabled={saving}>{tr('Enregistrer')}</Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={profileOpen} onClose={() => setProfileOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 480, md: 560 } } }}>
        {profile && (
          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar src={profile.photo || undefined} sx={{ width: 56, height: 56 }}>{profile.name[0]}</Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{profile.name}</Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={tr(CUSTOMER_STATUS_LABELS[profile.status || ''] || profile.status || '')} color={CUSTOMER_STATUS_COLORS[profile.status || ''] || 'default'} />
                    <Chip size="small" label={tr(LOYALTY_LEVEL_LABELS[profile.loyalty_level || ''] || profile.loyalty_level || '')} color="warning" variant="outlined" />
                    <Chip size="small" label={`${profile.score}/100 — ${tr(profile.score_label || '')}`} />
                  </Stack>
                </Box>
              </Stack>
              <IconButton onClick={() => setProfileOpen(false)}><CloseIcon /></IconButton>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {profile.phone || '—'} · {profile.whatsapp || '—'} · {profile.email || '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {[profile.address, profile.quartier, profile.commune, profile.city].filter(Boolean).join(', ') || tr('Adresse non renseignée')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tr(`Inscrit le ${formatDate(profile.created_at)}`)} · {tr('Fréquence')} : {tr(profile.purchase_frequency || '—')}
            </Typography>

            <Grid container spacing={1.5} sx={{ mt: 2 }}>
              <Grid size={4}><StatCard label={tr('Commandes')} value={profile.orders_count ?? 0} /></Grid>
              <Grid size={4}><StatCard label="LTV" value={formatCurrency(profile.ltv)} color="#2E7D32" /></Grid>
              <Grid size={4}><StatCard label={tr('Points')} value={profile.loyalty_points ?? 0} color="#F9A825" /></Grid>
              {canCredit && (
                <>
                  <Grid size={6}>
                    <StatCard label={tr('Dette')} value={formatCurrency(profile.balance)} color={Number(profile.balance) > 0 ? '#C62828' : undefined} />
                  </Grid>
                  <Grid size={6}>
                    <StatCard label={tr('Plafond crédit')} value={Number(profile.credit_limit) > 0 ? formatCurrency(profile.credit_limit) : tr('Illimité')} />
                  </Grid>
                </>
              )}
            </Grid>

            {canCredit && Number(profile.balance) > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">{tr('Dettes ouvertes')}</Typography>
                  <Button size="small" variant="contained" color="error" onClick={openPay}>{tr('Encaisser')}</Button>
                </Stack>
                <List dense>
                  {(profile.debts || []).map((d) => (
                    <ListItem key={d.id} disableGutters>
                      <ListItemText
                        primary={tr(`${d.reference} · reste ${formatCurrency(d.due)}`)}
                        secondary={tr(`${formatDate(d.created_at)} · total ${formatCurrency(d.total)} · payé ${formatCurrency(d.paid)}`)}
                      />
                    </ListItem>
                  ))}
                  {(profile.debts || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {tr(`Solde ${formatCurrency(profile.balance)} sans détail de vente.`)}
                    </Typography>
                  )}
                </List>
              </>
            )}

            {canCredit && (profile.credit_payments || []).length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>{tr('Derniers encaissements')}</Typography>
                <List dense>
                  {(profile.credit_payments || []).slice(0, 8).map((p) => (
                    <ListItem key={p.id} disableGutters>
                      <ListItemText
                        primary={`${formatCurrency(p.amount)} · ${tr(CREDIT_PAYMENT_LABELS[p.method] || p.method)}`}
                        secondary={`${formatDate(p.created_at)}${p.created_by_name ? ` · ${p.created_by_name}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {(profile.recommendations || []).length > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {(profile.recommendations || []).map((r) => <div key={r}>{tr(r)}</div>)}
              </Alert>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>{tr('Tags')}</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {(profile.tags || []).map((t) => (
                <Chip key={t.id} size="small" label={t.name} sx={{ bgcolor: `${t.color}22`, color: t.color }} />
              ))}
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" placeholder={tr('Nouveau tag')} value={tagName} onChange={(e) => setTagName(e.target.value)} fullWidth />
              <Button variant="outlined" onClick={submitTag}>{tr('Ajouter')}</Button>
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>{tr('Produits préférés')}</Typography>
            <List dense>
              {(profile.preferred_products || []).slice(0, 5).map((p) => (
                <ListItem key={p.product_id} disableGutters>
                  <ListItemText
                    primary={p.name}
                    secondary={tr(`Acheté ${p.times} fois · ${'★'.repeat(p.stars)}`)}
                  />
                </ListItem>
              ))}
              {(profile.preferred_products || []).length === 0 && (
                <Typography variant="body2" color="text.secondary">{tr('Aucun historique produit')}</Typography>
              )}
            </List>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>{tr('Historique commandes')}</Typography>
            <List dense sx={{ maxHeight: 220, overflow: 'auto' }}>
              {(profile.order_history || []).map((o) => (
                <ListItem key={`${o.source}-${o.id}`} disableGutters>
                  <ListItemText
                    primary={`${o.reference} · ${formatCurrency(o.total)}`}
                    secondary={`${formatDate(o.created_at)} · ${o.status} · ${o.payment_status}`}
                  />
                </ListItem>
              ))}
              {(profile.order_history || []).length === 0 && (
                <Typography variant="body2" color="text.secondary">{tr('Aucune commande')}</Typography>
              )}
            </List>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>{tr('Notes privées')}</Typography>
            <List dense>
              {(profile.notes || []).map((n) => (
                <ListItem key={n.id} disableGutters>
                  <ListItemText primary={n.content} secondary={`${n.created_by || n.created_by_name || ''} · ${formatDate(n.created_at)}`} />
                </ListItem>
              ))}
            </List>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField size="small" placeholder={tr('Note privée…')} value={noteText} onChange={(e) => setNoteText(e.target.value)} fullWidth multiline />
              <Button variant="contained" onClick={submitNote}>OK</Button>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
              <Button variant="outlined" onClick={() => { setProfileOpen(false); openEdit(profile); }}>{tr('Modifier')}</Button>
              {canCredit && Number(profile.balance) > 0 && (
                <Button variant="contained" color="error" onClick={openPay}>{tr('Encaisser une dette')}</Button>
              )}
              <Button variant="outlined" onClick={() => load()}>{tr('Actualiser')}</Button>
            </Stack>
          </Box>
        )}
      </Drawer>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{tr('Encaisser une dette')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {tr(`Dette actuelle : ${formatCurrency(profile?.balance)}`)}
            </Typography>
            <TextField
              label={tr('Montant')}
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              fullWidth
              required
            />
            <TextField select label={tr('Mode')} value={payMethod} onChange={(e) => setPayMethod(e.target.value)} fullWidth>
              {Object.entries(CREDIT_PAYMENT_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{tr(v)}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={tr('Vente (optionnel)')}
              value={paySaleId}
              onChange={(e) => setPaySaleId(e.target.value ? Number(e.target.value) : '')}
              fullWidth
              helperText={tr("Vide = répartition automatique (plus anciennes d'abord)")}
            >
              <MenuItem value="">{tr('Toutes (FIFO)')}</MenuItem>
              {(profile?.debts || []).map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.reference} — {formatCurrency(d.due)}</MenuItem>
              ))}
            </TextField>
            <TextField label={tr('Référence')} value={payRef} onChange={(e) => setPayRef(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPayOpen(false)}>{tr('Annuler')}</Button>
          <Button variant="contained" onClick={submitPayment} disabled={saving}>{tr('Encaisser')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
