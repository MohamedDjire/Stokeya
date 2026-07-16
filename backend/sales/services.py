from decimal import Decimal
from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from branches.models import Branch
from inventory.services import StockError, stock_exit
from products.models import Product
from warehouses.models import Warehouse

from .models import Payment, PaymentMethod, PaymentStatus, Sale, SaleItem, SaleStatus


class SaleError(Exception):
    pass


def _generate_reference(company):
    today = timezone.now().strftime('%Y%m%d')
    prefix = f'VTE-{today}-'
    last = Sale.objects.filter(
        company=company,
        reference__startswith=prefix,
    ).aggregate(Max('reference'))['reference__max']
    if last:
        num = int(last.split('-')[-1]) + 1
    else:
        num = 1
    return f'{prefix}{num:04d}'


@transaction.atomic
def create_sale(
    *,
    company,
    branch,
    seller,
    items_data,
    customer=None,
    cash_register=None,
    payment_method=PaymentMethod.CASH,
    discount_amount=Decimal('0'),
    notes='',
    warehouse=None,
    is_offline=False,
    client_reference=None,
):
    if not items_data:
        raise SaleError('La vente doit contenir au moins un article.')

    if client_reference:
        existing = Sale.objects.filter(
            company=company, client_reference=client_reference,
        ).prefetch_related('items__product', 'payments').first()
        if existing:
            return existing

    if warehouse is None:
        warehouse = Warehouse.objects.filter(
            branch=branch,
            is_active=True,
        ).order_by('-is_default', 'id').first()
    if not warehouse:
        raise SaleError('Aucun entrepôt configuré pour cette boutique.')

    subtotal = Decimal('0')
    tax_amount = Decimal('0')
    sale_items = []

    for item in items_data:
        try:
            product = Product.objects.get(id=item['product_id'], company=company, is_active=True)
        except Product.DoesNotExist:
            raise SaleError(f"Produit {item.get('product_id')} introuvable.")

        quantity = Decimal(str(item['quantity']))
        if quantity <= 0:
            raise SaleError('Quantité invalide.')

        unit_price = Decimal(str(item.get('unit_price', product.sale_price)))
        tax_rate = Decimal(str(item.get('tax_rate', product.tax_rate)))
        line_discount = Decimal(str(item.get('discount', 0)))
        line_subtotal = (unit_price * quantity) - line_discount
        line_tax = line_subtotal * tax_rate / Decimal('100')
        line_total = line_subtotal + line_tax

        subtotal += line_subtotal
        tax_amount += line_tax
        sale_items.append({
            'product': product,
            'quantity': quantity,
            'unit_price': unit_price,
            'tax_rate': tax_rate,
            'discount': line_discount,
            'total': line_total,
        })

    total = subtotal + tax_amount - Decimal(str(discount_amount))
    if total < 0:
        total = Decimal('0')

    now = timezone.now()
    sale = Sale.objects.create(
        company=company,
        branch=branch,
        cash_register=cash_register,
        customer=customer,
        seller=seller,
        reference=_generate_reference(company),
        status=SaleStatus.COMPLETED,
        payment_status=(
            PaymentStatus.UNPAID if payment_method == PaymentMethod.MOBILE_MONEY
            else PaymentStatus.PAID
        ),
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=Decimal(str(discount_amount)),
        total=total,
        notes=notes,
        is_offline=is_offline,
        synced_at=now if is_offline else None,
        client_reference=client_reference or None,
    )

    for item in sale_items:
        SaleItem.objects.create(sale=sale, **item)
        try:
            stock_exit(
                product=item['product'],
                warehouse=warehouse,
                quantity=item['quantity'],
                user=seller,
                notes=f'Vente {sale.reference}',
                reference=sale.reference,
            )
        except StockError as exc:
            raise SaleError(str(exc)) from exc

    payment_status = 'completed'
    if payment_method == PaymentMethod.MOBILE_MONEY:
        payment_status = 'pending'

    Payment.objects.create(
        sale=sale,
        method=payment_method,
        amount=total,
        reference=sale.reference,
        status=payment_status,
    )

    return sale
