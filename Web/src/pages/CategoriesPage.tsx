import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../components/PageHeader';
import {
  createCategory,
  createTag,
  fetchCategoriesList,
  fetchTags,
  updateCategory,
  updateTag,
  type Category,
  type Tag,
} from '../api/categories';
import { getApiErrorMessage } from '../api/client';

const categoryEmpty = { name: '', parent: '' as number | '', is_active: true };
const tagEmpty = { name: '', color: '#1976d2', is_active: true };

export default function CategoriesPage() {
  const [tab, setTab] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [categoryForm, setCategoryForm] = useState(categoryEmpty);
  const [tagForm, setTagForm] = useState(tagEmpty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(() => fetchCategoriesList().then(setCategories), []);
  const loadTags = useCallback(() => fetchTags().then(setTags), []);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([loadCategories(), loadTags()]).finally(() => setLoading(false));
  }, [loadCategories, loadTags]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openCategoryDialog = (c?: Category) => {
    setEditingCategory(c || null);
    setCategoryForm(c
      ? { name: c.name, parent: c.parent || '', is_active: c.is_active }
      : categoryEmpty);
    setError(null);
    setOpen(true);
  };

  const openTagDialog = (t?: Tag) => {
    setEditingTag(t || null);
    setTagForm(t ? { name: t.name, color: t.color || '#1976d2', is_active: t.is_active } : tagEmpty);
    setError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingCategory(null);
    setEditingTag(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (tab === 0) {
        if (!categoryForm.name) { setError('Le nom est obligatoire.'); return; }
        const payload = {
          name: categoryForm.name,
          parent: categoryForm.parent ? Number(categoryForm.parent) : null,
          is_active: categoryForm.is_active,
        };
        if (editingCategory) await updateCategory(editingCategory.id, payload);
        else await createCategory(payload);
        await loadCategories();
      } else {
        if (!tagForm.name) { setError('Le nom est obligatoire.'); return; }
        if (editingTag) await updateTag(editingTag.id, tagForm);
        else await createTag(tagForm);
        await loadTags();
      }
      closeDialog();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const categoryColumns: GridColDef<Category>[] = [
    { field: 'name', headerName: 'Nom', flex: 1, minWidth: 180 },
    { field: 'parent_name', headerName: 'Parent', width: 160, valueGetter: (v) => v || '—' },
    {
      field: 'is_active', headerName: 'Actif', width: 90,
      valueGetter: (v) => (v ? 'Oui' : 'Non'),
    },
  ];

  const tagColumns: GridColDef<Tag>[] = [
    { field: 'name', headerName: 'Nom', flex: 1, minWidth: 180 },
    {
      field: 'color', headerName: 'Couleur', width: 120,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: p.value, border: '1px solid #ccc' }} />
          {p.value}
        </Box>
      ),
    },
    {
      field: 'is_active', headerName: 'Actif', width: 90,
      valueGetter: (v) => (v ? 'Oui' : 'Non'),
    },
  ];

  const parentOptions = categories.filter((c) => !editingCategory || c.id !== editingCategory.id);

  return (
    <Box>
      <PageHeader
        title="Catégories & tags"
        subtitle="Organisez votre catalogue produits"
        action={
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => (tab === 0 ? openCategoryDialog() : openTagDialog())}>
            {tab === 0 ? 'Nouvelle catégorie' : 'Nouveau tag'}
          </Button>
        }
      />

      <Card sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`Catégories (${categories.length})`} />
          <Tab label={`Tags (${tags.length})`} />
        </Tabs>
      </Card>

      <Box sx={{ height: 560, bgcolor: 'background.paper', borderRadius: 2 }}>
        {tab === 0 ? (
          <DataGrid rows={categories} columns={categoryColumns} loading={loading} disableRowSelectionOnClick
            onRowClick={(p) => openCategoryDialog(p.row as Category)}
            sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
        ) : (
          <DataGrid rows={tags} columns={tagColumns} loading={loading} disableRowSelectionOnClick
            onRowClick={(p) => openTagDialog(p.row as Tag)}
            sx={{ border: 'none', '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
        )}
      </Box>

      <Dialog open={open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {tab === 0
            ? (editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie')
            : (editingTag ? 'Modifier le tag' : 'Nouveau tag')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {tab === 0 ? (
              <>
                <TextField label="Nom" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} fullWidth required />
                <TextField select label="Catégorie parente" value={categoryForm.parent} onChange={(e) => setCategoryForm({ ...categoryForm, parent: e.target.value ? Number(e.target.value) : '' })} fullWidth>
                  <MenuItem value="">Aucune (racine)</MenuItem>
                  {parentOptions.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
                <FormControlLabel control={<Checkbox checked={categoryForm.is_active} onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })} />} label="Actif" />
              </>
            ) : (
              <>
                <TextField label="Nom" value={tagForm.name} onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })} fullWidth required />
                <TextField label="Couleur (hex)" value={tagForm.color} onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })} fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <input type="color" value={tagForm.color} onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                          style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', background: 'transparent' }} />
                      </InputAdornment>
                    ),
                  }} />
                <FormControlLabel control={<Checkbox checked={tagForm.is_active} onChange={(e) => setTagForm({ ...tagForm, is_active: e.target.checked })} />} label="Actif" />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Annuler</Button>
          <Button variant="contained" onClick={save} disabled={saving}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
