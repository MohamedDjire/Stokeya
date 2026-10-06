import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Avatar, Button, Checkbox, Menu, Text, TextInput } from 'react-native-paper';
import {
  fetchBrands,
  fetchCategories,
  fetchProducts,
  fetchUnits,
  type OptionItem,
  type Product,
} from '../api/auth';
import { deleteProduct, updateProduct, uploadProductImage } from '../api/products';
import type { AppStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/colors';
import { previewWholesalePrice, type WholesaleDiscountType } from '../utils/pricing';

type Props = NativeStackScreenProps<AppStackParamList, 'ProductEdit'>;

function MenuField({ label, value, items, onSelect }: {
  label: string; value: string; items: OptionItem[];
  onSelect: (item: OptionItem) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Menu visible={visible} onDismiss={() => setVisible(false)} anchor={
      <TextInput label={label} value={value} mode="outlined" style={styles.input} editable={false}
        right={<TextInput.Icon icon="menu-down" onPress={() => setVisible(true)} />}
        onPressIn={() => setVisible(true)} />
    }>
      {items.map((item) => (
        <Menu.Item key={item.id} title={item.name} onPress={() => { onSelect(item); setVisible(false); }} />
      ))}
    </Menu>
  );
}

export default function ProductEditScreen({ navigation, route }: Props) {
  const { productId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<OptionItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', sku: '', description: '', category: null as number | null,
    category_name: '', brand: null as number | null, brand_name: '',
    unit: null as number | null, unit_name: '', purchase_price: '', sale_price: '',
    wholesale_min_qty: '10',
    wholesale_discount_type: 'price' as WholesaleDiscountType,
    wholesale_discount_value: '',
    wholesale_price: '',
    tax_rate: '0', min_stock: '0', max_stock: '', barcode: '', track_batches: false,
  });

  useEffect(() => {
    Promise.all([fetchUnits(), fetchCategories(), fetchBrands(), fetchProducts()])
      .then(([unitData, categoryData, brandData, products]) => {
        setUnits(unitData);
        setCategories(categoryData);
        setBrands(brandData);
        const product = products.find((p) => p.id === productId) as Product | undefined;
        if (product) {
          setForm({
            name: product.name,
            sku: product.sku || '',
            description: product.description || '',
            category: product.category,
            category_name: product.category_name || '',
            brand: product.brand,
            brand_name: product.brand_name || '',
            unit: product.unit,
            unit_name: product.unit_name,
            purchase_price: product.purchase_price,
            sale_price: product.sale_price,
            wholesale_min_qty: String(product.wholesale_min_qty ?? '10'),
            wholesale_discount_type: (product.wholesale_discount_type || 'price') as WholesaleDiscountType,
            wholesale_discount_value: product.wholesale_discount_value || '',
            wholesale_price: product.wholesale_price || '',
            tax_rate: product.tax_rate,
            min_stock: product.min_stock,
            max_stock: product.max_stock || '',
            barcode: product.barcodes?.[0]?.code || '',
            track_batches: product.track_batches,
          });
          setImageUri(product.image);
        }
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.length) {
      setNewImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProduct(productId, {
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim(),
        category: form.category,
        brand: form.brand,
        unit: form.unit,
        purchase_price: form.purchase_price || '0',
        sale_price: form.sale_price,
        wholesale_min_qty: form.wholesale_min_qty || '10',
        wholesale_discount_type: form.wholesale_discount_type,
        wholesale_discount_value: form.wholesale_discount_value || null,
        wholesale_price: form.wholesale_discount_type === 'price' ? (form.wholesale_price || null) : null,
        tax_rate: form.tax_rate || '0',
        min_stock: form.min_stock || '0',
        max_stock: form.max_stock || null,
        track_batches: form.track_batches,
        barcodes: form.barcode.trim() ? [{ code: form.barcode.trim(), is_primary: true }] : [],
      });
      if (newImageUri) {
        await uploadProductImage(productId, { uri: newImageUri });
      }
      Alert.alert('OK', 'Produit mis à jour.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch {
      Alert.alert('Erreur', 'Mise à jour impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer', 'Confirmer la suppression ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          await deleteProduct(productId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" />;

  const displayImage = newImageUri || imageUri;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.imageRow}>
        {displayImage ? (
          <Image source={{ uri: displayImage }} style={styles.image} />
        ) : (
          <Avatar.Icon size={72} icon="camera" style={styles.imagePlaceholder} color={colors.primary} />
        )}
        <Button mode="outlined" icon="image" onPress={pickImage} style={styles.imageBtn}>
          {displayImage ? 'Changer l\'image' : 'Ajouter une image'}
        </Button>
      </View>

      <TextInput label="Nom" mode="outlined" style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <TextInput label="Prix détail (unité)" keyboardType="decimal-pad" mode="outlined" style={styles.input} value={form.sale_price} onChangeText={(v) => setForm({ ...form, sale_price: v })} />
      <Text variant="titleMedium" style={{ fontWeight: '800', marginBottom: 4, color: colors.primary }}>Prix de gros / promo</Text>
      <TextInput label="À partir de (quantité)" keyboardType="number-pad" mode="outlined" style={styles.input} value={form.wholesale_min_qty} onChangeText={(v) => setForm({ ...form, wholesale_min_qty: v })} />
      <MenuField
        label="Type de promo"
        value={form.wholesale_discount_type === 'percent' ? 'Réduction %' : form.wholesale_discount_type === 'amount' ? 'Réduction en F' : 'Nouveau prix unitaire'}
        items={[
          { id: 1, name: 'Nouveau prix unitaire' },
          { id: 2, name: 'Réduction %' },
          { id: 3, name: 'Réduction en F' },
        ]}
        onSelect={(i) => setForm({
          ...form,
          wholesale_discount_type: i.id === 2 ? 'percent' : i.id === 3 ? 'amount' : 'price',
        })}
      />
      {form.wholesale_discount_type === 'price' ? (
        <TextInput label="Prix de gros (unitaire)" keyboardType="decimal-pad" mode="outlined" style={styles.input} value={form.wholesale_price} onChangeText={(v) => setForm({ ...form, wholesale_price: v })} />
      ) : (
        <TextInput
          label={form.wholesale_discount_type === 'percent' ? 'Réduction (%)' : 'Réduction (F par unité)'}
          keyboardType="decimal-pad"
          mode="outlined"
          style={styles.input}
          value={form.wholesale_discount_value}
          onChangeText={(v) => setForm({ ...form, wholesale_discount_value: v })}
        />
      )}
      {(() => {
        const preview = previewWholesalePrice(form.sale_price, form.wholesale_discount_type, form.wholesale_discount_value, form.wholesale_price);
        if (!preview) return null;
        return <Text style={{ color: '#2E7D32', fontWeight: '700', marginBottom: 12 }}>Gros dès {form.wholesale_min_qty || 10} : {preview.toLocaleString('fr-FR')} F</Text>;
      })()}
      <TextInput label="Code-barres" mode="outlined" style={styles.input} value={form.barcode} onChangeText={(v) => setForm({ ...form, barcode: v })} />
      <MenuField label="Unité" value={form.unit_name} items={units} onSelect={(i) => setForm({ ...form, unit: i.id, unit_name: i.name })} />
      <Button mode="contained" onPress={handleSave} loading={saving} style={{ marginBottom: 8 }}>Enregistrer</Button>
      <Button mode="outlined" textColor={colors.error} onPress={handleDelete}>Supprimer</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, backgroundColor: colors.background },
  loader: { marginTop: 48 },
  input: { marginBottom: 12 },
  imageRow: { alignItems: 'center', marginBottom: 16, gap: 8 },
  image: { width: 96, height: 96, borderRadius: 12, backgroundColor: '#E5E7EB' },
  imagePlaceholder: { backgroundColor: colors.primary + '15' },
  imageBtn: { marginTop: 4 },
});
