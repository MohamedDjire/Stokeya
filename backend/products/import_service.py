"""Import produits — analyse, mapping intelligent, validation, exécution, annulation."""

from __future__ import annotations

import csv
import io
import unicodedata
from decimal import Decimal, InvalidOperation

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from brands.models import Brand
from categories.models import Category
from inventory.services import default_warehouse_for_company, ensure_product_stock
from units.models import Unit

from .models import Barcode, Product, ProductImportBatch

COLUMN_ALIASES = {
    'name': [
        'nom', 'name', 'designation', 'désignation', 'libelle', 'libellé',
        'produit', 'article', 'nom du produit', 'nom produit', 'nom_produit',
        'product', 'product name', 'intitule', 'intitulé',
    ],
    'sale_price': [
        'prix_vente', 'prixvente', 'prix vente', 'prix', 'sale_price', 'pv',
        'prix_de_vente', 'prix public', 'prix_public', 'prix ttc', 'prix_ttc',
        'prix de vente', 'selling price', 'price', 'montant',
    ],
    'purchase_price': [
        'prix_achat', 'prixachat', 'prix achat', 'purchase_price', 'pa',
        'cout', 'coût', 'prix_de_revient', 'prix revient', 'cout achat',
        'cost', 'buying price',
    ],
    'sku': [
        'sku', 'reference', 'référence', 'ref', 'réf', 'code_article',
        'code_produit', 'code produit', 'ref produit', 'réf produit',
        'item code', 'product code',
    ],
    'description': ['description', 'desc', 'details', 'détails', 'commentaire', 'notes'],
    'category': [
        'categorie', 'catégorie', 'category', 'famille', 'rayon',
        'sous categorie', 'sous-catégorie', 'groupe',
    ],
    'brand': ['marque', 'brand', 'fabricant', 'manufacturer', 'maker'],
    'unit': ['unite', 'unité', 'unit', 'mesure', 'conditionnement', 'uom'],
    'tax_rate': ['tva', 'tax', 'tax_rate', 'taxe', 'vat', 'taux tva'],
    'min_stock': [
        'stock_min', 'stockmin', 'min_stock', 'seuil', 'seuil_alerte',
        'stock_minimum', 'stock minimum',
    ],
    'barcode': [
        'code_barres', 'codebarre', 'code_barre', 'barcode', 'ean',
        'gencode', 'code-barres', 'code barres', 'ean13', 'upc',
    ],
    'quantity': [
        'stock', 'stock_initial', 'quantite', 'quantité', 'qte', 'qté',
        'quantity', 'qty', 'stock actuel', 'disponible',
    ],
    'wholesale_price': [
        'prix_gros', 'prix gros', 'wholesale', 'wholesale_price',
        'prix grossiste', 'pv gros',
    ],
}

TARGET_FIELDS = [
    {'key': 'name', 'label': 'Nom du produit', 'required': True},
    {'key': 'sale_price', 'label': 'Prix de vente', 'required': True},
    {'key': 'purchase_price', 'label': 'Prix d\'achat', 'required': False},
    {'key': 'sku', 'label': 'Référence / SKU', 'required': False},
    {'key': 'barcode', 'label': 'Code-barres', 'required': False},
    {'key': 'description', 'label': 'Description', 'required': False},
    {'key': 'category', 'label': 'Catégorie', 'required': False},
    {'key': 'brand', 'label': 'Marque', 'required': False},
    {'key': 'unit', 'label': 'Unité', 'required': False},
    {'key': 'tax_rate', 'label': 'TVA (%)', 'required': False},
    {'key': 'min_stock', 'label': 'Stock minimum', 'required': False},
    {'key': 'quantity', 'label': 'Stock initial', 'required': False},
    {'key': 'wholesale_price', 'label': 'Prix de gros', 'required': False},
]

