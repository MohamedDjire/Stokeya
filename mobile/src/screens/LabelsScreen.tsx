import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Share, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, Searchbar, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { fetchProducts, type Product } from '../api/auth';
import { colors, spacing } from '../theme/colors';

function buildLabelText(products: Product[]): string {
  return products.map((p) => {
    const barcode = p.barcodes?.find((b) => b.is_primary)?.code || p.barcodes?.[0]?.code || '—';
    return [
      '─────────────────────',
      p.name,
      `SKU: ${p.sku || '—'}`,
      `Code: ${barcode}`,
      `Prix: ${Number(p.sale_price).toLocaleString('fr-FR')} XOF`,
      '─────────────────────',
    ].join('\n');
  }).join('\n\n');
}

export default function LabelsScreen() {
  const navigation = useNavigation();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search]);

  const selectedProducts = products.filter((p) => selected.has(p.id));
  const preview = buildLabelText(selectedProducts);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShare = async () => {
    if (!selectedProducts.length) {
      Alert.alert('Sélection vide', 'Choisissez au moins un produit.');
      return;
    }
    try {
      await Share.share({ message: preview, title: 'Étiquettes produits' });
    } catch {
      Alert.alert('Erreur', 'Partage impossible.');
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Étiquettes" subtitle={`${selected.size} sélectionné(s)`} />
      </Appbar.Header>

      <Searchbar placeholder="Filtrer produits..." value={search} onChangeText={setSearch} style={styles.search} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          selected.size > 0 ? (
            <Card style={styles.previewCard}>
              <Card.Title title="Aperçu étiquettes" subtitle="Texte sélectionnable — partagez ou copiez" />
              <Card.Content>
                <Text selectable style={styles.preview}>{preview}</Text>
                <Button mode="contained" icon="share-variant" onPress={handleShare} style={styles.shareBtn}>
                  Partager la liste
                </Button>
              </Card.Content>
            </Card>
          ) : null
        }
        renderItem={({ item }) => {
          const barcode = item.barcodes?.find((b) => b.is_primary)?.code || item.barcodes?.[0]?.code;
          return (
            <Card style={styles.card} onPress={() => toggle(item.id)}>
              <Card.Content style={styles.row}>
                <Checkbox status={selected.has(item.id) ? 'checked' : 'unchecked'} onPress={() => toggle(item.id)} />
                <View style={styles.rowText}>
                  <Text variant="titleSmall">{item.name}</Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    {item.sku || '—'} · {barcode || 'Sans code'}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Chargement...' : 'Aucun produit'}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  search: { margin: spacing.md },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  previewCard: { marginBottom: spacing.md, backgroundColor: '#FFFDE7' },
  preview: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18, color: colors.text },
  shareBtn: { marginTop: spacing.md },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1 },
  meta: { color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
});
