from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from inventory.services import stock_entry
from .models import GoodsReceipt, GoodsReceiptItem, OrderStatus, PurchaseOrder, PurchaseOrderItem


class PurchaseError(Exception):
    pass


def _generate_po_reference(company):
    today = timezone.now().strftime('%Y%m%d')
    prefix = f'BC-{today}-'
    last = PurchaseOrder.objects.filter(
        company=company,
        reference__startswith=prefix,
    ).aggregate(Max('reference'))['reference__max']
    num = int(last.split('-')[-1]) + 1 if last else 1
    return f'{prefix}{num:04d}'


def _generate_receipt_reference(order):
    count = order.receipts.count() + 1
    return f'{order.reference}-R{count:02d}'


@transaction.atomic
def create_purchase_order(*, company, supplier, items_data, user, expected_date=None, notes=''):
    if not items_data:
        raise PurchaseError('La commande doit contenir au moins un article.')

    total = Decimal('0')
    order_items = []
    for item in items_data:
        product = item['product']
        if product.company_id != company.id:
            raise PurchaseError(f'Produit {product.id} invalide.')
        quantity = Decimal(str(item['quantity']))
        unit_price = Decimal(str(item.get('unit_price', product.purchase_price)))
        line_total = quantity * unit_price
        total += line_total
        order_items.append({
            'product': product,
            'quantity': quantity,
            'unit_price': unit_price,
            'total': line_total,
        })

    order = PurchaseOrder.objects.create(
        company=company,
        supplier=supplier,
        reference=_generate_po_reference(company),
        status=OrderStatus.ORDERED,
        total=total,
        expected_date=expected_date,
        notes=notes,
        created_by=user,
    )
    for item in order_items:
        PurchaseOrderItem.objects.create(order=order, **item)
    return order


@transaction.atomic
def receive_goods(*, order, warehouse, items_data, user, notes=''):
    if order.status == OrderStatus.CANCELLED:
        raise PurchaseError('Commande annulée.')

    receipt = GoodsReceipt.objects.create(
        order=order,
        warehouse=warehouse,
        reference=_generate_receipt_reference(order),
        received_by=user,
        notes=notes,
    )

    for item_data in items_data:
        po_item = item_data['order_item']
        qty = Decimal(str(item_data['quantity_received']))
        if qty <= 0:
            continue

        remaining = po_item.quantity - po_item.quantity_received
        if qty > remaining:
            raise PurchaseError(
                f'Quantité reçue trop élevée pour {po_item.product.name} (reste: {remaining}).'
            )

        GoodsReceiptItem.objects.create(
            receipt=receipt,
            product=po_item.product,
            quantity_received=qty,
        )
        po_item.quantity_received += qty
        po_item.save(update_fields=['quantity_received'])

        stock_entry(
            product=po_item.product,
            warehouse=warehouse,
            quantity=qty,
            user=user,
            notes=f'Réception {receipt.reference}',
            reference=receipt.reference,
        )

    all_received = all(
        item.quantity_received >= item.quantity
        for item in order.items.all()
    )
    any_received = any(
        item.quantity_received > 0
        for item in order.items.all()
    )
    if all_received:
        order.status = OrderStatus.RECEIVED
    elif any_received:
        order.status = OrderStatus.PARTIAL
    order.save(update_fields=['status'])
    return receipt
