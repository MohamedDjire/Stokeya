import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Checkbox,
  Menu,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  createProduct,
  fetchBrands,
  fetchCategories,
  fetchUnits,
  type OptionItem,
} from '../api/auth';
import { uploadProductImage } from '../api/products';
import { colors } from '../theme/colors';
import { previewWholesalePrice } from '../utils/pricing';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ProductCreate'>;

type MenuFieldProps = {
  label: string;
  value: string;
  items: OptionItem[];
  onSelect: (item: OptionItem) => void;
};

function MenuField({ label, value, items, onSelect }: MenuFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <TextInput
          label={label}
          value={value}
          mode="outlined"
          style={styles.input}
          editable={false}
          right={<TextInput.Icon icon="menu-down" onPress={() => setVisible(true)} />}
          onPressIn={() => setVisible(true)}
        />
      }
    >
      {items.map((item) => (
        <Menu.Item
          key={item.id}
          title={item.name}
          onPress={() => {
            onSelect(item);
            setVisible(false);
          }}
        />
      ))}
    </Menu>
  );
}

export default function ProductCreateScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<OptionItem[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    category: null as number | null,
    category_name: '',
    brand: null as number | null,
    brand_name: '',
    unit: null as number | null,
    unit_name: '',
    purchase_price: '',
    sale_price: '',
    wholesale_min_qty: '10',
    wholesale_discount_type: 'price' as 'price' | 'percent' | 'amount',
    wholesale_discount_value: '',
    wholesale_price: '',
    tax_rate: '0',
    min_stock: '0',
    max_stock: '',
    barcode: '',
    track_batches: false,
  });

  useEffect(() => {
    Promise.all([fetchUnits(), fetchCategories(), fetchBrands()])
      .then(([unitData, categoryData, brandData]) => {
        setUnits(unitData);
        setCategories(categoryData);
        setBrands(brandData);
        if (unitData[0]) {
          setForm((prev) => ({
            ...prev,
            unit: unitData[0].id,
            unit_name: unitData[0].name,
          }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof typeof form, value: string | boolean | number | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.length) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sale_price || !form.unit) {
      Alert.alert('Champs requis', 'Nom, prix de vente et unite sont obligatoires.');
      return;
    }

    setSaving(true);
    try {
      const product = await createProduct({
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
        max_stock: form.max_stock || undefined,
        track_batches: form.track_batches,
        barcodes: form.barcode.trim()
          ? [{ code: form.barcode.trim(), is_primary: true }]
          : [],
      });

      if (imageUri) {
        try {
          await uploadProductImage(product.id, { uri: imageUri });
        } catch {
          Alert.alert('Image', 'Produit créé mais l\'image n\'a pas pu être envoyée.');
        }
      }

      Alert.alert('Produit cree', 'Le produit a bien ete enregistre.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le produit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.imageRow}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} />
            ) : (
              <Avatar.Icon size={72} icon="camera" style={styles.imagePlaceholder} color={colors.primary} />
            )}
            <Button mode="outlined" icon="image" onPress={pickImage} style={styles.imageBtn}>
              {imageUri ? 'Changer l\'image' : 'Ajouter une image'}
            </Button>
          </View>

          <TextInput label="Nom du produit" mode="outlined" style={styles.input} value={form.name} onChangeText={(v) => update('name', v)} />
          <TextInput label="SKU" mode="outlined" style={styles.input} value={form.sku} onChangeText={(v) => update('sku', v)} />
          <TextInput label="Description" mode="outlined" multiline style={styles.input} value={form.description} onChangeText={(v) => update('description', v)} />

          <MenuField
            label="Unite"
            value={form.unit_name}
            items={units}
            onSelect={(item) => setForm((prev) => ({ ...prev, unit: item.id, unit_name: item.name }))}
          />
          <MenuField
            label="Categorie"
            value={form.category_name}
            items={categories}
            onSelect={(item) => setForm((prev) => ({ ...prev, category: item.id, category_name: item.name }))}
          />
          <MenuField
            label="Marque"
            value={form.brand_name}
            items={brands}
            onSelect={(item) => setForm((prev) => ({ ...prev, brand: item.id, brand_name: item.name }))}
          />

          <TextInput label="Prix achat" keyboardType="decimal-pad" mode="outlined" style={styles.input} value={form.purchase_price} onChangeText={(v) => update('purchase_price', v)} />
          <TextInput label="Prix détail (unité)" keyboardType="decimal-pad" mode="outlined" style={styles.input} value={form.sale_price} onChangeText={(v) => update('sale_price', v)} />

          <Text variant="titleMedium" style={styles.section}>Prix de gros / promo</Text>
          <Text variant="bodySmall" style={styles.hint}>Ex. 10 000 F l’unité, dès 10 pièces → 9 300 F</Text>
          <TextInput label="À partir de (quantité)" keyboardType="number-pad" mode="outlined" style={styles.input} value={form.wholesale_min_qty} onChangeText={(v) => update('wholesale_min_qty', v)} />
          <MenuField
            label="Type de promo"
            value={
              form.wholesale_discount_type === 'percent' ? 'Réduction %'
                : form.wholesale_discount_type === 'amount' ? 'Réduction en F'
                  : 'Nouveau prix unitaire'
            }
            items={[
              { id: 1, name: 'Nouveau prix unitaire' },
              { id: 2, name: 'Réduction %' },
              { id: 3, name: 'Réduction en F' },
            ]}
            onSelect={(item) => update(
              'wholesale_discount_type',
              item.id === 2 ? 'percent' : item.id === 3 ? 'amount' : 'price',
            )}
          />
          {form.wholesale_discount_type === 'price' ? (
            <TextInput label="Prix de gros (unitaire)" keyboardType="decimal-pad" mode="outlined" style={styles.input} value={form.wholesale_price} onChangeText={(v) => update('wholesale_price', v)} />
          ) : (
            <TextInput
              label={form.wholesale_discount_type === 'percent' ? 'Réduction (%)' : 'Réduction (F par unité)'}
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.input}
              value={form.wholesale_discount_value}
              onChangeText={(v) => update('wholesale_discount_value', v)}
            />
          )}
          {(() => {
            const preview = previewWholesalePrice(form.sale_price, form.wholesale_discount_type, form.wholesale_discount_value, form.wholesale_price);
            if (!preview) return null;
            return (
              <Text style={styles.preview}>
                Gros dès {form.wholesale_min_qty || 10} : {preview.toLocaleString('fr-FR')} F (détail {Number(form.sale_price || 0).toLocaleString('fr-FR')} F)
              </Text>
            );
          })()}

          <TextInput label="TVA (%)" keyboardType="decimal-pad" mode="outlined" style={styles.input} value={form.tax_rate} onChangeText={(v) => update('tax_rate', v)} />
          <TextInput label="Stock minimum" keyboardType="decimal-pad" mode="outlined" style={styles.input} value={form.min_stock} onChangeText={(v) => update('min_stock', v)} />
          <TextInput label="Stock maximum" keyboardType="decimal-pad" mode="outlined" style={styles.input} value={form.max_stock} onChangeText={(v) => update('max_stock', v)} />
          <TextInput label="Code-barres" mode="outlined" style={styles.input} value={form.barcode} onChangeText={(v) => update('barcode', v)} />

          <View style={styles.checkboxRow}>
            <Checkbox
              status={form.track_batches ? 'checked' : 'unchecked'}
              onPress={() => update('track_batches', !form.track_batches)}
            />
            <Text>Suivre les lots / dates d'expiration</Text>
          </View>

          <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving}>
            Enregistrer le produit
          </Button>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loader: { marginTop: 48 },
  content: { padding: 16, paddingBottom: 32 },
  input: { marginBottom: 12 },
  section: { fontWeight: '800', marginTop: 8, marginBottom: 4, color: colors.primary },
  hint: { color: '#64748B', marginBottom: 8 },
  preview: { color: '#2E7D32', fontWeight: '700', marginBottom: 12 },
  imageRow: { alignItems: 'center', marginBottom: 16, gap: 8 },
  image: { width: 96, height: 96, borderRadius: 12, backgroundColor: '#E5E7EB' },
  imagePlaceholder: { backgroundColor: colors.primary + '15' },
  imageBtn: { marginTop: 4 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
});