TEMPLATE_HEADERS = [
    'nom', 'prix_vente', 'prix_achat', 'sku', 'description',
    'categorie', 'marque', 'unite', 'tva', 'stock_min', 'code_barres', 'stock',
]

DUPLICATE_IGNORE = 'ignore'
DUPLICATE_UPDATE = 'update'
DUPLICATE_ASK = 'ask'


class ImportError_(Exception):
    pass


def _normalize(text):
    if text is None:
        return ''
    text = str(text).strip().lower()
    text = unicodedata.normalize('NFD', text)
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def suggest_mapping(headers):
    """Retourne mapping champ->index, colonnes non mappées, et mapping index->champ."""
    mapping = {}
    used_indexes = set()
    for idx, header in enumerate(headers):
        norm = _normalize(header)
        for field, aliases in COLUMN_ALIASES.items():
            if field in mapping:
                continue
            if norm in [_normalize(a) for a in aliases] or norm == _normalize(field):
                mapping[field] = idx
                used_indexes.add(idx)
                break

    unmapped = [
        {'index': i, 'header': str(headers[i])}
        for i in range(len(headers))
        if i not in used_indexes and str(headers[i]).strip()
    ]
    return mapping, unmapped


def _to_decimal(value, default=None):
    if value is None or str(value).strip() == '':
        return Decimal(default) if default is not None else None
    raw = str(value).strip().replace(' ', '').replace(',', '.')
    raw = ''.join(c for c in raw if c.isdigit() or c in '.-')
    try:
        return Decimal(raw) if raw not in ('', '-', '.') else (Decimal(default) if default is not None else None)
    except InvalidOperation:
        return Decimal(default) if default is not None else None


def _rows_from_csv(file_bytes):
    text = None
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
        try:
            text = file_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ImportError_('Encodage du fichier CSV non pris en charge.')
    sample = text[:2048]
    delimiter = ';' if sample.count(';') >= sample.count(',') else ','
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    return [row for row in reader if any(str(c).strip() for c in row)]


def _rows_from_excel(file_bytes):
    from openpyxl import load_workbook
    try:
        wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001
        raise ImportError_(
            'Impossible de lire le fichier Excel. '
            'Enregistrez-le en .xlsx ou exportez en CSV, puis réessayez.'
        ) from exc
    ws = wb.active
    rows = []
    for row in ws.iter_rows(values_only=True):
        if row and any(c is not None and str(c).strip() for c in row):
            rows.append([('' if c is None else c) for c in row])
    return rows


def parse_file(filename, file_bytes):
    name = (filename or '').lower()
    if name.endswith('.csv') or name.endswith('.txt'):
        return _rows_from_csv(file_bytes)
    if name.endswith('.xls') and not name.endswith('.xlsx') and not name.endswith('.xlsm'):
        raise ImportError_(
            'Le format .xls (ancien Excel) n\'est pas supporté. '
            'Ouvrez le fichier et enregistrez-le en .xlsx ou CSV.'
        )
    if name.endswith('.xlsx') or name.endswith('.xlsm'):
        return _rows_from_excel(file_bytes)
    raise ImportError_('Format non supporté. Utilisez .xlsx ou .csv.')


def _cell(row, header_map, field):
    idx = header_map.get(field)
    if idx is None or idx >= len(row):
        return ''
    return row[idx]


def _row_dict(row, header_map):
    return {field: _cell(row, header_map, field) for field in COLUMN_ALIASES}


def _normalize_mapping(mapping):
    if not mapping:
        return {}
    out = {}
    for key, value in mapping.items():
        if value is None or value == '':
            continue
        try:
            out[str(key)] = int(value)
        except (TypeError, ValueError):
            continue
    return out


