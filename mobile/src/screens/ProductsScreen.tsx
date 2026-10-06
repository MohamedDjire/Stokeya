import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Appbar, Avatar, Card, FAB, Searchbar, Text, Chip } from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fetchProducts, type Product } from '../api/auth';
import { cachePeek } from '../api/cache';
import { colors, spacing } from '../theme/colors';
import type { AppStackParamList } from '../navigation/types';

export default function ProductsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [products, setProducts] = useState<Product[]>(() => cachePeek<Product[]>('products:') ?? []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(() => !(cachePeek('products:')?.length));
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = useCallback(async (query?: string, silent = false) => {
    if (!silent && !(cachePeek(`products:${query || ''}`) as Product[] | undefined)?.length) {
      setLoading(true);
    }
    try {
      setProducts(await fetchProducts(query));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProducts(search.trim() || undefined, true);
    }, search ? 280 : 0);
    return () => clearTimeout(t);
  }, [search, loadProducts]);

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.Content title="Produits" subtitle={`${products.length} article(s)`} />
        <Appbar.Action icon="file-import" onPress={() => navigation.navigate('ProductImport')} />
      </AppHeader>

      <Searchbar
        placeholder="Rechercher un produit..."
        value={search}
        onChangeText={handleSearch}
        style={styles.search}
        inputStyle={styles.searchInput}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => {
              setRefreshing(true);
              await loadProducts(search.trim() || undefined);
              setRefreshing(false);
            }} />
          }
          contentContainerStyle={products.length ? styles.list : styles.emptyList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="titleMedium">Aucun produit</Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Ajoutez votre premier produit pour commencer
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.card} mode="elevated" onPress={() => navigation.navigate('ProductEdit', { productId: item.id })}>
              <Card.Content style={styles.cardRow}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.thumb} />
                ) : (
                  <Avatar.Icon size={44} icon="package-variant" style={styles.thumbPlaceholder} color={colors.primary} />
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text variant="titleMedium" style={styles.productName}>{item.name}</Text>
                    <Chip compact style={styles.priceChip}>
                      {Number(item.sale_price).toLocaleString('fr-FR')} F
                    </Chip>
                  </View>
                  {Number(item.wholesale_price || 0) > 0 && (
                    <Text variant="labelSmall" style={{ color: '#2E7D32', fontWeight: '700' }}>
                      Gros {Number(item.wholesale_price).toLocaleString('fr-FR')} F dès {Number(item.wholesale_min_qty || 10)}
                    </Text>
                  )}
                  <Text variant="bodySmall" style={styles.meta}>
                    SKU: {item.sku || '—'} · Stock: {item.total_stock} · {item.unit_name}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}

      <FAB
        icon="plus"
        label="Nouveau"
        style={styles.fab}
        color="#FFF"
        onPress={() => navigation.navigate('ProductCreate')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  search: { margin: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface },
  searchInput: { fontSize: 14 },
  loader: { marginTop: 48 },
  list: { padding: spacing.md, paddingTop: 0, paddingBottom: 100 },
  emptyList: { flexGrow: 1, justifyContent: 'center', paddingBottom: 100 },
  empty: { alignItems: 'center', padding: spacing.lg },
  emptyText: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  card: { marginBottom: spacing.sm, backgroundColor: colors.surface },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardBody: { flex: 1 },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.border },
  thumbPlaceholder: { backgroundColor: colors.primary + '15' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  productName: { flex: 1, fontWeight: '600' },
  priceChip: { backgroundColor: colors.primary + '15' },
  meta: { color: colors.textMuted, marginTop: 6 },
  fab: { position: 'absolute', right: spacing.md, bottom: spacing.md, backgroundColor: colors.primary },
});
