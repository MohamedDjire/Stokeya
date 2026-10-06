import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Checkbox, Chip, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import {
  createBranch,
  createWarehouse,
  fetchBranches,
  fetchOnlineShop,
  fetchWarehouses,
  shareShopLink,
  updateBranch,
  updateOnlineShop,
  type Branch,
  type OnlineShop,
  type Warehouse,
} from '../api/sites';
import { colors, spacing } from '../theme/colors';

type Tab = 'main' | 'pos' | 'warehouses' | 'shop';

export default function SitesScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>('main');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [shop, setShop] = useState<OnlineShop | null>(null);
  const [showPosForm, setShowPosForm] = useState(false);
  const [posForm, setPosForm] = useState({ name: '', phone: '', address: '' });
  const [whForm, setWhForm] = useState({ name: '' });
  const [showWhForm, setShowWhForm] = useState(false);

  const main = useMemo(() => branches.find((b) => b.is_main) || null, [branches]);
  const posList = useMemo(() => branches.filter((b) => !b.is_main), [branches]);
  const storageWh = useMemo(() => warehouses.filter((w) => !w.is_pos_stock), [warehouses]);

  const load = useCallback(async () => {
    const [b, w, s] = await Promise.all([
      fetchBranches(),
      fetchWarehouses(),
      fetchOnlineShop().catch(() => null),
    ]);
    setBranches(b);
    setWarehouses(w);
    if (s) setShop(s);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const createPos = async () => {
    if (!posForm.name.trim()) return;
    setSaving(true);
    try {
      await createBranch({ ...posForm, is_active: true });
      setPosForm({ name: '', phone: '', address: '' });
      setShowPosForm(false);
      await load();
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le point de vente (limite de plan ?).');
    } finally {
      setSaving(false);
    }
  };

  const createStorageWh = async () => {
    if (!whForm.name.trim() || !main) return;
    setSaving(true);
    try {
      await createWarehouse({
        name: whForm.name,
        branch: main.id,
        is_default: false,
        is_active: true,
        is_pos_stock: false,
      });
      setWhForm({ name: '' });
      setShowWhForm(false);
      await load();
    } catch {
      Alert.alert('Erreur', 'Impossible de créer l\'entrepôt (pack Business requis ?).');
    } finally {
      setSaving(false);
    }
  };

  const saveShop = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      const updated = await updateOnlineShop({
        enabled: shop.enabled,
        name: shop.name,
        description: shop.description,
        whatsapp: shop.whatsapp,
        hours: shop.hours,
        phone: shop.phone,
        show_prices: shop.show_prices,
        show_stock: shop.show_stock,
      });
      setShop(updated);
      Alert.alert('OK', 'Boutique en ligne enregistrée.');
    } catch {
      Alert.alert('Erreur', 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Sites & boutique" subtitle="Siège, POS, entrepôts, boutique en ligne" />
      </AppHeader>

      <SegmentedButtons
        style={styles.tabs}
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        buttons={[
          { value: 'main', label: 'Siège' },
          { value: 'pos', label: 'POS' },
          { value: 'warehouses', label: 'Entrepôts' },
          { value: 'shop', label: 'En ligne' },
        ]}
      />

      {tab === 'main' && (
        <ScrollView contentContainerStyle={styles.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
          {main ? (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium">{main.name}</Text>
                <Chip compact style={styles.chip}>Principale</Chip>
                <Text variant="bodySmall" style={styles.meta}>{main.address || '—'}</Text>
                <Text variant="bodySmall" style={styles.meta}>{main.phone || '—'}</Text>
                <Text variant="bodySmall" style={styles.meta}>
                  Non supprimable. Les commandes web sont préparées ici.
                </Text>
              </Card.Content>
            </Card>
          ) : (
            <Text style={styles.empty}>Aucune boutique principale</Text>
          )}
        </ScrollView>
      )}

      {tab === 'pos' && (
        <View style={styles.flex}>
          <Button mode="contained" style={styles.padH} onPress={() => setShowPosForm(!showPosForm)}>
            {showPosForm ? 'Fermer' : 'Nouveau point de vente'}
          </Button>
          {showPosForm && (
            <View style={styles.form}>
              <TextInput label="Nom" mode="outlined" value={posForm.name} onChangeText={(v) => setPosForm({ ...posForm, name: v })} style={styles.input} />
              <TextInput label="Téléphone" mode="outlined" value={posForm.phone} onChangeText={(v) => setPosForm({ ...posForm, phone: v })} style={styles.input} />
              <TextInput label="Adresse" mode="outlined" value={posForm.address} onChangeText={(v) => setPosForm({ ...posForm, address: v })} style={styles.input} />
              <Button mode="contained" loading={saving} onPress={createPos}>Enregistrer</Button>
            </View>
          )}
          <FlatList
            data={posList}
            keyExtractor={(i) => String(i.id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={styles.pad}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium">{item.name}</Text>
                  <Text variant="bodySmall" style={styles.meta}>{item.phone || '—'} · {item.address || '—'}</Text>
                </Card.Content>
              </Card>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Aucun point de vente</Text>}
          />
        </View>
      )}

      {tab === 'warehouses' && (
        <View style={styles.flex}>
          <Button mode="contained" style={styles.padH} onPress={() => setShowWhForm(!showWhForm)}>
            {showWhForm ? 'Fermer' : 'Nouvel entrepôt'}
          </Button>
          {showWhForm && (
            <View style={styles.form}>
              <TextInput label="Nom entrepôt" mode="outlined" value={whForm.name} onChangeText={(v) => setWhForm({ name: v })} style={styles.input} />
              <Button mode="contained" loading={saving} onPress={createStorageWh}>Enregistrer</Button>
            </View>
          )}
          <FlatList
            data={storageWh}
            keyExtractor={(i) => String(i.id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={styles.pad}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium">{item.name}</Text>
                  <Text variant="bodySmall" style={styles.meta}>Stockage · {item.branch_name}</Text>
                </Card.Content>
              </Card>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Aucun entrepôt de stockage</Text>}
          />
        </View>
      )}

      {tab === 'shop' && shop && (
        <ScrollView contentContainerStyle={styles.pad}>
          <Text variant="titleSmall">Lien : /shop/{shop.slug}</Text>
          <Text variant="bodySmall" style={styles.meta}>Court : /s/{shop.code}</Text>
          <Button mode="outlined" icon="share-variant" style={styles.mt} onPress={() => shareShopLink(shop)}>
            Partager le lien
          </Button>
          <Checkbox.Item
            label="Boutique activée"
            status={shop.enabled ? 'checked' : 'unchecked'}
            onPress={() => setShop({ ...shop, enabled: !shop.enabled })}
          />
          <TextInput label="Nom" mode="outlined" value={shop.name} onChangeText={(v) => setShop({ ...shop, name: v })} style={styles.input} />
          <TextInput label="Description" mode="outlined" value={shop.description} onChangeText={(v) => setShop({ ...shop, description: v })} style={styles.input} />
          <TextInput label="WhatsApp" mode="outlined" value={shop.whatsapp} onChangeText={(v) => setShop({ ...shop, whatsapp: v })} style={styles.input} />
          <TextInput label="Horaires" mode="outlined" value={shop.hours} onChangeText={(v) => setShop({ ...shop, hours: v })} style={styles.input} />
          <Checkbox.Item
            label="Afficher les prix"
            status={shop.show_prices ? 'checked' : 'unchecked'}
            onPress={() => setShop({ ...shop, show_prices: !shop.show_prices })}
          />
          <Checkbox.Item
            label="Afficher le stock"
            status={shop.show_stock ? 'checked' : 'unchecked'}
            onPress={() => setShop({ ...shop, show_stock: !shop.show_stock })}
          />
          <Text variant="bodySmall" style={styles.meta}>Préparation : {shop.fulfillment_branch_name}</Text>
          <Button mode="contained" loading={saving} onPress={saveShop}>Enregistrer</Button>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { backgroundColor: colors.surface },
  tabs: { margin: spacing.md },
  pad: { padding: spacing.md, gap: spacing.sm },
  padH: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  meta: { color: colors.textMuted, marginTop: 4 },
  chip: { alignSelf: 'flex-start', marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  form: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  input: { marginBottom: spacing.sm },
  mt: { marginTop: spacing.sm, marginBottom: spacing.sm },
});
