from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from products.models import ProductBatch
from sales.models import SaleItem, SaleStatus

from .models import MovementType, StockLevel, StockMovement, StockTransfer


class StockError(Exception):
    pass


def _get_or_create_level(product, warehouse):
    level, _ = StockLevel.objects.get_or_create(
        product=product,
        warehouse=warehouse,
        defaults={'quantity': Decimal('0')},
    )
    return level


def get_stock_status(warehouse):
    levels = StockLevel.objects.filter(
        warehouse=warehouse,
        product__is_active=True,
    ).select_related('product')

    data = []
    for level in levels:
        product = level.product
        quantity = level.quantity
        if quantity <= 0:
            status = 'out_of_stock'
        elif quantity <= product.min_stock:
            status = 'low'
        else:
            status = 'ok'

        data.append({
            'id': level.id,
            'product_id': product.id,
            'name': product.name,
            'sku': product.sku,
            'quantity': quantity,
            'min_stock': product.min_stock,
            'max_stock': product.max_stock,
            'purchase_price': product.purchase_price,
            'sale_price': product.sale_price,
            'status': status,
            'updated_at': level.updated_at,
        })
    return data


def get_stock_movements(warehouse, limit=100):
    movements = StockMovement.objects.filter(
        warehouse=warehouse,
    ).select_related('product', 'created_by').order_by('-created_at')[:limit]

    return [
        {
            'id': m.id,
            'product_id': m.product_id,
            'product_name': m.product.name,
            'movement_type': m.movement_type,
            'quantity': m.quantity,
            'reference': m.reference,
            'notes': m.notes,
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

    total_products = levels.count()
    stock_total = levels.aggregate(total=Sum('quantity'))['total'] or Decimal('0')
    stock_value = sum(level.quantity * level.product.purchase_price for level in levels)
    in_stock = sum(1 for level in levels if level.quantity > 0)
    out_of_stock = sum(1 for level in levels if level.quantity <= 0)
    low_stock = sum(
        1 for level in levels
        if 0 < level.quantity <= level.product.min_stock
    )
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
        movement_type=MovementType.IN,
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
    exits_month = movements.filter(
        movement_type=MovementType.OUT,
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


def get_stock_alerts(warehouse):
    today = timezone.now().date()
    soon = today + timedelta(days=30)
    company = warehouse.branch.company
    alerts = []

    levels = StockLevel.objects.filter(
        warehouse=warehouse,
        product__is_active=True,
    ).select_related('product')

    for level in levels:
        product = level.product
        if level.quantity <= 0:
            alerts.append({
                'type': 'out_of_stock',
                'severity': 'error',
                'product_id': product.id,
                'product_name': product.name,
                'message': f'{product.name} — rupture de stock',
                'quantity': level.quantity,
            })
        elif level.quantity <= product.min_stock:
            alerts.append({
                'type': 'low_stock',
                'severity': 'warning',
                'product_id': product.id,
                'product_name': product.name,
                'message': f'{product.name} — stock faible ({level.quantity} / min {product.min_stock})',
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


def get_transfer_history(company, warehouse=None, limit=50):
    from django.db.models import Q

    qs = StockTransfer.objects.filter(company=company).select_related(
        'from_warehouse', 'to_warehouse', 'created_by'
    ).prefetch_related('items__product').order_by('-created_at')

    if warehouse:
        qs = qs.filter(Q(from_warehouse=warehouse) | Q(to_warehouse=warehouse))

    return [
        {
            'id': t.id,
            'from_warehouse': t.from_warehouse.name,
            'to_warehouse': t.to_warehouse.name,
            'status': t.status,
            'notes': t.notes,
            'items_count': t.items.count(),
            'items': [
                {'product_name': i.product.name, 'quantity': i.quantity}
                for i in t.items.all()
            ],
            'created_by': t.created_by.get_full_name() if t.created_by else 'Système',
            'created_at': t.created_at,
        }
        for t in qs[:limit]
    ]


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
def stock_entry(product, warehouse, quantity, user, notes='', reference=''):
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        raise StockError('La quantité doit être positive.')

    movement = StockMovement.objects.create(
        product=product,
        warehouse=warehouse,
        movement_type=MovementType.IN,
        quantity=quantity,
        notes=notes,
        reference=reference,
        created_by=user,
    )
    level = _get_or_create_level(product, warehouse)
    level.quantity += quantity
    level.save(update_fields=['quantity', 'updated_at'])
    return movement


@transaction.atomic
def stock_exit(product, warehouse, quantity, user, notes='', reference=''):
    quantity = Decimal(str(quantity))
    if quantity <= 0:
        raise StockError('La quantité doit être positive.')

    level = _get_or_create_level(product, warehouse)
    if level.quantity < quantity:
        raise StockError('Stock insuffisant pour cette sortie.')

    movement = StockMovement.objects.create(
        product=product,
        warehouse=warehouse,
        movement_type=MovementType.OUT,
        quantity=quantity,
        notes=notes,
        reference=reference,
        created_by=user,
    )
    level.quantity -= quantity
    level.save(update_fields=['quantity', 'updated_at'])
    return movement


@transaction.atomic
def stock_transfer(from_warehouse, to_warehouse, items_data, user, company, notes=''):
    from .models import StockTransfer, StockTransferItem, TransferStatus

    if from_warehouse.id == to_warehouse.id:
        raise StockError('Les entrepôts source et destination doivent être différents.')
    if from_warehouse.branch.company_id != company.id or to_warehouse.branch.company_id != company.id:
        raise StockError('Entrepôts invalides.')

    transfer = StockTransfer.objects.create(
        company=company,
        from_warehouse=from_warehouse,
        to_warehouse=to_warehouse,
        status=TransferStatus.COMPLETED,
        notes=notes,
        created_by=user,
    )

    for item in items_data:
        product = item['product']
        quantity = Decimal(str(item['quantity']))
        if quantity <= 0:
            raise StockError('Quantité invalide.')

        StockTransferItem.objects.create(transfer=transfer, product=product, quantity=quantity)
        stock_exit(
            product=product,
            warehouse=from_warehouse,
            quantity=quantity,
            user=user,
            notes=f'Transfert → {to_warehouse.name}',
            reference=f'TRF-{transfer.id}',
        )
        stock_entry(
            product=product,
            warehouse=to_warehouse,
            quantity=quantity,
            user=user,
            notes=f'Transfert depuis {from_warehouse.name}',
            reference=f'TRF-{transfer.id}',
        )

    return transfer


@transaction.atomic
def stock_adjustment(warehouse, items_data, user, company, reason, notes=''):
    from .models import MovementType, StockAdjustment, StockAdjustmentItem

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
        level.quantity = actual
        level.save(update_fields=['quantity', 'updated_at'])

        if diff != 0:
            StockMovement.objects.create(
                product=product,
                warehouse=warehouse,
                movement_type=MovementType.ADJUSTMENT,
                quantity=abs(diff),
                notes=f'{reason}: {expected} → {actual}',
                reference=f'ADJ-{adjustment.id}',
                created_by=user,
            )

    return adjustment
