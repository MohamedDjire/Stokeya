import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Appbar, Button, Card, Chip, Searchbar, Text, TextInput } from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import {
  addCustomerNote,
  backfillCustomerStats,
  createCustomer,
  CUSTOMER_STATUS_LABELS,
  fetchCrmDashboard,
  fetchCustomerProfile,
  fetchCustomersEnriched,
  LOYALTY_LEVEL_LABELS,
  type CrmDashboard,
  type Customer,
  type CustomerProfile,
} from '../api/customers';
import { colors, spacing } from '../theme/colors';

function money(v?: string | number) {
  return `${Number(v || 0).toLocaleString('fr-FR')} XOF`;
}

export default function CustomersScreen() {
  const navigation = useNavigation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dashboard, setDashboard] = useState<CrmDashboard | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '' });
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async (q?: string) => {
    const [dash, list] = await Promise.all([
      fetchCrmDashboard(),
      fetchCustomersEnriched({ search: q || undefined }),
    ]);
    setDashboard(dash);
    setCustomers(list);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createCustomer(form);
      setForm({ name: '', phone: '', email: '', city: '' });
      setShowForm(false);
      await load(search.trim() || undefined);
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le client.');
    } finally {
      setSaving(false);
    }
  };

  const openProfile = async (id: number) => {
    try {
      setProfile(await fetchCustomerProfile(id));
      setNoteText('');
    } catch {
      Alert.alert('Erreur', 'Impossible de charger la fiche client.');
    }
  };

  const submitNote = async () => {
    if (!profile || !noteText.trim()) return;
    await addCustomerNote(profile.id, noteText.trim());
    setProfile(await fetchCustomerProfile(profile.id));
    setNoteText('');
  };

  const recalculate = async () => {
    setSaving(true);
    try {
      await backfillCustomerStats();
      await load(search.trim() || undefined);
    } catch {
      Alert.alert('Erreur', 'Recalcul impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="CRM Clients" subtitle={`${customers.length} client(s)`} />
        <Appbar.Action icon="refresh" onPress={recalculate} />
        <Appbar.Action icon="plus" onPress={() => setShowForm(!showForm)} />
      </AppHeader>

      {showForm && (
        <View style={styles.form}>
          <TextInput label="Nom" mode="outlined" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} style={styles.input} />
          <TextInput label="Téléphone" mode="outlined" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} style={styles.input} />
          <TextInput label="Email" mode="outlined" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} style={styles.input} />
          <TextInput label="Ville" mode="outlined" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} style={styles.input} />
          <Button mode="contained" onPress={handleCreate} loading={saving}>Enregistrer</Button>
        </View>
      )}

      {dashboard && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiScroll} contentContainerStyle={styles.kpiRow}>
          {[
            ['Clients', String(dashboard.total_customers)],
            ['Nouveaux', String(dashboard.new_this_month)],
            ['CA', money(dashboard.revenue)],
            ['VIP', String(dashboard.vip_count)],
            ['Actifs', String(dashboard.active_count)],
            ['Fidél.', `${dashboard.retention_rate}%`],
          ].map(([label, value]) => (
            <Card key={label} style={styles.kpiCard}>
              <Card.Content>
                <Text variant="labelSmall">{label}</Text>
                <Text variant="titleMedium">{value}</Text>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      )}

      <Searchbar
        placeholder="Rechercher..."
        value={search}
        onChangeText={async (v) => {
          setSearch(v);
          await load(v.trim() || undefined);
        }}
        style={styles.search}
      />

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search.trim() || undefined)} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => openProfile(item.id)}>
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium">{item.name}</Text>
                <Text variant="bodySmall" style={styles.meta}>
                  {item.phone || '—'} · {item.orders_count ?? item.sales_count ?? 0} cmd · {money(item.total_spent)}
                </Text>
                <View style={styles.chips}>
                  {item.status ? <Chip compact>{CUSTOMER_STATUS_LABELS[item.status] || item.status}</Chip> : null}
                  {item.loyalty_level ? <Chip compact>{LOYALTY_LEVEL_LABELS[item.loyalty_level] || item.loyalty_level}</Chip> : null}
                  {typeof item.score === 'number' ? <Chip compact>{item.score}/100</Chip> : null}
                </View>
              </Card.Content>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun client</Text>}
      />

      <Modal visible={!!profile} animationType="slide" onRequestClose={() => setProfile(null)}>
        <View style={styles.modal}>
          <AppHeader>
            <Appbar.BackAction onPress={() => setProfile(null)} />
            <Appbar.Content title={profile?.name || 'Fiche client'} />
          </AppHeader>
          {profile && (
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text variant="bodyMedium">{profile.phone || '—'} · {profile.email || '—'}</Text>
              <Text variant="bodySmall" style={styles.meta}>
                {profile.city || '—'} · {CUSTOMER_STATUS_LABELS[profile.status || ''] || profile.status}
              </Text>
              <Text variant="titleSmall" style={styles.section}>
                Score {profile.score}/100 — {profile.score_label}
              </Text>
              <Text variant="bodyMedium">
                LTV {money(profile.ltv)} · {profile.orders_count} commandes · {profile.loyalty_points} pts
              </Text>
              <Text variant="bodySmall" style={styles.meta}>
                Fréquence : {profile.purchase_frequency || '—'}
              </Text>

              {(profile.recommendations || []).map((r) => (
                <Text key={r} style={styles.reco}>• {r}</Text>
              ))}

              <Text variant="titleSmall" style={styles.section}>Produits préférés</Text>
              {(profile.preferred_products || []).slice(0, 5).map((p) => (
                <Text key={p.product_id}>{p.name} — {p.times}× {'★'.repeat(p.stars)}</Text>
              ))}

              <Text variant="titleSmall" style={styles.section}>Historique</Text>
              {(profile.order_history || []).slice(0, 10).map((o) => (
                <Text key={`${o.source}-${o.id}`} variant="bodySmall">
                  {o.reference} · {money(o.total)} · {o.status}
                </Text>
              ))}

              <Text variant="titleSmall" style={styles.section}>Notes privées</Text>
              {(profile.notes || []).map((n) => (
                <Text key={n.id} variant="bodySmall">• {n.content}</Text>
              ))}
              <TextInput
                label="Nouvelle note"
                mode="outlined"
                value={noteText}
                onChangeText={setNoteText}
                style={styles.input}
              />
              <Button mode="contained" onPress={submitNote}>Ajouter la note</Button>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  form: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  input: { marginBottom: spacing.sm },
  search: { margin: spacing.md },
  list: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  meta: { color: colors.textMuted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  kpiScroll: { maxHeight: 90, marginTop: spacing.sm },
  kpiRow: { paddingHorizontal: spacing.md, gap: spacing.sm },
  kpiCard: { minWidth: 110 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalBody: { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },
  section: { marginTop: spacing.md, fontWeight: '700' },
  reco: { color: colors.primary, marginTop: 4 },
});