def _editable_row(line_no, d):
    name = str(d.get('name') or '').strip()
    sale_raw = d.get('sale_price')
    sale_price = _to_decimal(sale_raw)
    issues = []
    if not name:
        issues.append('empty_name')
    if sale_price is None or sale_price <= 0:
        issues.append('invalid_price')
    return {
        'line': line_no,
        'name': name,
        'sale_price': '' if sale_raw is None or str(sale_raw).strip() == '' else str(sale_raw).strip(),
        'purchase_price': str(d.get('purchase_price') or '').strip(),
        'sku': str(d.get('sku') or '').strip(),
        'barcode': str(d.get('barcode') or '').strip(),
        'quantity': str(d.get('quantity') or '').strip(),
        'category': str(d.get('category') or '').strip(),
        'brand': str(d.get('brand') or '').strip(),
        'unit': str(d.get('unit') or '').strip(),
        'tax_rate': str(d.get('tax_rate') or '').strip(),
        'description': str(d.get('description') or '').strip(),
        'issues': issues,
    }


def build_editable_rows(batch, column_mapping=None):
    if column_mapping is not None:
        batch.column_mapping = _normalize_mapping(column_mapping)
        batch.save(update_fields=['column_mapping', 'updated_at'])
    header_map = _normalize_mapping(batch.column_mapping)
    file_rows = _load_batch_rows(batch)
    rows = []
    for line_no, row in enumerate(file_rows[1:], start=2):
        rows.append(_editable_row(line_no, _row_dict(row, header_map)))
    return {
        'batch_id': batch.id,
        'headers': batch.headers or [],
        'column_mapping': header_map,
        'unmapped_columns': [
            {'index': i, 'header': str(batch.headers[i])}
            for i in range(len(batch.headers or []))
            if i not in header_map.values() and str((batch.headers or [''])[i]).strip()
        ],
        'missing_required': [f for f in ('name', 'sale_price') if f not in header_map],
        'target_fields': [f for f in TARGET_FIELDS if f['required']],
        'total_rows': len(rows),
        'rows': rows,
        'incomplete_count': sum(1 for r in rows if r['issues']),
    }


def analyze_upload(*, company, user, filename, file_bytes, uploaded_file=None):
    rows = parse_file(filename, file_bytes)
    if len(rows) < 2:
        raise ImportError_("Le fichier doit contenir une ligne d'en-tête et au moins un produit.")

    headers = [str(h).strip() if h is not None else '' for h in rows[0]]
    mapping, unmapped = suggest_mapping(headers)

    batch = ProductImportBatch.objects.create(
        company=company,
        created_by=user,
        filename=filename[:255],
        status=ProductImportBatch.Status.ANALYZED,
        headers=headers,
        column_mapping=mapping,
        total_rows=len(rows) - 1,
        duplicate_policy=DUPLICATE_UPDATE,
        auto_create_related=True,
    )
    if uploaded_file is not None:
        batch.file.save(filename, uploaded_file, save=True)
    else:
        from django.core.files.base import ContentFile
        batch.file.save(filename, ContentFile(file_bytes), save=True)

    prepared = build_editable_rows(batch)
    return {
        'batch_id': batch.id,
        'filename': batch.filename,
        'total_rows': batch.total_rows,
        'headers': headers,
        'suggested_mapping': mapping,
        'unmapped_columns': unmapped,
        'target_fields': TARGET_FIELDS,
        'missing_required': prepared['missing_required'],
        'rows': prepared['rows'],
        'incomplete_count': prepared['incomplete_count'],
        'preview': prepared['rows'][:10],
    }


def _load_batch_rows(batch):
    if not batch.file:
        raise ImportError_('Fichier d\'import introuvable.')
    with batch.file.open('rb') as fh:
        file_bytes = fh.read()
    return parse_file(batch.filename, file_bytes)


