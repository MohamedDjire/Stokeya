import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { requestPasswordReset } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';
import { colors, spacing } from '../theme/colors';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetInfo, setResetInfo] = useState<{ uid: string; token: string } | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await requestPasswordReset(email.trim().toLowerCase());
      if (res.reset) {
        setResetInfo(res.reset);
      } else {
        Alert.alert('Demande envoyée', res.message);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>Mot de passe oublié</Text>
        <Text variant="bodyMedium" style={styles.sub}>
          Entrez votre email pour réinitialiser votre mot de passe.
        </Text>
        <TextInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address"
          autoCapitalize="none" mode="outlined" style={styles.input} />
        {error ? <HelperText type="error">{error}</HelperText> : null}
        <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={!email || loading}>
          Envoyer
        </Button>
        {resetInfo && (
          <Button mode="outlined" style={{ marginTop: 12 }}
            onPress={() => navigation.navigate('ResetPassword', resetInfo)}>
            Continuer la réinitialisation
          </Button>
        )}
        <Button mode="text" onPress={() => navigation.goBack()}>Retour connexion</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  sub: { color: colors.textMuted, marginBottom: spacing.lg },
  input: { marginBottom: spacing.sm },
});
