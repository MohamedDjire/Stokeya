import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { confirmPasswordReset } from '../api/auth';
import { getApiErrorMessage } from '../api/errors';
import { colors, spacing } from '../theme/colors';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { uid, token } = route.params;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 8) {
      Alert.alert('Erreur', 'Minimum 8 caractères.');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset({
        uid, token,
        new_password: password,
        new_password_confirm: confirm,
      });
      Alert.alert('Succès', 'Mot de passe réinitialisé.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Erreur', getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>Nouveau mot de passe</Text>
        <TextInput label="Mot de passe" secureTextEntry mode="outlined" style={styles.input}
          value={password} onChangeText={setPassword} />
        <TextInput label="Confirmer" secureTextEntry mode="outlined" style={styles.input}
          value={confirm} onChangeText={setConfirm} />
        <Button mode="contained" onPress={handleSubmit} loading={loading}
          disabled={!password || !confirm || loading}>
          Réinitialiser
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  input: { marginBottom: spacing.sm },
});