def validate_batch(*, batch, column_mapping=None, duplicate_policy=DUPLICATE_IGNORE, auto_create=True):
    if column_mapping is not None:
        batch.column_mapping = _normalize_mapping(column_mapping)
    else:
        batch.column_mapping = _normalize_mapping(batch.column_mapping)
    if duplicate_policy not in (DUPLICATE_IGNORE, DUPLICATE_UPDATE, DUPLICATE_ASK):
        duplicate_policy = DUPLICATE_IGNORE
    batch.duplicate_policy = duplicate_policy
    batch.auto_create_related = auto_create
    batch.status = ProductImportBatch.Status.VALIDATED
    batch.save(update_fields=[
        'column_mapping', 'duplicate_policy', 'auto_create_related', 'status', 'updated_at',
    ])

    rows = _load_batch_rows(batch)
    header_map = batch.column_mapping or {}
    if 'name' not in header_map:
        raise ImportError_('Colonne « Nom » obligatoire : sélectionnez la correspondance.')
    if 'sale_price' not in header_map:
        raise ImportError_('Colonne « Prix de vente » obligatoire : sélectionnez la correspondance.')

    company = batch.company
    issues = []
    preview = []
    will_create = will_update = will_skip = 0
    cats_to_create = set()
    brands_to_create = set()
    units_to_create = set()

    existing_skus = {
        p.sku.strip().lower(): p.id
        for p in Product.objects.filter(company=company).exclude(sku='')
        if p.sku
    }
    existing_barcodes = {
        b.code.strip().lower(): b.product_id
        for b in Barcode.objects.filter(product__company=company)
    }
    existing_cats = set(
        Category.objects.filter(company=company).values_list('name', flat=True)
    )
    existing_brands = set(
        Brand.objects.filter(company=company).values_list('name', flat=True)
    )
    existing_units = set(
        Unit.objects.filter(company=company).values_list('name', flat=True)
    )

    for line_no, row in enumerate(rows[1:], start=2):
        d = _row_dict(row, header_map)
        name = str(d.get('name') or '').strip()
        sku = str(d.get('sku') or '').strip()
        barcode = str(d.get('barcode') or '').strip()
        cat = str(d.get('category') or '').strip()
        brand = str(d.get('brand') or '').strip()
        unit = str(d.get('unit') or '').strip()
        sale_raw = d.get('sale_price')
        qty_raw = d.get('quantity')

        row_issues = []
        if not name:
            row_issues.append({'code': 'empty_name', 'message': 'Nom vide', 'action': 'skip'})
        sale_price = _to_decimal(sale_raw)
        if sale_price is None or sale_price <= 0:
            row_issues.append({'code': 'invalid_price', 'message': 'Prix de vente invalide', 'action': 'fix'})

        qty = _to_decimal(qty_raw, default='0')
        if qty is not None and qty < 0:
            row_issues.append({'code': 'negative_stock', 'message': 'Stock négatif', 'action': 'fix'})

        dup_sku = sku and sku.lower() in existing_skus
        dup_bc = barcode and barcode.lower() in existing_barcodes
        if dup_sku or dup_bc:
            row_issues.append({
                'code': 'duplicate',
                'message': (
                    f'SKU déjà existant ({sku})' if dup_sku
                    else f'Code-barres déjà utilisé ({barcode})'
                ),
                'action': duplicate_policy,
                'existing_id': existing_skus.get(sku.lower()) if dup_sku else existing_barcodes.get(barcode.lower()),
            })

        if cat and cat not in existing_cats:
            cats_to_create.add(cat)
            if not auto_create:
                row_issues.append({'code': 'unknown_category', 'message': f'Catégorie inconnue : {cat}', 'action': 'create'})
        if brand and brand not in existing_brands:
            brands_to_create.add(brand)
            if not auto_create:
                row_issues.append({'code': 'unknown_brand', 'message': f'Marque inconnue : {brand}', 'action': 'create'})
        if unit and unit not in existing_units:
            units_to_create.add(unit)
            if not auto_create:
                row_issues.append({'code': 'unknown_unit', 'message': f'Unité inconnue : {unit}', 'action': 'create'})

        if row_issues:
            issues.append({'line': line_no, 'name': name or '—', 'issues': row_issues})

        if not name or sale_price is None or sale_price <= 0:
            will_skip += 1
        elif (dup_sku or dup_bc) and duplicate_policy == DUPLICATE_IGNORE:
            will_skip += 1
        elif (dup_sku or dup_bc) and duplicate_policy == DUPLICATE_UPDATE:
            will_update += 1
        elif (dup_sku or dup_bc) and duplicate_policy == DUPLICATE_ASK:
            will_skip += 1
        else:
            will_create += 1

        if len(preview) < 10:
            preview.append({
                'line': line_no,
                'name': name,
                'sku': sku,
                'sale_price': str(sale_price) if sale_price is not None else '',
                'quantity': str(qty or 0),
                'category': cat,
                'brand': brand,
                'status': (
                    'error' if any(i['code'] in ('empty_name', 'invalid_price') for i in row_issues)
                    else 'duplicate' if (dup_sku or dup_bc) else 'ok'
                ),
            })

    return {
        'batch_id': batch.id,
        'total_rows': batch.total_rows,
        'preview': preview,
        'issues': issues[:200],
        'issues_count': len(issues),
        'summary': {
            'will_create': will_create,
            'will_update': will_update,
            'will_skip': will_skip,
            'categories_to_create': sorted(cats_to_create),
            'brands_to_create': sorted(brands_to_create),
            'units_to_create': sorted(units_to_create),
        },
        'duplicate_policy': duplicate_policy,
        'auto_create_related': auto_create,
    }


