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

        if item.get('unit_price') not in (None, ''):
            unit_price = Decimal(str(item['unit_price']))
        else:
            unit_price = product.unit_price_for_qty(quantity)
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

    is_credit = payment_method == PaymentMethod.CREDIT
    is_mobile = payment_method == PaymentMethod.MOBILE_MONEY

    if is_credit:
        from customers.credit import CreditError, validate_credit_sale
        try:
            validate_credit_sale(company=company, customer=customer, total=total)
        except CreditError as exc:
            raise SaleError(str(exc)) from exc

    if is_credit or is_mobile:
        sale_payment_status = PaymentStatus.UNPAID
    else:
        sale_payment_status = PaymentStatus.PAID

    now = timezone.now()
    sale = Sale.objects.create(
        company=company,
        branch=branch,
        cash_register=cash_register,
        customer=customer,
        seller=seller,
        reference=_generate_reference(company),
        status=SaleStatus.COMPLETED,
        payment_status=sale_payment_status,
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

    if is_credit:
        payment_row_status = 'credit'
    elif is_mobile:
        payment_row_status = 'pending'
    else:
        payment_row_status = 'completed'

    Payment.objects.create(
        sale=sale,
        method=payment_method,
        amount=total,
        reference=sale.reference,
        status=payment_row_status,
    )

    if is_credit and customer:
        from customers.credit import increase_customer_debt
        increase_customer_debt(company=company, customer=customer, total=total)
        sale_id = sale.pk
        cust_name = customer.name
        ref = sale.reference
        tot = str(total)

        def _notify_credit():
            from notifications.models import NotificationType
            from notifications.services import notify_company
            try:
                notify_company(
                    company,
                    notification_type=NotificationType.SALE,
                    title='Vente à crédit',
                    message=f'{ref} — {cust_name} · {tot} F',
                    data={'sale_id': sale_id, 'reference': ref, 'link': '/customers'},
                )
            except Exception:
                pass

        transaction.on_commit(_notify_credit)

    if customer:
        from customers.services import award_loyalty_points, refresh_customer_stats
        if payment_row_status == 'completed':
            award_loyalty_points(
                customer, total, reference=sale.reference, reason='Vente POS', user=seller,
            )
        refresh_customer_stats(customer)

    # Réapprovisionnement automatique si stock faible après vente
    try:
        prefs = company.get_preferences() if hasattr(company, 'get_preferences') else {}
        auto = (prefs.get('automation') or {}).get('low_stock_auto_request', True)
        if auto:
            from inventory.services import ensure_auto_low_stock_after_sale
            ensure_auto_low_stock_after_sale(
                company=company,
                warehouse=warehouse,
                product_ids=[item['product'].id for item in sale_items],
                user=seller,
            )
    except Exception:
        pass

    return sale
