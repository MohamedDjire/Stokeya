import { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, HelperText, Text, TextInput, Snackbar } from 'react-native-paper';
import StokeyaLogo from '../components/StokeyaLogo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { register } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const TIMING_LABELS: Record<string, string> = {
  on_delivery: 'À la livraison',
  before_delivery: 'Avant livraison',
  both: 'Les deux (choix client)',
};

export default function RegisterScreen({ navigation }: Props) {
  const [form, setForm] = useState({
    company_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    shop_slug: '',
    wave_number: '',
    orange_money_number: '',
    payment_timing: 'on_delivery',
    password: '',
    password_confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const cycleTiming = () => {
    const order = ['on_delivery', 'before_delivery', 'both'];
    const idx = order.indexOf(form.payment_timing);
    update('payment_timing', order[(idx + 1) % order.length]);
  };

  const passwordMismatch =
    form.password_confirm.length > 0 && form.password !== form.password_confirm;

  const handleRegister = async () => {
    if (form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register({
        ...form,
        email: form.email.trim().toLowerCase(),
      });
      setSuccess(true);
      setTimeout(() => navigation.navigate('Login'), 1500);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Inscription impossible.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <StokeyaLogo size={56} />
        </View>
        <Text variant="headlineMedium" style={styles.title}>Créer votre entreprise</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>Boutique en ligne + paiements Wave / OM</Text>

        <TextInput label="Nom de l'entreprise" value={form.company_name}
          onChangeText={(v) => update('company_name', v)} mode="outlined" style={styles.input} />
        <TextInput label="Prénom" value={form.first_name}
          onChangeText={(v) => update('first_name', v)} mode="outlined" style={styles.input} />
        <TextInput label="Nom" value={form.last_name}
          onChangeText={(v) => update('last_name', v)} mode="outlined" style={styles.input} />
        <TextInput label="Email" value={form.email}
          onChangeText={(v) => update('email', v)} keyboardType="email-address"
          autoCapitalize="none" mode="outlined" style={styles.input} />
        <TextInput label="Téléphone" value={form.phone}
          onChangeText={(v) => update('phone', v)} keyboardType="phone-pad"
          mode="outlined" style={styles.input} />
        <TextInput label="WhatsApp" value={form.whatsapp}
          onChangeText={(v) => update('whatsapp', v)} keyboardType="phone-pad"
          mode="outlined" style={styles.input} />
        <TextInput label="Adresse" value={form.address}
          onChangeText={(v) => update('address', v)} mode="outlined" style={styles.input} />
        <TextInput label="Ville" value={form.city}
          onChangeText={(v) => update('city', v)} mode="outlined" style={styles.input} />
        <TextInput label="Slug boutique (optionnel)" value={form.shop_slug}
          onChangeText={(v) => update('shop_slug', v)} autoCapitalize="none" mode="outlined" style={styles.input} />
        <HelperText type="info">Lien public : /shop/votre-slug</HelperText>

        <Text variant="titleSmall" style={styles.section}>Paiement boutique</Text>
        <TextInput label="Numéro Wave" value={form.wave_number}
          onChangeText={(v) => update('wave_number', v)} keyboardType="phone-pad"
          mode="outlined" style={styles.input} />
        <TextInput label="Numéro Orange Money" value={form.orange_money_number}
          onChangeText={(v) => update('orange_money_number', v)} keyboardType="phone-pad"
          mode="outlined" style={styles.input} />
        <Button mode="outlined" onPress={cycleTiming} style={styles.input}>
          Paiement : {TIMING_LABELS[form.payment_timing]}
        </Button>

        <TextInput label="Mot de passe" value={form.password}
          onChangeText={(v) => update('password', v)} secureTextEntry mode="outlined" style={styles.input} />
        <TextInput
          label="Confirmer le mot de passe"
          value={form.password_confirm}
          onChangeText={(v) => update('password_confirm', v)}
          secureTextEntry
          mode="outlined"
          error={passwordMismatch}
          style={styles.input}
        />
        {passwordMismatch ? (
          <HelperText type="error" visible>
            Les mots de passe ne correspondent pas.
          </HelperText>
        ) : null}

        <Button mode="contained" onPress={handleRegister} loading={loading}
          disabled={loading || !form.company_name || !form.email || !form.password || passwordMismatch}
          style={styles.button}>
          S'inscrire
        </Button>

        <Button mode="text" onPress={() => navigation.navigate('Login')}>
          Déjà un compte ? Se connecter
        </Button>
      </ScrollView>

      <Snackbar visible={!!error} onDismiss={() => setError('')} duration={4000}>
        {error}
      </Snackbar>
      <Snackbar visible={success} onDismiss={() => setSuccess(false)} duration={2000}>
        Compte créé ! Connectez-vous.
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 24, paddingBottom: 48 },
  title: { marginBottom: 4, fontWeight: 'bold', color: '#0B1F3A' },
  subtitle: { marginBottom: 20, color: '#64748B' },
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  section: { marginTop: 8, marginBottom: 8, fontWeight: '700' },
  input: { marginBottom: 12 },
  button: { marginTop: 8, marginBottom: 8, paddingVertical: 4 },
});
