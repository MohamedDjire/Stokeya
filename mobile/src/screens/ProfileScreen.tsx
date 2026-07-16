import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  List,
  Text,
  TextInput,
} from 'react-native-paper';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout, setUser } from '../store/authSlice';
import { updateProfile } from '../api/auth';
import { fetchCompany, updateCompany, type Company } from '../api/company';
import { PERMISSION_LABELS } from '../utils/permissions';
import { colors, spacing } from '../theme/colors';
import type { AppStackParamList } from '../navigation/types';

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({ name: '', phone: '', address: '', currency: '', tax_rate: '' });
  const [savingCompany, setSavingCompany] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = !!user?.is_company_admin;

  useEffect(() => {
    fetchCompany()
      .then((c) => {
        setCompany(c);
        setCompanyForm({
          name: c.name,
          phone: c.phone || '',
          address: c.address || '',
          currency: c.currency || 'XOF',
          tax_rate: String(c.tax_rate ?? ''),
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const initials = (user?.full_name || user?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await updateProfile(profile);
      dispatch(setUser(updated));
      Alert.alert('Profil', 'Vos informations ont été mises à jour.');
    } catch {
      Alert.alert('Erreur', 'Mise à jour du profil impossible.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveCompany = async () => {
    setSavingCompany(true);
    try {
      const updated = await updateCompany({
        name: companyForm.name.trim(),
        phone: companyForm.phone.trim(),
        address: companyForm.address.trim(),
        currency: companyForm.currency.trim() || 'XOF',
        tax_rate: companyForm.tax_rate || '0',
      });
      setCompany(updated);
      Alert.alert('Entreprise', 'Informations enregistrées.');
    } catch {
      Alert.alert('Erreur', 'Mise à jour de l\'entreprise impossible.');
    } finally {
      setSavingCompany(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: () => dispatch(logout()) },
      ],
    );
  };

  const permissions = user?.permissions || [];

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Mon compte" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar.Text size={72} label={initials} style={styles.avatar} color="#FFF" />
          <Text variant="titleLarge" style={styles.name}>{user?.full_name || 'Utilisateur'}</Text>
          <Text variant="bodyMedium" style={styles.muted}>{user?.email}</Text>
          <Chip compact style={styles.roleChip} icon={isAdmin ? 'shield-crown' : 'account'}>
            {isAdmin ? 'Administrateur' : 'Utilisateur'}
          </Chip>
        </View>

        <Card style={[styles.card, { backgroundColor: '#E3F2FD' }]}>
          <Card.Content>
            <Text variant="bodyMedium">
              Un seul compte Inventra pour le mobile et le web. Les paiements (Wave, Orange Money, MTN Money) se finalisent sur la version web.
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Profil" left={(p) => <Avatar.Icon {...p} icon="account-edit" style={styles.cardIcon} />} />
          <Card.Content>
            <TextInput label="Prénom" mode="outlined" style={styles.input}
              value={profile.first_name} onChangeText={(v) => setProfile({ ...profile, first_name: v })} />
            <TextInput label="Nom" mode="outlined" style={styles.input}
              value={profile.last_name} onChangeText={(v) => setProfile({ ...profile, last_name: v })} />
            <TextInput label="Téléphone" mode="outlined" style={styles.input} keyboardType="phone-pad"
              value={profile.phone} onChangeText={(v) => setProfile({ ...profile, phone: v })} />
            <Button mode="contained" onPress={saveProfile} loading={savingProfile}>Enregistrer</Button>
          </Card.Content>
        </Card>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />
        ) : company && (
          <Card style={styles.card}>
            <Card.Title title="Entreprise" left={(p) => <Avatar.Icon {...p} icon="store" style={styles.cardIcon} />} />
            <Card.Content>
              <TextInput label="Nom de l'entreprise" mode="outlined" style={styles.input}
                value={companyForm.name} editable={isAdmin}
                onChangeText={(v) => setCompanyForm({ ...companyForm, name: v })} />
              <TextInput label="Téléphone" mode="outlined" style={styles.input} keyboardType="phone-pad"
                value={companyForm.phone} editable={isAdmin}
                onChangeText={(v) => setCompanyForm({ ...companyForm, phone: v })} />
              <TextInput label="Adresse" mode="outlined" style={styles.input}
                value={companyForm.address} editable={isAdmin}
                onChangeText={(v) => setCompanyForm({ ...companyForm, address: v })} />
              <View style={styles.row}>
                <TextInput label="Devise" mode="outlined" style={[styles.input, styles.half]}
                  value={companyForm.currency} editable={isAdmin}
                  onChangeText={(v) => setCompanyForm({ ...companyForm, currency: v })} />
                <TextInput label="TVA (%)" mode="outlined" style={[styles.input, styles.half]} keyboardType="decimal-pad"
                  value={companyForm.tax_rate} editable={isAdmin}
                  onChangeText={(v) => setCompanyForm({ ...companyForm, tax_rate: v })} />
              </View>
              {isAdmin ? (
                <Button mode="contained" onPress={saveCompany} loading={savingCompany}>Enregistrer</Button>
              ) : (
                <Text variant="bodySmall" style={styles.muted}>
                  Seul l'administrateur peut modifier ces informations.
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Title title="Accès et autorisations" left={(p) => <Avatar.Icon {...p} icon="shield-key" style={styles.cardIcon} />} />
          <Card.Content>
            {permissions.includes('ALL') ? (
              <Text variant="bodyMedium">Accès complet à tous les modules.</Text>
            ) : permissions.length ? (
              <View style={styles.permWrap}>
                {permissions.map((code) => (
                  <Chip key={code} compact style={styles.permChip}>
                    {PERMISSION_LABELS[code] || code}
                  </Chip>
                ))}
              </View>
            ) : (
              <Text variant="bodySmall" style={styles.muted}>Aucune autorisation spécifique.</Text>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content style={styles.linksCard}>
            {isAdmin && (
              <List.Item
                title="Utilisateurs et rôles"
                description="Gérer les comptes et permissions"
                left={(p) => <List.Icon {...p} icon="account-group" />}
                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                onPress={() => navigation.navigate('Users')}
              />
            )}
            <Divider />
            <List.Item
              title="Abonnement"
              description="Pack, limites et facturation"
              left={(p) => <List.Icon {...p} icon="crown" />}
              right={(p) => <List.Icon {...p} icon="chevron-right" />}
              onPress={() => navigation.navigate('Subscription')}
            />
          </Card.Content>
        </Card>

        <Button
          mode="outlined"
          icon="logout"
          textColor={colors.error}
          style={styles.logout}
          onPress={confirmLogout}
        >
          Se déconnecter
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  identity: { alignItems: 'center', marginBottom: spacing.md },
  avatar: { backgroundColor: colors.primary, marginBottom: spacing.sm },
  name: { fontWeight: '700' },
  muted: { color: colors.textMuted },
  roleChip: { marginTop: spacing.sm, backgroundColor: colors.primary + '15' },
  card: { marginBottom: spacing.md, backgroundColor: colors.surface },
  cardIcon: { backgroundColor: colors.primary + '15' },
  input: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  permWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  permChip: { backgroundColor: colors.secondary + '15' },
  linksCard: { paddingHorizontal: 0 },
  logout: { marginTop: spacing.sm, borderColor: colors.error },
});
