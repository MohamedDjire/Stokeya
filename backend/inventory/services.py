from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from products.models import Product, ProductBatch
from sales.models import SaleItem, SaleStatus

from .models import (
    InventorySession,
    InventorySessionItem,
    InventorySessionStatus,
    MovementType,
    RequestStatus,
    StockLevel,
    StockMovement,
    StockRequest,
    StockRequestItem,
    StockTransfer,
    StockTransferItem,
    TransferStatus,
    TransferVarianceReason,
)

INCOMING_TYPES = {
    MovementType.IN, MovementType.PURCHASE, MovementType.RETURN_CUSTOMER, MovementType.RETURN,
}
OUTGOING_TYPES = {
    MovementType.OUT, MovementType.SALE, MovementType.LOSS, MovementType.BREAKAGE,
    MovementType.THEFT, MovementType.DONATION, MovementType.INTERNAL,
    MovementType.RETURN_SUPPLIER,
}


class StockError(Exception):
    pass


def average_positive_quantity(quantities):
    """Moyenne des quantités strictement positives (seuil d'alerte orange)."""
    positive = []
    for raw in quantities:
        try:
            qty = Decimal(str(raw or 0))
        except Exception:  # noqa: BLE001
            continue
        if qty > 0:
            positive.append(qty)
    if not positive:
        return Decimal('0')
    return sum(positive) / Decimal(len(positive))


def classify_stock(quantity, min_stock=0, avg_quantity=None):
    """Statut stock : out_of_stock (rouge) | low (orange) | ok.

    Seuil orange = stock minimum du produit s'il est > 0,
    sinon la quantité moyenne du catalogue (ou 5 par défaut).
    """
    try:
        qty = Decimal(str(quantity or 0))
    except Exception:  # noqa: BLE001
        qty = Decimal('0')
    if qty <= 0:
        return 'out_of_stock'

    try:
        threshold = Decimal(str(min_stock or 0))
    except Exception:  # noqa: BLE001
        threshold = Decimal('0')

    if threshold <= 0:
        try:
            avg = Decimal(str(avg_quantity or 0))
        except Exception:  # noqa: BLE001
            avg = Decimal('0')
        threshold = avg if avg > 0 else Decimal('5')

    if qty <= threshold:
        return 'low'
    return 'ok'


def _get_or_create_level(product, warehouse):
    level, _ = StockLevel.objects.get_or_create(
        product=product,
        warehouse=warehouse,
        defaults={'quantity': Decimal('0')},
    )
    return level


def default_warehouse_for_company(company):
    from warehouses.models import Warehouse
    return (
        Warehouse.objects.filter(branch__company=company, is_active=True)
        .order_by('-is_default', 'id')
        .first()
    )


def ensure_product_stock(
    product, *, warehouse=None, quantity=None, user=None, notes='Stock produit',
):
    """Garantit un StockLevel (sinon le produit n'apparaît pas en Stock).

    - quantity=None → crée juste le niveau à 0
    - quantity >= 0 → fixe le stock (entrée / ajustement / sortie selon l'écart)
    """
    warehouse = warehouse or default_warehouse_for_company(product.company)
    if warehouse is None:
        return None

    level = _get_or_create_level(product, warehouse)
    if quantity is None:
        return level

    target = Decimal(str(quantity))
    if target < 0:
        raise StockError('Le stock ne peut pas être négatif.')

    old_quantity = level.quantity
    if target == old_quantity:
        return level

    diff = target - old_quantity
    if old_quantity == 0 and target > 0 and user is not None:
        stock_entry(
            product=product, warehouse=warehouse, quantity=target,
            user=user, notes=notes, reference='STOCK-INIT',
        )
        return _get_or_create_level(product, warehouse)

    level.quantity = target
    level.save(update_fields=['quantity', 'updated_at'])
    if user is not None:
        StockMovement.objects.create(
            product=product,
            warehouse=warehouse,
            movement_type=MovementType.ADJUSTMENT,
            quantity=abs(diff),
            old_quantity=old_quantity,
            new_quantity=target,
            notes=notes,
            reference='STOCK-SET',
            reason='Ajustement stock produit',
            created_by=user,
        )
    return level


def sync_missing_stock_levels(company):
    """Crée un StockLevel à 0 pour tout produit actif sans ligne de stock."""
    warehouse = default_warehouse_for_company(company)
    if warehouse is None:
        return 0
    existing_ids = StockLevel.objects.filter(
        product__company=company,
    ).values_list('product_id', flat=True)
    missing = list(
        Product.objects.filter(company=company, is_active=True)
        .exclude(id__in=existing_ids)
        .values_list('id', flat=True)
    )
    if not missing:
        return 0
    StockLevel.objects.bulk_create(
        [
            StockLevel(product_id=pid, warehouse=warehouse, quantity=Decimal('0'))
            for pid in missing
        ],
        ignore_conflicts=True,
    )
    return len(missing)


def get_stock_status(warehouse):
    levels = StockLevel.objects.filter(
        warehouse=warehouse,
        product__is_active=True,
    ).select_related('product', 'product__category', 'location').prefetch_related('product__barcodes')

    levels = list(levels)
    avg_qty = average_positive_quantity([level.quantity for level in levels])

    data = []
    for level in levels:
        product = level.product
        quantity = level.quantity
        status = classify_stock(quantity, product.min_stock, avg_qty)
        primary_barcode = next(
            (b.code for b in product.barcodes.all() if b.is_primary),
            None,
        )
        if not primary_barcode:
            barcodes = list(product.barcodes.all())
            primary_barcode = barcodes[0].code if barcodes else ''

        data.append({
            'id': level.id,
            'product_id': product.id,
            'name': product.name,
            'sku': product.sku,
            'barcode': primary_barcode or '',
            'category_id': product.category_id,
            'category_name': product.category.name if product.category_id else '',
            'quantity': str(quantity),
            'reserved_quantity': str(level.reserved_quantity or 0),
            'available': str(level.available),
            'min_stock': str(product.min_stock),
            'max_stock': str(product.max_stock) if product.max_stock is not None else None,
            'purchase_price': str(product.purchase_price),
            'sale_price': str(product.sale_price),
            'status': status,
            'location_code': level.location.code if level.location else None,
            'updated_at': level.updated_at,
        })
    return data


def get_stock_movements(warehouse, limit=100):
    movements = StockMovement.objects.filter(
        warehouse=warehouse,
    ).select_related('product', 'created_by', 'supplier', 'batch').order_by('-created_at')[:limit]

    return [
        {
            'id': m.id,
            'product_id': m.product_id,
            'product_name': m.product.name,
            'movement_type': m.movement_type,
            'quantity': m.quantity,
            'old_quantity': m.old_quantity,
            'new_quantity': m.new_quantity,
            'unit_cost': m.unit_cost,
            'reference': m.reference,
            'invoice_ref': m.invoice_ref,
            'reason': m.reason,
            'notes': m.notes,
            'supplier_name': m.supplier.name if m.supplier else None,
            'batch_number': m.batch.batch_number if m.batch else None,
            'created_by': m.created_by.get_full_name() if m.created_by else 'Système',
            'created_at': m.created_at,
        }
        for m in movements
    ]


