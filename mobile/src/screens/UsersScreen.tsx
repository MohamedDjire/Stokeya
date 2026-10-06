import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Chip,
  Divider,
  Menu,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import {
  createUser,
  fetchRoles,
  fetchUsers,
  updateUser,
  type CompanyUser,
  type Role,
} from '../api/users';
import { colors, spacing } from '../theme/colors';

export default function UsersScreen() {
  const navigation = useNavigation();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '', role_code: '' });
  const [roleMenu, setRoleMenu] = useState(false);

  const load = async () => {
    const [u, r] = await Promise.all([fetchUsers(), fetchRoles()]);
    setUsers(u);
    setRoles(r.filter((role) => role.code !== 'company_admin'));
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const roleName = (code: string) => roles.find((r) => r.code === code)?.name || 'Choisir un rôle';

  const handleCreate = async () => {
    if (!form.email.trim() || form.password.length < 8) {
      Alert.alert('Champs requis', 'Email valide et mot de passe (8 caractères min).');
      return;
    }
    setSaving(true);
    try {
      await createUser(form);
      setForm({ email: '', password: '', first_name: '', last_name: '', phone: '', role_code: '' });
      setShowForm(false);
      await load();
      Alert.alert('Utilisateur créé', 'Le compte a été ajouté.');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string; email?: string[] } } }).response?.data;
      Alert.alert('Erreur', detail?.detail || detail?.email?.[0] || 'Création impossible.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: CompanyUser) => {
    try {
      const updated = await updateUser(user.id, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      Alert.alert('Erreur', detail || 'Action impossible.');
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />;
  }

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Utilisateurs" subtitle={`${users.length} compte(s)`} />
        <Appbar.Action icon={showForm ? 'close' : 'account-plus'} onPress={() => setShowForm(!showForm)} />
      </AppHeader>

      {showForm && (
        <Card style={styles.formCard}>
          <Card.Content>
            <TextInput label="Email" mode="outlined" style={styles.input} autoCapitalize="none"
              keyboardType="email-address" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
            <TextInput label="Mot de passe" mode="outlined" style={styles.input} secureTextEntry
              value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} />
            <View style={styles.row}>
              <TextInput label="Prénom" mode="outlined" style={[styles.input, styles.half]}
                value={form.first_name} onChangeText={(v) => setForm({ ...form, first_name: v })} />
              <TextInput label="Nom" mode="outlined" style={[styles.input, styles.half]}
                value={form.last_name} onChangeText={(v) => setForm({ ...form, last_name: v })} />
            </View>
            <Menu
              visible={roleMenu}
              onDismiss={() => setRoleMenu(false)}
              anchor={
                <TextInput label="Rôle" mode="outlined" style={styles.input} editable={false}
                  value={form.role_code ? roleName(form.role_code) : ''}
                  right={<TextInput.Icon icon="menu-down" onPress={() => setRoleMenu(true)} />}
                  onPressIn={() => setRoleMenu(true)} />
              }
            >
              {roles.map((r) => (
                <Menu.Item key={r.id} title={r.name} onPress={() => { setForm({ ...form, role_code: r.code }); setRoleMenu(false); }} />
              ))}
            </Menu>
            <Button mode="contained" onPress={handleCreate} loading={saving}>Créer l'utilisateur</Button>
          </Card.Content>
        </Card>
      )}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.userHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium">{item.full_name || item.email}</Text>
                  <Text variant="bodySmall" style={styles.muted}>{item.email}</Text>
                </View>
                <Switch value={item.is_active} onValueChange={() => toggleActive(item)} disabled={item.is_company_admin} />
              </View>
              <View style={styles.chips}>
                {item.is_company_admin ? (
                  <Chip compact icon="shield-crown" style={styles.adminChip}>Administrateur</Chip>
                ) : item.roles.length ? (
                  item.roles.map((r) => <Chip key={r.id} compact style={styles.roleChip}>{r.name}</Chip>)
                ) : (
                  <Chip compact style={styles.noRole}>Sans rôle</Chip>
                )}
              </View>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  loader: { marginTop: 48 },
  formCard: { margin: spacing.md, backgroundColor: colors.surface },
  input: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  list: { padding: spacing.md, paddingTop: 0 },
  card: { marginBottom: spacing.sm, backgroundColor: colors.surface },
  userHeader: { flexDirection: 'row', alignItems: 'center' },
  muted: { color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  adminChip: { backgroundColor: colors.primary + '15' },
  roleChip: { backgroundColor: colors.secondary + '15' },
  noRole: { backgroundColor: colors.border },
});
