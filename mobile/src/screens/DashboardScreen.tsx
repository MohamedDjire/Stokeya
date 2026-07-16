import { useEffect, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Card, Text, ActivityIndicator, IconButton, Button, Chip, SegmentedButtons } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { useAppSelector } from '../store/hooks';
import { fetchDashboard, type DashboardData } from '../api/auth';
import { hasModuleAccess } from '../utils/permissions';
import StatCard from '../components/StatCard';
import ModuleCard from '../components/ModuleCard';
import { colors, spacing } from '../theme/colors';
import type { MainTabParamList, AppStackParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<AppStackParamList>
>;

type ChartTab = 'stock' | 'purchases' | 'sales' | 'margin';

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAppSelector((s) => s.auth);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartTab, setChartTab] = useState<ChartTab>('stock');

  const load = async () => {
    try {
      setData(await fetchDashboard());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const formatCurrency = (v: string | number | undefined) =>
    `${Number(v || 0).toLocaleString('fr-FR')} XOF`;

  const overview = data?.stock_overview;
  const purchases = data?.purchases_summary;
  const orders = data?.customer_orders;
  const alerts = data?.alerts;
  const charts = data?.charts;

  const chartValues = (() => {
    if (!charts) return [0];
    if (chartTab === 'stock') return charts.stock_value.length ? charts.stock_value : [0];
    if (chartTab === 'purchases') return charts.purchases.length ? charts.purchases : [0];
    if (chartTab === 'sales') return charts.sales.length ? charts.sales : [0];
    return charts.margin.length ? charts.margin : [0];
  })();

  const chartLabels = (charts?.labels || []).map((l, i) => (i % 5 === 0 ? l : ''));

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.Content
          title="Inventra"
          titleStyle={styles.headerTitle}
          subtitle={user?.full_name || user?.email}
        />
        <IconButton icon="account-circle-outline" size={28} onPress={() => navigation.navigate('Profile')} />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
        >
          <Text variant="headlineSmall" style={styles.greeting}>
            Bonjour {user?.first_name || ''}
          </Text>
          <Text variant="bodyMedium" style={styles.subGreeting}>
            Tableau de bord — stock, ventes, achats et alertes
          </Text>

          <View style={styles.statsGrid}>
            <StatCard title="CA aujourd'hui" value={formatCurrency(data?.revenue_today)} icon="cash" />
            <StatCard title="CA du mois" value={formatCurrency(data?.revenue_month)} icon="chart-line" color={colors.secondary} />
            <StatCard title="Ventes du jour" value={data?.sales_count_today || 0} icon="receipt" color={colors.accent} />
            <StatCard title="Produits" value={data?.products_count || 0} icon="package-variant" color="#7B1FA2" />
          </View>

          {/* Achats / Ventes résumés */}
          <View style={styles.rowCards}>
            <Card style={styles.halfCard} onPress={() => navigation.navigate('Purchases')}>
              <Card.Content>
                <Text variant="labelLarge" style={styles.cardTitle}>Achats fournisseurs</Text>
                <Text variant="bodySmall">À valider : {purchases?.to_validate ?? 0}</Text>
                <Text variant="bodySmall">À réceptionner : {purchases?.to_receive ?? 0}</Text>
                <Text variant="bodySmall">Partiel : {purchases?.partial ?? 0}</Text>
                <Chip compact style={styles.chip}>{purchases?.suppliers_count ?? 0} fournisseurs</Chip>
              </Card.Content>
            </Card>
            <Card style={styles.halfCard} onPress={() => navigation.navigate('Reports')}>
              <Card.Content>
                <Text variant="labelLarge" style={styles.cardTitle}>Ventes clients</Text>
                <Text variant="bodySmall">Impayées : {orders?.awaiting_payment ?? 0}</Text>
                <Text variant="bodySmall">Partielles : {orders?.partial_payment ?? 0}</Text>
                <Text variant="bodySmall">Brouillons : {orders?.draft ?? 0}</Text>
                <Chip compact style={styles.chip}>{orders?.customers_count ?? 0} clients</Chip>
              </Card.Content>
            </Card>
          </View>

          {/* Vue globale stock */}
          <Card style={styles.overviewCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>Vue globale du stock</Text>
              <View style={styles.overviewGrid}>
                {[
                  { label: 'Valeur', value: formatCurrency(overview?.stock_value) },
                  { label: 'Qté', value: Number(overview?.stock_qty || 0).toLocaleString('fr-FR') },
                  { label: 'Âge (j)', value: overview?.stock_age_avg ?? 0 },
                  { label: 'Rotation', value: overview?.rotation ?? 0 },
                  { label: 'Boutiques', value: overview?.branches ?? 0 },
                  { label: 'Entrepôts', value: overview?.warehouses ?? 0 },
                  { label: 'Inventaires', value: overview?.inventories ?? 0 },
                  { label: 'Ruptures', value: overview?.out_of_stock ?? 0 },
                ].map((item) => (
                  <View key={item.label} style={styles.overviewItem}>
                    <Text variant="titleSmall" style={styles.overviewValue}>{item.value}</Text>
                    <Text variant="labelSmall" style={styles.muted}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <Button mode="text" onPress={() => navigation.navigate('Stock')}>Ouvrir le stock</Button>
            </Card.Content>
          </Card>

          {/* Alertes */}
          <View style={styles.alertRow}>
            <Card style={[styles.alertTile, { borderTopColor: colors.primary }]} onPress={() => navigation.navigate('Stock')}>
              <Card.Content>
                <Text variant="headlineSmall" style={styles.alertNum}>{alerts?.automatic ?? 0}</Text>
                <Text variant="labelSmall">Alertes</Text>
              </Card.Content>
            </Card>
            <Card style={[styles.alertTile, { borderTopColor: colors.warning }]} onPress={() => navigation.navigate('Stock')}>
              <Card.Content>
                <Text variant="headlineSmall" style={styles.alertNum}>{alerts?.untreated ?? 0}</Text>
                <Text variant="labelSmall">Non traités</Text>
              </Card.Content>
            </Card>
            <Card style={[styles.alertTile, { borderTopColor: '#F9A825' }]} onPress={() => navigation.navigate('Purchases')}>
              <Card.Content>
                <Text variant="headlineSmall" style={styles.alertNum}>{alerts?.to_restock ?? 0}</Text>
                <Text variant="labelSmall">Réappro</Text>
              </Card.Content>
            </Card>
            <Card style={[styles.alertTile, { borderTopColor: colors.error }]} onPress={() => navigation.navigate('Stock')}>
              <Card.Content>
                <Text variant="headlineSmall" style={[styles.alertNum, { color: colors.error }]}>{alerts?.negative ?? 0}</Text>
                <Text variant="labelSmall">Négatifs</Text>
              </Card.Content>
            </Card>
          </View>

          {/* Graphique */}
          {charts && (
            <Card style={styles.trendCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>Évolution (30 j)</Text>
                <SegmentedButtons
                  value={chartTab}
                  onValueChange={(v) => setChartTab(v as ChartTab)}
                  density="small"
                  style={styles.segment}
                  buttons={[
                    { value: 'stock', label: 'Stock' },
                    { value: 'purchases', label: 'Achats' },
                    { value: 'sales', label: 'Ventes' },
                    { value: 'margin', label: 'Marge' },
                  ]}
                />
                <LineChart
                  data={{
                    labels: chartLabels,
                    datasets: [{ data: chartValues }],
                  }}
                  width={Dimensions.get('window').width - spacing.md * 2 - spacing.md}
                  height={190}
                  chartConfig={{
                    backgroundGradientFrom: colors.surface,
                    backgroundGradientTo: colors.surface,
                    decimalPlaces: 0,
                    color: (o = 1) => `rgba(21, 101, 192, ${o})`,
                    labelColor: () => colors.textMuted,
                    propsForDots: { r: '2', strokeWidth: '1', stroke: colors.primary },
                    propsForBackgroundLines: { stroke: colors.border },
                    formatYLabel: (y: string) => {
                      const n = Number(y);
                      return n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`;
                    },
                  }}
                  bezier
                  fromZero
                  style={styles.trendChart}
                />
                <Button compact mode="text" onPress={() => navigation.navigate('Reports')}>Rapports détaillés</Button>
              </Card.Content>
            </Card>
          )}

          {/* Listes alertes */}
          {(data?.alert_lists?.to_restock?.length || 0) > 0 && (
            <Card style={styles.listCard}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.sectionTitle}>À réapprovisionner</Text>
                {data?.alert_lists?.to_restock.slice(0, 5).map((p) => (
                  <Text key={`${p.id}-${p.warehouse}`} variant="bodySmall" style={styles.listItem}>
                    • {p.name} — {p.quantity} (min {p.min_stock})
                  </Text>
                ))}
              </Card.Content>
            </Card>
          )}

          <Text variant="titleMedium" style={styles.sectionTitle}>Modules</Text>

          {hasModuleAccess(user?.permissions, 'sales') && (
            <ModuleCard title="Caisse POS" subtitle="Vendre et encaisser" icon="cash-register" color={colors.primary} onPress={() => navigation.navigate('Caisse')} />
          )}
          {hasModuleAccess(user?.permissions, 'products') && (
            <ModuleCard title="Produits" subtitle="Catalogue et prix" icon="package-variant" color={colors.secondary} onPress={() => navigation.navigate('Produits')} />
          )}
          {hasModuleAccess(user?.permissions, 'stock') && (
            <ModuleCard title="Stock" subtitle="Entrées, sorties, inventaire" icon="warehouse" color={colors.accent} onPress={() => navigation.navigate('Stock')} />
          )}
          {hasModuleAccess(user?.permissions, 'stock') && (
            <>
              <ModuleCard title="Sites" subtitle="Magasins, entrepôts, emplacements" icon="store-marker" color="#00695C" onPress={() => navigation.navigate('Sites')} />
              <ModuleCard title="Catégories & Tags" subtitle="Organisation du catalogue" icon="tag-multiple" color="#5D4037" onPress={() => navigation.navigate('Categories')} />
              <ModuleCard title="Scan" subtitle="Recherche par code-barres" icon="barcode-scan" color="#283593" onPress={() => navigation.navigate('Scan')} />
              <ModuleCard title="Étiquettes" subtitle="Aperçu et partage d'étiquettes" icon="label" color="#AD1457" onPress={() => navigation.navigate('Labels')} />
              <ModuleCard title="Traçabilité" subtitle="Lots et mouvements produit" icon="timeline-text" color="#4527A0" onPress={() => navigation.navigate('Traceability')} />
              <ModuleCard title="Requêtes stock" subtitle="Demandes inter-entrepôts" icon="swap-horizontal" color="#1565C0" onPress={() => navigation.navigate('StockRequests')} />
            </>
          )}
          <ModuleCard title="Clients" subtitle="CRM et fidélité" icon="account-group" color="#5E35B1" onPress={() => navigation.navigate('Customers')} />
          <ModuleCard title="Fournisseurs" subtitle="Gestion fournisseurs" icon="truck-delivery" color="#455A64" onPress={() => navigation.navigate('Suppliers')} />
          <ModuleCard title="Achats" subtitle="Commandes et réceptions" icon="cart-arrow-down" color="#6D4C41" onPress={() => navigation.navigate('Purchases')} />
          <ModuleCard title="Dépenses" subtitle="Charges et frais" icon="cash-minus" color={colors.error} onPress={() => navigation.navigate('Expenses')} />
          <ModuleCard title="Rapports" subtitle="Ventes et finance" icon="chart-bar" color="#0277BD" onPress={() => navigation.navigate('Reports')} />
          <ModuleCard title="Abonnement" subtitle="Pack, limites et upgrade" icon="crown" color="#F9A825" onPress={() => navigation.navigate('Subscription')} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  headerTitle: { fontWeight: '700', color: colors.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  loader: { marginTop: 48 },
  greeting: { fontWeight: '700', color: colors.text },
  subGreeting: { color: colors.textMuted, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  rowCards: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  halfCard: { flex: 1, backgroundColor: colors.surface },
  cardTitle: { fontWeight: '700', marginBottom: 6, color: colors.primary },
  chip: { alignSelf: 'flex-start', marginTop: 8 },
  overviewCard: { marginBottom: spacing.md, backgroundColor: '#EEF5FF' },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overviewItem: {
    width: '22%',
    minWidth: 70,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  overviewValue: { fontWeight: '800', color: colors.primary, textAlign: 'center' },
  muted: { color: colors.textMuted, textAlign: 'center' },
  alertRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  alertTile: { flex: 1, borderTopWidth: 3, backgroundColor: colors.surface },
  alertNum: { fontWeight: '800', color: colors.text },
  trendCard: { marginBottom: spacing.md, backgroundColor: colors.surface },
  segment: { marginBottom: spacing.sm },
  trendChart: { borderRadius: 12, marginLeft: -8 },
  listCard: { marginBottom: spacing.md, backgroundColor: colors.surface },
  listItem: { color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontWeight: '600', marginBottom: spacing.sm, color: colors.text },
});