def get_stock_stats(warehouse):
    levels = StockLevel.objects.filter(
        warehouse=warehouse,
        product__is_active=True,
    ).select_related('product')

    levels = list(levels)
    avg_qty = average_positive_quantity([level.quantity for level in levels])
    total_products = len(levels)
    stock_total = sum((level.quantity for level in levels), Decimal('0'))
    stock_value = sum(level.quantity * level.product.purchase_price for level in levels)
    statuses = [
        classify_stock(level.quantity, level.product.min_stock, avg_qty)
        for level in levels
    ]
    in_stock = sum(1 for s in statuses if s != 'out_of_stock')
    out_of_stock = sum(1 for s in statuses if s == 'out_of_stock')
    low_stock = sum(1 for s in statuses if s == 'low')
    over_max = sum(
        1 for level in levels
        if level.product.max_stock and level.quantity > level.product.max_stock
    )

    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    movements = StockMovement.objects.filter(
        warehouse=warehouse,
        created_at__gte=month_start,
    )
    entries_month = movements.filter(
        movement_type__in=INCOMING_TYPES,
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
    exits_month = movements.filter(
        movement_type__in=OUTGOING_TYPES,
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')

    return {
        'total_products': total_products,
        'stock_total': stock_total,
        'stock_value': stock_value,
        'in_stock': in_stock,
        'out_of_stock': out_of_stock,
        'low_stock': low_stock,
        'over_max': over_max,
        'entries_month': entries_month,
        'exits_month': exits_month,
    }


def get_company_stock_alert_summary(company):
    """Compteurs d'alertes stock (faible + rupture) pour toute l'entreprise."""
    levels = list(
        StockLevel.objects.filter(
            product__company=company,
            product__is_active=True,
        ).select_related('product')
    )
    avg_qty = average_positive_quantity([level.quantity for level in levels])
    low_stock = 0
    out_of_stock = 0
    for level in levels:
        status = classify_stock(level.quantity, level.product.min_stock, avg_qty)
        if status == 'out_of_stock':
            out_of_stock += 1
        elif status == 'low':
            low_stock += 1
    return {
        'low_stock': low_stock,
        'out_of_stock': out_of_stock,
        'count': low_stock + out_of_stock,
    }


def get_stock_alerts(warehouse):
    today = timezone.now().date()
    soon = today + timedelta(days=30)
    company = warehouse.branch.company
    alerts = []

    levels = list(StockLevel.objects.filter(
        warehouse=warehouse,
        product__is_active=True,
    ).select_related('product'))
    avg_qty = average_positive_quantity([level.quantity for level in levels])

    for level in levels:
        product = level.product
        status = classify_stock(level.quantity, product.min_stock, avg_qty)
        if status == 'out_of_stock':
            alerts.append({
                'type': 'out_of_stock',
                'severity': 'error',
                'product_id': product.id,
                'product_name': product.name,
                'message': f'{product.name} — rupture de stock',
                'quantity': level.quantity,
            })
        elif status == 'low':
            threshold = product.min_stock if product.min_stock and product.min_stock > 0 else avg_qty
            alerts.append({
                'type': 'low_stock',
                'severity': 'warning',
                'product_id': product.id,
                'product_name': product.name,
                'message': (
                    f'{product.name} — stock faible ({level.quantity}'
                    f' / seuil {threshold})'
                ),
                'quantity': level.quantity,
            })
        if product.max_stock and level.quantity > product.max_stock:
            alerts.append({
                'type': 'over_max',
                'severity': 'info',
                'product_id': product.id,
                'product_name': product.name,
                'message': f'{product.name} — stock max dépassé ({level.quantity} / max {product.max_stock})',
                'quantity': level.quantity,
            })

    batches = ProductBatch.objects.filter(
        company=company,
        product__is_active=True,
        quantity__gt=0,
        expiry_date__isnull=False,
    ).select_related('product')

    for batch in batches:
        if batch.expiry_date < today:
            alerts.append({
                'type': 'expired',
                'severity': 'error',
                'product_id': batch.product_id,
                'product_name': batch.product.name,
                'message': f'{batch.product.name} — lot {batch.batch_number} expiré le {batch.expiry_date:%d/%m/%Y}',
                'batch_number': batch.batch_number,
                'expiry_date': batch.expiry_date,
            })
        elif batch.expiry_date <= soon:
            alerts.append({
                'type': 'expiring_soon',
                'severity': 'warning',
                'product_id': batch.product_id,
                'product_name': batch.product.name,
                'message': f'{batch.product.name} — lot {batch.batch_number} expire le {batch.expiry_date:%d/%m/%Y}',
                'batch_number': batch.batch_number,
                'expiry_date': batch.expiry_date,
            })

    severity_order = {'error': 0, 'warning': 1, 'info': 2}
    alerts.sort(key=lambda a: severity_order.get(a['severity'], 9))
    return alerts


def _is_pos_outlet_stock(warehouse):
    """Stock caisse d'un point de vente (hors boutique principale / siège)."""
    branch = getattr(warehouse, 'branch', None)
    return bool(warehouse.is_pos_stock and branch is not None and not branch.is_main)


def _validate_transfer_route(from_warehouse, to_warehouse):
    if from_warehouse.id == to_warehouse.id:
        raise StockError('Les emplacements source et destination doivent être différents.')
    if _is_pos_outlet_stock(from_warehouse) and _is_pos_outlet_stock(to_warehouse):
        raise StockError(
            'Transfert direct entre points de vente interdit. '
            'Passez par un entrepôt ou la boutique principale.'
        )


def _assert_source_availability(from_warehouse, items_data):
    for item in items_data:
        product = item['product']
        quantity = Decimal(str(item['quantity']))
        level = _get_or_create_level(product, from_warehouse)
        available = level.quantity - (level.reserved_quantity or 0)
        if available < quantity:
            raise StockError(
                f'Stock insuffisant pour {product.name} '
                f'(disponible {available}, demandé {quantity}).'
            )


def _assign_transfer_reference(transfer):
    if transfer.reference:
        return transfer
    transfer.reference = f'TRF-{transfer.id:06d}'
    transfer.save(update_fields=['reference', 'updated_at'])
    return transfer


def _variance_movement_type(reason):
    mapping = {
        TransferVarianceReason.BROKEN: MovementType.BREAKAGE,
        TransferVarianceReason.LOST: MovementType.LOSS,
        TransferVarianceReason.STOLEN: MovementType.THEFT,
        TransferVarianceReason.OTHER: MovementType.LOSS,
    }
    return mapping.get(reason, MovementType.LOSS)


def _serialize_transfer(transfer):
    items = list(transfer.items.all())
    total_qty = sum((i.quantity for i in items), Decimal('0'))
    return {
        'id': transfer.id,
        'reference': transfer.reference or f'TRF-{transfer.id:06d}',
        'from_warehouse_id': transfer.from_warehouse_id,
        'from_warehouse': transfer.from_warehouse.name,
        'to_warehouse_id': transfer.to_warehouse_id,
        'to_warehouse': transfer.to_warehouse.name,
        'status': transfer.status,
        'status_display': transfer.get_status_display(),
        'carrier': transfer.carrier,
        'notes': transfer.notes,
        'shipped_at': transfer.shipped_at,
        'received_at': transfer.received_at,
        'items_count': len(items),
        'total_quantity': total_qty,
        'items': [
            {
                'id': i.id,
                'product_id': i.product_id,
                'product_name': i.product.name,
                'product_sku': getattr(i.product, 'sku', '') or '',
                'quantity': i.quantity,
                'quantity_received': i.quantity_received,
                'variance_reason': i.variance_reason,
                'variance_notes': i.variance_notes,
            }
            for i in items
        ],
        'created_by': transfer.created_by.get_full_name() if transfer.created_by else 'Système',
        'received_by': transfer.received_by.get_full_name() if transfer.received_by else None,
        'created_at': transfer.created_at,
        'updated_at': transfer.updated_at,
    }


def get_transfer_history(company, warehouse=None, limit=50):
    qs = StockTransfer.objects.filter(company=company).select_related(
        'from_warehouse', 'to_warehouse', 'from_warehouse__branch', 'to_warehouse__branch',
        'created_by', 'received_by',
    ).prefetch_related('items__product').order_by('-created_at')

    if warehouse:
        qs = qs.filter(Q(from_warehouse=warehouse) | Q(to_warehouse=warehouse))

    return [_serialize_transfer(t) for t in qs[:limit]]


def get_product_rankings(company, days=90, limit=10):
    since = timezone.now() - timedelta(days=days)
    rows = list(
        SaleItem.objects.filter(
            sale__company=company,
            sale__status=SaleStatus.COMPLETED,
            sale__created_at__gte=since,
        )
        .values('product_id', 'product__name')
        .annotate(qty_sold=Sum('quantity'), revenue=Sum('total'))
        .order_by('-qty_sold')
    )
    top = [
        {
            'product_id': r['product_id'],
            'name': r['product__name'],
            'qty_sold': r['qty_sold'],
            'revenue': r['revenue'],
        }
        for r in rows[:limit]
    ]
    least = [
        {
            'product_id': r['product_id'],
            'name': r['product__name'],
            'qty_sold': r['qty_sold'],
            'revenue': r['revenue'],
        }
        for r in sorted(rows, key=lambda x: x['qty_sold'] or 0)[:limit]
    ]
    return {'top_sold': top, 'least_sold': least}


@transaction.atomic
def stock_entry(
    product, warehouse, quantity, user, notes='', reference='',
    movement_type=None, reason='', supplier=None, invoice_ref='',
    unit_cost=None, batch=None,
):
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        raise StockError('La quantité doit être positive.')

    level = _get_or_create_level(product, warehouse)
    old_quantity = level.quantity
    new_quantity = old_quantity + quantity

    movement = StockMovement.objects.create(
        product=product,
        warehouse=warehouse,
        movement_type=movement_type or MovementType.IN,
        quantity=quantity,
        old_quantity=old_quantity,
        new_quantity=new_quantity,
        unit_cost=unit_cost,
        notes=notes,
        reference=reference,
        invoice_ref=invoice_ref,
        reason=reason,
        supplier=supplier,
        batch=batch,
        created_by=user,
    )
    level.quantity = new_quantity
    level.save(update_fields=['quantity', 'updated_at'])
    return movement


@transaction.atomic
def stock_exit(
    product, warehouse, quantity, user, notes='', reference='',
    movement_type=None, reason='', supplier=None, invoice_ref='',
    unit_cost=None, batch=None, from_reservation=False,
):
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        raise StockError('La quantité doit être positive.')

    level = _get_or_create_level(product, warehouse)
    if level.quantity < quantity:
        raise StockError('Stock insuffisant pour cette sortie.')

    old_quantity = level.quantity
    new_quantity = old_quantity - quantity

    movement = StockMovement.objects.create(
        product=product,
        warehouse=warehouse,
        movement_type=movement_type or MovementType.OUT,
        quantity=quantity,
        old_quantity=old_quantity,
        new_quantity=new_quantity,
        unit_cost=unit_cost,
        notes=notes,
        reference=reference,
        invoice_ref=invoice_ref,
        reason=reason,
        supplier=supplier,
        batch=batch,
        created_by=user,
    )
    level.quantity = new_quantity
    if from_reservation:
        level.reserved_quantity = max(Decimal('0'), (level.reserved_quantity or 0) - quantity)
        level.save(update_fields=['quantity', 'reserved_quantity', 'updated_at'])
    else:
        level.save(update_fields=['quantity', 'updated_at'])
    return movement


@transaction.atomic
def reserve_stock(product, warehouse, quantity):
    """Réserve du stock disponible sans le sortir (commandes boutique)."""
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        raise StockError('La quantité doit être positive.')
    level = _get_or_create_level(product, warehouse)
    available = level.quantity - (level.reserved_quantity or 0)
    if available < quantity:
        raise StockError(
            f'Stock disponible insuffisant pour {product.name} '
            f'(disponible {available}, demandé {quantity}).'
        )
    level.reserved_quantity = (level.reserved_quantity or 0) + quantity
    level.save(update_fields=['reserved_quantity', 'updated_at'])
    return level


@transaction.atomic
def release_reservation(product, warehouse, quantity):
    """Libère une réservation (annulation / ajustement)."""
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        return
    level = _get_or_create_level(product, warehouse)
    level.reserved_quantity = max(Decimal('0'), (level.reserved_quantity or 0) - quantity)
    level.save(update_fields=['reserved_quantity', 'updated_at'])
    return level


@transaction.atomic
def stock_transfer(
    from_warehouse, to_warehouse, items_data, user, company,
    notes='', carrier='', auto_prepare=True, reserve=True,
):
    if from_warehouse.branch.company_id != company.id or to_warehouse.branch.company_id != company.id:
        raise StockError('Emplacements invalides.')
    _validate_transfer_route(from_warehouse, to_warehouse)
    if not items_data:
        raise StockError('Ajoutez au moins un produit.')
    _assert_source_availability(from_warehouse, items_data)

    transfer = StockTransfer.objects.create(
        company=company,
        from_warehouse=from_warehouse,
        to_warehouse=to_warehouse,
        status=TransferStatus.PENDING,
        notes=notes,
        carrier=carrier,
        created_by=user,
    )
    _assign_transfer_reference(transfer)

    for item in items_data:
        product = item['product']
        quantity = Decimal(str(item['quantity']))
        if quantity <= 0:
            raise StockError('Quantité invalide.')
        StockTransferItem.objects.create(transfer=transfer, product=product, quantity=quantity)
        if reserve:
            reserve_stock(product, from_warehouse, quantity)

    if auto_prepare:
        prepare_transfer(transfer, user)

    return transfer


@transaction.atomic
def import_from_main(to_warehouse, items_data, user, company, notes='', complete_now=False):
    """Approvisionne un entrepôt depuis le stock de la boutique principale (siège)."""
    from branches.models import Branch
    from warehouses.models import Warehouse

    if to_warehouse.branch.company_id != company.id:
        raise StockError('Entrepôt invalide.')
    if to_warehouse.is_pos_stock and _is_pos_outlet_stock(to_warehouse):
        raise StockError(
            'Pour approvisionner un point de vente, utilisez le module Transferts de stock.'
        )

    main_branch = Branch.objects.filter(company=company, is_main=True).first()
    if not main_branch:
        raise StockError('Boutique principale introuvable.')

    from_warehouse = (
        Warehouse.objects.filter(branch=main_branch, is_active=True, is_pos_stock=True)
        .order_by('-is_default', 'id')
        .first()
    )
    if not from_warehouse:
        raise StockError('Stock de la boutique principale introuvable.')

    transfer = stock_transfer(
        from_warehouse=from_warehouse,
        to_warehouse=to_warehouse,
        items_data=items_data,
        user=user,
        company=company,
        notes=notes or f'Approvisionnement siège → {to_warehouse.name}',
        auto_prepare=not complete_now,
    )
    if complete_now:
        # Déjà en préparation si auto_prepare ; sinon préparer puis expédier/recevoir
        if transfer.status == TransferStatus.PENDING:
            prepare_transfer(transfer, user)
        ship_transfer(transfer, user)
        receive_transfer(transfer, user)
    return transfer


@transaction.atomic
def prepare_transfer(transfer, user):
    if transfer.status != TransferStatus.PENDING:
        raise StockError('Seul un transfert créé peut passer en préparation.')
    transfer.status = TransferStatus.PREPARING
    transfer.save(update_fields=['status', 'updated_at'])
    return transfer


@transaction.atomic
def ship_transfer(transfer, user):
    if transfer.status not in (TransferStatus.PENDING, TransferStatus.PREPARING):
        raise StockError('Seul un transfert créé ou en préparation peut être expédié.')

    ref = transfer.reference or f'TRF-{transfer.id:06d}'
    items = list(transfer.items.select_related('product'))

    for item in items:
        level = _get_or_create_level(item.product, transfer.from_warehouse)
        if level.quantity < item.quantity:
            raise StockError(
                f'Stock insuffisant pour {item.product.name} '
                f'(physique {level.quantity}, demandé {item.quantity}).'
            )
        stock_exit(
            product=item.product,
            warehouse=transfer.from_warehouse,
            quantity=item.quantity,
            user=user,
            notes=f'Transfert → {transfer.to_warehouse.name}',
            reference=ref,
            movement_type=MovementType.TRANSFER,
            from_reservation=True,
        )

    transfer.status = TransferStatus.SHIPPED
    transfer.shipped_at = timezone.now()
    transfer.save(update_fields=['status', 'shipped_at', 'updated_at'])
    return transfer


@transaction.atomic
def receive_transfer(transfer, user, items_received=None):
    """
    Confirme la réception. `items_received` optionnel :
    [{item_id|product_id, quantity_received, variance_reason?, variance_notes?}]
    """
    if transfer.status not in (TransferStatus.SHIPPED, TransferStatus.IN_TRANSIT):
        raise StockError('Ce transfert doit être expédié avant réception.')

    ref = transfer.reference or f'TRF-{transfer.id:06d}'
    received_map = {}
    if items_received:
        for row in items_received:
            key = row.get('item_id') or row.get('product_id')
            if key is None:
                continue
            received_map[int(key)] = row

    for item in transfer.items.select_related('product'):
        row = received_map.get(item.id) or received_map.get(item.product_id) or {}
        qty_shipped = Decimal(str(item.quantity))
        if 'quantity_received' in row and row['quantity_received'] is not None:
            qty_received = Decimal(str(row['quantity_received']))
        else:
            qty_received = qty_shipped

        if qty_received < 0:
            raise StockError('Quantité reçue invalide.')
        if qty_received > qty_shipped:
            raise StockError(
                f'Quantité reçue supérieure à l\'expédié pour {item.product.name}.'
            )

        variance = qty_shipped - qty_received
        variance_reason = (row.get('variance_reason') or '').strip()
        variance_notes = (row.get('variance_notes') or '').strip()

        if variance > 0 and not variance_reason:
            raise StockError(
                f'Écart constaté pour {item.product.name} ({variance}). '
                'Indiquez un motif (cassé, perdu, volé, autre).'
            )
        if variance == 0:
            variance_reason = ''
            variance_notes = ''

        if qty_received > 0:
            stock_entry(
                product=item.product,
                warehouse=transfer.to_warehouse,
                quantity=qty_received,
                user=user,
                notes=f'Transfert depuis {transfer.from_warehouse.name}',
                reference=ref,
                movement_type=MovementType.TRANSFER,
            )

        if variance > 0:
            level = _get_or_create_level(item.product, transfer.to_warehouse)
            StockMovement.objects.create(
                product=item.product,
                warehouse=transfer.to_warehouse,
                movement_type=_variance_movement_type(variance_reason),
                quantity=variance,
                old_quantity=level.quantity,
                new_quantity=level.quantity,
                notes=(
                    f'Écart transfert {ref} '
                    f'({dict(TransferVarianceReason.choices).get(variance_reason, variance_reason)}'
                    f'{": " + variance_notes if variance_notes else ""})'
                ),
                reference=f'{ref}-ECART',
                reason=variance_reason,
                created_by=user,
            )

        item.quantity_received = qty_received
        item.variance_reason = variance_reason if variance > 0 else ''
        item.variance_notes = variance_notes if variance > 0 else ''
        item.save(update_fields=['quantity_received', 'variance_reason', 'variance_notes'])

    transfer.status = TransferStatus.COMPLETED
    transfer.received_at = timezone.now()
    transfer.received_by = user
    transfer.save(update_fields=['status', 'received_at', 'received_by', 'updated_at'])
    return transfer


@transaction.atomic
def cancel_transfer(transfer, user):
    if transfer.status not in (TransferStatus.PENDING, TransferStatus.PREPARING):
        raise StockError(
            'Un transfert ne peut être annulé qu\'avant expédition.'
        )
    for item in transfer.items.select_related('product'):
        release_reservation(item.product, transfer.from_warehouse, item.quantity)
    transfer.status = TransferStatus.CANCELLED
    transfer.save(update_fields=['status', 'updated_at'])
    return transfer


def suggest_replenishment(company, to_warehouse, from_warehouse=None, days=30):
    """Approvisionnement intelligent : propose les quantités à transférer."""
    from warehouses.models import Warehouse

    if to_warehouse.branch.company_id != company.id:
        raise StockError('Emplacement destination invalide.')

    if from_warehouse is None:
        from branches.models import Branch
        main = Branch.objects.filter(company=company, is_main=True).first()
        if main:
            from_warehouse = (
                Warehouse.objects.filter(branch=main, is_active=True, is_pos_stock=True)
                .order_by('-is_default', 'id')
                .first()
            )
    if from_warehouse is None:
        raise StockError('Source d\'approvisionnement introuvable.')
    if from_warehouse.branch.company_id != company.id:
        raise StockError('Emplacement source invalide.')
    _validate_transfer_route(from_warehouse, to_warehouse)

    since = timezone.now() - timedelta(days=days)
    sales_rows = {
        r['product_id']: r['qty_sold'] or Decimal('0')
        for r in SaleItem.objects.filter(
            sale__company=company,
            sale__status=SaleStatus.COMPLETED,
            sale__created_at__gte=since,
            sale__branch=to_warehouse.branch,
        ).values('product_id').annotate(qty_sold=Sum('quantity'))
    }
    # Fallback: ventes société si pas de ventes sur la boutique liée
    if not sales_rows:
        sales_rows = {
            r['product_id']: r['qty_sold'] or Decimal('0')
            for r in SaleItem.objects.filter(
                sale__company=company,
                sale__status=SaleStatus.COMPLETED,
                sale__created_at__gte=since,
            ).values('product_id').annotate(qty_sold=Sum('quantity'))
        }

    pending_in = {
        r['product_id']: r['qty'] or Decimal('0')
        for r in StockTransferItem.objects.filter(
            transfer__company=company,
            transfer__to_warehouse=to_warehouse,
            transfer__status__in=[
                TransferStatus.PENDING,
                TransferStatus.PREPARING,
                TransferStatus.SHIPPED,
                TransferStatus.IN_TRANSIT,
            ],
        ).values('product_id').annotate(qty=Sum('quantity'))
    }

    source_levels = {
        lv.product_id: lv
        for lv in StockLevel.objects.filter(
            warehouse=from_warehouse, product__is_active=True, product__company=company,
        ).select_related('product', 'product__category')
    }
    dest_levels = {
        lv.product_id: lv
        for lv in StockLevel.objects.filter(warehouse=to_warehouse).select_related('product')
    }

    suggestions = []
    for product_id, src_level in source_levels.items():
        product = src_level.product
        current = dest_levels[product_id].quantity if product_id in dest_levels else Decimal('0')
        min_stock = Decimal(str(product.min_stock or 0))
        max_stock = Decimal(str(product.max_stock or 0)) if product.max_stock else Decimal('0')
        sold = Decimal(str(sales_rows.get(product_id, 0)))
        daily = sold / Decimal(str(days)) if days else Decimal('0')
        cover_target = (daily * Decimal('14')).quantize(Decimal('1'))
        target = max_stock if max_stock > 0 else max(min_stock, cover_target)
        if target <= 0 and min_stock <= 0:
            continue
        if target <= 0:
            target = min_stock
        pending = Decimal(str(pending_in.get(product_id, 0)))
        proposed = target - current - pending
        if proposed <= 0:
            continue
        available = src_level.available
        if available <= 0:
            continue
        qty = min(proposed, available).quantize(Decimal('1'))
        if qty <= 0:
            continue
        suggestions.append({
            'product_id': product.id,
            'product_name': product.name,
            'sku': product.sku,
            'category_id': product.category_id,
            'category_name': product.category.name if product.category_id else '',
            'current_stock': current,
            'min_stock': min_stock,
            'target_stock': target,
            'pending_inbound': pending,
            'sales_period': sold,
            'source_available': available,
            'proposed_quantity': qty,
            'purchase_price': product.purchase_price,
            'sale_price': product.sale_price,
        })

    suggestions.sort(key=lambda x: (-float(x['proposed_quantity']), x['product_name']))
    return {
        'from_warehouse_id': from_warehouse.id,
        'from_warehouse_name': from_warehouse.name,
        'to_warehouse_id': to_warehouse.id,
        'to_warehouse_name': to_warehouse.name,
        'days': days,
        'items': suggestions,
        'items_count': len(suggestions),
    }


def parse_transfer_file(company, uploaded_file):
    """Parse Excel/CSV : colonnes produit (nom/sku/code-barres) + quantité."""
    from io import BytesIO

    from openpyxl import load_workbook
    from products.models import Product

    name = (getattr(uploaded_file, 'name', '') or '').lower()
    raw = uploaded_file.read()
    rows = []

    if name.endswith(('.xlsx', '.xls')):
        wb = load_workbook(BytesIO(raw), read_only=True, data_only=True)
        ws = wb.active
        for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if not row or all(c is None or str(c).strip() == '' for c in row):
                continue
            left = str(row[0]).strip() if row[0] is not None else ''
            right = row[1] if len(row) > 1 else None
            if i == 1 and left.lower() in ('produit', 'product', 'nom', 'sku', 'article'):
                continue
            if not left or right is None:
                continue
            try:
                qty = Decimal(str(right).replace(',', '.').replace(' ', ''))
            except Exception:  # noqa: BLE001
                continue
            if qty <= 0:
                continue
            rows.append({'key': left, 'quantity': qty})
    else:
        import csv
        from io import StringIO

        text = raw.decode('utf-8-sig', errors='ignore')
        first = next((ln for ln in text.splitlines() if ln.strip()), '')
        delimiter = ';' if first.count(';') >= first.count(',') else ','
        if first.count('\t') > first.count(delimiter):
            delimiter = '\t'
        reader = csv.reader(StringIO(text), delimiter=delimiter)
        for i, parts in enumerate(reader):
            parts = [str(p).strip() for p in parts if p is not None and str(p).strip() != '']
            if len(parts) < 2:
                fallback = (parts[0] if parts else '').rsplit(None, 1)
                if len(fallback) < 2:
                    continue
                parts = fallback
            left, right = parts[0], parts[1]
            if i == 0 and left.lower() in (
                'produit', 'product', 'nom', 'sku', 'article', 'quantité', 'quantite', 'qte',
            ):
                continue
            try:
                qty = Decimal(str(right).replace(',', '.').replace(' ', ''))
            except Exception:  # noqa: BLE001
                continue
            if qty <= 0:
                continue
            rows.append({'key': left, 'quantity': qty})

    products = list(Product.objects.filter(company=company, is_active=True).prefetch_related('barcodes'))
    by_name = {p.name.lower(): p for p in products}
    by_sku = { (p.sku or '').lower(): p for p in products if p.sku }
    barcode_map = {}
    for p in products:
        for b in p.barcodes.all():
            barcode_map[b.code.lower()] = p

    matched = []
    unmatched = []
    for row in rows:
        key = row['key']
        key_l = key.lower()
        product = by_name.get(key_l) or by_sku.get(key_l) or barcode_map.get(key_l)
        if not product:
            unmatched.append({'key': key, 'quantity': row['quantity']})
            continue
        matched.append({
            'product_id': product.id,
            'product_name': product.name,
            'sku': product.sku,
            'quantity': row['quantity'],
            'matched_key': key,
        })
    return {'matched': matched, 'unmatched': unmatched}


@transaction.atomic
def stock_adjustment(warehouse, items_data, user, company, reason, notes=''):
    from .models import StockAdjustment, StockAdjustmentItem

    adjustment = StockAdjustment.objects.create(
        company=company,
        warehouse=warehouse,
        reason=reason,
        notes=notes,
        created_by=user,
    )

    for item in items_data:
        product = item['product']
        expected = Decimal(str(item['expected_quantity']))
        actual = Decimal(str(item['actual_quantity']))
        diff = actual - expected

        StockAdjustmentItem.objects.create(
            adjustment=adjustment,
            product=product,
            expected_quantity=expected,
            actual_quantity=actual,
        )

        level = _get_or_create_level(product, warehouse)
        old_quantity = level.quantity
        level.quantity = actual
        level.save(update_fields=['quantity', 'updated_at'])

        if diff != 0:
            StockMovement.objects.create(
                product=product,
                warehouse=warehouse,
                movement_type=MovementType.ADJUSTMENT,
                quantity=abs(diff),
                old_quantity=old_quantity,
                new_quantity=actual,
                reason=reason,
                notes=f'{reason}: {expected} → {actual}',
                reference=f'ADJ-{adjustment.id}',
                created_by=user,
            )

    return adjustment


def _generate_session_reference(company):
    today = timezone.now().strftime('%Y%m%d')
    prefix = f'INV-{today}-'
    count = InventorySession.objects.filter(
        company=company, reference__startswith=prefix,
    ).count()
    return f'{prefix}{count + 1:03d}'


@transaction.atomic
def create_inventory_session(company, warehouse, user, product_ids=None, notes=''):
    levels = StockLevel.objects.filter(
        warehouse=warehouse, product__company=company, product__is_active=True,
    ).select_related('product')
    if product_ids:
        levels = levels.filter(product_id__in=product_ids)

    session = InventorySession.objects.create(
        company=company,
        warehouse=warehouse,
        reference=_generate_session_reference(company),
        status=InventorySessionStatus.IN_PROGRESS,
        notes=notes,
        created_by=user,
    )

    items = [
        InventorySessionItem(session=session, product=level.product, system_quantity=level.quantity)
        for level in levels
    ]

    if product_ids:
        existing_ids = {level.product_id for level in levels}
        missing_ids = set(product_ids) - existing_ids
        if missing_ids:
            missing_products = Product.objects.filter(
                company=company, id__in=missing_ids, is_active=True,
            )
            for product in missing_products:
                items.append(
                    InventorySessionItem(
                        session=session, product=product, system_quantity=Decimal('0'),
                    )
                )

    InventorySessionItem.objects.bulk_create(items)
    return session


def count_inventory_item(session, product_id, counted_quantity):
    if session.status == InventorySessionStatus.COMPLETED:
        raise StockError('Cette session a déjà été validée.')
    if session.status == InventorySessionStatus.CANCELLED:
        raise StockError('Cette session a été annulée.')

    try:
        item = session.items.get(product_id=product_id)
    except InventorySessionItem.DoesNotExist:
        raise StockError('Produit introuvable dans cette session.')

    item.counted_quantity = Decimal(str(counted_quantity))
    item.save(update_fields=['counted_quantity'])

    if session.status == InventorySessionStatus.DRAFT:
        session.status = InventorySessionStatus.IN_PROGRESS
        session.save(update_fields=['status', 'updated_at'])
    return item


@transaction.atomic
def validate_inventory_session(session, user):
    if session.status == InventorySessionStatus.COMPLETED:
        raise StockError('Cette session a déjà été validée.')
    if session.status == InventorySessionStatus.CANCELLED:
        raise StockError('Cette session a été annulée.')

    items = session.items.select_related('product').filter(counted_quantity__isnull=False)
    for item in items:
        diff = item.counted_quantity - item.system_quantity
        level = _get_or_create_level(item.product, session.warehouse)
        old_quantity = level.quantity
        level.quantity = item.counted_quantity
        level.save(update_fields=['quantity', 'updated_at'])

        if diff != 0:
            StockMovement.objects.create(
                product=item.product,
                warehouse=session.warehouse,
                movement_type=MovementType.INVENTORY,
                quantity=abs(diff),
                old_quantity=old_quantity,
                new_quantity=item.counted_quantity,
                reason=f'Inventaire {session.reference}',
                notes=item.notes,
                reference=session.reference,
                created_by=user,
            )

    session.status = InventorySessionStatus.COMPLETED
    session.validated_by = user
    session.validated_at = timezone.now()
    session.save(update_fields=['status', 'validated_by', 'validated_at', 'updated_at'])
    return session


def get_stock_dashboard(company, warehouse=None):
    from branches.models import Branch
    from warehouses.models import Warehouse

    levels = StockLevel.objects.filter(
        product__company=company, product__is_active=True,
    ).select_related('product')
    if warehouse:
        levels = levels.filter(warehouse=warehouse)
    else:
        levels = levels.filter(warehouse__branch__company=company)
    levels = list(levels)
    avg_qty = average_positive_quantity([level.quantity for level in levels])

    total_products = len({level.product_id for level in levels})
    stock_total_qty = sum((level.quantity for level in levels), Decimal('0'))
    stock_value = sum((level.quantity * level.product.purchase_price for level in levels), Decimal('0'))
    statuses = [
        classify_stock(level.quantity, level.product.min_stock, avg_qty)
        for level in levels
    ]
    out_of_stock = sum(1 for s in statuses if s == 'out_of_stock')
    low_stock = sum(1 for s in statuses if s == 'low')

    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    movements_qs = StockMovement.objects.filter(
        warehouse__branch__company=company, created_at__gte=today_start,
    )
    if warehouse:
        movements_qs = movements_qs.filter(warehouse=warehouse)
    movements_today = movements_qs.count()

    rankings = get_product_rankings(company, days=30, limit=5)

    branches_count = Branch.objects.filter(company=company, is_active=True).count()
    warehouses_count = Warehouse.objects.filter(branch__company=company, is_active=True).count()

    return {
        'total_products': total_products,
        'stock_total_qty': stock_total_qty,
        'out_of_stock': out_of_stock,
        'low_stock': low_stock,
        'stock_value': stock_value,
        'top_sold': rankings['top_sold'],
        'least_sold': rankings['least_sold'],
        'movements_today': movements_today,
        'branches_count': branches_count,
        'warehouses_count': warehouses_count,
    }


def get_stock_list(company, filters=None):
    filters = filters or {}
    sync_missing_stock_levels(company)

    levels = StockLevel.objects.filter(
        product__company=company, product__is_active=True,
    ).select_related(
        'product', 'product__category', 'product__brand', 'warehouse', 'warehouse__branch', 'location',
    ).prefetch_related('product__barcodes')

    warehouse_id = filters.get('warehouse_id')
    if warehouse_id:
        levels = levels.filter(warehouse_id=warehouse_id)
    else:
        levels = levels.filter(warehouse__branch__company=company)

    branch_id = filters.get('branch_id')
    if branch_id:
        levels = levels.filter(warehouse__branch_id=branch_id)

    category_id = filters.get('category_id')
    if category_id:
        levels = levels.filter(product__category_id=category_id)

    brand_id = filters.get('brand_id')
    if brand_id:
        levels = levels.filter(product__brand_id=brand_id)

    search = filters.get('search')
    if search:
        levels = levels.filter(
            Q(product__name__icontains=search)
            | Q(product__sku__icontains=search)
            | Q(product__barcodes__code__icontains=search)
        ).distinct()

    today = timezone.now().date()
    soon = today + timedelta(days=30)

    if filters.get('expired'):
        expired_ids = ProductBatch.objects.filter(
            company=company, expiry_date__lt=today, quantity__gt=0,
        ).values_list('product_id', flat=True)
        levels = levels.filter(product_id__in=list(expired_ids))

    if filters.get('expiring_soon'):
        expiring_ids = ProductBatch.objects.filter(
            company=company, expiry_date__gte=today, expiry_date__lte=soon, quantity__gt=0,
        ).values_list('product_id', flat=True)
        levels = levels.filter(product_id__in=list(expiring_ids))

    levels = list(levels)
    product_ids = [level.product_id for level in levels]
    warehouse_ids = list({level.warehouse_id for level in levels})

    last_in_map = {}
    last_out_map = {}
    if product_ids:
        movements_qs = StockMovement.objects.filter(
            product_id__in=product_ids, warehouse_id__in=warehouse_ids,
        ).order_by('product_id', 'warehouse_id', '-created_at').only(
            'product_id', 'warehouse_id', 'old_quantity', 'new_quantity', 'created_at',
        )
        for m in movements_qs:
            key = (m.product_id, m.warehouse_id)
            if m.old_quantity is None or m.new_quantity is None:
                continue
            if m.new_quantity > m.old_quantity and key not in last_in_map:
                last_in_map[key] = m.created_at
            elif m.new_quantity < m.old_quantity and key not in last_out_map:
                last_out_map[key] = m.created_at

    avg_qty = average_positive_quantity([level.quantity for level in levels])
    status_filter = filters.get('status')
    rows = []
    for level in levels:
        product = level.product
        quantity = level.quantity
        min_stock = product.min_stock
        row_status = classify_stock(quantity, min_stock, avg_qty)

        if status_filter and status_filter != row_status:
            continue

        barcodes = list(product.barcodes.all())
        primary_barcode = next((b.code for b in barcodes if b.is_primary), None)
        if not primary_barcode and barcodes:
            primary_barcode = barcodes[0].code

        key = (product.id, level.warehouse_id)

        rows.append({
            'id': level.id,
            'product_id': product.id,
            'image': product.image.url if product.image else None,
            'name': product.name,
            'barcode': primary_barcode or '',
            'sku': product.sku,
            'category': product.category.name if product.category else None,
            'category_id': product.category_id,
            'brand': product.brand.name if product.brand else None,
            'brand_id': product.brand_id,
            'warehouse_id': level.warehouse_id,
            'warehouse': level.warehouse.name,
            'branch_id': level.warehouse.branch_id,
            'branch': level.warehouse.branch.name,
            'quantity': quantity,
            'reserved': level.reserved_quantity,
            'available': level.available,
            'min_stock': min_stock,
            'max_stock': product.max_stock,
            'purchase_price': product.purchase_price,
            'sale_price': product.sale_price,
            'stock_value': quantity * product.purchase_price,
            'last_in': last_in_map.get(key),
            'last_out': last_out_map.get(key),
            'status': row_status,
            'location_code': level.location.code if level.location else None,
        })

    return rows


def suggested_replenish_qty(product, current_qty):
    """Quantité proposée : max_stock - actuel, sinon 2× min_stock."""
    current = Decimal(str(current_qty or 0))
    min_s = Decimal(str(product.min_stock or 0))
    max_s = Decimal(str(product.max_stock or 0)) if product.max_stock else Decimal('0')
    if max_s > 0:
        return max(Decimal('0'), (max_s - current).quantize(Decimal('1')))
    if min_s > 0:
        target = min_s * 2
        return max(Decimal('0'), (target - current).quantize(Decimal('1')))
    return Decimal('0')


def _pos_stock_warehouse(branch):
    from warehouses.models import Warehouse
    return (
        Warehouse.objects.filter(branch=branch, is_active=True, is_pos_stock=True)
        .order_by('-is_default', 'id')
        .first()
    )


def _default_supply_warehouse(branch, company):
    """Entrepôt d'approvisionnement par défaut du PDV / siège."""
    if branch.default_supply_warehouse_id:
        return branch.default_supply_warehouse
    from branches.models import Branch
    from warehouses.models import Warehouse
    main = Branch.objects.filter(company=company, is_main=True).first()
    if not main:
        return None
    return (
        Warehouse.objects.filter(branch=main, is_active=True)
        .filter(Q(is_pos_stock=True) | Q(is_default=True))
        .order_by('-is_pos_stock', '-is_default', 'id')
        .first()
    )


def _next_request_reference(company):
    stamp = timezone.now().strftime('%Y%m%d')
    count = StockRequest.objects.filter(
        company=company, reference__startswith=f'REQ-{stamp}',
    ).count()
    return f'REQ-{stamp}-{count + 1:03d}'


def _open_request_statuses():
    return (
        RequestStatus.DRAFT,
        RequestStatus.PENDING,
        RequestStatus.POS_VALIDATED,
        RequestStatus.APPROVED,
    )


@transaction.atomic
def upsert_replenishment_request(
    *,
    company,
    to_warehouse,
    product,
    user=None,
    source='auto',
    quantity=None,
    notes='',
    from_warehouse=None,
):
    """
    Crée ou enrichit une demande d'approvisionnement pour un produit.
    Le caissier n'impose pas la quantité : on calcule une proposition.
    """
    if to_warehouse.branch.company_id != company.id:
        raise StockError('Entrepôt destination invalide.')
    if product.company_id != company.id:
        raise StockError('Produit invalide.')

    level = StockLevel.objects.filter(product=product, warehouse=to_warehouse).first()
    current = level.quantity if level else Decimal('0')
    proposed = Decimal(str(quantity)) if quantity is not None else suggested_replenish_qty(product, current)
    if proposed <= 0:
        proposed = Decimal('1')

    if from_warehouse is None:
        from_warehouse = _default_supply_warehouse(to_warehouse.branch, company)

    # Demande ouverte existante pour ce magasin
    open_req = (
        StockRequest.objects.filter(
            company=company,
            to_warehouse=to_warehouse,
            status__in=_open_request_statuses(),
        )
        .filter(Q(source=source) | Q(source__in=('auto', 'cashier_alert', 'pos_manager', 'manual')))
        .order_by('-created_at')
        .first()
    )

    if open_req:
        item = open_req.items.filter(product=product).first()
        if item:
            # Ne pas baisser une quantité déjà validée au PDV
            if open_req.status in (RequestStatus.POS_VALIDATED, RequestStatus.APPROVED):
                return open_req
            if Decimal(str(item.quantity)) < proposed:
                item.quantity = proposed
                item.save(update_fields=['quantity'])
            return open_req
        StockRequestItem.objects.create(request=open_req, product=product, quantity=proposed)
        if notes and notes not in (open_req.notes or ''):
            open_req.notes = f'{open_req.notes}\n{notes}'.strip() if open_req.notes else notes
            open_req.save(update_fields=['notes', 'updated_at'])
        return open_req

    status = RequestStatus.PENDING
    # Demande manuelle / responsable PDV avec qté → déjà prête pour le siège si source pos_manager
    if source == 'pos_manager' and quantity is not None:
        status = RequestStatus.POS_VALIDATED

    req = StockRequest.objects.create(
        company=company,
        reference=_next_request_reference(company),
        from_warehouse=from_warehouse,
        to_warehouse=to_warehouse,
        status=status,
        source=source,
        notes=notes,
        requested_by=user,
    )
    StockRequestItem.objects.create(request=req, product=product, quantity=proposed)
    return req


def create_cashier_alert(*, company, user, product, to_warehouse=None):
    """Alerte caissier : demande sans choix de quantité."""
    from accounts.utils import user_has_flag

    if not user_has_flag(user, 'can_request_stock'):
        raise StockError('Vous ne pouvez pas demander un réapprovisionnement.')

    if to_warehouse is None:
        branch = user.assigned_branch
        if not branch:
            raise StockError('Aucun point de vente assigné.')
        to_warehouse = _pos_stock_warehouse(branch)
    if not to_warehouse:
        raise StockError('Stock du point de vente introuvable.')

    level = StockLevel.objects.filter(product=product, warehouse=to_warehouse).first()
    current = level.quantity if level else Decimal('0')
    return upsert_replenishment_request(
        company=company,
        to_warehouse=to_warehouse,
        product=product,
        user=user,
        source='cashier_alert',
        notes=f'Alerte caissier — stock actuel : {current}',
    )


def ensure_auto_low_stock_after_sale(*, company, warehouse, product_ids, user=None):
    """Après une vente : crée des demandes auto si stock ≤ min."""
    if not product_ids:
        return []
    created = []
    levels = {
        lv.product_id: lv
        for lv in StockLevel.objects.filter(
            warehouse=warehouse, product_id__in=product_ids,
        ).select_related('product')
    }
    for pid in product_ids:
        level = levels.get(pid)
        if not level:
            continue
        product = level.product
        min_s = Decimal(str(product.min_stock or 0))
        if level.quantity > min_s and level.quantity > 0:
            continue
        # Rupture ou sous le seuil
        req = upsert_replenishment_request(
            company=company,
            to_warehouse=warehouse,
            product=product,
            user=user,
            source='auto',
            notes=f'Réappro auto — stock {level.quantity} (min {min_s})',
        )
        created.append(req)
    return created


def pos_validate_request(stock_request, user, items_updates=None, notes=None):
    """Responsable PDV confirme / ajuste les quantités et envoie au siège."""
    if stock_request.status not in (RequestStatus.PENDING, RequestStatus.DRAFT):
        raise StockError('Cette demande ne peut plus être validée au PDV.')
    if items_updates:
        by_id = {u['product_id']: Decimal(str(u['quantity'])) for u in items_updates}
        for item in stock_request.items.all():
            if item.product_id in by_id:
                qty = by_id[item.product_id]
                if qty <= 0:
                    raise StockError('Quantité invalide.')
                item.quantity = qty
                item.save(update_fields=['quantity'])
    if notes is not None:
        stock_request.notes = notes
    stock_request.status = RequestStatus.POS_VALIDATED
    stock_request.processed_by = user
    stock_request.save(update_fields=['status', 'processed_by', 'notes', 'updated_at'])
    return stock_request


def hq_approve_request(stock_request, user, from_warehouse=None):
    """Siège approuve la demande (prête pour création de transfert)."""
    allowed = (RequestStatus.PENDING, RequestStatus.DRAFT, RequestStatus.POS_VALIDATED)
    if stock_request.status not in allowed:
        raise StockError('Cette demande ne peut plus être approuvée.')
    # Les alertes caissier/auto doivent passer par le PDV d'abord
    if (
        stock_request.source in ('cashier_alert', 'auto')
        and stock_request.status == RequestStatus.PENDING
        and not (user.is_company_admin or user.is_superuser)
    ):
        from accounts.utils import get_user_role_code
        if get_user_role_code(user) not in ('company_admin', 'manager'):
            raise StockError('Le responsable du point de vente doit d\'abord valider cette demande.')
    if from_warehouse is not None:
        stock_request.from_warehouse = from_warehouse
    if not stock_request.from_warehouse_id:
        stock_request.from_warehouse = _default_supply_warehouse(
            stock_request.to_warehouse.branch, stock_request.company,
        )
    stock_request.status = RequestStatus.APPROVED
    stock_request.processed_by = user
    stock_request.save(update_fields=['status', 'processed_by', 'from_warehouse', 'updated_at'])
    return stock_request


@transaction.atomic
def fulfill_request_as_transfer(stock_request, user, from_warehouse=None):
    """Crée le transfert (préparation) sans réception automatique."""
    if stock_request.status not in (RequestStatus.APPROVED, RequestStatus.POS_VALIDATED):
        # Admin peut servir directement une demande déjà validée PDV
        if stock_request.status != RequestStatus.PENDING or not (
            user.is_company_admin or user.is_superuser
        ):
            raise StockError('Approuvez la demande avant de créer le transfert.')
        hq_approve_request(stock_request, user, from_warehouse)

    stock_request.refresh_from_db()
    src = from_warehouse or stock_request.from_warehouse
    if not src:
        src = _default_supply_warehouse(stock_request.to_warehouse.branch, stock_request.company)
    if not src:
        raise StockError('Indiquez un entrepôt source pour servir la requête.')

    items_data = [
        {
            'product': item.product,
            'product_id': item.product_id,
            'quantity': item.quantity,
        }
        for item in stock_request.items.all()
    ]
    transfer = stock_transfer(
        from_warehouse=src,
        to_warehouse=stock_request.to_warehouse,
        items_data=items_data,
        user=user,
        company=stock_request.company,
        notes=f'Transfert demande {stock_request.reference}',
        auto_prepare=True,
        reserve=True,
    )
    for item in stock_request.items.all():
        item.quantity_fulfilled = item.quantity
        item.save(update_fields=['quantity_fulfilled'])

    stock_request.transfer = transfer
    stock_request.from_warehouse = src
    stock_request.status = RequestStatus.FULFILLED
    stock_request.processed_by = user
    stock_request.save(update_fields=[
        'transfer', 'from_warehouse', 'status', 'processed_by', 'updated_at',
    ])
    return stock_request, transfer
