import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Chip,
  Dialog,
  Menu,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { fetchProducts, type Product } from '../api/auth';
import {
  fetchProductRankings,
  fetchStockAlerts,
  fetchStockMovements,
  fetchStockStats,
  fetchStockStatus,
  fetchStockTransfers,
  fetchWarehouses,
  MOVEMENT_LABELS,
  stockEntry,
  stockExit,
  type ProductRanking,
  type StockAlert,
  type StockMovementItem,
  type StockStats,
  type StockStatusItem,
  type StockTransfer,
  type WarehouseItem,
} from '../api/stock';
import StockTransferDialog from '../components/StockTransferDialog';
import StockAdjustDialog from '../components/StockAdjustDialog';
import { colors } from '../theme/colors';

type TabKey = 'stock' | 'history' | 'transfers' | 'alerts';

const ENTRY_REASONS = ['Achat fournisseur', 'Retour client', 'Transfert entrepôt', 'Autre'];
const EXIT_REASONS = ['Vente', 'Perte/Casse', 'Transfert', 'Autre'];

export default function StockScreen() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [warehouse, setWarehouse] = useState<WarehouseItem | null>(null);
  const [warehouseMenuVisible, setWarehouseMenuVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('stock');
  const [stockItems, setStockItems] = useState<StockStatusItem[]>([]);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [rankings, setRankings] = useState<{ top_sold: ProductRanking[]; least_sold: ProductRanking[] } | null>(null);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'entry' | 'exit'>('entry');
  const [transferVisible, setTransferVisible] = useState(false);
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: 0,
    product_name: '',
    quantity: '1',
    reference: '',
    notes: '',
  });
  const [productMenuVisible, setProductMenuVisible] = useState(false);

  const loadData = useCallback(async (warehouseId: number) => {
    const [statusData, movementData, statsData, productData, alertData, transferData, rankingData] =
      await Promise.all([
        fetchStockStatus(warehouseId),
        fetchStockMovements(warehouseId),
        fetchStockStats(warehouseId),
        fetchProducts(),
        fetchStockAlerts(warehouseId),
        fetchStockTransfers(warehouseId),
        fetchProductRankings(),
      ]);
    setStockItems(statusData);
    setMovements(movementData);
    setStats(statsData);
    setProducts(productData);
    setAlerts(alertData);
    setTransfers(transferData);
    setRankings(rankingData);
  }, []);

  useEffect(() => {
    fetchWarehouses()
      .then((data) => {
        setWarehouses(data);
        const selected = data.find((w) => w.is_default) || data[0] || null;
        setWarehouse(selected);
        if (selected) {
          return loadData(selected.id);
        }
      })
      .finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    if (!warehouse) return;
    setRefreshing(true);
    try {
      await loadData(warehouse.id);
    } finally {
      setRefreshing(false);
    }
  };

  const openModal = (type: 'entry' | 'exit') => {
    setModalType(type);
    setForm({
      product_id: products[0]?.id || 0,
      product_name: products[0]?.name || '',
      quantity: '1',
      reference: type === 'entry' ? ENTRY_REASONS[0] : EXIT_REASONS[0],
      notes: '',
    });
    setModalVisible(true);
  };

  const handleSaveMovement = async () => {
    if (!warehouse || !form.product_id || !form.quantity) {
      Alert.alert('Champs requis', 'Produit et quantité sont obligatoires.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        product_id: form.product_id,
        warehouse_id: warehouse.id,
        quantity: form.quantity,
        reference: form.reference,
        notes: form.notes,
      };
      if (modalType === 'entry') {
        await stockEntry(payload);
      } else {
        await stockExit(payload);
      }
      setModalVisible(false);
      await loadData(warehouse.id);
      Alert.alert('Succès', modalType === 'entry' ? 'Entrée enregistrée.' : 'Sortie enregistrée.');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail || 'Opération impossible';
      Alert.alert('Erreur', message);
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'out_of_stock' || status === 'Rupture') return '#B71C1C';
    if (status === 'low' || status === 'Stock bas') return '#E65100';
    return '#2E7D32';
  };

  const statusLabel = (status: string) => {
    if (status === 'out_of_stock' || status === 'Rupture') return 'Rupture';
    if (status === 'low' || status === 'Stock bas') return 'Stock bas';
    return 'OK';
  };

  return (
    <View style={styles.container}>
      <Appbar.Header elevated style={{ backgroundColor: '#FFFFFF' }}>
        <Appbar.Content title="Gestion du stock" subtitle={warehouse?.name || ''} />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <>
          <View style={styles.toolbar}>
            <Menu
              visible={warehouseMenuVisible}
              onDismiss={() => setWarehouseMenuVisible(false)}
              anchor={
                <Button mode="outlined" onPress={() => setWarehouseMenuVisible(true)}>
                  {warehouse?.name || 'Entrepôt'}
                </Button>
              }
            >
              {warehouses.map((w) => (
                <Menu.Item
                  key={w.id}
                  title={`${w.name} (${w.branch_name})`}
                  onPress={() => {
                    setWarehouse(w);
                    setWarehouseMenuVisible(false);
                    loadData(w.id);
                  }}
                />
              ))}
            </Menu>

            <View style={styles.actions}>
              <Button mode="contained" icon="plus" compact onPress={() => openModal('entry')}>
                Entrée
              </Button>
              <Button mode="outlined" icon="minus" compact onPress={() => openModal('exit')}>
                Sortie
              </Button>
              <Button mode="outlined" icon="swap-horizontal" compact
                disabled={warehouses.length < 2} onPress={() => setTransferVisible(true)}>
                Transfert
              </Button>
              <Button mode="outlined" icon="clipboard-check-outline" compact
                disabled={!warehouse} onPress={() => setAdjustVisible(true)}>
                Inventaire
              </Button>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
            <Card style={styles.statCard}><Card.Content><Text variant="labelMedium">Valeur stock</Text><Text variant="titleMedium" style={styles.statValue}>{Math.round(Number(stats?.stock_value || 0)).toLocaleString('fr-FR')}</Text></Card.Content></Card>
            <Card style={styles.statCard}><Card.Content><Text variant="labelMedium">Produits</Text><Text variant="titleMedium" style={styles.statValue}>{stats?.total_products || 0}</Text></Card.Content></Card>
            <Card style={styles.statCard}><Card.Content><Text variant="labelMedium">En stock</Text><Text variant="titleMedium" style={styles.statValue}>{stats?.in_stock || 0}</Text></Card.Content></Card>
            <Card style={styles.statCard}><Card.Content><Text variant="labelMedium">Ruptures</Text><Text variant="titleMedium" style={[styles.statValue, { color: '#B71C1C' }]}>{stats?.out_of_stock || 0}</Text></Card.Content></Card>
            <Card style={styles.statCard}><Card.Content><Text variant="labelMedium">Stock bas</Text><Text variant="titleMedium" style={[styles.statValue, { color: '#E65100' }]}>{stats?.low_stock || 0}</Text></Card.Content></Card>
            <Card style={styles.statCard}><Card.Content><Text variant="labelMedium">Entrées mois</Text><Text variant="titleMedium" style={styles.statValue}>{stats?.entries_month || 0}</Text></Card.Content></Card>
            <Card style={styles.statCard}><Card.Content><Text variant="labelMedium">Sorties mois</Text><Text variant="titleMedium" style={styles.statValue}>{stats?.exits_month || 0}</Text></Card.Content></Card>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            <Chip selected={activeTab === 'stock'} onPress={() => setActiveTab('stock')} style={styles.tabChip}>Stock</Chip>
            <Chip selected={activeTab === 'history'} onPress={() => setActiveTab('history')} style={styles.tabChip}>Mouvements</Chip>
            <Chip selected={activeTab === 'transfers'} onPress={() => setActiveTab('transfers')} style={styles.tabChip}>Transferts ({transfers.length})</Chip>
            <Chip selected={activeTab === 'alerts'} onPress={() => setActiveTab('alerts')} style={styles.tabChip}>Alertes ({alerts.length})</Chip>
          </ScrollView>

          {activeTab === 'stock' && (
            <FlatList
              data={stockItems}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                rankings && (rankings.top_sold.length > 0 || rankings.least_sold.length > 0) ? (
                  <Card style={styles.card}>
                    <Card.Content>
                      <Text variant="titleSmall" style={styles.rankTitle}>Top ventes (90j)</Text>
                      {rankings.top_sold.slice(0, 3).map((p, i) => (
                        <View key={p.product_id} style={styles.rankRow}>
                          <Text variant="bodyMedium">{i + 1}. {p.name}</Text>
                          <Text variant="bodySmall">{p.qty_sold} vendus</Text>
                        </View>
                      ))}
                      {rankings.top_sold.length === 0 && (
                        <Text variant="bodySmall" style={styles.empty}>Pas encore de ventes</Text>
                      )}
                    </Card.Content>
                  </Card>
                ) : null
              }
              ListEmptyComponent={<Text style={styles.empty}>Aucun produit en stock</Text>}
              renderItem={({ item }) => (
                <Card style={styles.card}>
                  <Card.Content>
                    <Text variant="titleMedium">{item.name}</Text>
                    <Text variant="bodySmall">SKU: {item.sku || '-'}</Text>
                    <View style={styles.row}>
                      <Text>Stock: {item.quantity}</Text>
                      <Text>Seuil: {item.min_stock}</Text>
                      <Text style={{ color: statusColor(item.status), fontWeight: '600' }}>{statusLabel(item.status)}</Text>
                    </View>
                  </Card.Content>
                </Card>
              )}
            />
          )}

          {activeTab === 'history' && (
            <FlatList
              data={movements}
              keyExtractor={(item) => item.id.toString()}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>Aucun mouvement</Text>}
              renderItem={({ item }) => (
                <Card style={styles.card}>
                  <Card.Content>
                    <View style={styles.row}>
                      <Text variant="titleSmall">{item.product_name}</Text>
                      <Text style={{ color: item.movement_type === 'in' ? '#2E7D32' : '#C62828' }}>
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
              ListEmptyComponent={<Text style={styles.empty}>Aucun transfert</Text>}
              renderItem={({ item }) => (
                <Card style={styles.card}>
                  <Card.Content>
                    <View style={styles.row}>
                      <Text variant="titleSmall">{item.from_warehouse} → {item.to_warehouse}</Text>
                      <Text variant="bodySmall">{item.items_count} article(s)</Text>
                    </View>
                    <Text variant="bodySmall">{item.items.map((it) => `${it.product_name} (${it.quantity})`).join(', ')}</Text>
                    <Text variant="bodySmall">{item.created_by} — {new Date(item.created_at).toLocaleString('fr-FR')}</Text>
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
              ListEmptyComponent={<Text style={styles.empty}>Aucune alerte — tout est en ordre</Text>}
              renderItem={({ item }) => (
                <Card style={[styles.card, { borderLeftWidth: 4, borderLeftColor: item.severity === 'error' ? '#B71C1C' : item.severity === 'warning' ? '#E65100' : '#1565C0' }]}>
                  <Card.Content>
                    <Text variant="bodyMedium">{item.message}</Text>
                  </Card.Content>
                </Card>
              )}
            />
          )}
        </>
      )}

      <Portal>
        <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)}>
          <Dialog.Title>{modalType === 'entry' ? 'Entrée de stock' : 'Sortie de stock'}</Dialog.Title>
          <Dialog.Content>
            <Menu
              visible={productMenuVisible}
              onDismiss={() => setProductMenuVisible(false)}
              anchor={
                <TextInput
                  label="Produit"
                  mode="outlined"
                  value={form.product_name}
                  editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setProductMenuVisible(true)} />}
                  onPressIn={() => setProductMenuVisible(true)}
                  style={styles.input}
                />
              }
            >
              {products.map((p) => (
                <Menu.Item
                  key={p.id}
                  title={p.name}
                  onPress={() => {
                    setForm((prev) => ({ ...prev, product_id: p.id, product_name: p.name }));
                    setProductMenuVisible(false);
                  }}
                />
              ))}
            </Menu>

            <TextInput
              label="Quantité"
              mode="outlined"
              keyboardType="decimal-pad"
              value={form.quantity}
              onChangeText={(v) => setForm((prev) => ({ ...prev, quantity: v }))}
              style={styles.input}
            />

            <TextInput
              label="Motif"
              mode="outlined"
              value={form.reference}
              onChangeText={(v) => setForm((prev) => ({ ...prev, reference: v }))}
              style={styles.input}
            />

            <TextInput
              label="Notes"
              mode="outlined"
              value={form.notes}
              onChangeText={(v) => setForm((prev) => ({ ...prev, notes: v }))}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setModalVisible(false)}>Annuler</Button>
            <Button loading={saving} onPress={handleSaveMovement}>
              Valider
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <StockTransferDialog
        visible={transferVisible}
        warehouses={warehouses}
        products={products}
        defaultFrom={warehouse}
        onDismiss={() => setTransferVisible(false)}
        onDone={() => {
          setTransferVisible(false);
          if (warehouse) loadData(warehouse.id);
          Alert.alert('Succès', 'Transfert effectué.');
        }}
      />

      <StockAdjustDialog
        visible={adjustVisible}
        warehouse={warehouse}
        products={products}
        currentStock={stockItems}
        onDismiss={() => setAdjustVisible(false)}
        onDone={() => {
          setAdjustVisible(false);
          if (warehouse) loadData(warehouse.id);
          Alert.alert('Succès', 'Inventaire ajusté.');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loader: { marginTop: 48 },
  toolbar: { padding: 16, gap: 12 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  statCard: { minWidth: 120 },
  statValue: { fontWeight: '700', flexWrap: 'wrap' },
  tabs: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tabChip: { marginRight: 4 },
  list: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  rankTitle: { marginBottom: 8, color: '#1565C0' },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  empty: { textAlign: 'center', color: '#666', marginTop: 24 },
  input: { marginBottom: 8 },
});
