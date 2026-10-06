import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Chip,
  Menu,
  Searchbar,
  Text,
} from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import TabPill from '../components/TabPill';
import { fetchProducts, type Product } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';
import {
  cancelTransfer,
  fetchInventorySessions,
  fetchProductRankings,
  fetchStockAlerts,
  fetchStockDashboard,
  fetchStockListItems,
  fetchStockMovements,
  fetchStockTransfers,
  fetchWarehouses,
  INVENTORY_STATUS_LABELS,
  MOVEMENT_LABELS,
  receiveTransfer,
  shipTransfer,
  TRANSFER_STATUS_COLORS,
  TRANSFER_STATUS_LABELS,
  type InventorySession,
  type ProductRanking,
  type StockAlert,
  type StockDashboardData,
  type StockListItem,
  type StockMovementItem,
  type StockTransfer,
  type WarehouseItem,
} from '../api/stock';
import StockTransferDialog from '../components/StockTransferDialog';
import StockEntryExitDialog from '../components/StockEntryExitDialog';
import InventorySessionDialog from '../components/InventorySessionDialog';
import QuickStockEntry from '../components/QuickStockEntry';
import { colors, radius, spacing } from '../theme/colors';

type TabKey = 'stock' | 'movements' | 'transfers' | 'inventory' | 'alerts';

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'ok', label: 'OK' },
  { value: 'low', label: 'Faible' },
  { value: 'out_of_stock', label: 'Rupture' },
];

function statusColor(status: string) {
  if (status === 'out_of_stock') return '#B71C1C';
  if (status === 'low') return '#E65100';
  return '#2E7D32';
}

function statusLabel(status: string) {
  if (status === 'out_of_stock') return 'Rupture';
  if (status === 'low') return 'Faible';
  return 'OK';
}

