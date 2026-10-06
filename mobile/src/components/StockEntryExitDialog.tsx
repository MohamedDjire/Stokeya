import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, Divider, HelperText, Menu, Portal, Text, TextInput } from 'react-native-paper';
import { EXIT_REASONS, stockEntry, stockExit, type WarehouseItem } from '../api/stock';
import type { Product } from '../api/auth';
import { fetchSuppliers, type Supplier } from '../api/suppliers';
import { getApiErrorMessage } from '../api/errors';
import ProductPicker from './ProductPicker';

const emptyForm = {
  product_id: 0,
  product_name: '',
  warehouse_id: 0,
  quantity: '1',
  notes: '',
  reference: '',
  supplier_id: 0,
  supplier_name: '',
  cost_price: '',
  invoice_number: '',
  batch_number: '',
  expiry_date: '',
  reason: '',
};

export default function StockEntryExitDialog({
  visible,
  mode,
  warehouses,
  products,
  defaultWarehouse,
  defaultProductId,
  onDismiss,
  onDone,
}: {
  visible: boolean;
  mode: 'entry' | 'exit';
  warehouses: WarehouseItem[];
  products: Product[];
  defaultWarehouse: WarehouseItem | null;
  defaultProductId?: number;
  onDismiss: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [warehouseMenu, setWarehouseMenu] = useState(false);
  const [supplierMenu, setSupplierMenu] = useState(false);
  const [reasonMenu, setReasonMenu] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (visible) {
      const selected = products.find((p) => p.id === defaultProductId);
      setForm({
        ...emptyForm,
        warehouse_id: defaultWarehouse?.id || 0,
        product_id: selected?.id || 0,
        product_name: selected?.name || '',
      });
      setError(null);
      setShowMore(false);
      if (mode === 'entry') {
        fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
      }
    }
  }, [visible, mode, defaultWarehouse, defaultProductId, products]);

  const submit = async () => {
    setError(null);
    if (!form.warehouse_id || !form.product_id || !form.quantity) {
      setError('Entrepôt, produit et quantité sont obligatoires.');
      return;
    }
    if (mode === 'exit' && !form.reason) {
      setError('Le motif de sortie est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'entry') {
        await stockEntry({
          product_id: form.product_id,
          warehouse_id: form.warehouse_id,
          quantity: form.quantity,
          notes: form.notes || undefined,
          reference: form.reference || undefined,
          supplier_id: form.supplier_id || undefined,
          cost_price: form.cost_price || undefined,
          invoice_number: form.invoice_number || undefined,
          batch_number: form.batch_number || undefined,
          expiry_date: form.expiry_date || undefined,
        });
      } else {
        await stockExit({
          product_id: form.product_id,
          warehouse_id: form.warehouse_id,
          quantity: form.quantity,
          reason: form.reason,
          notes: form.notes || undefined,
          reference: form.reference || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const reasonLabel = EXIT_REASONS.find((r) => r.value === form.reason)?.label || '';
  const isEntry = mode === 'entry';

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{isEntry ? 'Ajouter du stock' : 'Retirer du stock'}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodySmall" style={styles.intro}>
              {isEntry
                ? 'Choisissez le produit, l’entrepôt et la quantité à ajouter.'
                : 'Indiquez le produit, la quantité et le motif du retrait.'}
            </Text>
            {error && <HelperText type="error" visible>{error}</HelperText>}

            <Button
              mode="outlined"
              icon="magnify"
              onPress={() => setPickerOpen(true)}
              style={styles.input}
              contentStyle={styles.productBtn}
            >
              {form.product_name || 'Choisir un produit'}
            </Button>

            <Menu
              visible={warehouseMenu}
              onDismiss={() => setWarehouseMenu(false)}
              anchor={
                <TextInput
                  label="Entrepôt"
                  mode="outlined"
                  value={warehouses.find((w) => w.id === form.warehouse_id)?.name || ''}
                  editable={false}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setWarehouseMenu(true)} />}
                  onPressIn={() => setWarehouseMenu(true)}
                  style={styles.input}
                />
              }
            >
              {warehouses.map((w) => (
                <Menu.Item
                  key={w.id}
                  title={`${w.name} (${w.branch_name})`}
                  onPress={() => { setForm((f) => ({ ...f, warehouse_id: w.id })); setWarehouseMenu(false); }}
                />
              ))}
            </Menu>

            <TextInput
              label="Quantité"
              mode="outlined"
              keyboardType="decimal-pad"
              value={form.quantity}
              onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
              style={styles.input}
            />

            {!isEntry && (
              <Menu
                visible={reasonMenu}
                onDismiss={() => setReasonMenu(false)}
                anchor={
                  <TextInput
                    label="Motif"
                    mode="outlined"
                    value={reasonLabel}
                    editable={false}
                    right={<TextInput.Icon icon="menu-down" onPress={() => setReasonMenu(true)} />}
                    onPressIn={() => setReasonMenu(true)}
                    style={styles.input}
                  />
                }
              >
                {EXIT_REASONS.map((r) => (
                  <Menu.Item
                    key={r.value}
                    title={r.label}
                    onPress={() => { setForm((f) => ({ ...f, reason: r.value })); setReasonMenu(false); }}
                  />
                ))}
              </Menu>
            )}

            <Button compact mode="text" onPress={() => setShowMore((v) => !v)} style={styles.more}>
              {showMore ? 'Masquer les options' : 'Plus d’options (fournisseur, lot…)'}
            </Button>

            {showMore && (
              <>
                {isEntry && (
                  <>
                    <Divider style={styles.divider} />
                    <Menu
                      visible={supplierMenu}
                      onDismiss={() => setSupplierMenu(false)}
                      anchor={
                        <TextInput
                          label="Fournisseur (optionnel)"
                          mode="outlined"
                          value={form.supplier_name}
                          editable={false}
                          right={<TextInput.Icon icon="menu-down" onPress={() => setSupplierMenu(true)} />}
                          onPressIn={() => setSupplierMenu(true)}
                          style={styles.input}
                        />
                      }
                    >
                      <Menu.Item title="—" onPress={() => { setForm((f) => ({ ...f, supplier_id: 0, supplier_name: '' })); setSupplierMenu(false); }} />
                      {suppliers.map((s) => (
                        <Menu.Item
                          key={s.id}
                          title={s.name}
                          onPress={() => { setForm((f) => ({ ...f, supplier_id: s.id, supplier_name: s.name })); setSupplierMenu(false); }}
                        />
                      ))}
                    </Menu>
                    <TextInput label="Prix d'achat" mode="outlined" keyboardType="decimal-pad" value={form.cost_price}
                      onChangeText={(v) => setForm((f) => ({ ...f, cost_price: v }))} style={styles.input} />
                    <TextInput label="N° facture" mode="outlined" value={form.invoice_number}
                      onChangeText={(v) => setForm((f) => ({ ...f, invoice_number: v }))} style={styles.input} />
                    <TextInput label="N° lot" mode="outlined" value={form.batch_number}
                      onChangeText={(v) => setForm((f) => ({ ...f, batch_number: v }))} style={styles.input} />
                    <TextInput label="Date d'expiration (AAAA-MM-JJ)" mode="outlined" placeholder="2026-12-31"
                      value={form.expiry_date} onChangeText={(v) => setForm((f) => ({ ...f, expiry_date: v }))} style={styles.input} />
                  </>
                )}
                <TextInput label="Référence (optionnel)" mode="outlined" value={form.reference}
                  onChangeText={(v) => setForm((f) => ({ ...f, reference: v }))} style={styles.input} />
                <TextInput label="Note (optionnel)" mode="outlined" value={form.notes} multiline
                  onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} style={styles.input} />
              </>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Annuler</Button>
          <Button
            mode="contained"
            loading={saving}
            onPress={() => void submit()}
            buttonColor={isEntry ? '#2E7D32' : undefined}
          >
            {isEntry ? 'Ajouter' : 'Retirer'}
          </Button>
        </Dialog.Actions>
      </Dialog>

      <ProductPicker
        visible={pickerOpen}
        products={products}
        onSelect={(p) => setForm((f) => ({ ...f, product_id: p.id, product_name: p.name }))}
        onDismiss={() => setPickerOpen(false)}
      />
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '88%' },
  content: { paddingHorizontal: 24, paddingVertical: 8 },
  intro: { color: '#64748B', marginBottom: 8 },
  input: { marginBottom: 10 },
  productBtn: { justifyContent: 'flex-start' },
  more: { alignSelf: 'flex-start', marginBottom: 4 },
  divider: { marginVertical: 12 },
});
