import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Card, Chip, Menu, Text } from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import TabPill from '../components/TabPill';
import { useNavigation } from '@react-navigation/native';
import {
  fetchShopOrders,
  SHOP_ORDER_STATUS_COLORS,
  SHOP_ORDER_STATUS_LABELS,
  SHOP_ORDER_STATUS_OPTIONS,
  updateShopOrderStatus,
  type ShopOrder,
} from '../api/shop';
import { getApiErrorMessage } from '../api/errors';
import { colors, spacing } from '../theme/colors';

export default function ShopOrdersScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [menuOrderId, setMenuOrderId] = useState<number | null>(null);

  const load = useCallback(async (status?: string) => {
    try {
      setOrders(await fetchShopOrders(status ? { status } : undefined));
    } catch (err) {
      Alert.alert('Erreur', getApiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(statusFilter || undefined).finally(() => setLoading(false));
  }, [statusFilter, load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(statusFilter || undefined);
    setRefreshing(false);
  };

  const changeStatus = async (id: number, status: string) => {
    setMenuOrderId(null);
    setSavingId(id);
    try {
      await updateShopOrderStatus(id, status);
      await load(statusFilter || undefined);
    } catch (err) {
      Alert.alert('Erreur', getApiErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Commandes boutique" subtitle={`${orders.length} commande(s)`} />
      </AppHeader>

      <View style={styles.filtersBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filters}
        >
          <TabPill label="Toutes" selected={!statusFilter} onPress={() => setStatusFilter('')} />
          {SHOP_ORDER_STATUS_OPTIONS.map(([value, label]) => (
            <TabPill
              key={value}
              label={label}
              selected={statusFilter === value}
              onPress={() => setStatusFilter(value)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aucune commande</Text>}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium">{item.reference}</Text>
                  <Menu
                    visible={menuOrderId === item.id}
                    onDismiss={() => setMenuOrderId(null)}
                    anchor={
                      <Chip
                        compact
                        disabled={savingId === item.id}
                        icon={savingId === item.id ? 'loading' : undefined}
                        onPress={() => setMenuOrderId(item.id)}
                        style={[styles.statusChip, { backgroundColor: SHOP_ORDER_STATUS_COLORS[item.status] || colors.primary }]}
                        textStyle={styles.statusChipText}
                      >
                        {SHOP_ORDER_STATUS_LABELS[item.status] || item.status}
                      </Chip>
                    }
                  >
                    {SHOP_ORDER_STATUS_OPTIONS.map(([value, label]) => (
                      <Menu.Item key={value} title={label} onPress={() => changeStatus(item.id, value)} />
                    ))}
                  </Menu>
                </View>
                <Text variant="bodyMedium" style={styles.customer}>{item.customer_name} · {item.customer_phone}</Text>
                <Text variant="bodySmall" style={styles.meta}>
                  {item.branch_name || 'Boutique'} · {item.items_count} article(s) · {item.delivery_method === 'delivery' ? 'Livraison' : 'Retrait'}
                </Text>
                {item.customer_address ? (
                  <Text variant="bodySmall" style={styles.meta}>{item.customer_address}</Text>
                ) : null}
                {item.notes ? <Text variant="bodySmall" style={styles.meta}>Note : {item.notes}</Text> : null}
                <View style={styles.rowBetween}>
                  <Text variant="bodySmall" style={styles.meta}>
                    {new Date(item.created_at).toLocaleString('fr-FR')}
                  </Text>
                  <Text variant="titleSmall" style={styles.total}>
                    {Number(item.total || 0).toLocaleString('fr-FR')} XOF
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  filtersBar: { height: 40, justifyContent: 'center' },
  filtersScroll: { flexGrow: 0 },
  filters: { alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 32 },
  loader: { marginTop: 48 },
  list: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  statusChip: { alignSelf: 'flex-start' },
  statusChipText: { color: '#FFF', fontWeight: '600' },
  customer: { marginTop: 4, fontWeight: '600', color: colors.text },
  meta: { color: colors.textMuted, marginTop: 2 },
  total: { color: colors.primary, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
});
