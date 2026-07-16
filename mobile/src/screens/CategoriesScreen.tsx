import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Appbar, Button, Card, Chip, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import {
  createCategory,
  createTag,
  fetchCategories,
  fetchTags,
  type Category,
  type Tag,
} from '../api/categories';
import { colors, spacing } from '../theme/colors';

type Tab = 'categories' | 'tags';

export default function CategoriesScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>('categories');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#1565C0');

  const load = useCallback(async (q?: string) => {
    const [c, t] = await Promise.all([fetchCategories(q), fetchTags(q)]);
    setCategories(c);
    setTags(t);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleSearch = async (v: string) => {
    setSearch(v);
    await load(v.trim() || undefined);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      if (tab === 'categories') {
        if (!categoryName.trim()) return;
        await createCategory({ name: categoryName.trim() });
        setCategoryName('');
      } else {
        if (!tagName.trim()) return;
        await createTag({ name: tagName.trim(), color: tagColor });
        setTagName('');
      }
      setShowForm(false);
      await load(search.trim() || undefined);
    } catch {
      Alert.alert('Erreur', 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const count = tab === 'categories' ? categories.length : tags.length;

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Catégories & Tags" subtitle={`${count} élément(s)`} />
        <Appbar.Action icon="plus" onPress={() => setShowForm(!showForm)} />
      </Appbar.Header>

      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        style={styles.segment}
        buttons={[
          { value: 'categories', label: 'Catégories' },
          { value: 'tags', label: 'Tags' },
        ]}
      />

      {showForm && (
        <View style={styles.form}>
          {tab === 'categories' ? (
            <TextInput label="Nom de catégorie" mode="outlined" value={categoryName} onChangeText={setCategoryName} style={styles.input} />
          ) : (
            <>
              <TextInput label="Nom du tag" mode="outlined" value={tagName} onChangeText={setTagName} style={styles.input} />
              <TextInput label="Couleur (#hex)" mode="outlined" value={tagColor} onChangeText={setTagColor} style={styles.input} />
            </>
          )}
          <Button mode="contained" onPress={handleCreate} loading={saving}>Enregistrer</Button>
        </View>
      )}

      <Searchbar placeholder="Rechercher..." value={search} onChangeText={handleSearch} style={styles.search} />

      {tab === 'categories' ? (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search.trim() || undefined)} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium">{item.name}</Text>
                <Text variant="bodySmall" style={styles.meta}>
                  {item.parent_name ? `Parent : ${item.parent_name}` : 'Racine'}
                </Text>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucune catégorie</Text>}
        />
      ) : (
        <FlatList
          data={tags}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(search.trim() || undefined)} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Card.Content style={styles.tagRow}>
                <Chip style={{ backgroundColor: item.color || colors.primary }} textStyle={styles.chipText}>
                  {item.name}
                </Chip>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aucun tag</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.surface },
  segment: { margin: spacing.md, marginBottom: 0 },
  form: { padding: spacing.md, backgroundColor: colors.surface },
  input: { marginBottom: spacing.sm },
  search: { margin: spacing.md },
  list: { padding: spacing.md, paddingTop: 0 },
  card: { marginBottom: spacing.sm },
  meta: { color: colors.textMuted, marginTop: 4 },
  tagRow: { flexDirection: 'row' },
  chipText: { color: '#FFF' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32 },
});
