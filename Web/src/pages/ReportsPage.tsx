import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import {
  downloadAnalyticsExcel,
  fetchAnalytics,
  fetchAnalyticsFilters,
  type Analytics,
  type AnalyticsFilters,
} from '../api/reports';
import { CHART_COLORS } from '../theme';
import { compact, formatCurrency, formatNumber } from '../utils/format';
import { useLocale } from '../locale/useLocale';
import { tr as trPhrase } from '../locale/tr';

type Period = 'week' | 'month' | 'year';

export default function ReportsPage() {
  const { tr, version } = useLocale();
  void version;

  const [period, setPeriod] = useState<Period>('month');
  const [branch, setBranch] = useState<number | ''>('');
  const [seller, setSeller] = useState<number | ''>('');
  const [filters, setFilters] = useState<AnalyticsFilters>({ branches: [], sellers: [] });
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalyticsFilters().then(setFilters).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchAnalytics({ period, branch: branch || null, seller: seller || null })
      .then(setData)
      .finally(() => setLoading(false));
  }, [period, branch, seller]);

  useEffect(() => { load(); }, [load]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadAnalyticsExcel({ period, branch: branch || null, seller: seller || null });
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = () => {
    if (!data) return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(buildReportHtml(data));
      win.document.close();
      win.focus();
      win.print();
    }
  };

  const trendData = data?.sales_trend.labels.map((label, i) => ({
    label,
    revenue: data.sales_trend.revenue[i],
  })) || [];

  const reData = data?.revenue_vs_expenses.labels.map((label, i) => ({
    label,
    Recettes: data.revenue_vs_expenses.revenue[i],
    Dépenses: data.revenue_vs_expenses.expenses[i],
  })) || [];

  return (
    <Box>
      <PageHeader
        title={tr('Statistiques')}
        subtitle={tr('Analyse de performance')}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={exportPdf} disabled={!data}>
              PDF
            </Button>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportExcel} disabled={exporting || !data}>
              Excel
            </Button>
          </Stack>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems="center">
        <ToggleButtonGroup exclusive size="small" value={period} onChange={(_, v) => v && setPeriod(v)}>
          <ToggleButton value="week">{tr('7 jours')}</ToggleButton>
          <ToggleButton value="month">{tr('30 jours')}</ToggleButton>
          <ToggleButton value="year">{tr('Année')}</ToggleButton>
        </ToggleButtonGroup>
        {filters.branches.length > 1 && (
          <TextField select size="small" label={tr('Boutique')} value={branch}
            onChange={(e) => setBranch(e.target.value ? Number(e.target.value) : '')} sx={{ minWidth: 180 }}>
            <MenuItem value="">{tr('Toutes boutiques')}</MenuItem>
            {filters.branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
        )}
        {filters.sellers.length > 1 && (
          <TextField select size="small" label={tr('Vendeur')} value={seller}
            onChange={(e) => setSeller(e.target.value ? Number(e.target.value) : '')} sx={{ minWidth: 180 }}>
            <MenuItem value="">{tr('Tous vendeurs')}</MenuItem>
            {filters.sellers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
        )}
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {data && (
        <>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label={tr("Chiffre d'affaires")} value={formatCurrency(data.kpis.revenue)} growth={data.kpis.revenue_growth} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label={tr('Ventes')} value={data.kpis.sales_count} growth={data.kpis.sales_growth} color="#0F766E" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label={tr('Panier moyen')} value={formatCurrency(data.kpis.average_basket)} color="#FF6F00" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label={tr('Produits actifs')} value={data.kpis.active_products} color="#8E24AA" />
            </Grid>
          </Grid>

          {data.low_stock_count > 0 && (
            <Alert severity="warning" sx={{ my: 2 }}>
              {tr(`${data.low_stock_count} produit(s) en alerte stock (stock faible ou rupture) — voir le tableau de bord et la page Stock.`)}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{tr("Évolution du chiffre d'affaires")}</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" />
                      <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={compact} fontSize={12} tickLine={false} axisLine={false} width={45} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Line type="monotone" dataKey="revenue" name={tr('CA')} stroke="#0D9488" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{tr('Modes de paiement')}</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.payment_methods}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(e) => e.label}
                      >
                        {data.payment_methods.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{tr('Recettes vs Dépenses (6 mois)')}</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={reData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" />
                      <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={compact} fontSize={12} tickLine={false} axisLine={false} width={45} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="Recettes" name={tr('Recettes')} stroke="#2E7D32" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Dépenses" name={tr('Dépenses')} stroke="#C62828" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{tr('CA par catégorie')}</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.category_breakdown} layout="vertical" margin={{ left: 10 }}>
                      <XAxis type="number" tickFormatter={compact} fontSize={12} hide />
                      <YAxis type="category" dataKey="name" fontSize={12} width={90} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="revenue" fill="#0F766E" radius={[0, 6, 6, 0]} name={tr('CA')} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>{tr('Top produits')}</Typography>
                  {data.top_products.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">{tr('Aucune vente sur la période.')}</Typography>
                  ) : (
                    data.top_products.map((p, i) => {
                      const max = data.top_products[0].revenue || 1;
                      return (
                        <Box key={p.id} sx={{ mb: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600}>{i + 1}. {p.name}</Typography>
                            <Typography variant="body2" color="text.secondary">{formatCurrency(p.revenue)}</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={(p.revenue / max) * 100} sx={{ height: 8, borderRadius: 4 }} />
                        </Box>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}

function buildReportHtml(d: Analytics): string {
  const periodLabel = d.period === 'week'
    ? trPhrase('7 derniers jours')
    : d.period === 'year'
      ? trPhrase('Année en cours')
      : trPhrase('30 derniers jours');
  const money = (n: number) => formatCurrency(n);
  const row = (cells: (string | number)[], tag = 'td') =>
    `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
  const trendRows = d.sales_trend.labels.map((l, i) => row([l, money(d.sales_trend.revenue[i]), formatNumber(d.sales_trend.counts[i])])).join('');
  const reRows = d.revenue_vs_expenses.labels.map((l, i) => row([l, money(d.revenue_vs_expenses.revenue[i]), money(d.revenue_vs_expenses.expenses[i]), money(d.revenue_vs_expenses.profit[i])])).join('');
  const topRows = d.top_products.map((p) => row([p.name, formatNumber(p.quantity), money(p.revenue)])).join('');
  return `<html><head><meta charset="utf-8"/><title>${trPhrase('Rapport Stokeya')}</title><style>
    body{font-family:Arial,sans-serif;color:#1A1A2E;padding:24px}
    h1{color:#0D9488}h2{color:#0D9488;font-size:15px;border-bottom:2px solid #E5E7EB;padding-bottom:4px;margin-top:24px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
    th{background:#0D9488;color:#fff;padding:6px;text-align:left}td{padding:6px;border-bottom:1px solid #E5E7EB}
    .kpis{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}.kpi{background:#F0F4F8;border-radius:8px;padding:12px;flex:1;min-width:130px}
    .v{font-size:18px;font-weight:700}.l{color:#6B7280;font-size:11px}</style></head><body>
    <h1>${trPhrase('Rapport statistique — Stokeya')}</h1><p class="l">${trPhrase('Période')} : ${periodLabel}</p>
    <div class="kpis">
      <div class="kpi"><div class="l">${trPhrase("Chiffre d'affaires")}</div><div class="v">${money(d.kpis.revenue)}</div></div>
      <div class="kpi"><div class="l">${trPhrase('Ventes')}</div><div class="v">${formatNumber(d.kpis.sales_count)}</div></div>
      <div class="kpi"><div class="l">${trPhrase('Panier moyen')}</div><div class="v">${money(d.kpis.average_basket)}</div></div>
      <div class="kpi"><div class="l">${trPhrase('Produits actifs')}</div><div class="v">${formatNumber(d.kpis.active_products)}</div></div>
    </div>
    <h2>${trPhrase("Évolution du chiffre d'affaires")}</h2><table>${row([trPhrase('Période'), trPhrase('CA'), trPhrase('Ventes')], 'th')}${trendRows}</table>
    <h2>${trPhrase('Recettes vs Dépenses')}</h2><table>${row([trPhrase('Mois'), trPhrase('Recettes'), trPhrase('Dépenses'), trPhrase('Bénéfice')], 'th')}${reRows}</table>
    <h2>${trPhrase('Top produits')}</h2><table>${row([trPhrase('Produit'), trPhrase('Qté'), trPhrase('CA')], 'th')}${topRows || row([trPhrase('Aucune vente'), '', ''])}</table>
  </body></html>`;
}
