import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import {
  createBranch,
  createLocation,
  createWarehouse,
  fetchBranches,
  fetchLocations,
  fetchWarehouses,
  type Branch,
  type Warehouse,
  type WarehouseLocation,
} from '../api/sites';
import { colors, spacing } from '../theme/colors';

type Tab = 'branches' | 'warehouses' | 'locations';

export default function SitesScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>('branches');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  const [branchForm, setBranchForm] = useState({ name: '', phone: '', address: '' });
  const [warehouseForm, setWarehouseForm] = useState({ name: '', branch: 0 });
  const [locationForm, setLocationForm] = useState({ code: '', name: '', warehouse: 0 });

  const load = useCallback(async (q?: string) => {
    const [b, w, l] = await Promise.all([
      fetchBranches(q),
      fetchWarehouses(q),
      fetchLocations(q),
    ]);
    setBranches(b);
    setWarehouses(w);
    setLocations(l);
    setWarehouseForm((f) => (f.branch ? f : { ...f, branch: b[0]?.id || 0 }));
    setLocationForm((f) => (f.warehouse ? f : { ...f, warehouse: w[0]?.id || 0 }));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleSearch = async (v: string) => {
    setSearch(v);
    await load(v.trim() || undefined);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      if (tab === 'branches') {
        if (!branchForm.name.trim()) return;
        await createBranch(branchForm);
        setBranchForm({ name: '', phone: '', address: '' });
      } else if (tab === 'warehouses') {
        if (!warehouseForm.name.trim() || !warehouseForm.branch) return;
        await createWarehouse(warehouseForm);
        setWarehouseForm({ name: '', branch: branches[0]?.id || 0 });
      } else {
        if (!locationForm.code.trim() || !locationForm.name.trim() || !locationForm.warehouse) return;
        await createLocation(locationForm);
        setLocationForm({ code: '', name: '', warehouse: warehouses[0]?.id || 0 });
      }
      setShowForm(false);
      await load(search.trim() || undefined);
    } catch {
      Alert.alert('Erreur', 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const count = tab === 'branches' ? branches.length : tab === 'warehouses' ? warehouses.length : locations.length;

  const renderBranch = ({ item }: { item: Branch }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">{item.name}</Text>
        <Text variant="bodySmall" style={styles.meta}>
          {item.phone || '—'} · {item.address || 'Sans adresse'}
        </Text>
      </Card.Content>
    </Card>
  );

  const renderWarehouse = ({ item }: { item: Warehouse }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">{item.name}</Text>
        <Text variant="bodySmall" style={styles.meta}>
          {item.branch_name} · {item.locations_count} emplacement(s)
          {item.is_default ? ' · Par défaut' : ''}
        </Text>
      </Card.Content>
    </Card>
  );

  const renderLocation = ({ item }: { item: WarehouseLocation }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">{item.code} — {item.name}</Text>
        <Text variant="bodySmall" style={styles.meta}>{item.warehouse_name}</Text>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Sites" subtitle={`${count} élément(s)`} />
        <Appbar.Action icon="plus" onPress={() => setShowForm(!showForm)} />
      </Appbar.Header>

      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        style={styles.segment}
        buttons={[
          { value: 'branches', label: 'Magasins' },
          { value: 'warehouses', label: 'Entrepôts' },
          { value: 'locations', label: 'Emplacements' },
        ]}
      />

      {showForm && (
        <View style={styles.form}>
          {tab === 'branches' && (
            <>
              <TextInput label="Nom" mode="outlined" value={branchForm.name} onChangeText={(v) => setBranchForm({ ...branchForm, name: v })} style={styles.input} />
              <TextInput label="Téléphone" mode="outlined" value={branchForm.phone} onChangeText={(v) => setBranchForm({ ...branchForm, phone: v })} style={styles.input} />
              <TextInput label="Adresse" mode="outlined" value={branchForm.address} onChangeText={(v) => setBranchForm({ ...branchForm, address: v })} style={styles.input} />
            </>
          )}
          {tab === 'warehouses' && (
            <>
              <TextInput label="Nom" mode="outlined" value={warehouseForm.name} onChangeText={(v) => setWarehouseForm({ ...warehouseForm, name: v })} style={styles.input} />
              <Text variant="bodySmall" style={styles.hint}>Boutique ID : {warehouseForm.branch || '—'}</Text>
            </>
          )}
          {tab === 'locations' && (
            <>
              <TextInput label="Code" mode="outlined" value={locationForm.code} onChangeText={(v) => setLocationForm({ ...locationForm, code: v })} style={styles.input} />
              <TextInput label="Nom" mode="outlined" value={locationForm.name} onChangeText={(v) => setLocationForm({ ...locationForm, name: v })} style={styles.input} />
              <Text variant="bodySmall" style={styles.hint}>Entrepôt ID : {locationForm.warehouse || '—'}</Text>
            </>
          )}
          <Button mode="contained" onPress={handleCreate} loading={saving}>Enregistrer</Button>
        </View>
      )}

      <Searchbar placeholder="Rechercher..." value={search} onChangeText={handleSearch} style={styles.search} />

      {tab === 'branches' && (
        <FlatList
          data={branches}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search.trim() || undefined)} />}
          contentContainerStyle={styles.list}
          renderItem={renderBranch}
          ListEmptyComponent={<Text style={styles.empty}>Aucun magasin</Text>}
        />
      )}
      {tab === 'warehouses' && (
        <FlatList
          data={warehouses}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search.trim() || undefined)} />}
          contentContainerStyle={styles.list}
          renderItem={renderWarehouse}
          ListEmptyComponent={<Text style={styles.empty}>Aucun entrepôt</Text>}
        />
      )}
      {tab === 'locations' && (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search.trim() || undefined)} />}
          contentContainerStyle={styles.list}
          renderItem={renderLocation}
          ListEmptyComponent={<Text style={styles.empty}>Aucun emplacement</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  segment: { margin: spacing.md, marginBottom: 0 },
  form: { padding: spacing.md, backgroundColor: colors.surface },
  input: { marginBottom: spacing.sm },
  hint: { color: colors.textMuted, marginBottom: spacing.sm },
  search: { margin: spacing.md },
  list: { padding: spacing.md, paddingTop: 0 },
  card: { marginBottom: spacing.sm },
  meta: { color: colors.textMuted, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
});
