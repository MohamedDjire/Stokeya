"""Import de produits en masse depuis CSV, Excel ou PDF.

Les colonnes reconnues (insensibles à la casse/accents) :
- nom / name / designation / libelle       -> name (obligatoire)
- prix_vente / prix / sale_price / pv       -> sale_price (obligatoire)
- prix_achat / purchase_price / pa / cout   -> purchase_price
- sku / reference / ref / code              -> sku
- description / desc                        -> description
- categorie / category                      -> category (créée si absente)
- marque / brand                            -> brand (créée si absente)
- unite / unit                              -> unit (créée si absente, défaut "Pièce")
- tva / tax / tax_rate                      -> tax_rate
- stock_min / min_stock / seuil             -> min_stock
- code_barres / barcode / ean / gencode     -> barcode
- stock / stock_initial / quantite / qte    -> quantité initiale (entrée de stock)
"""

import csv
import io
import unicodedata
from decimal import Decimal, InvalidOperation

from django.db import transaction

from brands.models import Brand
from categories.models import Category
from inventory.services import stock_entry
from units.models import Unit
from warehouses.models import Warehouse
from .models import Barcode, Product


COLUMN_ALIASES = {
    'name': ['nom', 'name', 'designation', 'désignation', 'libelle', 'libellé', 'produit', 'article'],
    'sale_price': ['prix_vente', 'prixvente', 'prix vente', 'prix', 'sale_price', 'pv', 'prix_de_vente'],
    'purchase_price': ['prix_achat', 'prixachat', 'prix achat', 'purchase_price', 'pa', 'cout', 'coût', 'prix_de_revient'],
    'sku': ['sku', 'reference', 'référence', 'ref', 'réf', 'code_article', 'code_produit'],
    'description': ['description', 'desc', 'details', 'détails'],
    'category': ['categorie', 'catégorie', 'category', 'famille', 'rayon'],
    'brand': ['marque', 'brand', 'fabricant'],
    'unit': ['unite', 'unité', 'unit', 'mesure'],
    'tax_rate': ['tva', 'tax', 'tax_rate', 'taxe'],
    'min_stock': ['stock_min', 'stockmin', 'min_stock', 'seuil', 'seuil_alerte', 'stock_minimum'],
    'barcode': ['code_barres', 'codebarre', 'code_barre', 'barcode', 'ean', 'gencode', 'code-barres'],
    'quantity': ['stock', 'stock_initial', 'quantite', 'quantité', 'qte', 'qté', 'quantity'],
}

TEMPLATE_HEADERS = [
    'nom', 'prix_vente', 'prix_achat', 'sku', 'description',
    'categorie', 'marque', 'unite', 'tva', 'stock_min', 'code_barres', 'stock',
]


class ImportError_(Exception):
    pass


def _normalize(text):
    if text is None:
        return ''
    text = str(text).strip().lower()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return text


def _build_header_map(headers):
    """Associe l'index de colonne au champ interne."""
    mapping = {}
    for idx, header in enumerate(headers):
        norm = _normalize(header)
        for field, aliases in COLUMN_ALIASES.items():
            if norm in [_normalize(a) for a in aliases]:
                mapping[field] = idx
                break
    return mapping


def _to_decimal(value, default='0'):
    if value is None or str(value).strip() == '':
        return Decimal(default)
    raw = str(value).strip().replace(' ', '').replace(',', '.')
    raw = ''.join(c for c in raw if c.isdigit() or c in '.-')
    try:
        return Decimal(raw or default)
    except InvalidOperation:
        return Decimal(default)


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

    wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active
    rows = []
    for row in ws.iter_rows(values_only=True):
        if row and any(c is not None and str(c).strip() for c in row):
            rows.append([('' if c is None else c) for c in row])
    return rows


def _rows_from_pdf(file_bytes):
    import pdfplumber

    rows = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    if row and any(c and str(c).strip() for c in row):
                        rows.append([('' if c is None else c) for c in row])
    if not rows:
        raise ImportError_(
            'Aucun tableau détecté dans le PDF. Utilisez un PDF avec un tableau '
            'de produits ou préférez un fichier Excel/CSV.'
        )
    return rows


