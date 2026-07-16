import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Text } from 'react-native-paper';
import { colors, spacing } from '../theme/colors';

type Props = {
  onScan: (code: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={styles.center}><Text>Chargement caméra...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Accès caméra requis pour scanner</Text>
        <Button mode="contained" onPress={requestPermission}>Autoriser</Button>
        <Button onPress={onClose} style={{ marginTop: 8 }}>Annuler</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'qr'] }}
        onBarcodeScanned={scanned ? undefined : ({ data }) => {
          setScanned(true);
          onScan(data);
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.hint}>Placez le code-barres dans le cadre</Text>
        <Button mode="contained" onPress={onClose} buttonColor={colors.error}>Fermer</Button>
        {scanned && (
          <Button mode="outlined" onPress={() => setScanned(false)} textColor="#FFF">
            Scanner à nouveau
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 8,
  },
  hint: { color: '#FFF', textAlign: 'center', marginBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  msg: { marginBottom: spacing.md, textAlign: 'center' },
});
