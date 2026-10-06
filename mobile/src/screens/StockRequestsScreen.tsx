import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Chip, Searchbar, Text, TextInput } from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import { fetchProducts } from '../api/auth';
import { fetchWarehousesList } from '../api/sites';
import {
  approveStockRequest,
  cancelStockRequest,
  createStockRequest,
  fetchStockRequests,
  fulfillStockRequest,
  rejectStockRequest,
  type StockRequest,
} from '../api/stockRequests';
import { colors, spacing } from '../theme/colors';

const STATUS_COLORS: Record<string, string> = {
  draft: colors.textMuted,
  pending: colors.warning,
  approved: colors.primary,
  rejected: colors.error,
  fulfilled: colors.success,
  cancelled: colors.textMuted,
};

export default function StockRequestsScreen() {
  const navigation = useNavigation();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [warehouses, setWarehouses] = useState<Awaited<ReturnType<typeof fetchWarehousesList>>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof fetchProducts>>>([]);
  const [toWarehouse, setToWarehouse] = useState<number | null>(null);
  const [fromWarehouse, setFromWarehouse] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const load = useCallback(async (q?: string) => {
    setRequests(await fetchStockRequests(q));
  }, []);

  useEffect(() => {
    Promise.all([load(), fetchWarehousesList(), fetchProducts()])
      .then(([, wh, prods]) => {
        setWarehouses(wh);
        setProducts(prods);
        setToWarehouse(wh[0]?.id || null);
        setFromWarehouse(wh.find((w) => !w.is_default)?.id || wh[0]?.id || null);
        setProductId(prods[0]?.id || null);
      })
      .finally(() => setLoading(false));
  }, [load]);

  const handleSearch = async (v: string) => {
    setSearch(v);
    await load(v.trim() || undefined);
  };

  const handleCreate = async () => {
    if (!toWarehouse || !productId) return;
    setSaving(true);
    try {
      await createStockRequest({
        to_warehouse: toWarehouse,
        from_warehouse: fromWarehouse,
        notes: notes.trim() || undefined,
        items: [{ product: productId, quantity }],
      });
      setNotes('');
      setQuantity('1');
      setShowForm(false);
      await load(search.trim() || undefined);
      Alert.alert('OK', 'Requête créée.');
    } catch {
      Alert.alert('Erreur', 'Création impossible.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: number, action: 'approve' | 'reject' | 'fulfill' | 'cancel') => {
    setActionId(id);
    try {
      const fn = {
        approve: approveStockRequest,
        reject: rejectStockRequest,
        fulfill: fulfillStockRequest,
        cancel: cancelStockRequest,
      }[action];
      await fn(id);
      await load(search.trim() || undefined);
    } catch {
      Alert.alert('Erreur', 'Action impossible.');
    } finally {
      setActionId(null);
    }
  };

  const renderActions = (req: StockRequest) => {
    const busy = actionId === req.id;
    const actions: Array<{ label: string; mode: 'contained' | 'outlined'; action: 'approve' | 'reject' | 'fulfill' | 'cancel' }> = [];

    if (req.status === 'pending' || req.status === 'draft') {
      actions.push({ label: 'Approuver', mode: 'contained', action: 'approve' });
      actions.push({ label: 'Rejeter', mode: 'outlined', action: 'reject' });
    }
    if (req.status === 'approved' || req.status === 'pending') {
      actions.push({ label: 'Servir', mode: 'contained', action: 'fulfill' });
    }
    if (req.status !== 'fulfilled' && req.status !== 'cancelled') {
      actions.push({ label: 'Annuler', mode: 'outlined', action: 'cancel' });
    }

    if (!actions.length) return null;

    return (
      <View style={styles.actions}>
        {actions.map((a) => (
          <Button
            key={a.action}
            mode={a.mode}
            compact
            loading={busy}
            onPress={() => runAction(req.id, a.action)}
            style={styles.actionBtn}
          >
            {a.label}
          </Button>
        ))}
      </View>
    );
  };

  const listHeader = showForm ? (
    <Card style={styles.formCard}>
      <Card.Title title="Nouvelle requête de stock" />
      <Card.Content>
        <Text variant="bodySmall" style={styles.meta}>
          Destination : entrepôt {toWarehouse ?? '—'} · Source : {fromWarehouse ?? '—'}
        </Text>
        <Text variant="bodySmall" style={styles.meta}>Produit ID : {productId ?? '—'}</Text>
        <TextInput label="Quantité" mode="outlined" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={styles.input} />
        <TextInput label="Notes" mode="outlined" value={notes} onChangeText={setNotes} multiline style={styles.input} />
        <Button mode="contained" onPress={handleCreate} loading={saving}>Créer la requête</Button>
      </Card.Content>
    </Card>
  ) : null;

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Requêtes de stock" subtitle={`${requests.length} requête(s)`} />
        <Appbar.Action icon="plus" onPress={() => setShowForm(!showForm)} />
      </AppHeader>

      <Searchbar placeholder="Rechercher..." value={search} onChangeText={handleSearch} style={styles.search} />

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search.trim() || undefined)} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">{item.reference}</Text>
                <Chip compact textStyle={{ color: '#FFF' }} style={{ backgroundColor: STATUS_COLORS[item.status] || colors.primary }}>
                  {item.status_display}
                </Chip>
              </View>
              <Text variant="bodySmall" style={styles.meta}>
                {item.from_warehouse_name || '—'} → {item.to_warehouse_name}
              </Text>
              <Text variant="bodySmall" style={styles.meta}>
                Par {item.requested_by_name || '—'} · {new Date(item.created_at).toLocaleDateString('fr-FR')}
              </Text>
              {item.items.map((line) => (
                <Text key={line.id} variant="bodySmall" style={styles.itemLine}>
                  • {line.product_name} — {Number(line.quantity).toLocaleString('fr-FR')}
                  {Number(line.quantity_fulfilled) > 0 ? ` (servi ${line.quantity_fulfilled})` : ''}
                </Text>
              ))}
              {item.notes ? <Text variant="bodySmall" style={styles.meta}>Note : {item.notes}</Text> : null}
              {renderActions(item)}
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune requête</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  search: { margin: spacing.md },
  list: { padding: spacing.md, paddingTop: 0 },
  formCard: { marginBottom: spacing.md },
  input: { marginVertical: spacing.sm },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  meta: { color: colors.textMuted, marginTop: 4 },
  itemLine: { color: colors.text, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
});