def execute_batch(*, batch, user, max_new=None, duplicate_policy=None):
    if duplicate_policy:
        if duplicate_policy not in (DUPLICATE_IGNORE, DUPLICATE_UPDATE, DUPLICATE_ASK):
            raise ImportError_('Politique de doublons invalide.')
        batch.duplicate_policy = duplicate_policy
        batch.save(update_fields=['duplicate_policy', 'updated_at'])
    policy = batch.duplicate_policy or DUPLICATE_IGNORE
    if policy == DUPLICATE_ASK:
        raise ImportError_(
            'Choisissez « Ignorer » ou « Mettre à jour » pour les doublons avant d\'importer.'
        )
    header_map = _normalize_mapping(batch.column_mapping)
    batch.column_mapping = header_map
    if 'name' not in header_map or 'sale_price' not in header_map:
        raise ImportError_('Mapping incomplet : nom et prix de vente sont obligatoires.')

    rows = _load_batch_rows(batch)
    company = batch.company
    default_unit = None

    def get_unit(unit_name):
        nonlocal default_unit
        unit_name = (unit_name or '').strip()
        if unit_name:
            unit, _ = Unit.objects.get_or_create(
                company=company, name=unit_name,
                defaults={'abbreviation': unit_name[:10]},
            )
            return unit
        if default_unit is None:
            default_unit, _ = Unit.objects.get_or_create(
                company=company, name='Pièce', defaults={'abbreviation': 'pce'},
            )
        return default_unit

    warehouse = default_warehouse_for_company(company)

    created = updated = skipped = 0
    errors = []
    created_ids = []
    updated_ids = []
    limit_hit = False

    # Chunked commits for large files
    CHUNK = 100
    pending = 0

    with transaction.atomic():
        for line_no, row in enumerate(rows[1:], start=2):
            d = _row_dict(row, header_map)
            name = str(d.get('name') or '').strip()
            if not name:
                skipped += 1
                continue

            sale_price = _to_decimal(d.get('sale_price'))
            if sale_price is None or sale_price <= 0:
                errors.append({'line': line_no, 'name': name, 'message': 'Prix de vente invalide'})
                skipped += 1
                continue

            sku = str(d.get('sku') or '').strip()
            barcode_val = str(d.get('barcode') or '').strip()
            existing = None
            if sku:
                existing = Product.objects.filter(company=company, sku__iexact=sku).first()
            if existing is None and barcode_val:
                bc = Barcode.objects.filter(
                    product__company=company, code__iexact=barcode_val,
                ).select_related('product').first()
                if bc:
                    existing = bc.product

            if existing and policy == DUPLICATE_IGNORE:
                skipped += 1
                continue

            if existing is None and max_new is not None and created >= max_new:
                limit_hit = True
                skipped += 1
                continue

            try:
                cat_name = str(d.get('category') or '').strip()
                category = None
                if cat_name:
                    category, _ = Category.objects.get_or_create(company=company, name=cat_name)

                brand_name = str(d.get('brand') or '').strip()
                brand = None
                if brand_name:
                    brand, _ = Brand.objects.get_or_create(company=company, name=brand_name)

                unit = get_unit(d.get('unit'))
                purchase = _to_decimal(d.get('purchase_price'), default='0') or Decimal('0')
                tax = _to_decimal(d.get('tax_rate'), default='0') or Decimal('0')
                min_stock = _to_decimal(d.get('min_stock'), default='0') or Decimal('0')
                wholesale = _to_decimal(d.get('wholesale_price'))
                description = str(d.get('description') or '').strip()
                qty = _to_decimal(d.get('quantity'), default='0') or Decimal('0')

                if existing and policy == DUPLICATE_UPDATE:
                    existing.name = name
                    existing.description = description or existing.description
                    existing.category = category or existing.category
                    existing.brand = brand or existing.brand
                    existing.unit = unit
                    existing.purchase_price = purchase
                    existing.sale_price = sale_price
                    existing.tax_rate = tax
                    existing.min_stock = min_stock
                    if wholesale is not None:
                        existing.wholesale_price = wholesale
                    if sku:
                        existing.sku = sku
                    existing.save()
                    if barcode_val:
                        Barcode.objects.get_or_create(
                            product=existing, code=barcode_val, defaults={'is_primary': True},
                        )
                    ensure_product_stock(existing, warehouse=warehouse, user=user)
                    updated += 1
                    updated_ids.append(existing.id)
                else:
                    product = Product.objects.create(
                        company=company,
                        name=name,
                        sku=sku,
                        description=description,
                        category=category,
                        brand=brand,
                        unit=unit,
                        purchase_price=purchase,
                        sale_price=sale_price,
                        wholesale_price=wholesale,
                        tax_rate=tax,
                        min_stock=min_stock,
                    )
                    if barcode_val:
                        Barcode.objects.get_or_create(
                            product=product, code=barcode_val, defaults={'is_primary': True},
                        )
                    ensure_product_stock(
                        product,
                        warehouse=warehouse,
                        quantity=qty if qty > 0 else Decimal('0'),
                        user=user,
                        notes=f'Import #{batch.id}',
                    )
                    created += 1
                    created_ids.append(product.id)

                pending += 1
                if pending >= CHUNK:
                    pending = 0
            except Exception as exc:  # noqa: BLE001
                errors.append({'line': line_no, 'name': name, 'message': str(exc)})
                skipped += 1

        if limit_hit:
            errors.append({
                'line': 0, 'name': '',
                'message': 'Limite d\'abonnement atteinte : certains produits n\'ont pas été importés.',
            })

        batch.status = ProductImportBatch.Status.COMPLETED
        batch.created_count = created
        batch.updated_count = updated
        batch.skipped_count = skipped
        batch.errors = errors[:200]
        batch.created_product_ids = created_ids
        batch.updated_product_ids = updated_ids
        batch.can_undo_until = timezone.now() + timedelta(minutes=30)
        batch.save()

    return {
        'batch_id': batch.id,
        'created': created,
        'updated': updated,
        'skipped': skipped,
        'total_rows': batch.total_rows,
        'errors': errors[:50],
        'can_undo_until': batch.can_undo_until.isoformat() if batch.can_undo_until else None,
    }


