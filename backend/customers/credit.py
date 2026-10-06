"""Dettes clients : ventes à crédit et encaissements."""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from companies.limits import require_feature
from companies.plans import FEATURE_CUSTOMER_CREDIT
from sales.models import Payment, PaymentMethod, PaymentStatus, Sale, SaleStatus

from .models import Customer, CustomerPayment


class CreditError(Exception):
    pass


def sale_amount_paid(sale) -> Decimal:
    """Montants réellement encaissés (hors marqueur crédit)."""
    total = (
        sale.payments.filter(status='completed')
        .exclude(method=PaymentMethod.CREDIT)
        .aggregate(s=Sum('amount'))['s']
    )
    return Decimal(str(total or 0))


def sale_amount_due(sale) -> Decimal:
    due = Decimal(str(sale.total)) - sale_amount_paid(sale)
    return due if due > 0 else Decimal('0')


def refresh_sale_payment_status(sale):
    paid = sale_amount_paid(sale)
    total = Decimal(str(sale.total))
    if paid <= 0:
        sale.payment_status = PaymentStatus.UNPAID
    elif paid < total:
        sale.payment_status = PaymentStatus.PARTIAL
    else:
        sale.payment_status = PaymentStatus.PAID
    sale.save(update_fields=['payment_status', 'updated_at'])


def validate_credit_sale(*, company, customer, total):
    """Contrôles avant création d'une vente à crédit."""
    require_feature(company, FEATURE_CUSTOMER_CREDIT)
    if not customer:
        raise CreditError('Un client est obligatoire pour une vente à crédit.')

    total = Decimal(str(total))
    if total <= 0:
        return

    customer = Customer.objects.select_for_update().get(pk=customer.pk, company=company)
    new_balance = Decimal(str(customer.balance)) + total
    limit = Decimal(str(customer.credit_limit or 0))
    if limit > 0 and new_balance > limit:
        available = limit - Decimal(str(customer.balance))
        raise CreditError(
            f'Plafond de crédit dépassé. Solde actuel {customer.balance} F, '
            f'plafond {limit} F, disponible {max(available, 0)} F.'
        )


def increase_customer_debt(*, company, customer, total):
    """Incrémente la dette après une vente crédit réussie."""
    total = Decimal(str(total))
    if total <= 0 or not customer:
        return
    customer = Customer.objects.select_for_update().get(pk=customer.pk, company=company)
    customer.balance = Decimal(str(customer.balance)) + total
    customer.save(update_fields=['balance', 'updated_at'])


@transaction.atomic
def record_customer_payment(
    *,
    company,
    customer,
    amount,
    method=PaymentMethod.CASH,
    reference='',
    notes='',
    user=None,
    sale_id=None,
):
    """Encaissement sur la dette client (FIFO sur les ventes impayées)."""
    require_feature(company, FEATURE_CUSTOMER_CREDIT)

    amount = Decimal(str(amount))
    if amount <= 0:
        raise CreditError('Le montant doit être supérieur à 0.')

    if method == PaymentMethod.CREDIT:
        raise CreditError('Choisissez un mode d\'encaissement (espèces, mobile money…).')

    customer = Customer.objects.select_for_update().get(pk=customer.pk, company=company)
    balance = Decimal(str(customer.balance))
    if amount > balance:
        raise CreditError(
            f'Montant trop élevé : la dette du client est de {balance} F.'
        )

    qs = Sale.objects.filter(
        company=company,
        customer=customer,
        status=SaleStatus.COMPLETED,
        payment_status__in=[PaymentStatus.UNPAID, PaymentStatus.PARTIAL],
    ).order_by('created_at').prefetch_related('payments')

    if sale_id:
        qs = qs.filter(pk=sale_id)
        if not qs.exists():
            raise CreditError('Vente introuvable ou déjà soldée.')

    remaining = amount
    settled_sales = []

    for sale in qs:
        if remaining <= 0:
            break
        due = sale_amount_due(sale)
        if due <= 0:
            continue
        alloc = min(remaining, due)
        Payment.objects.create(
            sale=sale,
            method=method,
            amount=alloc,
            reference=reference or '',
            status='completed',
        )
        refresh_sale_payment_status(sale)
        sale.refresh_from_db()
        if sale.payment_status == PaymentStatus.PAID:
            settled_sales.append(sale)
        remaining -= alloc

    if remaining > 0 and sale_id:
        raise CreditError('Le montant dépasse le reste dû de cette vente.')

    # Réduit toujours le solde du montant demandé (FIFO sur les ventes ouvertes).
    customer.balance = balance - amount
    if customer.balance < 0:
        customer.balance = Decimal('0')
    customer.save(update_fields=['balance', 'updated_at'])

    payment = CustomerPayment.objects.create(
        company=company,
        customer=customer,
        amount=amount,
        method=method,
        reference=reference or '',
        notes=notes or '',
        created_by=user,
    )

    from .services import award_loyalty_points, refresh_customer_stats
    for sale in settled_sales:
        award_loyalty_points(
            customer,
            sale.total,
            reference=sale.reference,
            reason='Règlement crédit',
            user=user,
        )
    refresh_customer_stats(customer)

    return payment


def list_customer_debts(customer):
    sales = (
        Sale.objects.filter(
            company=customer.company,
            customer=customer,
            status=SaleStatus.COMPLETED,
            payment_status__in=[PaymentStatus.UNPAID, PaymentStatus.PARTIAL],
        )
        .order_by('created_at')
        .prefetch_related('payments')
    )
    rows = []
    for sale in sales:
        due = sale_amount_due(sale)
        if due <= 0:
            continue
        rows.append({
            'id': sale.id,
            'reference': sale.reference,
            'total': str(sale.total),
            'paid': str(sale_amount_paid(sale)),
            'due': str(due),
            'payment_status': sale.payment_status,
            'created_at': sale.created_at,
        })
    return rows
