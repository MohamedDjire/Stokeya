import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PageHeader from '../components/PageHeader';
import { fetchBranchDashboard, fetchBranches, type Branch, type BranchDashboard } from '../api/sites';
import { getApiErrorMessage } from '../api/client';
import { formatCurrency, formatNumber } from '../utils/format';
import { useLocale } from '../locale/useLocale';

export default function PosOutletPage() {
  const { tr, version } = useLocale();
  void version;

  const { branchId } = useParams();
  const navigate = useNavigate();
  const id = Number(branchId);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [dash, setDash] = useState<BranchDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [branches, dashboard] = await Promise.all([
        fetchBranches(),
        fetchBranchDashboard(id),
      ]);
      setBranch(branches.find((b) => b.id === id) || null);
      setDash(dashboard);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const whId = dash?.pos_warehouse_id;
  const supplyId = dash?.default_supply_warehouse_id;

  const cards = [
    { label: tr('Chiffre d\'affaires'), value: formatCurrency(dash?.today.revenue) },
    { label: tr('Ventes'), value: String(dash?.today.sales_count ?? 0) },
    { label: tr('Clients'), value: String(dash?.today.customers ?? 0) },
    { label: tr('Produits vendus'), value: formatNumber(dash?.today.items_sold || 0) },
    { label: tr('Stock'), value: `${formatNumber(dash?.stock_quantity || 0)} ${tr('articles')}` },
    { label: tr('Produits en alerte'), value: String(dash?.stock_alerts ?? 0), alert: (dash?.stock_alerts || 0) > 0 },
    { label: tr('Transferts entrants'), value: String(dash?.pending_inbound ?? 0) },
  ];

  return (
    <Box>
      <PageHeader
        title={branch ? tr(`Point de vente : ${branch.name}`) : tr('Point de vente')}
        subtitle={
          branch
            ? [branch.code, branch.city, branch.manager_name].filter(Boolean).join(' · ') || tr('Tableau de bord du magasin')
            : tr('Chargement…')
        }
        action={
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/sites')}>
            {tr('Sites')}
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Typography color="text.secondary">{tr('Chargement…')}</Typography>}

      {!loading && dash && (
        <>
          {(dash.stock_alerts || 0) > 0 && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => navigate(`/transfers?to=${whId || ''}&from=${supplyId || ''}&smart=1`)}
                >
                  {tr('Approvisionner maintenant')}
                </Button>
              }
            >
              {tr('Stock faible')} — {dash.stock_alerts} {tr('produit(s) sous le seuil. Approvisionnez depuis le siège ou un entrepôt.')}
            </Alert>
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{tr('Aujourd\'hui')}</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {cards.map((c) => (
              <Grid key={c.label} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card variant="outlined" sx={{ height: '100%', borderColor: c.alert ? 'warning.main' : undefined }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h6" fontWeight={700}>{c.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              startIcon={<LocalShippingIcon />}
              disabled={!whId}
              onClick={() => navigate(`/transfers?to=${whId}&from=${supplyId || ''}`)}
            >
              {tr('Approvisionner')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              disabled={!whId}
              onClick={() => navigate(`/transfers?to=${whId}&from=${supplyId || ''}&smart=1`)}
            >
              {tr('Approvisionnement intelligent')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<AssignmentIcon />}
              disabled={!whId}
              onClick={() => navigate(`/requests?to=${whId}&from=${supplyId || ''}`)}
            >
              {tr('Demander un approvisionnement')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<PointOfSaleIcon />}
              onClick={() => navigate(`/pos?branch=${id}`)}
            >
              {tr('Ouvrir la caisse')}
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              disabled={!whId}
              onClick={() => navigate(`/transfers?from=${whId}&return=1`)}
            >
              {tr('Retour vers entrepôt')}
            </Button>
            <Button variant="text" onClick={() => navigate('/sites')}>
              {tr('Modifier le PDV')}
            </Button>
          </Stack>

          <Alert severity="info" sx={{ mt: 3 }}>
            {tr('Un point de vente sert à vendre : son stock vient du siège ou d\'un entrepôt via transfert.')}
            {!dash.allow_supplier_receipts && ` ${tr('Les achats fournisseurs directs sont désactivés sur ce magasin.')}`}
          </Alert>
        </>
      )}
    </Box>
  );
}