@transaction.atomic
def undo_batch(*, batch, user):
    if batch.status != ProductImportBatch.Status.COMPLETED:
        raise ImportError_('Seul un import terminé peut être annulé.')
    if not batch.can_undo_until or timezone.now() > batch.can_undo_until:
        raise ImportError_('Le délai d\'annulation (30 minutes) est dépassé.')

    ids = batch.created_product_ids or []
    deleted = Product.objects.filter(company=batch.company, id__in=ids).delete()[0]
    batch.status = ProductImportBatch.Status.CANCELLED
    batch.can_undo_until = None
    batch.save(update_fields=['status', 'can_undo_until', 'updated_at'])
    return {'deleted': deleted, 'batch_id': batch.id}


def execute_from_rows(*, batch, user, rows, max_new=None):
    """Import depuis le tableau édité (mapping + corrections utilisateur)."""
    if not rows:
        raise ImportError_('Aucune ligne à importer.')

    company = batch.company
    default_unit = None

    def get_unit(unit_name):
        nonlocal default_unit
        unit_name = (unit_name or '').strip()
        if unit_name:
            unit, _ = Unit.objects.get_or_create(
                company=company, name=unit_name,
                defaults={'abbreviation': unit_name[:10]},
            )
            return unit
        if default_unit is None:
            default_unit, _ = Unit.objects.get_or_create(
                company=company, name='Pièce', defaults={'abbreviation': 'pce'},
            )
        return default_unit

    warehouse = default_warehouse_for_company(company)

    created = updated = skipped = 0
    errors = []
    created_ids = []
    updated_ids = []
    limit_hit = False

    with transaction.atomic():
        for index, raw in enumerate(rows):
            line_no = int(raw.get('line') or index + 2)
            name = str(raw.get('name') or '').strip()
            if not name:
                skipped += 1
                errors.append({'line': line_no, 'name': '—', 'message': 'Nom vide'})
                continue

            sale_price = _to_decimal(raw.get('sale_price'))
            if sale_price is None or sale_price <= 0:
                skipped += 1
                errors.append({'line': line_no, 'name': name, 'message': 'Prix de vente invalide'})
                continue

            sku = str(raw.get('sku') or '').strip()
            barcode_val = str(raw.get('barcode') or '').strip()
            existing = None
            if sku:
                existing = Product.objects.filter(company=company, sku__iexact=sku).first()
            if existing is None and barcode_val:
                bc = Barcode.objects.filter(
                    product__company=company, code__iexact=barcode_val,
                ).select_related('product').first()
                if bc:
                    existing = bc.product

            if existing is None and max_new is not None and created >= max_new:
                limit_hit = True
                skipped += 1
                continue

            try:
                cat_name = str(raw.get('category') or '').strip()
                category = None
                if cat_name:
                    category, _ = Category.objects.get_or_create(company=company, name=cat_name)

                brand_name = str(raw.get('brand') or '').strip()
                brand = None
                if brand_name:
                    brand, _ = Brand.objects.get_or_create(company=company, name=brand_name)

                unit = get_unit(raw.get('unit'))
                purchase = _to_decimal(raw.get('purchase_price'), default='0') or Decimal('0')
                tax = _to_decimal(raw.get('tax_rate'), default='0') or Decimal('0')
                min_stock = _to_decimal(raw.get('min_stock'), default='0') or Decimal('0')
                wholesale = _to_decimal(raw.get('wholesale_price'))
                description = str(raw.get('description') or '').strip()
                qty = _to_decimal(raw.get('quantity'), default='0') or Decimal('0')
                if qty is not None and qty < 0:
                    qty = Decimal('0')

                if existing:
                    existing.name = name
                    existing.description = description or existing.description
                    existing.category = category or existing.category
                    existing.brand = brand or existing.brand
                    existing.unit = unit
                    existing.purchase_price = purchase
                    existing.sale_price = sale_price
                    existing.tax_rate = tax
                    existing.min_stock = min_stock
                    if wholesale is not None:
                        existing.wholesale_price = wholesale
                    if sku:
                        existing.sku = sku
                    existing.save()
                    if barcode_val:
                        Barcode.objects.get_or_create(
                            product=existing, code=barcode_val, defaults={'is_primary': True},
                        )
                    ensure_product_stock(existing, warehouse=warehouse, user=user)
                    updated += 1
                    updated_ids.append(existing.id)
                else:
                    product = Product.objects.create(
                        company=company,
                        name=name,
                        sku=sku,
                        description=description,
                        category=category,
                        brand=brand,
                        unit=unit,
                        purchase_price=purchase,
                        sale_price=sale_price,
                        wholesale_price=wholesale,
                        tax_rate=tax,
                        min_stock=min_stock,
                    )
                    if barcode_val:
                        Barcode.objects.get_or_create(
                            product=product, code=barcode_val, defaults={'is_primary': True},
                        )
                    ensure_product_stock(
                        product,
                        warehouse=warehouse,
                        quantity=qty if qty and qty > 0 else Decimal('0'),
                        user=user,
                        notes=f'Import #{batch.id}',
                    )
                    created += 1
                    created_ids.append(product.id)
            except Exception as exc:  # noqa: BLE001
                errors.append({'line': line_no, 'name': name, 'message': str(exc)})
                skipped += 1

        if limit_hit:
            errors.append({
                'line': 0, 'name': '',
                'message': 'Limite d\'abonnement atteinte : certains produits n\'ont pas été importés.',
            })

        batch.status = ProductImportBatch.Status.COMPLETED
        batch.duplicate_policy = DUPLICATE_UPDATE
        batch.auto_create_related = True
        batch.created_count = created
        batch.updated_count = updated
        batch.skipped_count = skipped
        batch.errors = errors[:200]
        batch.created_product_ids = created_ids
        batch.updated_product_ids = updated_ids
        batch.can_undo_until = timezone.now() + timedelta(minutes=30)
        batch.total_rows = len(rows)
        batch.save()

    return {
        'batch_id': batch.id,
        'created': created,
        'updated': updated,
        'skipped': skipped,
        'total_rows': len(rows),
        'errors': errors[:50],
        'can_undo_until': batch.can_undo_until.isoformat() if batch.can_undo_until else None,
    }


