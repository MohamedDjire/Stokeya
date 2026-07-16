import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Banner } from 'react-native-paper';
import { flushOfflineQueue } from '../offline/sync';
import { getOfflineQueue } from '../offline/storage';

type Props = {
  onSynced?: () => void;
};

export default function OfflineBanner({ onSynced }: Props) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshPending = async () => {
    const queue = await getOfflineQueue();
    setPending(queue.length);
  };

  useEffect(() => {
    refreshPending();
    const unsub = NetInfo.addEventListener((state) => {
      const next = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(next);
      if (next) {
        setSyncing(true);
        flushOfflineQueue()
          .then((result) => {
            if (result.synced > 0) {
              setMessage(`${result.synced} vente(s) synchronisée(s)`);
              onSynced?.();
            }
          })
          .finally(() => {
            setSyncing(false);
            refreshPending();
          });
      }
    });
    return unsub;
  }, [onSynced]);

  if (online && pending === 0 && !message) return null;

  if (!online) {
    return (
      <Banner visible icon="cloud-off-outline" style={styles.offline}>
        Mode hors ligne — les ventes espèces sont enregistrées localement
        {pending > 0 ? ` (${pending} en attente)` : ''}.
      </Banner>
    );
  }

  if (pending > 0 || syncing || message) {
    return (
      <Banner
        visible
        icon={syncing ? 'sync' : 'cloud-upload-outline'}
        actions={message ? [{ label: 'OK', onPress: () => setMessage(null) }] : []}
        style={styles.pending}
      >
        {syncing
          ? 'Synchronisation des ventes offline…'
          : message || `${pending} vente(s) en attente de synchronisation`}
      </Banner>
    );
  }

  return <View />;
}

const styles = StyleSheet.create({
  offline: { backgroundColor: '#FFF3E0' },
  pending: { backgroundColor: '#E3F2FD' },
});
