import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  Divider,
  HelperText,
  IconButton,
  Menu,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { stockAdjust, type StockStatusItem, type WarehouseItem } from '../api/stock';
import type { Product } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';

interface Line {
  product_id: number;
  product_name: string;
  expected_quantity: string;
  actual_quantity: string;
}

export default function StockAdjustDialog({
  visible,
  warehouse,
  products,
  currentStock,
  onDismiss,
  onDone,
}: {
  visible: boolean;
  warehouse: WarehouseItem | null;
  products: Product[];
  currentStock: StockStatusItem[];
  onDismiss: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([
    { product_id: 0, product_name: '', expected_quantity: '0', actual_quantity: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [productMenu, setProductMenu] = useState<number | null>(null);

  const addLine = () =>
    setLines([...lines, { product_id: 0, product_name: '', expected_quantity: '0', actual_quantity: '' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const selectProduct = (i: number, product: Product) => {
    const st = currentStock.find((s) => s.product_id === product.id);
    setLine(i, {
      product_id: product.id,
      product_name: product.name,
      expected_quantity: st ? st.quantity : '0',
    });
    setProductMenu(null);
  };

  const reset = () => {
    setLines([{ product_id: 0, product_name: '', expected_quantity: '0', actual_quantity: '' }]);
    setReason('');
    setNotes('');
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product_id && l.actual_quantity !== '');
    if (!warehouse || !reason || valid.length === 0) {
      setError('Indiquez un motif et au moins un produit avec la quantité réelle.');
      return;
    }
    setSaving(true);
    try {
      await stockAdjust({
        warehouse_id: warehouse.id,
        reason,
        notes,
        items: valid.map((l) => ({
          product_id: l.product_id,
          expected_quantity: l.expected_quantity || '0',
          actual_quantity: l.actual_quantity,
        })),
      });
      reset();
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Ajustement d'inventaire</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            {error && <HelperText type="error" visible>{error}</HelperText>}

            <TextInput label="Motif" mode="outlined" value={reason} onChangeText={setReason}
              placeholder="Inventaire physique, casse, péremption…" style={styles.input} />

            <Divider style={styles.divider} />
            <Text variant="labelLarge" style={styles.sectionLabel}>Articles</Text>

            {lines.map((line, i) => (
              <View key={i} style={styles.lineWrap}>
                <View style={styles.line}>
                  <View style={styles.lineProduct}>
                    <Menu
                      visible={productMenu === i}
                      onDismiss={() => setProductMenu(null)}
                      anchor={
                        <TextInput label="Produit" mode="outlined" dense value={line.product_name} editable={false}
                          right={<TextInput.Icon icon="menu-down" onPress={() => setProductMenu(i)} />}
                          onPressIn={() => setProductMenu(i)} />
                      }
                    >
                      {products.map((p) => (
                        <Menu.Item key={p.id} title={p.name} onPress={() => selectProduct(i, p)} />
                      ))}
                    </Menu>
                  </View>
                  <IconButton icon="delete-outline" size={20} onPress={() => removeLine(i)} />
                </View>
                <View style={styles.qtyRow}>
                  <TextInput label="Théorique" mode="outlined" dense value={line.expected_quantity}
                    editable={false} style={styles.qtyInput} />
                  <TextInput label="Réel" mode="outlined" dense keyboardType="decimal-pad"
                    value={line.actual_quantity} onChangeText={(v) => setLine(i, { actual_quantity: v })}
                    style={styles.qtyInput} />
                </View>
              </View>
            ))}

            <Button icon="plus" onPress={addLine} style={styles.addBtn}>Ajouter un article</Button>

            <TextInput label="Note (optionnel)" mode="outlined" value={notes} onChangeText={setNotes} style={styles.input} />
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Annuler</Button>
          <Button mode="contained" loading={saving} onPress={submit}>Valider</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '85%' },
  content: { paddingHorizontal: 24, paddingVertical: 8 },
  input: { marginBottom: 10 },
  divider: { marginVertical: 12 },
  sectionLabel: { marginBottom: 8 },
  lineWrap: { marginBottom: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineProduct: { flex: 1 },
  qtyRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  qtyInput: { flex: 1 },
  addBtn: { alignSelf: 'flex-start', marginBottom: 8 },
});
