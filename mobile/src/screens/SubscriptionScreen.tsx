import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Chip,
  Divider,
  ProgressBar,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import {
  changePlan,
  fetchPlans,
  fetchSubscription,
  type Plan,
  type Subscription,
  type UsageItem,
} from '../api/subscription';
import { colors, spacing } from '../theme/colors';
import { webPaymentUrl } from '../config/web';

function UsageBar({ label, item }: { label: string; item: UsageItem }) {
  const ratio = item.unlimited || item.limit === 0 ? 0 : Math.min(item.used / item.limit, 1);
  return (
    <View style={styles.usageRow}>
      <View style={styles.usageHeader}>
        <Text variant="bodyMedium">{label}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {item.used} / {item.unlimited ? '∞' : item.limit}
        </Text>
      </View>
      {!item.unlimited && (
        <ProgressBar progress={ratio} color={ratio >= 1 ? colors.error : colors.primary} style={styles.progress} />
      )}
    </View>
  );
}

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [changing, setChanging] = useState<string | null>(null);

  const load = async () => {
    const [sub, planList] = await Promise.all([fetchSubscription(), fetchPlans()]);
    setSubscription(sub);
    setPlans(planList);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleChange = async (plan: Plan) => {
    const price = Number(cycle === 'annual' ? plan.price_annual : plan.price);
    if (price > 0) {
      const url = webPaymentUrl(`/payment/subscription?plan=${plan.code}&cycle=${cycle}`);
      Alert.alert(
        'Paiement sur le web',
        'Les abonnements payants se règlent sur la version web Inventra avec Wave. Ouvrir la page de paiement ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ouvrir', onPress: () => Linking.openURL(url) },
        ],
      );
      return;
    }

    setChanging(plan.code);
    try {
      await changePlan(plan.code, cycle);
      await load();
      Alert.alert('Pack activé', `Vous êtes maintenant sur ${plan.name}.`);
    } catch {
      Alert.alert('Erreur', 'Changement de pack impossible.');
    } finally {
      setChanging(null);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />;
  }

  const currentCode = subscription?.plan_code;

  const limitLabel = (unlimited: boolean, value: number, suffix: string) =>
    unlimited ? `${suffix} illimités` : `${value} ${suffix}`;

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Abonnement" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        {subscription && (
          <Card style={styles.currentCard}>
            <Card.Content>
              <View style={styles.currentHeader}>
                <View>
                  <Text variant="titleLarge" style={styles.currentPlan}>{subscription.plan_name}</Text>
                  <Chip compact style={subscription.is_valid ? styles.okChip : styles.koChip}>
                    {subscription.status === 'trial' ? 'Essai' : subscription.is_valid ? 'Actif' : 'Expiré'}
                  </Chip>
                </View>
                {subscription.end_date && (
                  <Text variant="bodySmall" style={styles.muted}>
                    Jusqu'au {subscription.end_date}
                  </Text>
                )}
              </View>
              <Divider style={styles.divider} />
              <Text variant="titleSmall" style={styles.usageTitle}>Utilisation</Text>
              <UsageBar label="Utilisateurs" item={subscription.usage.users} />
              <UsageBar label="Boutiques" item={subscription.usage.branches} />
              <UsageBar label="Produits" item={subscription.usage.products} />
            </Card.Content>
          </Card>
        )}

        <SegmentedButtons
          value={cycle}
          onValueChange={(v) => setCycle(v as typeof cycle)}
          style={styles.segment}
          buttons={[
            { value: 'monthly', label: 'Mensuel' },
            { value: 'annual', label: 'Annuel (-2 mois)' },
          ]}
        />

        {plans.map((plan) => {
          const isCurrent = plan.code === currentCode;
          const price = cycle === 'annual' ? plan.price_annual : plan.price;
          return (
            <Card key={plan.id} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
              <Card.Content>
                <View style={styles.planHeader}>
                  <Text variant="titleMedium" style={styles.planName}>{plan.name}</Text>
                  <Text variant="titleMedium" style={styles.planPrice}>
                    {Number(price).toLocaleString('fr-FR')} F
                    <Text variant="bodySmall" style={styles.muted}>/{cycle === 'annual' ? 'an' : 'mois'}</Text>
                  </Text>
                </View>

                <Text variant="bodySmall" style={styles.limits}>
                  {limitLabel(plan.unlimited_users, plan.max_users, 'utilisateur(s)')} ·{' '}
                  {limitLabel(plan.unlimited_branches, plan.max_branches, 'boutique(s)')} ·{' '}
                  {limitLabel(plan.unlimited_products, plan.max_products, 'produits')}
                </Text>

                {plan.features_detail.slice(0, 6).map((f) => (
                  <Text key={f.code} variant="bodySmall" style={styles.feature}>✓ {f.label}</Text>
                ))}
                {plan.features_detail.length > 6 && (
                  <Text variant="bodySmall" style={styles.muted}>
                    + {plan.features_detail.length - 6} autre(s)
                  </Text>
                )}

                {isCurrent ? (
                  <Button mode="contained-tonal" disabled style={styles.planBtn}>Pack actuel</Button>
                ) : (
                  <Button
                    mode="contained"
                    style={styles.planBtn}
                    loading={changing === plan.code}
                    onPress={() => handleChange(plan)}
                  >
                    {isCurrent ? 'Pack actuel' : Number(cycle === 'annual' ? plan.price_annual : plan.price) > 0 ? 'Payer sur le web' : 'Choisir ce pack'}
                  </Button>
                )}
              </Card.Content>
            </Card>
          );
        })}

        <Text variant="bodySmall" style={styles.note}>
          Un seul compte Inventra fonctionne sur mobile et web. Les paiements (Wave, Orange Money, MTN Money) se finalisent sur la version web.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  content: { padding: spacing.md },
  loader: { marginTop: 48 },
  currentCard: { marginBottom: spacing.md, backgroundColor: colors.primary + '0D' },
  currentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  currentPlan: { fontWeight: '700', color: colors.primary, marginBottom: 4 },
  okChip: { backgroundColor: '#E8F5E9', alignSelf: 'flex-start' },
  koChip: { backgroundColor: '#FFEBEE', alignSelf: 'flex-start' },
  divider: { marginVertical: spacing.sm },
  usageTitle: { fontWeight: '600', marginBottom: spacing.sm },
  usageRow: { marginBottom: spacing.sm },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progress: { height: 6, borderRadius: 3 },
  muted: { color: colors.textMuted },
  segment: { marginBottom: spacing.md },
  planCard: { marginBottom: spacing.md, backgroundColor: colors.surface },
  planCardCurrent: { borderWidth: 2, borderColor: colors.primary },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontWeight: '700' },
  planPrice: { fontWeight: '700', color: colors.primary },
  limits: { color: colors.textMuted, marginVertical: spacing.sm },
  feature: { marginTop: 2, color: colors.text },
  planBtn: { marginTop: spacing.md },
  note: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});
