import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CategoryIcon from '@mui/icons-material/CategoryOutlined';
import {
  fetchStockStatus,
  parseTransferFile,
  stockTransfer,
  suggestReplenishment,
  type StockStatusItem,
  type StockTransfer,
  type WarehouseItem,
} from '../../api/stock';
import { getApiErrorMessage } from '../../api/client';
import { formatNumber } from '../../utils/format';
import { formatTransferValue, transferSummaryValue } from './printTransferSlip';
import { useLocale } from '../../locale/useLocale';

function isPosOutlet(w: WarehouseItem) {
  return Boolean(w.is_pos_stock && w.branch_is_main === false);
}

function availableOf(row: StockStatusItem) {
  const qty = Number(row.quantity || 0);
  const reserved = Number(row.reserved_quantity || 0);
  if (row.available != null && row.available !== '') {
    const a = Number(row.available);
    if (!Number.isNaN(a)) return Math.max(0, a);
  }
  return Math.max(0, qty - reserved);
}

function physicalOf(row: StockStatusItem) {
  return Math.max(0, Number(row.quantity || 0));
}

function warehouseLabel(w: WarehouseItem) {
  const kind = !w.is_pos_stock
    ? 'Entrepôt'
    : w.branch_is_main
      ? 'Siège'
      : 'Point de vente';
  const stock = w.products_in_stock != null ? ` · ${formatNumber(w.products_in_stock)} en stock` : '';
  return `${w.name} — ${w.branch_name} (${kind})${stock}`;
}

function pickDefaultSource(warehouses: WarehouseItem[]): number | '' {
  const ranked = [...warehouses].sort((a, b) => {
    const stockDiff = (b.products_in_stock || 0) - (a.products_in_stock || 0);
    if (stockDiff !== 0) return stockDiff;
    if (a.branch_is_main && a.is_pos_stock && !(b.branch_is_main && b.is_pos_stock)) return -1;
    if (b.branch_is_main && b.is_pos_stock && !(a.branch_is_main && a.is_pos_stock)) return 1;
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return a.id - b.id;
  });
  const withStock = ranked.find((w) => (w.products_in_stock || 0) > 0);
  return withStock?.id || ranked[0]?.id || '';
}

type QtyMap = Record<number, string>;

const STEPS = ['Source & destination', 'Produits', 'Résumé'];

