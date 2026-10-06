import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Menu, Text, TextInput } from 'react-native-paper';
import { stockEntry, type WarehouseItem } from '../api/stock';
import type { Product } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';
import ProductPicker from './ProductPicker';
import { colors, radius, spacing } from '../theme/colors';

export default function QuickStockEntry({
  warehouses,
  products,
  defaultWarehouse,
  onDone,
  onOpenAdvanced,
}: {
  warehouses: WarehouseItem[];
  products: Product[];
  defaultWarehouse: WarehouseItem | null;
  onDone: () => void;
  onOpenAdvanced: (productId?: number) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [warehouse, setWarehouse] = useState<WarehouseItem | null>(defaultWarehouse);
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [whMenu, setWhMenu] = useState(false);

  useEffect(() => {
    if (defaultWarehouse) setWarehouse(defaultWarehouse);
  }, [defaultWarehouse]);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!product || !warehouse || !quantity || Number(quantity) <= 0) {
      setError('Choisissez un produit, un entrepôt et une quantité.');
      return;
    }
    setSaving(true);
    try {
      await stockEntry({
        product_id: product.id,
        warehouse_id: warehouse.id,
        quantity,
      });
      setSuccess(`${quantity} ajouté(s) à « ${product.name} ».`);
      setProduct(null);
      setQuantity('1');
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="titleMedium" style={styles.title}>Ajouter du stock</Text>
          <Text variant="bodySmall" style={styles.hint}>
            Produit + quantité + entrepôt — c’est tout.
          </Text>
        </View>
        <Button compact mode="text" icon="tune" onPress={() => onOpenAdvanced(product?.id)}>
          Plus
        </Button>
      </View>

      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      {success ? <HelperText type="info" visible style={styles.ok}>{success}</HelperText> : null}

      <Button
        mode="outlined"
        icon="magnify"
        onPress={() => setPickerOpen(true)}
        style={styles.field}
        contentStyle={styles.productBtn}
      >
        {product ? product.name : 'Choisir un produit'}
      </Button>

      <Menu
        visible={whMenu}
        onDismiss={() => setWhMenu(false)}
        anchor={
          <Button mode="outlined" icon="warehouse" onPress={() => setWhMenu(true)} style={styles.field}>
            {warehouse ? warehouse.name : 'Entrepôt'}
          </Button>
        }
      >
        {warehouses.map((w) => (
          <Menu.Item
            key={w.id}
            title={`${w.name} — ${w.branch_name}`}
            onPress={() => { setWarehouse(w); setWhMenu(false); }}
          />
        ))}
      </Menu>

      <View style={styles.row}>
        <TextInput
          label="Quantité"
          mode="outlined"
          keyboardType="number-pad"
          value={quantity}
          onChangeText={setQuantity}
          style={styles.qty}
        />
        <Button
          mode="contained"
          icon="plus"
          loading={saving}
          disabled={saving}
          onPress={() => void submit()}
          style={styles.addBtn}
          contentStyle={styles.addBtnContent}
          buttonColor="#2E7D32"
        >
          Ajouter
        </Button>
      </View>

      <ProductPicker
        visible={pickerOpen}
        products={products}
        onSelect={setProduct}
        onDismiss={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#F0FDFA',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  headerText: { flex: 1, paddingRight: 8 },
  title: { fontWeight: '800', color: colors.secondary },
  hint: { color: colors.textMuted, marginTop: 2 },
  ok: { color: '#2E7D32' },
  field: { marginBottom: 8, borderRadius: radius.md },
  productBtn: { justifyContent: 'flex-start' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  qty: { flex: 1, backgroundColor: colors.surface },
  addBtn: { borderRadius: radius.md, marginTop: 6 },
  addBtnContent: { height: 48, paddingHorizontal: 12 },
});
