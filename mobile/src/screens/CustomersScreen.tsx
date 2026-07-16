import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Searchbar, Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { createCustomer, fetchCustomers, type Customer } from '../api/customers';
import { colors, spacing } from '../theme/colors';

export default function CustomersScreen() {
  const navigation = useNavigation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q?: string) => {
    setCustomers(await fetchCustomers(q));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createCustomer(form);
      setForm({ name: '', phone: '', email: '' });
      setShowForm(false);
      await load();
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le client.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Clients" subtitle={`${customers.length} client(s)`} />
        <Appbar.Action icon="plus" onPress={() => setShowForm(!showForm)} />
      </Appbar.Header>

      {showForm && (
        <View style={styles.form}>
          <TextInput label="Nom" mode="outlined" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} style={styles.input} />
          <TextInput label="Téléphone" mode="outlined" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} style={styles.input} />
          <TextInput label="Email" mode="outlined" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} style={styles.input} />
          <Button mode="contained" onPress={handleCreate} loading={saving}>Enregistrer</Button>
        </View>
      )}

      <Searchbar placeholder="Rechercher..." value={search} onChangeText={async (v) => { setSearch(v); await load(v.trim() || undefined); }} style={styles.search} />

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search.trim() || undefined)} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.name}</Text>
              <Text variant="bodySmall" style={styles.meta}>
                {item.phone || '—'} · {item.sales_count} vente(s)
              </Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun client</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  form: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: { marginBottom: spacing.sm },
  search: { margin: spacing.md },
  list: { padding: spacing.md, paddingTop: 0 },
  card: { marginBottom: spacing.sm },
  meta: { color: colors.textMuted, marginTop: 4 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
});
