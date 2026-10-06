import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Text, TextInput } from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import { fetchProductByBarcode } from '../api/products';
import type { Product } from '../api/auth';
import BarcodeScanner from '../components/BarcodeScanner';
import { colors, spacing } from '../theme/colors';

export default function ScanScreen() {
  const navigation = useNavigation();
  const [code, setCode] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const lookup = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;
    setLoading(true);
    setProduct(null);
    try {
      const found = await fetchProductByBarcode(trimmed);
      setProduct(found);
      setCode(trimmed);
    } catch {
      Alert.alert('Introuvable', 'Aucun produit pour ce code-barres.');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (scanned: string) => {
    setShowScanner(false);
    lookup(scanned);
  };

  const primaryBarcode = product?.barcodes?.find((b) => b.is_primary)?.code
    || product?.barcodes?.[0]?.code
    || code;

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Scan code-barres" subtitle="Recherche produit" />
        <Appbar.Action icon="barcode-scan" onPress={() => setShowScanner(true)} />
      </AppHeader>

      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          label="Code-barres (USB / saisie)"
          mode="outlined"
          value={code}
          onChangeText={setCode}
          onSubmitEditing={() => lookup(code)}
          autoCapitalize="none"
          autoFocus
          style={styles.input}
          right={<TextInput.Icon icon="magnify" onPress={() => lookup(code)} />}
        />
        <Text style={styles.hint}>
          Lecteur USB/Bluetooth : scannez ici — le produit s’affiche automatiquement.
        </Text>
        <Button mode="contained" onPress={() => lookup(code)} loading={loading} style={styles.btn}>
          Rechercher
        </Button>
        <Button mode="outlined" icon="camera" onPress={() => setShowScanner(true)} style={styles.btn}>
          Scanner avec la caméra
        </Button>

        {product && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge">{product.name}</Text>
              <Text variant="bodySmall" style={styles.meta}>SKU : {product.sku || '—'}</Text>
              <Text variant="bodySmall" style={styles.meta}>Code : {primaryBarcode}</Text>
              <Text variant="bodySmall" style={styles.meta}>
                Catégorie : {product.category_name || '—'}
              </Text>
              <Text variant="titleMedium" style={styles.price}>
                {Number(product.sale_price).toLocaleString('fr-FR')} XOF
              </Text>
              <Text variant="bodySmall" style={styles.meta}>
                Stock total : {Number(product.total_stock).toLocaleString('fr-FR')}
              </Text>
              {product.track_batches && (
                <Text variant="labelSmall" style={styles.batch}>Suivi par lots activé</Text>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  content: { padding: spacing.md },
  input: { marginBottom: spacing.sm },
  hint: { color: colors.textMuted, marginBottom: spacing.sm, fontSize: 13 },
  btn: { marginBottom: spacing.sm },
  card: { marginTop: spacing.md },
  meta: { color: colors.textMuted, marginTop: 4 },
  price: { marginTop: spacing.sm, color: colors.primary, fontWeight: '700' },
  batch: { marginTop: spacing.sm, color: colors.secondary },
});