def parse_file(filename, file_bytes):
    name = (filename or '').lower()
    if name.endswith('.csv') or name.endswith('.txt'):
        return _rows_from_csv(file_bytes)
    if name.endswith('.xlsx') or name.endswith('.xlsm') or name.endswith('.xls'):
        return _rows_from_excel(file_bytes)
    if name.endswith('.pdf'):
        return _rows_from_pdf(file_bytes)
    raise ImportError_('Format non supporté. Utilisez CSV, Excel (.xlsx) ou PDF.')


@transaction.atomic
def import_products(*, company, user, filename, file_bytes, default_warehouse=None, max_new=None):
    rows = parse_file(filename, file_bytes)
    if len(rows) < 2:
        raise ImportError_('Le fichier doit contenir une ligne d\'en-tête et au moins un produit.')

    header_map = _build_header_map(rows[0])
    if 'name' not in header_map:
        raise ImportError_(
            'Colonne "nom" introuvable. En-têtes attendues : '
            + ', '.join(TEMPLATE_HEADERS)
        )

    default_unit = None

    def get_unit(unit_name):
        nonlocal default_unit
        unit_name = (unit_name or '').strip()
        if unit_name:
            unit, _ = Unit.objects.get_or_create(
                company=company,
                name=unit_name,
                defaults={'abbreviation': unit_name[:10]},
            )
            return unit
        if default_unit is None:
            default_unit, _ = Unit.objects.get_or_create(
                company=company,
                name='Pièce',
                defaults={'abbreviation': 'pce'},
            )
        return default_unit

    if default_warehouse is None:
        default_warehouse = (
            Warehouse.objects.filter(branch__company=company, is_active=True)
            .order_by('-is_default', 'id')
            .first()
        )

    created = 0
    skipped = 0
    errors = []
    limit_hit = False

    def cell(row, field):
        idx = header_map.get(field)
        if idx is None or idx >= len(row):
            return ''
        return row[idx]

    for line_no, row in enumerate(rows[1:], start=2):
        name = str(cell(row, 'name')).strip()
        if not name:
            skipped += 1
            continue

        if max_new is not None and created >= max_new:
            limit_hit = True
            skipped += 1
            continue

        try:
            sale_price = _to_decimal(cell(row, 'sale_price'))
            if sale_price <= 0:
                errors.append(f'Ligne {line_no} ({name}) : prix de vente manquant ou nul.')
                skipped += 1
                continue

            category = None
            cat_name = str(cell(row, 'category')).strip()
            if cat_name:
                category, _ = Category.objects.get_or_create(company=company, name=cat_name)

            brand = None
            brand_name = str(cell(row, 'brand')).strip()
            if brand_name:
                brand, _ = Brand.objects.get_or_create(company=company, name=brand_name)

            unit = get_unit(cell(row, 'unit'))

            product = Product.objects.create(
                company=company,
                name=name,
                sku=str(cell(row, 'sku')).strip(),
                description=str(cell(row, 'description')).strip(),
                category=category,
                brand=brand,
                unit=unit,
                purchase_price=_to_decimal(cell(row, 'purchase_price')),
                sale_price=sale_price,
                tax_rate=_to_decimal(cell(row, 'tax_rate')),
                min_stock=_to_decimal(cell(row, 'min_stock')),
            )

            barcode_val = str(cell(row, 'barcode')).strip()
            if barcode_val:
                Barcode.objects.get_or_create(
                    product=product,
                    code=barcode_val,
                    defaults={'is_primary': True},
                )

            qty = _to_decimal(cell(row, 'quantity'))
            if qty > 0 and default_warehouse is not None:
                stock_entry(
                    product=product,
                    warehouse=default_warehouse,
                    quantity=qty,
                    user=user,
                    notes='Import initial',
                    reference='IMPORT',
                )

            created += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f'Ligne {line_no} ({name}) : {exc}')
            skipped += 1

    if limit_hit:
        errors.append(
            'Limite de produits de votre abonnement atteinte : certains produits '
            'n\'ont pas été importés. Passez à un pack supérieur.'
        )

    return {
        'created': created,
        'skipped': skipped,
        'total_rows': len(rows) - 1,
        'errors': errors[:50],
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
        'Boulangerie', '', 'Pièce', '0', '5', '', '20',
    ])
    return output.getvalue()