export default function StockScreen() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [warehouse, setWarehouse] = useState<WarehouseItem | null>(null);
  const [warehouseMenuVisible, setWarehouseMenuVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('stock');

  const [dashboard, setDashboard] = useState<StockDashboardData | null>(null);
  const [rankings, setRankings] = useState<{ top_sold: ProductRanking[]; least_sold: ProductRanking[] } | null>(null);

  const [listItems, setListItems] = useState<StockListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [inventories, setInventories] = useState<InventorySession[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [transferActionId, setTransferActionId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [entryExit, setEntryExit] = useState<{ visible: boolean; mode: 'entry' | 'exit'; productId?: number }>({
    visible: false,
    mode: 'entry',
  });
  const [transferVisible, setTransferVisible] = useState(false);
  const [inventoryDialog, setInventoryDialog] = useState<{ visible: boolean; sessionId: number | null }>({ visible: false, sessionId: null });

  const loadDashboard = useCallback(async (warehouseId: number) => {
    try {
      setDashboard(await fetchStockDashboard(warehouseId));
    } catch {
      // ignore
    }
  }, []);

  const loadSections = useCallback(async (warehouseId: number) => {
    setSectionLoading(true);
    try {
      const [movementData, alertData, transferData, inventoryData] = await Promise.all([
        fetchStockMovements(warehouseId),
        fetchStockAlerts(warehouseId),
        fetchStockTransfers(warehouseId),
        fetchInventorySessions(warehouseId),
      ]);
      setMovements(movementData);
      setAlerts(alertData);
      setTransfers(transferData);
      setInventories(inventoryData);
    } finally {
      setSectionLoading(false);
    }
  }, []);

  const loadList = useCallback(async (warehouseId: number, q: string, status: string) => {
    setListLoading(true);
    try {
      const { results } = await fetchStockListItems({
        warehouse: warehouseId,
        search: q || undefined,
        status: status || undefined,
        page: 1,
        page_size: 100,
      });
      setListItems(results);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadAll = useCallback(async (warehouseId: number) => {
    await Promise.all([
      loadDashboard(warehouseId),
      loadSections(warehouseId),
      loadList(warehouseId, search, statusFilter),
    ]);
  }, [loadDashboard, loadSections, loadList, search, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const whs = await fetchWarehouses();
        if (cancelled) return;
        setWarehouses(whs);
        const selected = whs.find((w) => w.is_default) || whs[0] || null;
        setWarehouse(selected);
        setLoading(false);
        void fetchProducts().then((prods) => { if (!cancelled) setProducts(prods); });
        void fetchProductRankings().then((ranks) => { if (!cancelled) setRankings(ranks); });
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectWarehouse = (w: WarehouseItem) => {
    setWarehouse(w);
    setWarehouseMenuVisible(false);
  };

  const handleRefresh = async () => {
    if (!warehouse) return;
    setRefreshing(true);
    try {
      await loadAll(warehouse.id);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (v: string) => {
    setSearch(v);
  };

  useEffect(() => {
    if (!warehouse) return;
    void loadDashboard(warehouse.id);
    void loadSections(warehouse.id);
  }, [warehouse, loadDashboard, loadSections]);

  useEffect(() => {
    if (!warehouse) return;
    const t = setTimeout(() => {
      void loadList(warehouse.id, search, statusFilter);
    }, search ? 280 : 0);
    return () => clearTimeout(t);
  }, [search, warehouse, statusFilter, loadList]);

  const handleStatusFilter = (v: string) => {
    setStatusFilter(v);
    setActiveTab('stock');
  };

  const runTransferAction = async (id: number, action: 'ship' | 'receive' | 'cancel') => {
    if (!warehouse) return;
    setActionError(null);
    setTransferActionId(id);
    try {
      const fn = { ship: shipTransfer, receive: receiveTransfer, cancel: cancelTransfer }[action];
      await fn(id);
      await loadSections(warehouse.id);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    } finally {
      setTransferActionId(null);
    }
  };

  const openEntry = (productId?: number) => setEntryExit({ visible: true, mode: 'entry', productId });
  const openExit = (productId?: number) => setEntryExit({ visible: true, mode: 'exit', productId });

  const kpis = [
    { key: 'all', label: 'Produits', value: dashboard?.products_count ?? 0, status: '', color: colors.primary },
    { key: 'out', label: 'Ruptures', value: dashboard?.out_of_stock ?? 0, status: 'out_of_stock', color: '#C62828' },
    { key: 'low', label: 'Stock faible', value: dashboard?.low_stock ?? 0, status: 'low', color: colors.coral },
    { key: 'value', label: 'Valeur', value: `${Math.round(Number(dashboard?.stock_value || 0)).toLocaleString('fr-FR')} F`, status: null, color: '#2E7D32' },
  ];

  const listHeader = (
    <View>
      <QuickStockEntry
        warehouses={warehouses}
        products={products}
        defaultWarehouse={warehouse}
        onDone={() => { if (warehouse) loadAll(warehouse.id); }}
        onOpenAdvanced={(productId) => openEntry(productId)}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
        {kpis.map((kpi) => (
          <Pressable
            key={kpi.key}
            onPress={() => {
              if (kpi.status === null) return;
              void handleStatusFilter(kpi.status);
            }}
          >
            <Card style={styles.statCard}>
              <Card.Content>
                <Text variant="labelMedium" style={{ color: colors.textMuted }}>{kpi.label}</Text>
                <Text variant="titleMedium" style={[styles.statValue, { color: kpi.color }]}>{kpi.value}</Text>
              </Card.Content>
            </Card>
          </Pressable>
        ))}
      </ScrollView>

      {rankings && rankings.top_sold.length > 0 ? (
        <Card style={styles.rankCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.rankTitle}>Top ventes (90 j)</Text>
            {rankings.top_sold.slice(0, 3).map((p, i) => (
              <View key={p.product_id} style={styles.rankRow}>
                <Text variant="bodyMedium">{i + 1}. {p.name}</Text>
                <Text variant="bodySmall">{p.qty_sold} vendus</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      ) : null}

      <Searchbar
        placeholder="Rechercher un produit…"
        value={search}
        onChangeText={handleSearch}
        style={styles.search}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TabPill
            key={f.value}
            label={f.label}
            selected={statusFilter === f.value}
            onPress={() => handleStatusFilter(f.value)}
          />
        ))}
      </ScrollView>
      <Text style={styles.tip}>Astuce : « + Stock » sur une ligne ajoute ce produit.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.Content title="Gestion des stocks" subtitle="Ajoutez et suivez en quelques clics" />
      </AppHeader>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <>
          <View style={styles.toolbar}>
            <Menu
              visible={warehouseMenuVisible}
              onDismiss={() => setWarehouseMenuVisible(false)}
              anchor={
                <Button mode="outlined" icon="menu-down" onPress={() => setWarehouseMenuVisible(true)}>
                  {warehouse?.name || 'Entrepôt'}
                </Button>
              }
            >
              {warehouses.map((w) => (
                <Menu.Item key={w.id} title={`${w.name} (${w.branch_name})`} onPress={() => handleSelectWarehouse(w)} />
              ))}
            </Menu>

            <View style={styles.actions}>
              <Button mode="contained" icon="plus" compact buttonColor="#2E7D32" onPress={() => openEntry()}>
                Ajouter
              </Button>
              <Button mode="outlined" icon="minus" compact textColor={colors.error} onPress={() => openExit()}>
                Retirer
              </Button>
              <Button mode="outlined" icon="swap-horizontal" compact
                disabled={warehouses.length < 2} onPress={() => setTransferVisible(true)}>
                Transférer
              </Button>
              <Button mode="outlined" icon="clipboard-check-outline" compact
                disabled={!warehouse} onPress={() => setInventoryDialog({ visible: true, sessionId: null })}>
                Inventaire
              </Button>
            </View>
          </View>

          <View style={styles.tabsBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScroll}
              contentContainerStyle={styles.tabs}
            >
              <TabPill label="Mes stocks" selected={activeTab === 'stock'} onPress={() => setActiveTab('stock')} />
              <TabPill label={`Mouvements (${movements.length})`} selected={activeTab === 'movements'} onPress={() => setActiveTab('movements')} />
              <TabPill label={`Transferts (${transfers.length})`} selected={activeTab === 'transfers'} onPress={() => setActiveTab('transfers')} />
              <TabPill label={`Inventaires (${inventories.length})`} selected={activeTab === 'inventory'} onPress={() => setActiveTab('inventory')} />
              <TabPill label={`Alertes (${alerts.length})`} selected={activeTab === 'alerts'} onPress={() => setActiveTab('alerts')} />
            </ScrollView>
          </View>

          {actionError && (
            <Text style={styles.actionError} onPress={() => setActionError(null)}>{actionError}</Text>
          )}

          {activeTab === 'stock' && (
            <FlatList
              data={listItems}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={styles.list}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={
                listLoading ? <ActivityIndicator style={styles.loader} /> : <Text style={styles.empty}>Aucun produit trouvé</Text>
              }
              renderItem={({ item }) => (
                <Card style={styles.card}>
                  <Card.Content>
                    <View style={styles.row}>
                      <Text variant="titleMedium" style={styles.flexShrink}>{item.name}</Text>
                      <Text style={{ color: statusColor(item.status), fontWeight: '700' }}>{statusLabel(item.status)}</Text>
                    </View>
                    <Text variant="bodySmall" style={styles.meta}>
                      {item.sku ? `SKU ${item.sku}` : 'Sans SKU'} · {item.warehouse_name}
                    </Text>
                    <View style={styles.row}>
                      <Text>Stock {item.quantity}</Text>
                      <Text>Dispo {item.available_quantity}</Text>
                    </View>
                    <View style={styles.rowActions}>
                      <Button
                        mode="contained"
                        compact
                        buttonColor="#2E7D32"
                        onPress={() => openEntry(item.product_id)}
                      >
                        + Stock
                      </Button>
                      <Button mode="text" compact textColor={colors.error} onPress={() => openExit(item.product_id)}>
                        Retirer
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              )}
            />
          )}

          {activeTab === 'movements' && (
            <FlatList
              data={movements}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                sectionLoading ? <ActivityIndicator style={styles.loader} /> : <Text style={styles.empty}>Aucun mouvement</Text>
              }
              renderItem={({ item }) => (
                <Card style={styles.card}>
                  <Card.Content>
                    <View style={styles.row}>
                      <Text variant="titleSmall">{item.product_name}</Text>
                      <Text style={{ color: item.movement_type === 'in' ? '#2E7D32' : '#C62828', fontWeight: '700' }}>
                        {item.movement_type === 'in' ? '+' : '-'}{item.quantity}
                      </Text>
                    </View>
                    <Text variant="bodySmall">{MOVEMENT_LABELS[item.movement_type] || item.movement_type} · {item.reference || item.notes || 'Sans motif'} — {item.created_by}</Text>
                    <Text variant="bodySmall">{new Date(item.created_at).toLocaleString('fr-FR')}</Text>
                  </Card.Content>
                </Card>
              )}
            />
          )}

          {activeTab === 'transfers' && (
            <FlatList
              data={transfers}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                sectionLoading ? <ActivityIndicator style={styles.loader} /> : <Text style={styles.empty}>Aucun transfert</Text>
              }
              renderItem={({ item }) => {
                const busy = transferActionId === item.id;
                return (
                  <Card style={styles.card}>
                    <Card.Content>
                      <View style={styles.row}>
                        <Text variant="titleSmall" style={styles.flexShrink}>{item.from_warehouse} → {item.to_warehouse}</Text>
                        <Chip compact textStyle={styles.transferStatusText}
                          style={{ backgroundColor: TRANSFER_STATUS_COLORS[item.status] || colors.primary }}>
                          {TRANSFER_STATUS_LABELS[item.status] || item.status}
                        </Chip>
                      </View>
                      <Text variant="bodySmall">{item.items.map((it) => `${it.product_name} (${it.quantity})`).join(', ')}</Text>
                      <Text variant="bodySmall">{item.created_by} — {new Date(item.created_at).toLocaleString('fr-FR')}</Text>
                      <View style={styles.transferActions}>
                        {item.status === 'pending' && (
                          <Button mode="outlined" compact icon="truck-delivery-outline" loading={busy} disabled={busy}
                            onPress={() => runTransferAction(item.id, 'ship')}>
                            Expédier
                          </Button>
                        )}
                        {(item.status === 'shipped' || item.status === 'in_transit') && (
                          <Button mode="outlined" compact icon="check-circle-outline" loading={busy} disabled={busy}
                            textColor="#2E7D32" onPress={() => runTransferAction(item.id, 'receive')}>
                            Recevoir
                          </Button>
                        )}
                        {['pending', 'shipped', 'in_transit'].includes(item.status) && (
                          <Button mode="text" compact icon="cancel" loading={busy} disabled={busy}
                            textColor="#C62828" onPress={() => runTransferAction(item.id, 'cancel')}>
                            Annuler
                          </Button>
                        )}
                      </View>
                    </Card.Content>
                  </Card>
                );
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <FlatList
              data={inventories}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <Button mode="contained-tonal" icon="plus" style={styles.newInventoryBtn}
                  onPress={() => setInventoryDialog({ visible: true, sessionId: null })}>
                  Nouvelle session d'inventaire
                </Button>
              }
              ListEmptyComponent={
                sectionLoading ? <ActivityIndicator style={styles.loader} /> : <Text style={styles.empty}>Aucune session d'inventaire</Text>
              }
              renderItem={({ item }) => (
                <Card style={styles.card} onPress={() => setInventoryDialog({ visible: true, sessionId: item.id })}>
                  <Card.Content>
                    <View style={styles.row}>
                      <Text variant="titleSmall">{item.warehouse_name}</Text>
                      <Chip compact>{INVENTORY_STATUS_LABELS[item.status] || item.status}</Chip>
                    </View>
                    <Text variant="bodySmall">{item.counted_count}/{item.items_count} article(s) compté(s)</Text>
                    <Text variant="bodySmall">{item.created_by} — {new Date(item.created_at).toLocaleString('fr-FR')}</Text>
                    {item.notes ? <Text variant="bodySmall">Note : {item.notes}</Text> : null}
                  </Card.Content>
                </Card>
              )}
            />
          )}

          {activeTab === 'alerts' && (
            <FlatList
              data={alerts}
              keyExtractor={(_, i) => i.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                sectionLoading ? <ActivityIndicator style={styles.loader} /> : <Text style={styles.empty}>Aucune alerte — tout est en ordre</Text>
              }
              renderItem={({ item }) => (
                <Card style={[styles.card, { borderLeftWidth: 4, borderLeftColor: item.severity === 'error' ? '#B71C1C' : item.severity === 'warning' ? '#E65100' : '#0D9488' }]}>
                  <Card.Content>
                    <Text variant="bodyMedium">{item.message}</Text>
                  </Card.Content>
                </Card>
              )}
            />
          )}
        </>
      )}

      <StockEntryExitDialog
        visible={entryExit.visible}
        mode={entryExit.mode}
        warehouses={warehouses}
        products={products}
        defaultWarehouse={warehouse}
        defaultProductId={entryExit.productId}
        onDismiss={() => setEntryExit((e) => ({ ...e, visible: false }))}
        onDone={() => {
          setEntryExit((e) => ({ ...e, visible: false }));
          if (warehouse) loadAll(warehouse.id);
          Alert.alert('Succès', entryExit.mode === 'entry' ? 'Stock ajouté.' : 'Stock retiré.');
        }}
      />

      <StockTransferDialog
        visible={transferVisible}
        warehouses={warehouses}
        products={products}
        defaultFrom={warehouse}
        onDismiss={() => setTransferVisible(false)}
        onDone={() => {
          setTransferVisible(false);
          if (warehouse) loadAll(warehouse.id);
          Alert.alert('Succès', 'Transfert créé.');
        }}
      />

      <InventorySessionDialog
        visible={inventoryDialog.visible}
        warehouses={warehouses}
        defaultWarehouse={warehouse}
        sessionId={inventoryDialog.sessionId}
        onDismiss={() => setInventoryDialog({ visible: false, sessionId: null })}
        onDone={() => {
          setInventoryDialog({ visible: false, sessionId: null });
          if (warehouse) loadAll(warehouse.id);
          Alert.alert('Succès', 'Inventaire validé.');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: 48 },
  toolbar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 8, gap: 10 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statsRow: { paddingHorizontal: 0, gap: 8, paddingBottom: 8, alignItems: 'center' },
  statCard: { minWidth: 118, borderRadius: radius.md },
  statValue: { fontWeight: '800' },
  tabsBar: { height: 40, justifyContent: 'center' },
  tabsScroll: { flexGrow: 0 },
  tabs: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 32,
  },
  filterRow: { gap: 6, paddingBottom: 4, alignItems: 'center', height: 32 },
  search: { marginBottom: 8 },
  tip: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  actionError: { color: '#C62828', paddingHorizontal: 16, paddingBottom: 4 },
  list: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  card: { marginBottom: 10, borderRadius: radius.md },
  rankCard: { marginBottom: 12, borderRadius: radius.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  rowActions: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  flexShrink: { flexShrink: 1, fontWeight: '700' },
  meta: { color: colors.textMuted, marginTop: 4 },
  rankTitle: { marginBottom: 8, color: colors.primary, fontWeight: '700' },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  empty: { textAlign: 'center', color: '#666', marginTop: 24 },
  transferStatusText: { color: '#FFF', fontWeight: '600' },
  transferActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  newInventoryBtn: { marginBottom: 12 },
});
