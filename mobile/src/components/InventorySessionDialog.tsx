import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Dialog, HelperText, Menu, Portal, Text, TextInput } from 'react-native-paper';
import {
  createInventorySession,
  fetchInventorySession,
  fetchStockStatus,
  INVENTORY_STATUS_LABELS,
  patchInventoryCount,
  validateInventorySession,
  type InventorySession,
  type InventorySessionItem,
  type WarehouseItem,
} from '../api/stock';
import { getApiErrorMessage } from '../api/errors';

export default function InventorySessionDialog({
  visible,
  warehouses,
  defaultWarehouse,
  sessionId,
  onDismiss,
  onDone,
}: {
  visible: boolean;
  warehouses: WarehouseItem[];
  defaultWarehouse: WarehouseItem | null;
  sessionId: number | null;
  onDismiss: () => void;
  onDone: () => void;
}) {
  const [warehouse, setWarehouse] = useState<WarehouseItem | null>(defaultWarehouse);
  const [warehouseMenu, setWarehouseMenu] = useState(false);
  const [notes, setNotes] = useState('');
  const [session, setSession] = useState<InventorySession | null>(null);
  const [items, setItems] = useState<InventorySessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = async (s: InventorySession) => {
    if (s.items && s.items.length) {
      setItems(s.items);
      return;
    }
    const status = await fetchStockStatus(s.warehouse);
    setItems(status.map((st) => ({
      id: st.id,
      product_id: st.product_id,
      product_name: st.name,
      sku: st.sku,
      expected_quantity: st.quantity,
      counted_quantity: null,
    })));
  };

  useEffect(() => {
    if (!visible) {
      setSession(null);
      setItems([]);
      setError(null);
      setNotes('');
      return;
    }
    setWarehouse(defaultWarehouse);
    if (sessionId) {
      setLoading(true);
      fetchInventorySession(sessionId)
        .then(async (s) => {
          setSession(s);
          await loadItems(s);
        })
        .catch((err) => setError(getApiErrorMessage(err)))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sessionId]);

  const start = async () => {
    setError(null);
    if (!warehouse) {
      setError('Choisissez un entrepôt.');
      return;
    }
    setSaving(true);
    try {
      const s = await createInventorySession({ warehouse_id: warehouse.id, notes: notes || undefined });
      setSession(s);
      await loadItems(s);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setCounted = (productId: number, value: string) => {
    setItems((prev) => prev.map((it) => (it.product_id === productId ? { ...it, counted_quantity: value } : it)));
  };

  const persistCounts = async () => {
    if (!session) return;
    const toSave = items.filter((it) => it.counted_quantity !== null && it.counted_quantity !== '');
    if (!toSave.length) return;
    await patchInventoryCount(session.id, {
      items: toSave.map((it) => ({ product_id: it.product_id, counted_quantity: it.counted_quantity as string })),
    });
  };

  const handleSaveCounts = async () => {
    setError(null);
    setSaving(true);
    try {
      await persistCounts();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!session) return;
    setError(null);
    setSaving(true);
    try {
      await persistCounts();
      await validateInventorySession(session.id);
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const readOnly = session ? !['draft', 'in_progress'].includes(session.status) : false;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>
          Session d'inventaire{session ? ` — ${INVENTORY_STATUS_LABELS[session.status] || session.status}` : ''}
        </Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            {loading ? (
              <ActivityIndicator style={styles.loader} />
            ) : !session ? (
              <>
                {error && <HelperText type="error" visible>{error}</HelperText>}
                <Menu
                  visible={warehouseMenu}
                  onDismiss={() => setWarehouseMenu(false)}
                  anchor={
                    <TextInput label="Entrepôt" mode="outlined" value={warehouse?.name || ''} editable={false}
                      right={<TextInput.Icon icon="menu-down" onPress={() => setWarehouseMenu(true)} />}
                      onPressIn={() => setWarehouseMenu(true)} style={styles.input} />
                  }
                >
                  {warehouses.map((w) => (
                    <Menu.Item key={w.id} title={`${w.name} (${w.branch_name})`}
                      onPress={() => { setWarehouse(w); setWarehouseMenu(false); }} />
                  ))}
                </Menu>
                <TextInput label="Note (optionnel)" mode="outlined" multiline value={notes}
                  onChangeText={setNotes} style={styles.input} />
                <Text variant="bodySmall" style={styles.hint}>
                  Une nouvelle session sera créée avec le stock théorique actuel de l'entrepôt. Vous pourrez
                  ensuite saisir les quantités comptées physiquement.
                </Text>
              </>
            ) : (
              <>
                {error && <HelperText type="error" visible>{error}</HelperText>}
                {readOnly && (
                  <Text variant="bodySmall" style={styles.readOnlyBanner}>
                    Cette session est {INVENTORY_STATUS_LABELS[session.status]?.toLowerCase() || session.status} — lecture seule.
                  </Text>
                )}
                {items.map((it) => {
                  const diff = it.counted_quantity !== null && it.counted_quantity !== ''
                    ? Number(it.counted_quantity) - Number(it.expected_quantity)
                    : null;
                  return (
                    <View key={it.product_id} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text variant="bodyMedium" numberOfLines={1} style={styles.itemName}>{it.product_name}</Text>
                        <Text variant="bodySmall" style={styles.hint}>{it.sku} · Théorique: {it.expected_quantity}</Text>
                      </View>
                      <TextInput
                        mode="outlined"
                        dense
                        keyboardType="decimal-pad"
                        placeholder="Compté"
                        value={it.counted_quantity ?? ''}
                        editable={!readOnly}
                        onChangeText={(v) => setCounted(it.product_id, v)}
                        style={styles.countInput}
                      />
                      {diff !== null && (
                        <Chip compact style={[styles.diffChip, { backgroundColor: diff === 0 ? '#E8F5E9' : '#FFF3E0' }]}>
                          {diff === 0 ? 'OK' : diff > 0 ? `+${diff}` : diff}
                        </Chip>
                      )}
                    </View>
                  );
                })}
                {items.length === 0 && (
                  <Text variant="bodySmall" style={styles.hint}>Aucun produit en stock dans cet entrepôt.</Text>
                )}
              </>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Fermer</Button>
          {!session && <Button mode="contained" loading={saving} onPress={start}>Démarrer</Button>}
          {session && !readOnly && (
            <>
              <Button loading={saving} onPress={handleSaveCounts}>Enregistrer</Button>
              <Button mode="contained" loading={saving} onPress={handleValidate}>Valider</Button>
            </>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '85%' },
  content: { paddingHorizontal: 24, paddingVertical: 8 },
  input: { marginBottom: 10 },
  hint: { color: '#6B7280' },
  loader: { marginVertical: 24 },
  readOnlyBanner: { color: '#0D9488', marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  itemInfo: { flex: 2 },
  itemName: { fontWeight: '600' },
  countInput: { flex: 1 },
  diffChip: { minWidth: 44 },
});
