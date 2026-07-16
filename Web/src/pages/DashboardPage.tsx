import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingIcon from '@mui/icons-material/LocalShippingOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReplayIcon from '@mui/icons-material/ReplayOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveOutlined';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import { fetchDashboard, type DashboardData } from '../api/auth';
import { compact, formatCurrency } from '../utils/format';
import { useAppSelector } from '../store/hooks';

type ChartTab = 'stock' | 'purchases' | 'sales' | 'margin';

function SummaryCard({
  title,
  rows,
  footer,
  onClick,
  color = '#1565C0',
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  footer: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Stack spacing={1}>
            {rows.map((r) => (
              <Box key={r.label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">{r.label}</Typography>
                <Typography variant="body2" fontWeight={700} color={color}>{r.value}</Typography>
              </Box>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            {footer}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function AlertTile({
  label,
  value,
  color,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card sx={{ height: '100%', borderTop: `3px solid ${color}` }}>
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
          <Box sx={{ color, mb: 1 }}>{icon}</Box>
          <Typography variant="h5" fontWeight={800}>{value}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [chartTab, setChartTab] = useState<ChartTab>('stock');

  useEffect(() => {
    fetchDashboard().then(setData).catch(() => undefined);
  }, []);

  const overview = data?.stock_overview;
  const purchases = data?.purchases_summary;
  const orders = data?.customer_orders;
  const alerts = data?.alerts;

  const chartData = useMemo(() => {
    const labels = data?.charts?.labels || [];
    return labels.map((label, i) => ({
      label,
      stock: data?.charts?.stock_qty[i] ?? 0,
      value: data?.charts?.stock_value[i] ?? 0,
      purchases: data?.charts?.purchases[i] ?? 0,
      sales: data?.charts?.sales[i] ?? 0,
      margin: data?.charts?.margin[i] ?? 0,
    }));
  }, [data]);

  return (
    <Box>
      <PageHeader
        title={`Bonjour ${user?.first_name || user?.full_name || ''}`}
        subtitle="Tableau de bord — stock, ventes, achats et alertes"
      />

      {/* KPIs CA */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="CA aujourd'hui" value={formatCurrency(data?.revenue_today)} icon={<PaidIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="CA du mois" value={formatCurrency(data?.revenue_month)} icon={<TrendingUpIcon />} color="#00897B" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Ventes du jour" value={data?.sales_count_today ?? 0} icon={<ReceiptIcon />} color="#FF6F00" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Produits actifs" value={data?.products_count ?? 0} icon={<Inventory2Icon />} color="#8E24AA" />
        </Grid>
      </Grid>

      {/* Achats / Stock central / Ventes */}
      <Grid container spacing={2} sx={{ mb: 2 }} alignItems="stretch">
        <Grid size={{ xs: 12, md: 3.5 }}>
          <SummaryCard
            title="Commandes fournisseurs"
            color="#1565C0"
            onClick={() => navigate('/purchases')}
            rows={[
              { label: 'À valider', value: purchases?.to_validate ?? 0 },
              { label: 'À réceptionner', value: purchases?.to_receive ?? 0 },
              { label: 'Réception partielle', value: purchases?.partial ?? 0 },
            ]}
            footer={`${purchases?.suppliers_count ?? 0} fournisseurs`}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%', background: 'linear-gradient(145deg, #F8FBFF 0%, #EEF5FF 100%)' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Vue globale du stock
              </Typography>
              <Grid container spacing={1.5}>
                {[
                  { label: 'Produits', value: overview?.products ?? 0 },
                  { label: 'Valeur stock', value: formatCurrency(overview?.stock_value) },
                  { label: 'Qté totale', value: Number(overview?.stock_qty ?? 0).toLocaleString('fr-FR') },
                  { label: 'Âge stock (j)', value: overview?.stock_age_avg ?? 0 },
                  { label: 'Rotation', value: overview?.rotation ?? 0 },
                  { label: 'Boutiques', value: overview?.branches ?? 0 },
                  { label: 'Entrepôts', value: overview?.warehouses ?? 0 },
                  { label: 'Inventaires', value: overview?.inventories ?? 0 },
                ].map((item) => (
                  <Grid size={{ xs: 6, sm: 3 }} key={item.label}>
                    <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="h6" fontWeight={800} color="primary.main" noWrap>
                        {item.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Button size="small" sx={{ mt: 2 }} onClick={() => navigate('/stock')}>
                Ouvrir le stock
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3.5 }}>
          <SummaryCard
            title="Ventes clients"
            color="#00897B"
            onClick={() => navigate('/sales')}
            rows={[
              { label: 'En attente de paiement', value: orders?.awaiting_payment ?? 0 },
              { label: 'Paiement partiel', value: orders?.partial_payment ?? 0 },
              { label: 'Brouillons', value: orders?.draft ?? 0 },
            ]}
            footer={`${orders?.customers_count ?? 0} clients`}
          />
        </Grid>
      </Grid>

      {/* Alertes */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <AlertTile
            label="Alertes automatiques"
            value={alerts?.automatic ?? 0}
            color="#1565C0"
            icon={<NotificationsActiveIcon />}
            onClick={() => navigate('/stock')}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <AlertTile
            label="Stocks non traités"
            value={alerts?.untreated ?? 0}
            color="#E65100"
            icon={<WarningAmberIcon />}
            onClick={() => navigate('/stock')}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <AlertTile
            label="À réapprovisionner"
            value={alerts?.to_restock ?? 0}
            color="#F9A825"
            icon={<ReplayIcon />}
            onClick={() => navigate('/purchases')}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <AlertTile
            label="Stocks négatifs"
            value={alerts?.negative ?? 0}
            color="#C62828"
            icon={<ErrorOutlineIcon />}
            onClick={() => navigate('/stock')}
          />
        </Grid>
      </Grid>

      {/* Graphiques */}
      <Card sx={{ mb: 2 }}>
        <Tabs
          value={chartTab}
          onChange={(_, v) => setChartTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="stock" label="Évolution de stock" />
          <Tab value="purchases" label="Achats" />
          <Tab value="sales" label="Ventes" />
          <Tab value="margin" label="Marge brute" />
        </Tabs>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button size="small" onClick={() => navigate('/reports')}>Rapports détaillés</Button>
          </Box>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={compact} fontSize={11} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                formatter={(v: number, name: string) =>
                  name === 'stock' ? [v, 'Quantité'] : [formatCurrency(v), name]
                }
              />
              <Legend />
              {chartTab === 'stock' && (
                <>
                  <Line type="monotone" dataKey="stock" name="Stock (qté)" stroke="#FF6F00" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="value" name="Valeur" stroke="#E91E63" strokeWidth={2} dot={false} />
                </>
              )}
              {chartTab === 'purchases' && (
                <Line type="monotone" dataKey="purchases" name="Achats" stroke="#1565C0" strokeWidth={2} dot={false} />
              )}
              {chartTab === 'sales' && (
                <Line type="monotone" dataKey="sales" name="Ventes" stroke="#00897B" strokeWidth={2} dot={false} />
              )}
              {chartTab === 'margin' && (
                <Line type="monotone" dataKey="margin" name="Marge" stroke="#7B1FA2" strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Listes d'alertes */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <LocalShippingIcon fontSize="small" color="primary" />
                <Typography fontWeight={600}>À réapprovisionner</Typography>
              </Stack>
              {(data?.alert_lists?.to_restock || []).slice(0, 5).map((p) => (
                <Typography key={`${p.id}-${p.warehouse}`} variant="body2" sx={{ py: 0.5 }}>
                  {p.name} — {p.quantity} (min {p.min_stock}) · {p.warehouse}
                </Typography>
              ))}
              {!data?.alert_lists?.to_restock?.length && (
                <Typography variant="body2" color="text.secondary">Aucun article</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <WarningAmberIcon fontSize="small" color="warning" />
                <Typography fontWeight={600}>Stock faible</Typography>
              </Stack>
              {(data?.alert_lists?.low_stock || data?.low_stock_products || []).slice(0, 5).map((p) => (
                <Typography key={`${p.id}-${p.warehouse}-low`} variant="body2" sx={{ py: 0.5 }}>
                  {p.name} — {p.quantity} · {p.warehouse}
                </Typography>
              ))}
              {!(data?.alert_lists?.low_stock?.length || data?.low_stock_products?.length) && (
                <Typography variant="body2" color="text.secondary">Aucun article</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <PeopleIcon fontSize="small" color="error" />
                <Typography fontWeight={600}>Stocks négatifs</Typography>
              </Stack>
              {(data?.alert_lists?.negative || []).slice(0, 5).map((p) => (
                <Typography key={`${p.id}-${p.warehouse}-neg`} variant="body2" sx={{ py: 0.5 }} color="error.main">
                  {p.name} — {p.quantity} · {p.warehouse}
                </Typography>
              ))}
              {!data?.alert_lists?.negative?.length && (
                <Typography variant="body2" color="text.secondary">Aucun article</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
