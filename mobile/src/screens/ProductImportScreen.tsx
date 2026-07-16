import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, Card, Divider, List, Text } from 'react-native-paper';
import { IMPORT_TEMPLATE_URL, importProducts, type ImportResult, type PickedFile } from '../api/products';
import type { AppStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'ProductImport'>;

export default function ProductImportScreen({ navigation }: Props) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'text/comma-separated-values',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
        'text/plain',
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
    setResult(null);
  };

  const runImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await importProducts(file);
      setResult(res);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      Alert.alert('Import impossible', detail || 'Vérifiez le format du fichier.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.title}>Importer une liste de produits</Text>
            <Text variant="bodySmall" style={styles.help}>
              Formats acceptés : CSV, Excel (.xlsx) ou PDF avec un tableau.
              La première ligne doit contenir les en-têtes de colonnes.
            </Text>
            <Text variant="bodySmall" style={styles.help}>
              Colonnes reconnues : nom (obligatoire), prix_vente (obligatoire),
              prix_achat, sku, description, categorie, marque, unite, tva,
              stock_min, code_barres, stock.
            </Text>
            <Button
              mode="text"
              icon="download"
              onPress={() => Linking.openURL(IMPORT_TEMPLATE_URL)}
              style={styles.templateBtn}
            >
              Télécharger le modèle CSV
            </Button>
          </Card.Content>
        </Card>

        <Button mode="outlined" icon="file-upload" onPress={pickFile} style={styles.action}>
          {file ? 'Changer de fichier' : 'Choisir un fichier'}
        </Button>

        {file && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium" numberOfLines={1}>{file.name}</Text>
              <Text variant="bodySmall" style={styles.muted}>{file.mimeType || 'Type inconnu'}</Text>
            </Card.Content>
          </Card>
        )}

        <Button
          mode="contained"
          icon="database-import"
          onPress={runImport}
          disabled={!file || importing}
          loading={importing}
          style={styles.action}
        >
          Lancer l'import
        </Button>

        {importing && (
          <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />
        )}

        {result && (
          <Card style={[styles.card, styles.resultCard]}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.success}>
                {result.created} produit(s) importé(s)
              </Text>
              <Text variant="bodyMedium">Lignes traitées : {result.total_rows}</Text>
              <Text variant="bodyMedium">Ignorées : {result.skipped}</Text>
              {result.errors.length > 0 && (
                <>
                  <Divider style={styles.divider} />
                  <Text variant="titleSmall" style={styles.errorTitle}>Détails</Text>
                  {result.errors.map((e, i) => (
                    <List.Item
                      key={i}
                      title={e}
                      titleNumberOfLines={3}
                      left={(p) => <List.Icon {...p} icon="alert-circle-outline" color={colors.warning} />}
                      titleStyle={styles.errorItem}
                    />
                  ))}
                </>
              )}
              <Button mode="contained-tonal" onPress={() => navigation.goBack()} style={styles.action}>
                Voir les produits
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  card: { marginBottom: spacing.md },
  resultCard: { backgroundColor: '#F1F8E9' },
  title: { fontWeight: '700', marginBottom: spacing.sm },
  help: { color: colors.textMuted, marginBottom: spacing.sm },
  templateBtn: { alignSelf: 'flex-start', marginTop: spacing.xs },
  action: { marginBottom: spacing.md },
  muted: { color: colors.textMuted, marginTop: 2 },
  success: { color: colors.success, fontWeight: '700', marginBottom: spacing.sm },
  divider: { marginVertical: spacing.sm },
  errorTitle: { marginBottom: spacing.xs },
  errorItem: { fontSize: 12, color: colors.text },
});
