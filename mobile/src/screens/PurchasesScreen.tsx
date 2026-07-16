import { useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { fetchProducts } from '../api/auth';
import { fetchPurchaseOrders, createPurchaseOrder, receivePurchaseOrder } from '../api/purchases';
import { fetchSuppliers } from '../api/suppliers';
import { fetchWarehouses } from '../api/stock';
import { colors, spacing } from '../theme/colors';

export default function PurchasesScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchPurchaseOrders>>>([]);
  const [suppliers, setSuppliers] = useState<Awaited<ReturnType<typeof fetchSuppliers>>>([]);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof fetchProducts>>>([]);
  const [warehouses, setWarehouses] = useState<Awaited<ReturnType<typeof fetchWarehouses>>>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [o, s, p, w] = await Promise.all([
      fetchPurchaseOrders(), fetchSuppliers(), fetchProducts(), fetchWarehouses(),
    ]);
    setOrders(o);
    setSuppliers(s);
    setProducts(p);
    setWarehouses(w);
    if (!supplierId && s[0]) setSupplierId(s[0].id);
    if (!productId && p[0]) setProductId(p[0].id);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!supplierId || !productId) return;
    try {
      await createPurchaseOrder({
        supplier_id: supplierId,
        items: [{ product_id: productId, quantity }],
      });
      await load();
      Alert.alert('OK', 'Commande créée.');
    } catch {
      Alert.alert('Erreur', 'Commande impossible.');
    }
  };

  const handleReceive = async (orderId: number, items: typeof orders[0]['items']) => {
    const wh = warehouses.find((w) => w.is_default) || warehouses[0];
    if (!wh) return;
    try {
      await receivePurchaseOrder(orderId, {
        warehouse_id: wh.id,
        items: items.map((i) => ({
          order_item_id: i.id,
          quantity_received: String(Number(i.quantity) - Number(i.quantity_received)),
        })),
      });
      await load();
      Alert.alert('OK', 'Marchandises réceptionnées, stock mis à jour.');
    } catch {
      Alert.alert('Erreur', 'Réception impossible.');
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Achats" subtitle="Commandes fournisseurs" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Title title="Nouvelle commande" />
          <Card.Content>
            <Text variant="bodySmall">Fournisseur ID: {supplierId} · Produit ID: {productId}</Text>
            <TextInput label="Quantité" mode="outlined" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={styles.input} />
            <Button mode="contained" onPress={handleCreate}>Commander</Button>
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.section}>Commandes ({orders.length})</Text>
        {orders.map((order) => (
          <Card key={order.id} style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall">{order.reference} — {order.supplier_name}</Text>
              <Text variant="bodySmall">{order.status} · {Number(order.total).toLocaleString('fr-FR')} XOF</Text>
              {order.status !== 'received' && order.status !== 'cancelled' && (
                <Button mode="outlined" onPress={() => handleReceive(order.id, order.items)} style={{ marginTop: 8 }}>
                  Réceptionner
                </Button>
              )}
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  content: { padding: spacing.md },
  card: { marginBottom: spacing.md },
  input: { marginVertical: spacing.sm },
  section: { marginBottom: spacing.sm, fontWeight: '600' },
});
