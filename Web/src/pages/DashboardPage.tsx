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
import { fetchDashboard, type DashboardData } from '../api/auth';
import { compact, formatCurrency, formatNumber } from '../utils/format';
import { useAppSelector } from '../store/hooks';
import { useLocale } from '../locale/useLocale';
import { BRAND } from '../theme';
import { fadeUpSx, staggerFadeUp } from '../theme/motion';

type ChartTab = 'stock' | 'purchases' | 'sales' | 'margin';

function SummaryCard({
  title,
  rows,
  footer,
  onClick,
  color = '#0D9488',
  index = 0,
}: {
  title: string;
  rows: Array<{ label: string; value: string | number }>;
  footer: string;
  onClick: () => void;
  color?: string;
  index?: number;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        ...staggerFadeUp(index + 4),
        '&:hover': { transform: 'translateY(-3px)', borderColor: `${color}66` },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ width: 28, height: 3, borderRadius: 1, bgcolor: color, mb: 1.25 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Stack spacing={1}>
            {rows.map((r) => (
              <Box key={r.label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">{r.label}</Typography>
                <Typography variant="body2" fontWeight={700} color={color}>
                  {typeof r.value === 'number' ? formatNumber(r.value) : r.value}
                </Typography>
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
  index = 0,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
  index?: number;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        borderTop: `3px solid ${color}`,
        ...staggerFadeUp(index + 8),
        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 10px 24px ${color}22` },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
          <Box sx={{ color, mb: 1 }}>{icon}</Box>
          <Typography variant="h5" fontWeight={800}>{formatNumber(value)}</Typography>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { tr, version } = useLocale();
  void version;
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
      <Box
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
          background: `linear-gradient(125deg, ${BRAND.navy} 0%, #0E4A5C 45%, ${BRAND.primaryDark} 100%)`,
          boxShadow: '0 16px 40px rgba(11,31,58,0.22)',
          ...fadeUpSx(0),
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 80% at 100% 0%, rgba(45,212,191,0.35), transparent 55%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="overline" sx={{ color: BRAND.mint, fontWeight: 700, letterSpacing: '0.14em' }}>
            {tr('Tableau de bord')}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 700,
              fontSize: { xs: '1.6rem', md: '2rem' },
              letterSpacing: '-0.02em',
              mt: 0.5,
            }}
          >
            {tr('Bonjour')} {user?.first_name || user?.full_name || ''}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', mt: 0.75, maxWidth: 520 }}>
            {tr('Stock, ventes, achats et alertes — tout en un coup d’œil.')}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="contained"
              onClick={() => navigate('/pos')}
              sx={{ bgcolor: '#fff', color: BRAND.navy, '&:hover': { bgcolor: BRAND.mint } }}
            >
              {tr('Ouvrir la caisse')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate('/stock')}
              sx={{ borderColor: 'rgba(255,255,255,0.45)', color: '#fff', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              {tr('Voir le stock')}
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* KPIs CA */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard index={0} label={tr("CA aujourd'hui")} value={formatCurrency(data?.revenue_today)} icon={<PaidIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard index={1} label={tr('CA du mois')} value={formatCurrency(data?.revenue_month)} icon={<TrendingUpIcon />} color={BRAND.primaryDark} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard index={2} label={tr('Ventes du jour')} value={formatNumber(data?.sales_count_today ?? 0)} icon={<ReceiptIcon />} color={BRAND.coral} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard index={3} label={tr('Produits actifs')} value={formatNumber(data?.products_count ?? 0)} icon={<Inventory2Icon />} color={BRAND.sky} />
        </Grid>
      </Grid>

      {/* Vue multi-sites (admin) */}
      {Boolean(data?.sites_overview?.length) && (user?.is_company_admin || user?.role_code === 'manager') && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {tr('Entreprise — sites & stocks')}
            </Typography>
            <Grid container spacing={1.5}>
              {(data?.sites_overview || []).map((site) => {
                const kindLabel = site.kind === 'main' ? tr('Boutique principale') : site.kind === 'pos' ? tr('Point de vente') : tr('Entrepôt');
                const needsRestock = site.pending_requests > 0;
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={site.warehouse_id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor: needsRestock ? '#E65100' : 'divider',
                        bgcolor: needsRestock ? '#FFF8F1' : 'background.paper',
                      }}
                    >
                      <CardActionArea
                        onClick={() => navigate(
                          site.kind === 'pos'
                            ? `/sites/pos/${site.branch_id}`
                            : site.pending_requests > 0
                              ? '/requests'
                              : '/stock',
                        )}
                      >
                        <CardContent sx={{ py: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">{kindLabel}</Typography>
                          <Typography fontWeight={700}>{site.warehouse_name}</Typography>
                          <Typography variant="body2" color="text.secondary">{site.branch_name}</Typography>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                            <Typography variant="body2">{tr('Stock')} : <strong>{compact(site.stock_qty)}</strong></Typography>
                            <Typography variant="body2" color={needsRestock ? 'warning.main' : 'text.secondary'}>
                              {tr('Demandes')} : <strong>{formatNumber(site.pending_requests)}</strong>
                            </Typography>
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Achats / Stock central / Ventes */}
      <Grid container spacing={2} sx={{ mb: 2 }} alignItems="stretch">
        <Grid size={{ xs: 12, md: 3.5 }}>
          <SummaryCard
            index={0}
            title={tr('Commandes fournisseurs')}
            color="#0D9488"
            onClick={() => navigate('/purchases')}
            rows={[
              { label: tr('À valider'), value: purchases?.to_validate ?? 0 },
              { label: tr('À réceptionner'), value: purchases?.to_receive ?? 0 },
              { label: tr('Réception partielle'), value: purchases?.partial ?? 0 },
            ]}
            footer={tr(`${purchases?.suppliers_count ?? 0} fournisseurs`)}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card
            sx={{
              height: '100%',
              background: 'linear-gradient(145deg, #F0FDFA 0%, #E0F2FE 100%)',
              borderColor: 'rgba(13,148,136,0.2)',
              ...staggerFadeUp(5),
            }}
          >
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {tr('Vue globale du stock')}
              </Typography>
              <Grid container spacing={1}>
                {[
                  { label: tr('Produits'), value: formatNumber(overview?.products ?? 0) },
                  { label: tr('Valeur stock'), value: formatCurrency(overview?.stock_value) },
                  { label: tr('Qté totale'), value: formatNumber(overview?.stock_qty ?? 0) },
                  { label: tr('Inventaires'), value: formatNumber(overview?.inventories ?? 0) },
                  { label: tr('Âge stock (j)'), value: formatNumber(overview?.stock_age_avg ?? 0) },
                  { label: tr('Rotation'), value: formatNumber(overview?.rotation ?? 0, { maximumFractionDigits: 2 }) },
                  { label: tr('Boutiques'), value: formatNumber(overview?.branches ?? 0) },
                  { label: tr('Entrepôts'), value: formatNumber(overview?.warehouses ?? 0) },
                ].map((item) => (
                  <Grid size={{ xs: 6, sm: 3 }} key={item.label}>
                    <Box
                      sx={{
                        textAlign: 'center',
                        px: 0.75,
                        py: 0.85,
                        minHeight: 62,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography
                        fontWeight={800}
                        color="primary.main"
                        sx={{
                          fontSize: { xs: '0.88rem', sm: '0.95rem' },
                          lineHeight: 1.2,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {item.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                        {item.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Button size="small" sx={{ mt: 2 }} onClick={() => navigate('/stock')}>
                {tr('Ouvrir le stock')}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3.5 }}>
          <SummaryCard
            index={2}
            title={tr('Ventes clients')}
            color="#0F766E"
            onClick={() => navigate('/sales')}
            rows={[
              { label: tr('En attente de paiement'), value: orders?.awaiting_payment ?? 0 },
              { label: tr('Paiement partiel'), value: orders?.partial_payment ?? 0 },
              { label: tr('Brouillons'), value: orders?.draft ?? 0 },
            ]}
            footer={tr(`${orders?.customers_count ?? 0} clients`)}
          />
        </Grid>
      </Grid>

      {/* Alertes */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <AlertTile
            index={0}
            label={tr('Ruptures de stock')}
            value={alerts?.out_of_stock ?? overview?.out_of_stock ?? 0}
            color="#C62828"
            icon={<ErrorOutlineIcon />}
            onClick={() => navigate('/stock?status=out_of_stock')}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <AlertTile
            index={1}
            label={tr('Stock faible')}
            value={alerts?.low_stock ?? overview?.low_stock ?? 0}
            color="#E65100"
            icon={<WarningAmberIcon />}
            onClick={() => navigate('/stock?status=low')}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <AlertTile
            index={2}
            label={tr('À réapprovisionner')}
            value={alerts?.to_restock ?? 0}
            color="#F9A825"
            icon={<ReplayIcon />}
            onClick={() => navigate('/purchases')}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <AlertTile
            index={3}
            label={tr('Alertes automatiques')}
            value={alerts?.automatic ?? 0}
            color="#0D9488"
            icon={<NotificationsActiveIcon />}
            onClick={() => navigate('/stock')}
          />
        </Grid>
      </Grid>

      {/* Graphiques */}
      <Card sx={{ mb: 2, ...staggerFadeUp(12) }}>
        <Tabs
          value={chartTab}
          onChange={(_, v) => setChartTab(v)}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="stock" label={tr('Évolution de stock')} />
          <Tab value="purchases" label={tr('Achats')} />
          <Tab value="sales" label={tr('Ventes')} />
          <Tab value="margin" label={tr('Marge brute')} />
        </Tabs>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button size="small" onClick={() => navigate('/reports')}>{tr('Rapports détaillés')}</Button>
          </Box>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={compact} fontSize={11} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                formatter={(v: number, name: string) =>
                  name === 'stock' ? [v, tr('Quantité')] : [formatCurrency(v), name]
                }
              />
              <Legend />
              {chartTab === 'stock' && (
                <>
                  <Line type="monotone" dataKey="stock" name={tr('Stock (qté)')} stroke="#FF6F00" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="value" name={tr('Valeur')} stroke="#E91E63" strokeWidth={2} dot={false} />
                </>
              )}
              {chartTab === 'purchases' && (
                <Line type="monotone" dataKey="purchases" name={tr('Achats')} stroke="#0D9488" strokeWidth={2} dot={false} />
              )}
              {chartTab === 'sales' && (
                <Line type="monotone" dataKey="sales" name={tr('Ventes')} stroke="#0F766E" strokeWidth={2} dot={false} />
              )}
              {chartTab === 'margin' && (
                <Line type="monotone" dataKey="margin" name={tr('Marge')} stroke="#7B1FA2" strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Listes d'alertes */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderTop: '3px solid #C62828' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <ErrorOutlineIcon fontSize="small" sx={{ color: '#C62828' }} />
                <Typography fontWeight={600}>{tr('Ruptures de stock')}</Typography>
              </Stack>
              {(data?.alert_lists?.out_of_stock || []).slice(0, 8).map((p) => (
                <Typography key={`${p.id}-${p.warehouse}-out`} variant="body2" sx={{ py: 0.5, color: '#C62828' }}>
                  {p.name} — {p.quantity} · {p.warehouse}
                </Typography>
              ))}
              {!data?.alert_lists?.out_of_stock?.length && (
                <Typography variant="body2" color="text.secondary">{tr('Aucune rupture')}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderTop: '3px solid #E65100' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <WarningAmberIcon fontSize="small" sx={{ color: '#E65100' }} />
                <Typography fontWeight={600}>{tr('Stock faible')}</Typography>
              </Stack>
              {(data?.alert_lists?.low_stock || data?.low_stock_products || []).slice(0, 8).map((p) => (
                <Typography key={`${p.id}-${p.warehouse}-low`} variant="body2" sx={{ py: 0.5, color: '#E65100' }}>
                  {p.name} — {p.quantity} · {p.warehouse}
                </Typography>
              ))}
              {!(data?.alert_lists?.low_stock?.length || data?.low_stock_products?.length) && (
                <Typography variant="body2" color="text.secondary">{tr('Aucun stock faible')}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <LocalShippingIcon fontSize="small" color="primary" />
                <Typography fontWeight={600}>{tr('À réapprovisionner')}</Typography>
              </Stack>
              {(data?.alert_lists?.to_restock || []).slice(0, 8).map((p) => (
                <Typography key={`${p.id}-${p.warehouse}`} variant="body2" sx={{ py: 0.5 }}>
                  {p.name} — {p.quantity} · {p.warehouse}
                </Typography>
              ))}
              {!data?.alert_lists?.to_restock?.length && (
                <Typography variant="body2" color="text.secondary">{tr('Aucun article')}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
