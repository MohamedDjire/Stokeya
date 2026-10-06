import { useCallback, useEffect, useState } from 'react';
import { Alert, Dimensions, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Chip,
  Divider,
  Menu,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  exportAnalyticsExcel,
  fetchAnalytics,
  fetchAnalyticsFilters,
  type Analytics,
  type AnalyticsFilters,
} from '../api/reports';
import { colors, radius, spacing } from '../theme/colors';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - spacing.md * 2 - spacing.md * 2;

const PIE_COLORS = ['#0D9488', '#00897B', '#FF6F00', '#8E24AA', '#43A047', '#E53935'];

const baseChartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (o = 1) => `rgba(21, 101, 192, ${o})`,
  labelColor: () => colors.textMuted,
  propsForDots: { r: '3', strokeWidth: '2', stroke: colors.primary },
  propsForBackgroundLines: { stroke: colors.border },
};

function compact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)}k`;
  return `${Math.round(n)}`;
}

function thinLabels(labels: string[], keep = 6) {
  if (labels.length <= keep) return labels;
  const step = Math.ceil(labels.length / keep);
  return labels.map((l, i) => (i % step === 0 ? l : ''));
}

const fmt = (v: number) => `${Number(v).toLocaleString('fr-FR')} XOF`;

export default function ReportsScreen() {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filters, setFilters] = useState<AnalyticsFilters>({ branches: [], sellers: [] });
  const [branch, setBranch] = useState<number | null>(null);
  const [seller, setSeller] = useState<number | null>(null);
  const [branchMenu, setBranchMenu] = useState(false);
  const [sellerMenu, setSellerMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalyticsFilters().then(setFilters).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    fetchAnalytics(period, { branch, seller })
      .then(setData)
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [period, branch, seller]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const branchName = branch ? filters.branches.find((b) => b.id === branch)?.name : 'Toutes boutiques';
  const sellerName = seller ? filters.sellers.find((s) => s.id === seller)?.name : 'Tous vendeurs';

  const handleExportExcel = async () => {
    setExportMenu(false);
    setExporting(true);
    try {
      await exportAnalyticsExcel({ period, branch, seller });
    } catch {
      Alert.alert('Export', 'Impossible de générer le fichier Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setExportMenu(false);
    if (!data) return;
    setExporting(true);
    try {
      const html = buildReportHtml(data, { branchName, sellerName });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Rapport Stokeya' });
      }
    } catch {
      Alert.alert('Export', 'Impossible de générer le PDF.');
    } finally {
      setExporting(false);
    }
  };

  const trendLabels = data ? thinLabels(data.sales_trend.labels) : [];
  const trendData = data?.sales_trend.revenue.length ? data.sales_trend.revenue : [0];

  const pieData = (data?.payment_methods || []).map((p, i) => ({
    name: p.label,
    amount: p.total,
    color: PIE_COLORS[i % PIE_COLORS.length],
    legendFontColor: colors.text,
    legendFontSize: 12,
  }));

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Statistiques" subtitle="Analyse de performance" />
        <Menu
          visible={exportMenu}
          onDismiss={() => setExportMenu(false)}
          anchor={
            <Appbar.Action
              icon={exporting ? 'progress-download' : 'download'}
              disabled={exporting || !data}
              onPress={() => setExportMenu(true)}
            />
          }
        >
          <Menu.Item leadingIcon="file-pdf-box" title="Exporter en PDF" onPress={handleExportPdf} />
          <Menu.Item leadingIcon="file-excel" title="Exporter en Excel" onPress={handleExportExcel} />
        </Menu>
      </AppHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <SegmentedButtons
          value={period}
          onValueChange={(v) => { setLoading(true); setPeriod(v as typeof period); }}
          buttons={[
            { value: 'week', label: '7 jours' },
            { value: 'month', label: '30 jours' },
            { value: 'year', label: 'Année' },
          ]}
          style={styles.segment}
        />

        {(filters.branches.length > 1 || filters.sellers.length > 1) && (
          <View style={styles.filterRow}>
            {filters.branches.length > 1 && (
              <Menu
                visible={branchMenu}
                onDismiss={() => setBranchMenu(false)}
                anchor={
                  <Chip icon="store" onPress={() => setBranchMenu(true)} style={styles.filterChip}>
                    {branchName}
                  </Chip>
                }
              >
                <Menu.Item title="Toutes boutiques" onPress={() => { setBranch(null); setBranchMenu(false); setLoading(true); }} />
                <Divider />
                {filters.branches.map((b) => (
                  <Menu.Item key={b.id} title={b.name}
                    onPress={() => { setBranch(b.id); setBranchMenu(false); setLoading(true); }} />
                ))}
              </Menu>
            )}
            {filters.sellers.length > 1 && (
              <Menu
                visible={sellerMenu}
                onDismiss={() => setSellerMenu(false)}
                anchor={
                  <Chip icon="account" onPress={() => setSellerMenu(true)} style={styles.filterChip}>
                    {sellerName}
                  </Chip>
                }
              >
                <Menu.Item title="Tous vendeurs" onPress={() => { setSeller(null); setSellerMenu(false); setLoading(true); }} />
                <Divider />
                {filters.sellers.map((s) => (
                  <Menu.Item key={s.id} title={s.name}
                    onPress={() => { setSeller(s.id); setSellerMenu(false); setLoading(true); }} />
                ))}
              </Menu>
            )}
          </View>
        )}

        {loading || !data ? (
          <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
        ) : (
          <>
            {/* KPIs */}
            <View style={styles.kpiGrid}>
              <KpiCard label="Chiffre d'affaires" value={fmt(data.kpis.revenue)} growth={data.kpis.revenue_growth} />
              <KpiCard label="Ventes" value={`${data.kpis.sales_count}`} growth={data.kpis.sales_growth} />
              <KpiCard label="Panier moyen" value={fmt(data.kpis.average_basket)} />
              <KpiCard label="Produits actifs" value={`${data.kpis.active_products}`} />
            </View>

            {data.low_stock_count > 0 && (
              <Chip icon="alert" style={styles.alertChip} textStyle={{ color: colors.error }}>
                {data.low_stock_count} produit(s) en stock faible
              </Chip>
            )}

            {/* Sales trend */}
            <Card style={styles.card}>
              <Card.Title title="Évolution du chiffre d'affaires" titleVariant="titleMedium" />
              <Card.Content>
                <LineChart
                  data={{ labels: trendLabels, datasets: [{ data: trendData }] }}
                  width={CHART_W}
                  height={220}
                  chartConfig={baseChartConfig}
                  bezier
                  fromZero
                  formatYLabel={(y) => compact(Number(y))}
                  style={styles.chart}
                />
              </Card.Content>
            </Card>

            {/* Revenue vs expenses */}
            <Card style={styles.card}>
              <Card.Title title="Recettes vs Dépenses" subtitle="6 derniers mois" titleVariant="titleMedium" />
              <Card.Content>
                <LineChart
                  data={{
                    labels: data.revenue_vs_expenses.labels,
                    datasets: [
                      { data: data.revenue_vs_expenses.revenue.length ? data.revenue_vs_expenses.revenue : [0], color: (o = 1) => `rgba(46, 125, 50, ${o})` },
                      { data: data.revenue_vs_expenses.expenses.length ? data.revenue_vs_expenses.expenses : [0], color: (o = 1) => `rgba(198, 40, 40, ${o})` },
                    ],
                    legend: ['Recettes', 'Dépenses'],
                  }}
                  width={CHART_W}
                  height={220}
                  chartConfig={baseChartConfig}
                  bezier
                  fromZero
                  formatYLabel={(y) => compact(Number(y))}
                  style={styles.chart}
                />
              </Card.Content>
            </Card>

            {/* Payment methods pie */}
            {pieData.length > 0 && (
              <Card style={styles.card}>
                <Card.Title title="Modes de paiement" titleVariant="titleMedium" />
                <Card.Content>
                  <PieChart
                    data={pieData}
                    width={CHART_W}
                    height={200}
                    chartConfig={baseChartConfig}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft="8"
                    absolute
                  />
                </Card.Content>
              </Card>
            )}

            {/* Category breakdown */}
            {data.category_breakdown.length > 0 && (
              <Card style={styles.card}>
                <Card.Title title="CA par catégorie" titleVariant="titleMedium" />
                <Card.Content>
                  <BarChart
                    data={{
                      labels: data.category_breakdown.map((c) => c.name.slice(0, 8)),
                      datasets: [{ data: data.category_breakdown.map((c) => c.revenue) }],
                    }}
                    width={CHART_W}
                    height={220}
                    chartConfig={{
                      ...baseChartConfig,
                      color: (o = 1) => `rgba(0, 137, 123, ${o})`,
                      formatYLabel: (y: string) => compact(Number(y)),
                    }}
                    fromZero
                    showValuesOnTopOfBars
                    yAxisLabel=""
                    yAxisSuffix=""
                    style={styles.chart}
                    verticalLabelRotation={20}
                  />
                </Card.Content>
              </Card>
            )}

            {/* Top products */}
            <Card style={styles.card}>
              <Card.Title title="Top produits" titleVariant="titleMedium" />
              <Card.Content>
                {data.top_products.length === 0 ? (
                  <Text style={styles.muted}>Aucune vente sur la période.</Text>
                ) : (
                  data.top_products.map((p, i) => {
                    const max = data.top_products[0].revenue || 1;
                    return (
                      <View key={p.id} style={styles.topRow}>
                        <View style={styles.topInfo}>
                          <Text variant="bodyMedium" numberOfLines={1} style={styles.topName}>
                            {i + 1}. {p.name}
                          </Text>
                          <Text variant="bodySmall" style={styles.muted}>{fmt(p.revenue)}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${(p.revenue / max) * 100}%` }]} />
                        </View>
                      </View>
                    );
                  })
                )}
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function KpiCard({ label, value, growth }: { label: string; value: string; growth?: number }) {
  const positive = (growth ?? 0) >= 0;
  return (
    <Card style={styles.kpiCard}>
      <Card.Content style={styles.kpiContent}>
        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>{label}</Text>
        <Text variant="titleMedium" style={styles.kpiValue} numberOfLines={1}>{value}</Text>
        {growth !== undefined && (
          <Text variant="bodySmall" style={{ color: positive ? colors.success : colors.error }}>
            {positive ? '▲' : '▼'} {Math.abs(growth)}%
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

function buildReportHtml(d: Analytics, ctx: { branchName?: string; sellerName?: string }) {
  const periodLabel = d.period === 'week' ? '7 derniers jours' : d.period === 'year' ? 'Année en cours' : '30 derniers jours';
  const row = (cells: (string | number)[], tag = 'td') =>
    `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
  const money = (n: number) => `${Number(n).toLocaleString('fr-FR')} XOF`;

  const trendRows = d.sales_trend.labels
    .map((l, i) => row([l, money(d.sales_trend.revenue[i]), d.sales_trend.counts[i]]))
    .join('');
  const reRows = d.revenue_vs_expenses.labels
    .map((l, i) => row([l, money(d.revenue_vs_expenses.revenue[i]), money(d.revenue_vs_expenses.expenses[i]), money(d.revenue_vs_expenses.profit[i])]))
    .join('');
  const topRows = d.top_products.map((p) => row([p.name, p.quantity, money(p.revenue)])).join('');
  const payRows = d.payment_methods.map((p) => row([p.label, money(p.total), p.count])).join('');
  const catRows = d.category_breakdown.map((c) => row([c.name, money(c.revenue)])).join('');

  return `
  <html><head><meta charset="utf-8" /><style>
    body { font-family: -apple-system, Roboto, sans-serif; color: #1A1A2E; padding: 24px; }
    h1 { color: #0D9488; margin-bottom: 4px; }
    .meta { color: #6B7280; font-size: 12px; margin-bottom: 16px; }
    h2 { color: #0D9488; font-size: 15px; margin-top: 24px; border-bottom: 2px solid #E5E7EB; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th { background: #0D9488; color: #fff; padding: 6px; text-align: left; }
    td { padding: 6px; border-bottom: 1px solid #E5E7EB; }
    .kpis { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
    .kpi { flex: 1; min-width: 130px; background: #F0F4F8; border-radius: 8px; padding: 12px; }
    .kpi .v { font-size: 18px; font-weight: 700; }
    .kpi .l { color: #6B7280; font-size: 11px; }
  </style></head><body>
    <h1>Rapport statistique — Stokeya</h1>
    <div class="meta">Période : ${periodLabel} · Boutique : ${ctx.branchName || 'Toutes'} · Vendeur : ${ctx.sellerName || 'Tous'}</div>
    <div class="kpis">
      <div class="kpi"><div class="l">Chiffre d'affaires</div><div class="v">${money(d.kpis.revenue)}</div><div class="l">${d.kpis.revenue_growth >= 0 ? '▲' : '▼'} ${Math.abs(d.kpis.revenue_growth)}%</div></div>
      <div class="kpi"><div class="l">Ventes</div><div class="v">${d.kpis.sales_count}</div><div class="l">${d.kpis.sales_growth >= 0 ? '▲' : '▼'} ${Math.abs(d.kpis.sales_growth)}%</div></div>
      <div class="kpi"><div class="l">Panier moyen</div><div class="v">${money(d.kpis.average_basket)}</div></div>
      <div class="kpi"><div class="l">Produits actifs</div><div class="v">${d.kpis.active_products}</div></div>
    </div>
    <h2>Évolution du chiffre d'affaires</h2>
    <table>${row(['Période', 'CA', 'Nb ventes'], 'th')}${trendRows}</table>
    <h2>Recettes vs Dépenses (6 mois)</h2>
    <table>${row(['Mois', 'Recettes', 'Dépenses', 'Bénéfice'], 'th')}${reRows}</table>
    <h2>Top produits</h2>
    <table>${row(['Produit', 'Qté', 'CA'], 'th')}${topRows || row(['Aucune vente', '', ''])}</table>
    <h2>Modes de paiement</h2>
    <table>${row(['Mode', 'Montant', 'Nb'], 'th')}${payRows || row(['—', '', ''])}</table>
    <h2>CA par catégorie</h2>
    <table>${row(['Catégorie', 'CA'], 'th')}${catRows || row(['—', ''])}</table>
  </body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: { backgroundColor: colors.surface },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  segment: { marginBottom: spacing.md },
  loader: { marginTop: 48 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  kpiCard: { width: (SCREEN_W - spacing.md * 2 - spacing.sm) / 2, backgroundColor: colors.surface },
  kpiContent: { gap: 2 },
  kpiValue: { fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted },
  alertChip: { backgroundColor: colors.error + '15', marginBottom: spacing.sm, alignSelf: 'flex-start' },
  card: { marginBottom: spacing.md, backgroundColor: colors.surface },
  chart: { borderRadius: radius.md, marginVertical: spacing.sm },
  topRow: { marginBottom: spacing.sm },
  topInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  topName: { flex: 1, marginRight: spacing.sm },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
