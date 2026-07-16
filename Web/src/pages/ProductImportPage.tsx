import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import PageHeader from '../components/PageHeader';
import { importProducts, IMPORT_TEMPLATE_URL, type ImportResult } from '../api/auth';
import { API_BASE_URL } from '../config/api';
import { getAccessToken } from '../api/client';
import { getApiErrorMessage } from '../api/client';

export default function ProductImportPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runImport = async () => {
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      setResult(await importProducts(file));
    } catch (err) {
      setError(getApiErrorMessage(err, "Import impossible."));
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE_URL}${IMPORT_TEMPLATE_URL}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele_produits.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <PageHeader
        title="Importer des produits"
        subtitle="Fichiers CSV, Excel (.xlsx) ou PDF"
        action={
          <Button variant="outlined" onClick={() => navigate('/products')}>
            Retour aux produits
          </Button>
        }
      />

      <Card sx={{ maxWidth: 640 }}>
        <CardContent>
          <Stack spacing={2}>
            <Alert severity="info">
              Le fichier doit contenir au minimum une colonne <b>nom</b> et <b>prix de vente</b>. Les
              catégories, marques et unités manquantes sont créées automatiquement.
            </Alert>

            <Button startIcon={<DownloadIcon />} onClick={downloadTemplate} variant="text" sx={{ alignSelf: 'flex-start' }}>
              Télécharger le modèle CSV
            </Button>

            <Divider />

            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
              {file ? file.name : 'Choisir un fichier'}
              <input
                type="file"
                hidden
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
              />
            </Button>

            <Button variant="contained" onClick={runImport} disabled={!file || loading}>
              {loading ? 'Import en cours...' : 'Lancer l\'import'}
            </Button>

            {error && <Alert severity="error">{error}</Alert>}

            {result && (
              <Box>
                <Alert severity={result.errors.length ? 'warning' : 'success'}>
                  {result.created} produit(s) créé(s), {result.skipped} ignoré(s).
                </Alert>
                {result.errors.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2 }}>
                      Erreurs :
                    </Typography>
                    <List dense>
                      {result.errors.slice(0, 20).map((e, i) => (
                        <ListItem key={i}>
                          <ListItemText primary={e} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
