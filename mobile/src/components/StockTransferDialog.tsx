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
import { stockTransfer, type WarehouseItem } from '../api/stock';
import type { Product } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';

interface Line {
  product_id: number;
  product_name: string;
  quantity: string;
}

export default function StockTransferDialog({
  visible,
  warehouses,
  products,
  defaultFrom,
  onDismiss,
  onDone,
}: {
  visible: boolean;
  warehouses: WarehouseItem[];
  products: Product[];
  defaultFrom: WarehouseItem | null;
  onDismiss: () => void;
  onDone: () => void;
}) {
  const [from, setFrom] = useState<WarehouseItem | null>(defaultFrom);
  const [to, setTo] = useState<WarehouseItem | null>(null);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ product_id: 0, product_name: '', quantity: '1' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fromMenu, setFromMenu] = useState(false);
  const [toMenu, setToMenu] = useState(false);
  const [productMenu, setProductMenu] = useState<number | null>(null);

  const addLine = () => setLines([...lines, { product_id: 0, product_name: '', quantity: '1' }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const reset = () => {
    setLines([{ product_id: 0, product_name: '', quantity: '1' }]);
    setNotes('');
    setTo(null);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const valid = lines.filter((l) => l.product_id && l.quantity);
    if (!from || !to || from.id === to.id || valid.length === 0) {
      setError('Choisissez deux entrepôts différents et au moins un produit.');
      return;
    }
    setSaving(true);
    try {
      await stockTransfer({
        from_warehouse_id: from.id,
        to_warehouse_id: to.id,
        notes,
        items: valid.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
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
        <Dialog.Title>Transfert entre entrepôts</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            {error && <HelperText type="error" visible>{error}</HelperText>}

            <Menu
              visible={fromMenu}
              onDismiss={() => setFromMenu(false)}
              anchor={
                <TextInput label="Depuis" mode="outlined" value={from?.name || ''} editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setFromMenu(true)} />}
                  onPressIn={() => setFromMenu(true)} style={styles.input} />
              }
            >
              {warehouses.map((w) => (
                <Menu.Item key={w.id} title={`${w.name} (${w.branch_name})`}
                  onPress={() => { setFrom(w); setFromMenu(false); }} />
              ))}
            </Menu>

            <Menu
              visible={toMenu}
              onDismiss={() => setToMenu(false)}
              anchor={
                <TextInput label="Vers" mode="outlined" value={to?.name || ''} editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setToMenu(true)} />}
                  onPressIn={() => setToMenu(true)} style={styles.input} />
              }
            >
              {warehouses.filter((w) => w.id !== from?.id).map((w) => (
                <Menu.Item key={w.id} title={`${w.name} (${w.branch_name})`}
                  onPress={() => { setTo(w); setToMenu(false); }} />
              ))}
            </Menu>

            <Divider style={styles.divider} />
            <Text variant="labelLarge" style={styles.sectionLabel}>Articles</Text>

            {lines.map((line, i) => (
              <View key={i} style={styles.line}>
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
                      <Menu.Item key={p.id} title={p.name}
                        onPress={() => { setLine(i, { product_id: p.id, product_name: p.name }); setProductMenu(null); }} />
                    ))}
                  </Menu>
                </View>
                <TextInput label="Qté" mode="outlined" dense keyboardType="decimal-pad" value={line.quantity}
                  onChangeText={(v) => setLine(i, { quantity: v })} style={styles.lineQty} />
                <IconButton icon="delete-outline" size={20} onPress={() => removeLine(i)} />
              </View>
            ))}

            <Button icon="plus" onPress={addLine} style={styles.addBtn}>Ajouter un article</Button>

            <TextInput label="Note (optionnel)" mode="outlined" value={notes} onChangeText={setNotes} style={styles.input} />
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Annuler</Button>
          <Button mode="contained" loading={saving} onPress={submit}>Transférer</Button>
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
  line: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  lineProduct: { flex: 2 },
  lineQty: { flex: 1 },
  addBtn: { alignSelf: 'flex-start', marginBottom: 8 },
});
