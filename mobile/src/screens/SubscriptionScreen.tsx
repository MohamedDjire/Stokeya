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
  Text,
} from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  changePlan,
  fetchPlans,
  fetchSubscription,
  type Plan,
  type Subscription,
  type UsageItem,
} from '../api/subscription';
import { colors, radius, spacing } from '../theme/colors';
import { webPaymentUrl } from '../config/web';

const PLAN_BLURBS: Record<string, string> = {
  starter: 'Pour démarrer un petit commerce',
  business: 'Pour les commerces en croissance',
  enterprise: 'Pour les réseaux et équipes',
  trial: 'Pour découvrir Stokeya',
};

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

function planLines(plan: Plan): string[] {
  const lines = [
    plan.unlimited_users ? 'Utilisateurs illimités' : `${plan.max_users} utilisateur${plan.max_users > 1 ? 's' : ''}`,
    plan.unlimited_branches ? 'Boutiques illimitées' : `${plan.max_branches} boutique${plan.max_branches > 1 ? 's' : ''}`,
    plan.unlimited_products ? 'Produits illimités' : `Jusqu'à ${Number(plan.max_products).toLocaleString('fr-FR')} produits`,
  ];
  const hasShop = (plan.features || []).includes('online_shop')
    || (plan.features_detail || []).some((f) => f.code === 'online_shop')
    || plan.code === 'business'
    || plan.code === 'enterprise';
  if (hasShop) lines.push('Boutique en ligne');
  const extras = (plan.features_detail || [])
    .filter((f) => f.code !== 'online_shop')
    .slice(0, 3)
    .map((f) => f.label);
  return [...lines, ...extras];
}

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
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
    const price = Number(plan.price);
    if (price > 0) {
      const url = webPaymentUrl(`/payment/subscription?plan=${plan.code}&cycle=monthly`);
      Alert.alert(
        'Paiement Wave / Orange Money',
        'Les abonnements se règlent sur Stokeya web via SasPay (mobile money, carte ou autre moyen). Ouvrir la page ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ouvrir', onPress: () => Linking.openURL(url) },
        ],
      );
      return;
    }

    setChanging(plan.code);
    try {
      await changePlan(plan.code, 'monthly');
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
  const publicPlans = plans.filter((p) => p.is_public !== false && Number(p.price) >= 0);

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Changer de pack" />
      </AppHeader>

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

        {publicPlans.map((plan) => {
          const isCurrent = plan.code === currentCode;
          const featured = plan.code === 'business';
          const price = Number(plan.price);
          const lines = planLines(plan);
          return (
            <Card key={plan.id} style={[styles.planCard, (featured || isCurrent) && styles.planCardAccent]}>
              <Card.Content>
                {featured && (
                  <Chip compact style={styles.recoChip} textStyle={styles.recoText}>Recommandé</Chip>
                )}
                {isCurrent && (
                  <Chip compact style={styles.currentChip} textStyle={{ fontWeight: '700' }}>Pack actuel</Chip>
                )}
                <Text variant="titleLarge" style={styles.planName}>
                  {plan.name.replace(/^Pack\s+/i, '')}
                </Text>
                <Text variant="bodySmall" style={styles.blurb}>
                  {PLAN_BLURBS[plan.code] || 'Pack Stokeya'}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{price.toLocaleString('fr-FR')}</Text>
                  <Text style={styles.planCurrency}> F</Text>
                </View>
                <Text variant="labelSmall" style={styles.muted}>HT / mois · Sans engagement</Text>

                <Button
                  mode={featured || isCurrent ? 'contained' : 'outlined'}
                  style={styles.planBtn}
                  loading={changing === plan.code}
                  disabled={changing === plan.code}
                  onPress={() => handleChange(plan)}
                >
                  {isCurrent ? 'Renouveler' : price > 0 ? 'S\'abonner' : 'Activer'}
                </Button>

                {lines.map((line) => (
                  <View key={line} style={styles.featureRow}>
                    <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.primary} />
                    <Text variant="bodySmall" style={styles.feature}>{line}</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          );
        })}

        <Text variant="bodySmall" style={styles.note}>
          Paiement SasPay sur Stokeya web : mobile money, carte ou autre moyen. Un seul compte pour mobile et web.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  content: { padding: spacing.md, paddingBottom: 40 },
  loader: { marginTop: 48 },
  currentCard: { marginBottom: spacing.md, backgroundColor: colors.primary + '0D', borderRadius: radius.lg },
  currentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  currentPlan: { fontWeight: '800', color: colors.primary, marginBottom: 4 },
  okChip: { backgroundColor: '#E8F5E9', alignSelf: 'flex-start' },
  koChip: { backgroundColor: '#FFEBEE', alignSelf: 'flex-start' },
  divider: { marginVertical: spacing.sm },
  usageTitle: { fontWeight: '700', marginBottom: spacing.sm },
  usageRow: { marginBottom: spacing.sm },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progress: { height: 6, borderRadius: 3 },
  muted: { color: colors.textMuted },
  planCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  planCardAccent: { borderColor: colors.primary },
  recoChip: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    marginBottom: 8,
  },
  recoText: { color: '#fff', fontWeight: '700' },
  currentChip: { alignSelf: 'center', marginBottom: 8, backgroundColor: '#ECFDF5' },
  planName: { fontWeight: '800', textAlign: 'center', color: colors.secondary },
  blurb: { textAlign: 'center', color: colors.textMuted, marginTop: 4, minHeight: 36 },
  priceRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: 8 },
  planPrice: { fontWeight: '800', fontSize: 36, color: colors.secondary },
  planCurrency: { fontWeight: '800', fontSize: 20, color: colors.secondary, marginBottom: 6 },
  planBtn: { marginTop: spacing.md, marginBottom: spacing.sm, borderRadius: radius.md },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  feature: { flex: 1, color: '#475569', lineHeight: 18 },
  note: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});
