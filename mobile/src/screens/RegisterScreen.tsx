import { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Text, TextInput, Snackbar } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { register } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [form, setForm] = useState({
    company_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    password_confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
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
        <Text variant="headlineMedium" style={styles.title}>Créer votre entreprise</Text>

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
        <TextInput label="Mot de passe" value={form.password}
          onChangeText={(v) => update('password', v)} secureTextEntry mode="outlined" style={styles.input} />
        <TextInput label="Confirmer le mot de passe" value={form.password_confirm}
          onChangeText={(v) => update('password_confirm', v)} secureTextEntry mode="outlined" style={styles.input} />

        <Button mode="contained" onPress={handleRegister} loading={loading}
          disabled={loading || !form.company_name || !form.email || !form.password}
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
  title: { marginBottom: 24, fontWeight: 'bold', color: '#1565C0' },
  input: { marginBottom: 12 },
  button: { marginTop: 8, marginBottom: 8, paddingVertical: 4 },
});
