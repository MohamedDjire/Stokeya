import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Searchbar, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { fetchProducts, type Product } from '../api/auth';
import { fetchProductTraceability, type ProductTraceability } from '../api/products';
import { MOVEMENT_LABELS } from '../api/stock';
import { colors, spacing } from '../theme/colors';

export default function TraceabilityScreen() {
  const navigation = useNavigation();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trace, setTrace] = useState<ProductTraceability | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts().then(setProducts);
  }, []);

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const loadTrace = async (productId: number) => {
    setSelectedId(productId);
    setLoading(true);
    setTrace(null);
    try {
      setTrace(await fetchProductTraceability(productId));
    } catch {
      Alert.alert('Erreur', 'Traçabilité indisponible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Traçabilité" subtitle="Niveaux, lots et mouvements" />
      </Appbar.Header>

      <Searchbar placeholder="Rechercher un produit..." value={search} onChangeText={setSearch} style={styles.search} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleSmall" style={styles.section}>Produits</Text>
        {filtered.slice(0, 20).map((p) => (
          <Card
            key={p.id}
            style={[styles.card, selectedId === p.id && styles.selected]}
            onPress={() => loadTrace(p.id)}
          >
            <Card.Content>
              <Text variant="titleSmall">{p.name}</Text>
              <Text variant="bodySmall" style={styles.meta}>{p.sku || '—'}</Text>
            </Card.Content>
          </Card>
        ))}

        {loading && <Text style={styles.meta}>Chargement...</Text>}

        {trace && (
          <>
            <Text variant="titleMedium" style={styles.section}>
              {trace.product.name}
            </Text>

            <Text variant="titleSmall" style={styles.section}>Niveaux de stock</Text>
            {trace.stock_levels.length === 0 ? (
              <Text style={styles.meta}>Aucun niveau enregistré</Text>
            ) : (
              trace.stock_levels.map((level) => (
                <Card key={level.warehouse_id} style={styles.card}>
                  <Card.Content>
                    <Text variant="titleSmall">{level.warehouse_name}</Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {level.branch_name} · Qté {Number(level.quantity).toLocaleString('fr-FR')}
                    </Text>
                  </Card.Content>
                </Card>
              ))
            )}

            <Text variant="titleSmall" style={styles.section}>Lots</Text>
            {trace.batches.length === 0 ? (
              <Text style={styles.meta}>Aucun lot</Text>
            ) : (
              trace.batches.map((batch) => (
                <Card key={batch.id} style={styles.card}>
                  <Card.Content>
                    <Text variant="titleSmall">{batch.batch_number}</Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      Qté {Number(batch.quantity).toLocaleString('fr-FR')}
                      {batch.expiry_date ? ` · Exp. ${batch.expiry_date}` : ''}
                    </Text>
                  </Card.Content>
                </Card>
              ))
            )}

            <Text variant="titleSmall" style={styles.section}>Mouvements récents</Text>
            {trace.movements.length === 0 ? (
              <Text style={styles.meta}>Aucun mouvement</Text>
            ) : (
              trace.movements.slice(0, 15).map((m) => (
                <Card key={m.id} style={styles.card}>
                  <Card.Content>
                    <Text variant="titleSmall">
                      {MOVEMENT_LABELS[m.movement_type] || m.movement_type} — {Number(m.quantity).toLocaleString('fr-FR')}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {m.warehouse_name} · {m.reference || '—'}
                    </Text>
                    <Text variant="labelSmall" style={styles.meta}>
                      {m.created_by || '—'} · {new Date(m.created_at).toLocaleString('fr-FR')}
                    </Text>
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        )}

        {!trace && !loading && selectedId === null && (
          <Button mode="outlined" disabled style={styles.hintBtn}>
            Sélectionnez un produit ci-dessus
          </Button>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  search: { margin: spacing.md },
  content: { padding: spacing.md, paddingTop: 0, paddingBottom: spacing.xl },
  section: { fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.sm, color: colors.text },
  card: { marginBottom: spacing.sm },
  selected: { borderColor: colors.primary, borderWidth: 1 },
  meta: { color: colors.textMuted, marginTop: 2 },
  hintBtn: { marginTop: spacing.lg },
});
