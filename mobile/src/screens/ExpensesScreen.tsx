import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Text, TextInput } from 'react-native-paper';
import AppHeader from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import { createExpense, createExpenseCategory, fetchExpenseCategories, fetchExpenses } from '../api/expenses';
import { colors, spacing } from '../theme/colors';

export default function ExpensesScreen() {
  const navigation = useNavigation();
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof fetchExpenses>>>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof fetchExpenseCategories>>>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const load = async () => {
    const [e, c] = await Promise.all([fetchExpenses(), fetchExpenseCategories()]);
    setExpenses(e);
    setCategories(c);
    if (!categoryId && c[0]) setCategoryId(c[0].id);
  };

  useEffect(() => { load(); }, []);

  const ensureCategory = async () => {
    if (categories.length) return categories[0].id;
    const cat = await createExpenseCategory('Général');
    await load();
    return cat.id;
  };

  const handleCreate = async () => {
    if (!amount || !description.trim()) return;
    try {
      const catId = categoryId || await ensureCategory();
      await createExpense({
        category: catId,
        amount,
        description: description.trim(),
        date: new Date().toISOString().slice(0, 10),
      });
      setAmount('');
      setDescription('');
      await load();
    } catch {
      Alert.alert('Erreur', 'Dépense impossible.');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Dépenses" />
      </AppHeader>

      <View style={styles.form}>
        <TextInput label="Montant (XOF)" mode="outlined" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} />
        <TextInput label="Description" mode="outlined" value={description} onChangeText={setDescription} style={styles.input} />
        <Button mode="contained" onPress={handleCreate}>Enregistrer</Button>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall">{item.category_name}</Text>
              <Text variant="bodyMedium">{item.description}</Text>
              <Text variant="bodySmall" style={styles.amount}>
                {Number(item.amount).toLocaleString('fr-FR')} XOF · {item.date}
              </Text>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  form: { padding: spacing.md, backgroundColor: colors.surface },
  input: { marginBottom: spacing.sm },
  list: { padding: spacing.md },
  card: { marginBottom: spacing.sm },
  amount: { color: colors.error, marginTop: 4, fontWeight: '600' },
});