export default function TransferCreateDialog({
  open,
  warehouses,
  recentTransfers,
  initialFrom,
  initialTo,
  autoSmart,
  onClose,
  onCreated,
}: {
  open: boolean;
  warehouses: WarehouseItem[];
  recentTransfers: StockTransfer[];
  initialFrom?: number | '';
  initialTo?: number | '';
  autoSmart?: boolean;
  onClose: () => void;
  onCreated: (transfer: StockTransfer) => void;
}) {
  const { tr, version } = useLocale();
  void version;
  const [step, setStep] = useState(0);
  const [fromId, setFromId] = useState<number | ''>('');
  const [toId, setToId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [carrier, setCarrier] = useState('');
  const [catalog, setCatalog] = useState<StockStatusItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [qtys, setQtys] = useState<QtyMap>({});
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [bulkQty, setBulkQty] = useState('100');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [categoryPct, setCategoryPct] = useState('20');
  const [copyId, setCopyId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(0);
    setFromId('');
    setToId('');
    setNotes('');
    setCarrier('');
    setCatalog([]);
    setQtys({});
    setSelected({});
    setSearch('');
    setBarcode('');
    setBulkQty('100');
    setCategoryId('');
    setCategoryPct('20');
    setCopyId('');
    setError(null);
    setInfo(null);
  }, []);

  useEffect(() => {
    if (open) {
      reset();
      const preferredFrom = initialFrom || pickDefaultSource(warehouses);
      if (preferredFrom) setFromId(Number(preferredFrom));
      if (initialTo) setToId(Number(initialTo));
    }
  }, [open, reset, warehouses, initialFrom, initialTo]);

  useEffect(() => {
    if (open && autoSmart && fromId && toId && step === 0) {
      // Laisser l'utilisateur lancer le calcul ; on préremplit juste les emplacements
      setInfo('Emplacements préremplis. Cliquez sur « Approvisionnement intelligent » ou continuez pour saisir manuellement.');
    }
  }, [open, autoSmart, fromId, toId, step]);

  const destinations = useMemo(() => {
    const from = warehouses.find((w) => w.id === fromId);
    return warehouses.filter((w) => {
      if (w.id === fromId) return false;
      if (from && isPosOutlet(from) && isPosOutlet(w)) return false;
      return true;
    });
  }, [warehouses, fromId]);

  const loadCatalog = useCallback(async (warehouseId: number) => {
    setLoadingCatalog(true);
    setError(null);
    setInfo(null);
    try {
      const rows = await fetchStockStatus(warehouseId);
      // Produits avec stock physique > 0 (même si partiellement réservé)
      const withStock = rows.filter((r) => physicalOf(r) > 0);
      setCatalog(withStock);
      if (rows.length === 0) {
        setInfo(
          'Aucun stock enregistré sur cet emplacement. Choisissez le siège / entrepôt qui contient réellement les marchandises (indiqué « … en stock » dans la liste Source).',
        );
      } else if (withStock.length === 0) {
        setInfo('Tous les produits de cet emplacement sont à quantité 0.');
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setCatalog([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    if (fromId && step >= 1) loadCatalog(Number(fromId));
  }, [fromId, step, loadCatalog]);

  const catalogCategories = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>();
    catalog.forEach((r) => {
      const id = Number(r.category_id);
      if (!id) return;
      const prev = map.get(id);
      if (prev) prev.count += 1;
      else map.set(id, { id, name: r.category_name || `Catégorie #${id}`, count: 1 });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [catalog]);

  const uncategorizedCount = useMemo(
    () => catalog.filter((r) => !Number(r.category_id)).length,
    [catalog],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((r) => {
      if (categoryId === 0) {
        if (Number(r.category_id)) return false;
      } else if (categoryId && Number(r.category_id) !== Number(categoryId)) {
        return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q)
        || (r.sku || '').toLowerCase().includes(q)
        || (r.barcode || '').toLowerCase().includes(q)
        || (r.category_name || '').toLowerCase().includes(q)
      );
    });
  }, [catalog, search, categoryId]);

  const lines = useMemo(
    () => catalog
      .filter((r) => Number(qtys[r.product_id] || 0) > 0)
      .map((r) => ({
        product_id: r.product_id,
        product_name: r.name,
        quantity: qtys[r.product_id],
        available: availableOf(r),
        purchase_price: r.purchase_price,
      })),
    [catalog, qtys],
  );

  const priceMap = useMemo(() => {
    const map: Record<number, string | number> = {};
    catalog.forEach((r) => { map[r.product_id] = r.purchase_price; });
    return map;
  }, [catalog]);

  const totalQty = lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const totalValue = transferSummaryValue(lines, priceMap);

  const setQty = (productId: number, value: string) => {
    const row = catalog.find((r) => r.product_id === productId);
    const max = row ? availableOf(row) : Infinity;
    let n = value;
    if (n !== '' && Number(n) > max) n = String(max);
    if (n !== '' && Number(n) < 0) n = '0';
    setQtys((prev) => ({ ...prev, [productId]: n }));
  };

  const bumpQty = (productId: number, delta: number) => {
    const current = Number(qtys[productId] || 0);
    setQty(productId, String(Math.max(0, current + delta)));
  };

  const applyBarcode = () => {
    const code = barcode.trim().toLowerCase();
    if (!code) return;
    const row = catalog.find((r) => (
      (r.barcode || '').toLowerCase() === code
      || (r.sku || '').toLowerCase() === code
    ));
    if (!row) {
      setError(`Produit introuvable pour « ${barcode} ».`);
      return;
    }
    setError(null);
    setSearch(row.name);
    bumpQty(row.product_id, 1);
    setBarcode('');
    barcodeRef.current?.focus();
  };

  const applyBulkToSelected = () => {
    const qty = Number(bulkQty);
    if (!qty || qty <= 0) {
      setError('Indiquez une quantité valide.');
      return;
    }
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
    if (ids.length === 0) {
      setError('Cochez au moins un produit.');
      return;
    }
    setError(null);
    setQtys((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        const row = catalog.find((r) => r.product_id === id);
        const max = row ? availableOf(row) : qty;
        next[id] = String(Math.min(qty, max));
      });
      return next;
    });
    setInfo(`${ids.length} produit(s) mis à ${qty} unités.`);
  };

  const applyCategoryPct = () => {
    if (categoryId === '') {
      setError('Choisissez une catégorie (ou « Sans catégorie »).');
      return;
    }
    const pct = Number(categoryPct);
    if (!pct || pct <= 0 || pct > 100) {
      setError('Pourcentage invalide (1–100).');
      return;
    }
    const rows = catalog.filter((r) => {
      if (categoryId === 0) return !Number(r.category_id);
      return Number(r.category_id) === Number(categoryId);
    });
    if (rows.length === 0) {
      setError('Aucun produit dans cette catégorie à la source.');
      return;
    }

    const nextQtys: QtyMap = { ...qtys };
    const nextSelected: Record<number, boolean> = { ...selected };
    let applied = 0;
    rows.forEach((r) => {
      const avail = availableOf(r);
      if (avail <= 0) return;
      const qty = Math.max(1, Math.floor((avail * pct) / 100));
      nextQtys[r.product_id] = String(Math.min(qty, avail));
      nextSelected[r.product_id] = true;
      applied += 1;
    });

    if (applied === 0) {
      setError('Aucun stock disponible à transférer dans cette catégorie.');
      return;
    }

    setError(null);
    setQtys(nextQtys);
    setSelected(nextSelected);
    const label = categoryId === 0
      ? 'Sans catégorie'
      : (catalogCategories.find((c) => c.id === categoryId)?.name || 'catégorie');
    setInfo(`Transfert ${pct}% appliqué à ${applied} produit(s) — ${label}.`);
  };

  const applyCopy = () => {
    const tr = recentTransfers.find((t) => t.id === copyId);
    if (!tr) {
      setError('Choisissez un transfert à copier.');
      return;
    }
    setError(null);
    setQtys((prev) => {
      const next = { ...prev };
      (tr.items || []).forEach((item) => {
        const row = catalog.find((r) => r.product_id === item.product_id);
        if (!row) return;
        const max = availableOf(row);
        const qty = Math.min(Number(item.quantity || 0), max);
        if (qty > 0) next[item.product_id] = String(qty);
      });
      return next;
    });
    if (tr.from_warehouse_id) setFromId(tr.from_warehouse_id);
    if (tr.to_warehouse_id) setToId(tr.to_warehouse_id);
    setInfo(`Liste reprise depuis ${tr.reference || `TRF-${tr.id}`}.`);
  };

  const applyExcel = async (file: File) => {
    setError(null);
    try {
      const result = await parseTransferFile(file);
      setQtys((prev) => {
        const next = { ...prev };
        result.matched.forEach((m) => {
          const row = catalog.find((r) => r.product_id === m.product_id);
          if (!row) return;
          const max = availableOf(row);
          next[m.product_id] = String(Math.min(Number(m.quantity), max));
        });
        return next;
      });
      const msg = `${result.matched.length} ligne(s) chargée(s)`;
      setInfo(result.unmatched.length
        ? `${msg}. Non trouvés : ${result.unmatched.map((u) => u.key).join(', ')}`
        : msg);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const applySmart = async () => {
    if (!fromId || !toId) {
      setError('Choisissez source et destination.');
      return;
    }
    setSmartLoading(true);
    setError(null);
    try {
      const result = await suggestReplenishment({
        from_warehouse_id: Number(fromId),
        to_warehouse_id: Number(toId),
        days: 30,
      });
      if (!result.items.length) {
        setInfo('Aucun besoin détecté pour cette destination.');
        return;
      }
      setQtys((prev) => {
        const next = { ...prev };
        result.items.forEach((item) => {
          next[item.product_id] = String(item.proposed_quantity);
        });
        return next;
      });
      setInfo(`Approvisionnement intelligent : ${result.items_count} produit(s) proposés.`);
      setStep(1);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSmartLoading(false);
    }
  };

  const goNext = () => {
    setError(null);
    if (step === 0) {
      if (!fromId || !toId || fromId === toId) {
        setError('Choisissez une source et une destination différentes.');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (lines.length === 0) {
        setError('Saisissez au moins une quantité à transférer.');
        return;
      }
      setStep(2);
    }
  };

  const submit = async () => {
    if (!fromId || !toId || lines.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const transfer = await stockTransfer({
        from_warehouse_id: Number(fromId),
        to_warehouse_id: Number(toId),
        notes,
        carrier,
        auto_prepare: true,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: String(l.quantity),
        })),
      });
      onCreated(transfer);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const fromWh = warehouses.find((w) => w.id === fromId);
  const toWh = warehouses.find((w) => w.id === toId);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Nouveau transfert de stock</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ my: 2 }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {info && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}

        {step === 0 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Source"
                value={fromId}
                onChange={(e) => {
                  setFromId(Number(e.target.value));
                  setToId('');
                  setQtys({});
                  setCatalog([]);
                }}
                fullWidth
                helperText="Choisissez l'emplacement qui contient le stock (voir « … en stock »)."
              >
                {[...warehouses]
                  .sort((a, b) => (b.products_in_stock || 0) - (a.products_in_stock || 0))
                  .map((w) => (
                    <MenuItem key={w.id} value={w.id}>{warehouseLabel(w)}</MenuItem>
                  ))}
              </TextField>
              <TextField
                select
                label="Destination"
                value={toId}
                onChange={(e) => setToId(Number(e.target.value))}
                fullWidth
              >
                {destinations.map((w) => (
                  <MenuItem key={w.id} value={w.id}>{warehouseLabel(w)}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label="Transporteur (optionnel)"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              fullWidth
            />
            <TextField
              label="Commentaire"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Divider />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={applySmart}
                disabled={!fromId || !toId || smartLoading}
              >
                Approvisionnement intelligent
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                Calcule les besoins selon stock min, ventes 30 j et transferts en cours.
              </Typography>
            </Stack>
          </Stack>
        )}

        {step === 1 && (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                size="small"
                placeholder="Rechercher un produit…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                  ),
                }}
              />
              <TextField
                size="small"
                inputRef={barcodeRef}
                placeholder="Scanner code-barres"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyBarcode(); } }}
                sx={{ minWidth: 220 }}
              />
              <Button variant="outlined" onClick={applyBarcode}>OK</Button>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => fileRef.current?.click()}
                disabled={loadingCatalog}
              >
                Charger depuis Excel / CSV
              </Button>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".xlsx,.xls,.csv,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) applyExcel(f);
                  e.target.value = '';
                }}
              />

              <TextField
                select
                size="small"
                label="Copier un transfert"
                value={copyId}
                onChange={(e) => setCopyId(Number(e.target.value))}
                sx={{ minWidth: 200 }}
              >
                {recentTransfers.slice(0, 20).map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.reference || `TRF-${t.id}`} — {t.to_warehouse}
                  </MenuItem>
                ))}
              </TextField>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={applyCopy} disabled={!copyId}>
                Copier
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField
                select
                size="small"
                label="Catégorie"
                value={categoryId === '' ? '' : String(categoryId)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCategoryId(raw === '' ? '' : Number(raw));
                }}
                sx={{ minWidth: 200 }}
                helperText="Filtre la liste ; puis cliquez Appliquer %"
              >
                <MenuItem value="">Toutes les catégories</MenuItem>
                {uncategorizedCount > 0 && (
                  <MenuItem value="0">Sans catégorie ({formatNumber(uncategorizedCount)})</MenuItem>
                )}
                {catalogCategories.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>{tr(c.name)} ({formatNumber(c.count)})</MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="% du stock"
                type="number"
                value={categoryPct}
                onChange={(e) => setCategoryPct(e.target.value)}
                sx={{ width: 120 }}
                inputProps={{ min: 1, max: 100 }}
              />
              <Button
                size="small"
                variant="contained"
                startIcon={<CategoryIcon />}
                onClick={applyCategoryPct}
                disabled={categoryId === '' || catalog.length === 0}
              >
                Appliquer {formatNumber(categoryPct)}%
              </Button>

              <Box sx={{ flex: 1 }} />

              <Typography variant="body2">{formatNumber(selectedCount)} sélectionné(s)</Typography>
              <TextField
                size="small"
                label="Qté commune"
                type="number"
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
                sx={{ width: 120 }}
              />
              <Button size="small" variant="outlined" onClick={applyBulkToSelected}>
                Appliquer à la sélection
              </Button>
            </Stack>

            <Box sx={{ maxHeight: 420, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Produit</TableCell>
                    <TableCell align="right">Disponible</TableCell>
                    <TableCell align="center" sx={{ minWidth: 180 }}>À transférer</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingCatalog && (
                    <TableRow>
                      <TableCell colSpan={4}>Chargement du stock source…</TableCell>
                    </TableRow>
                  )}
                  {!loadingCatalog && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        Aucun produit en stock sur cet emplacement.
                        Repassez à l&apos;étape 1 et choisissez une source avec « … en stock » (souvent le siège).
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((row) => {
                    const avail = availableOf(row);
                    const physical = physicalOf(row);
                    const qty = qtys[row.product_id] || '';
                    return (
                      <TableRow key={row.product_id} hover selected={Boolean(selected[row.product_id])}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={Boolean(selected[row.product_id])}
                            disabled={avail <= 0}
                            onChange={(e) => setSelected((s) => ({ ...s, [row.product_id]: e.target.checked }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={600}>{row.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[row.sku, row.barcode, row.category_name ? tr(row.category_name) : null].filter(Boolean).join(' · ')}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(avail)}
                          {physical !== avail && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              dont {formatNumber(physical - avail)} réservé
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                            <IconButton size="small" disabled={avail <= 0} onClick={() => bumpQty(row.product_id, -1)}>
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <TextField
                              size="small"
                              type="number"
                              value={qty}
                              disabled={avail <= 0}
                              onChange={(e) => setQty(row.product_id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              sx={{ width: 88 }}
                              inputProps={{ min: 0, max: avail }}
                            />
                            <IconButton size="small" disabled={avail <= 0} onClick={() => bumpQty(row.product_id, 1)}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {formatNumber(lines.length)} produit(s) · {formatNumber(totalQty)} unité(s) sélectionnée(s)
            </Typography>
          </Stack>
        )}

        {step === 2 && (
          <Stack spacing={2}>
            <Alert severity="info">
              À la validation, Stokeya crée le transfert, réserve le stock source et le passe en préparation.
            </Alert>
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Résumé</Typography>
              <Typography>Source : <strong>{fromWh ? warehouseLabel(fromWh) : '—'}</strong></Typography>
              <Typography>Destination : <strong>{toWh ? warehouseLabel(toWh) : '—'}</strong></Typography>
              <Typography>Produits : <strong>{formatNumber(lines.length)}</strong></Typography>
              <Typography>Quantité totale : <strong>{formatNumber(totalQty)}</strong></Typography>
              <Typography>Valeur (prix d&apos;achat) : <strong>{formatTransferValue(totalValue)}</strong></Typography>
            </Box>
            <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Produit</TableCell>
                    <TableCell align="right">Qté</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.product_id}>
                      <TableCell>{l.product_name}</TableCell>
                      <TableCell align="right">{l.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Annuler</Button>
        {step > 0 && <Button onClick={() => setStep((s) => s - 1)}>Retour</Button>}
        {step < 2 ? (
          <Button variant="contained" onClick={goNext}>Continuer</Button>
        ) : (
          <Button variant="contained" onClick={submit} disabled={saving}>
            Valider le transfert
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
