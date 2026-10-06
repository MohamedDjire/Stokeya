import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUploadOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import PageHeader from '../components/PageHeader';
import {
  analyzeProductImport,
  executeProductImport,
  fetchImportHistory,
  prepareProductImport,
  undoProductImport,
  IMPORT_TEMPLATE_URL,
  type ImportExecuteResult,
  type ImportHistoryItem,
  type ImportRow,
} from '../api/auth';
import { API_BASE_URL } from '../config/api';
import { getAccessToken, getApiErrorMessage } from '../api/client';
import { formatDate } from '../utils/format';
import { useLocale } from '../locale/useLocale';

const ACCEPT = '.xlsx,.xls,.csv';

const REQUIRED_LABELS: Record<string, string> = {
  name: 'Nom du produit',
  sale_price: 'Prix de vente',
};

function rowIssues(row: ImportRow): string[] {
  const issues: string[] = [];
  if (!row.name.trim()) issues.push('empty_name');
  const price = Number(String(row.sale_price).replace(',', '.'));
  if (!row.sale_price.trim() || Number.isNaN(price) || price <= 0) issues.push('invalid_price');
  return issues;
}

export default function ProductImportPage() {
  const navigate = useNavigate();
  const { tr, version } = useLocale();
  void version;
  const [dragOver, setDragOver] = useState(false);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<ImportExecuteResult | null>(null);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await fetchImportHistory());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const incompleteCount = useMemo(
    () => rows.filter((r) => rowIssues(r).length > 0).length,
    [rows],
  );

  const pickFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setRows([]);
    setBatchId(null);
    setLoading(true);
    try {
      const data = await analyzeProductImport(file);
      setBatchId(data.batch_id);
      setFilename(data.filename);
      setHeaders(data.headers);
      setMapping({ ...data.suggested_mapping });
      setMissingRequired(data.missing_required);
      setRows(data.rows.map((r) => ({ ...r, issues: rowIssues(r) })));
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Analyse du fichier impossible.')));
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void pickFile(dropped);
  };

  const applyMissingMapping = async () => {
    if (!batchId) return;
    setError(null);
    setLoading(true);
    try {
      const nextMapping = { ...mapping };
      for (const key of missingRequired) {
        if (nextMapping[key] === undefined || nextMapping[key] === null) {
          setError(tr(`Sélectionnez la colonne pour « ${REQUIRED_LABELS[key] || key} ».`));
          setLoading(false);
          return;
        }
      }
      const data = await prepareProductImport(batchId, nextMapping);
      setMapping(data.column_mapping);
      setMissingRequired(data.missing_required);
      setRows(data.rows.map((r) => ({ ...r, issues: rowIssues(r) })));
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Mise à jour impossible.')));
    } finally {
      setLoading(false);
    }
  };

  const updateCell = (index: number, field: keyof ImportRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      row.issues = rowIssues(row);
      next[index] = row;
      return next;
    });
  };

  const confirmImport = async () => {
    if (!batchId) return;
    if (incompleteCount > 0) {
      setError(tr(`Complétez les ${incompleteCount} ligne(s) avec nom ou prix manquant avant de valider.`));
      return;
    }
    setError(null);
    setImporting(true);
    try {
      const data = await executeProductImport(batchId, { rows });
      setResult(data);
      await loadHistory();
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Import impossible.')));
    } finally {
      setImporting(false);
    }
  };

  const runUndo = async (id: number) => {
    setError(null);
    setLoading(true);
    try {
      await undoProductImport(id);
      if (result?.batch_id === id) setResult(null);
      await loadHistory();
    } catch (err) {
      setError(getApiErrorMessage(err, tr('Annulation impossible.')));
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

  const reset = () => {
    setBatchId(null);
    setFilename('');
    setHeaders([]);
    setMapping({});
    setMissingRequired([]);
    setRows([]);
    setResult(null);
    setError(null);
  };

  const needsColumnPick = missingRequired.length > 0;

  return (
    <Box>
      <PageHeader
        title={tr('Importer des produits')}
        subtitle={tr('Déposez votre fichier — Stokeya fait le reste')}
        action={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<DownloadIcon />} onClick={() => void downloadTemplate()} variant="outlined">
              {tr('Télécharger un modèle')}
            </Button>
            <Button variant="text" onClick={() => navigate('/products')}>
              {tr('Retour')}
            </Button>
          </Stack>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!batchId && !result && (
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          sx={{
            border: '2px dashed',
            borderColor: dragOver ? 'primary.main' : 'divider',
            bgcolor: dragOver ? 'action.hover' : 'background.paper',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            maxWidth: 720,
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            {tr('Déposer votre fichier ici')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {tr("Colonnes reconnues automatiquement. Vous n'avez rien à préparer dans Excel.")}
          </Typography>
          <Button variant="contained" component="label" startIcon={<UploadFileIcon />} disabled={loading}>
            {loading ? tr('Analyse…') : tr('Choisir un fichier')}
            <input
              type="file"
              hidden
              accept={ACCEPT}
              onChange={(e) => void pickFile(e.target.files?.[0] || null)}
            />
          </Button>
          <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">
            {tr('.xlsx ou .csv')}
          </Typography>
          {loading && <LinearProgress sx={{ mt: 2 }} />}
        </Box>
      )}

      {batchId && !result && needsColumnPick && (
        <Stack spacing={2} sx={{ maxWidth: 640 }}>
          <Alert severity="warning">
            {tr(`Stokeya n'a pas trouvé automatiquement ${missingRequired.length > 1 ? 'ces colonnes' : 'cette colonne'}. Indiquez laquelle utiliser, puis continuez.`)}
          </Alert>
          {missingRequired.map((key) => (
            <TextField
              key={key}
              select
              label={tr(REQUIRED_LABELS[key] || key)}
              value={mapping[key] ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setMapping((prev) => {
                  const next = { ...prev };
                  if (value === '') delete next[key];
                  else next[key] = Number(value);
                  return next;
                });
              }}
              fullWidth
            >
              <MenuItem value="">{tr('— Choisir —')}</MenuItem>
              {headers.map((header, index) => (
                <MenuItem key={`${header}-${index}`} value={index}>
                  {header || tr(`Colonne ${index + 1}`)}
                </MenuItem>
              ))}
            </TextField>
          ))}
          <Stack direction="row" spacing={1}>
            <Button onClick={reset}>{tr('Annuler')}</Button>
            <Button variant="contained" disabled={loading} onClick={() => void applyMissingMapping()}>
              {tr('Continuer')}
            </Button>
          </Stack>
        </Stack>
      )}

      {batchId && !result && !needsColumnPick && (
        <Stack spacing={2}>
          <Alert severity="success">
            {tr(`${rows.length} produit(s) prêts à partir de « ${filename} ». Catégories, marques et unités seront créées automatiquement. Les doublons (SKU / code-barres) seront mis à jour.`)}
          </Alert>

          {incompleteCount > 0 && (
            <Alert severity="warning">
              {tr(`${incompleteCount} ligne(s) incomplète(s) — renseignez le nom et le prix de vente dans le tableau.`)}
            </Alert>
          )}

          <TableContainer sx={{ maxHeight: 520, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width={56}>{tr('Ligne')}</TableCell>
                  <TableCell>{tr('Nom *')}</TableCell>
                  <TableCell width={120}>{tr('Prix *')}</TableCell>
                  <TableCell width={110}>{tr('SKU')}</TableCell>
                  <TableCell width={90}>{tr('Stock')}</TableCell>
                  <TableCell>{tr('Catégorie')}</TableCell>
                  <TableCell>{tr('Marque')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => {
                  const issues = rowIssues(row);
                  const bad = issues.length > 0;
                  return (
                    <TableRow key={row.line} sx={{ bgcolor: bad ? 'rgba(211, 47, 47, 0.06)' : undefined }}>
                      <TableCell>{row.line}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.name}
                          error={issues.includes('empty_name')}
                          onChange={(e) => updateCell(index, 'name', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.sale_price}
                          error={issues.includes('invalid_price')}
                          onChange={(e) => updateCell(index, 'sale_price', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.sku}
                          onChange={(e) => updateCell(index, 'sku', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.quantity}
                          onChange={(e) => updateCell(index, 'quantity', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.category}
                          onChange={(e) => updateCell(index, 'category', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.brand}
                          onChange={(e) => updateCell(index, 'brand', e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {importing && <LinearProgress />}

          <Stack direction="row" spacing={1}>
            <Button onClick={reset} disabled={importing}>{tr('Annuler')}</Button>
            <Button
              variant="contained"
              disabled={importing || rows.length === 0 || incompleteCount > 0}
              onClick={() => void confirmImport()}
            >
              {importing ? tr('Import…') : tr(`Valider l'import (${rows.length})`)}
            </Button>
          </Stack>
        </Stack>
      )}

      {result && (
        <Stack spacing={2} sx={{ maxWidth: 720 }}>
          <Alert severity={result.errors.length ? 'warning' : 'success'}>
            {tr(`Import terminé — ${result.created} créés, ${result.updated} mis à jour, ${result.skipped} ignorés.`)}
          </Alert>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {result.can_undo_until && (
              <Button
                color="warning"
                startIcon={<UndoIcon />}
                onClick={() => void runUndo(result.batch_id)}
                disabled={loading}
              >
                {tr('Annuler cet import (30 min)')}
              </Button>
            )}
            <Button variant="contained" onClick={() => navigate('/products')}>
              {tr('Voir les produits')}
            </Button>
            <Button onClick={reset}>{tr('Nouvel import')}</Button>
          </Stack>
          {result.errors.length > 0 && (
            <List dense>
              {result.errors.slice(0, 15).map((e, i) => (
                <ListItem key={i}>
                  <ListItemText
                    primary={e.line ? tr(`Ligne ${e.line} — ${e.name || '—'}`) : e.message}
                    secondary={e.line ? e.message : undefined}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      )}

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" gutterBottom>
        {tr('Historique')}
      </Typography>
      {history.length === 0 ? (
        <Typography color="text.secondary">{tr('Aucun import pour le moment.')}</Typography>
      ) : (
        <List dense sx={{ maxWidth: 720 }}>
          {history.map((item) => (
            <ListItem
              key={item.id}
              secondaryAction={
                item.can_undo ? (
                  <Button size="small" startIcon={<UndoIcon />} onClick={() => void runUndo(item.id)}>
                    {tr('Annuler')}
                  </Button>
                ) : undefined
              }
            >
              <ListItemText
                primary={tr(`${formatDate(item.created_at)} — ${item.created_count} produits · ${item.filename}`)}
                secondary={tr(`Par ${item.created_by || '—'} · ${item.status}`)}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