def build_csv_template():
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(TEMPLATE_HEADERS)
    writer.writerow([
        'Coca-Cola 33cl', '500', '350', 'COCA33', 'Boisson gazeuse',
        'Boissons', 'Coca-Cola', 'Pièce', '18', '10', '5449000000996', '48',
    ])
    writer.writerow([
        'Pain de mie', '750', '500', 'PAIN01', '',
        'Alimentation', '', 'Pièce', '0', '5', '', '20',
    ])
    return output.getvalue()


# Compat one-shot (ancien endpoint)
@transaction.atomic
def import_products(*, company, user, filename, file_bytes, default_warehouse=None, max_new=None):
    from django.core.files.base import ContentFile
    batch = ProductImportBatch.objects.create(
        company=company, created_by=user, filename=filename[:255],
        status=ProductImportBatch.Status.ANALYZED,
    )
    batch.file.save(filename, ContentFile(file_bytes), save=True)
    rows = parse_file(filename, file_bytes)
    headers = [str(h).strip() if h is not None else '' for h in rows[0]]
    mapping, _ = suggest_mapping(headers)
    batch.headers = headers
    batch.column_mapping = mapping
    batch.total_rows = max(0, len(rows) - 1)
    batch.duplicate_policy = DUPLICATE_IGNORE
    batch.save()
    result = execute_batch(batch=batch, user=user, max_new=max_new)
    return {
        'created': result['created'],
        'updated': result['updated'],
        'skipped': result['skipped'],
        'total_rows': result['total_rows'],
        'errors': [
            f"Ligne {e['line']} ({e['name']}) : {e['message']}" if e.get('line')
            else e['message']
            for e in result['errors']
        ],
        'batch_id': batch.id,
    }
