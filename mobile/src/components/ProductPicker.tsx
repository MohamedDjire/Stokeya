import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import type { Product } from '../api/auth';
import { colors, radius, spacing } from '../theme/colors';

export default function ProductPicker({
  visible,
  products,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  products: Product[];
  onSelect: (product: Product) => void;
  onDismiss: () => void;
}) {
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (!q) return sorted;
    return sorted.filter((p) =>
      p.name.toLowerCase().includes(q)
      || (p.sku || '').toLowerCase().includes(q)
      || (p.barcodes || []).some((b) => (b.code || '').toLowerCase().includes(q)),
    );
  }, [products, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={styles.title}>Choisir un produit</Text>
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Text style={styles.close}>Fermer</Text>
          </Pressable>
        </View>
        <Searchbar
          placeholder="Nom, SKU ou code-barres…"
          value={query}
          onChangeText={setQuery}
          autoFocus
          style={styles.search}
        />
        <FlatList
          data={options}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aucun produit</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                onSelect(item);
                setQuery('');
                onDismiss();
              }}
            >
              <Text variant="titleSmall" style={styles.name}>{item.name}</Text>
              <Text variant="bodySmall" style={styles.meta}>
                {item.sku ? `SKU ${item.sku}` : 'Sans SKU'}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontWeight: '800', color: colors.secondary },
  close: { color: colors.primary, fontWeight: '700' },
  search: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
});
