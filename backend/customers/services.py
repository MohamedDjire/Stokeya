from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, Count, Max, Q, Sum
from django.utils import timezone

from sales.models import Sale, SaleStatus
from shops.models import ShopOrder, ShopOrderStatus

from .models import (
    AbandonedCart,
    Customer,
    CustomerTag,
    CustomerTagAssignment,
    LoyaltyLevel,
    LoyaltySettings,
    LoyaltyTransaction,
)


SYSTEM_TAGS = [
    ('vip', 'VIP', '#FFB300'),
    ('nouveau', 'Nouveau', '#43A047'),
    ('inactif', 'Inactif', '#757575'),
    ('frequent', 'Achète souvent', '#0D9488'),
    ('big_spender', 'Grand acheteur', '#6A1B9A'),
    ('at_risk', 'Risque de départ', '#C62828'),
]


def get_loyalty_settings(company):
    settings, _ = LoyaltySettings.objects.get_or_create(company=company)
    return settings


def level_for_points(settings, points):
    if points > settings.gold_max:
        return LoyaltyLevel.PLATINUM
    if points > settings.silver_max:
        return LoyaltyLevel.GOLD
    if points > settings.bronze_max:
        return LoyaltyLevel.SILVER
    return LoyaltyLevel.BRONZE


def _sale_qs(customer):
    return Sale.objects.filter(customer=customer, status=SaleStatus.COMPLETED)


def _shop_qs(customer):
    return ShopOrder.objects.filter(
        customer=customer,
        status=ShopOrderStatus.DELIVERED,
    )


def refresh_customer_stats(customer):
    """Recompute cached order stats from sales + delivered shop orders."""
    sales = _sale_qs(customer).aggregate(
        count=Count('id'),
        total=Sum('total'),
        last=Max('created_at'),
    )
    shops = _shop_qs(customer).aggregate(
        count=Count('id'),
        total=Sum('total'),
        last=Max('created_at'),
    )
    count = (sales['count'] or 0) + (shops['count'] or 0)
    total = (sales['total'] or Decimal('0')) + (shops['total'] or Decimal('0'))
    last_dates = [d for d in (sales['last'], shops['last']) if d]
    last_order_at = max(last_dates) if last_dates else None

    customer.orders_count = count
    customer.total_spent = total
    customer.last_order_at = last_order_at
    customer.score = compute_customer_score(customer)
    customer.loyalty_level = level_for_points(
        get_loyalty_settings(customer.company), customer.loyalty_points,
    )
    customer.save(update_fields=[
        'orders_count', 'total_spent', 'last_order_at', 'score', 'loyalty_level', 'updated_at',
    ])
    sync_auto_tags(customer)
    return customer


def compute_customer_score(customer):
    """Score 0–100 from recency, frequency, monetary, regularity, payments."""
    now = timezone.now()
    settings = get_loyalty_settings(customer.company)

    if customer.last_order_at:
        days = (now - customer.last_order_at).days
        if days <= 7:
            recency = 25
        elif days <= 30:
            recency = 20
        elif days <= settings.active_days:
            recency = 15
        elif days <= settings.inactive_days:
            recency = 8
        else:
            recency = 2
    else:
        recency = 0

    freq = min(25, (customer.orders_count or 0) * 2)
    spent = float(customer.total_spent or 0)
    monetary = min(25, int(spent / 20000))

    regularity = 5
    dates = list(
        _sale_qs(customer).order_by('created_at').values_list('created_at', flat=True)[:50]
    )
    dates += list(
        _shop_qs(customer).order_by('created_at').values_list('created_at', flat=True)[:50]
    )
    dates = sorted(dates)
    if len(dates) >= 3:
        gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        avg_gap = sum(gaps) / len(gaps) if gaps else 999
        if avg_gap <= 14:
            regularity = 15
        elif avg_gap <= 30:
            regularity = 12
        elif avg_gap <= 60:
            regularity = 8
        else:
            regularity = 4

    unpaid = Sale.objects.filter(
        customer=customer, status=SaleStatus.COMPLETED,
    ).exclude(payment_status='paid').count()
    payments = max(0, 10 - unpaid * 2)

    return min(100, recency + freq + monetary + regularity + payments)


def purchase_frequency_label(customer):
    dates = list(
        _sale_qs(customer).order_by('created_at').values_list('created_at', flat=True)
    )
    dates += list(
        _shop_qs(customer).order_by('created_at').values_list('created_at', flat=True)
    )
    dates = sorted(dates)
    if len(dates) < 2:
        return None
    gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
    avg = sum(gaps) / len(gaps)
    if avg <= 1.5:
        return 'Tous les jours'
    if avg <= 10:
        return f'Tous les {int(round(avg))} jours'
    if avg <= 40:
        return 'Tous les mois'
    if avg <= 100:
        return 'Tous les 2–3 mois'
    return 'Occasionnel'


def preferred_products(customer, limit=10):
    from sales.models import SaleItem
    from shops.models import ShopOrderItem

    sale_items = (
        SaleItem.objects.filter(sale__customer=customer, sale__status=SaleStatus.COMPLETED)
        .values('product_id', 'product__name')
        .annotate(times=Sum('quantity'), revenue=Sum('total'))
        .order_by('-times')[:limit]
    )
    shop_items = (
        ShopOrderItem.objects.filter(
            order__customer=customer, order__status=ShopOrderStatus.DELIVERED,
        )
        .values('product_id', 'product__name')
        .annotate(times=Sum('quantity'), revenue=Sum('total'))
        .order_by('-times')[:limit]
    )

    merged = {}
    for row in list(sale_items) + list(shop_items):
        pid = row['product_id']
        if not pid:
            continue
        entry = merged.setdefault(pid, {
            'product_id': pid,
            'name': row['product__name'] or 'Produit',
            'times': Decimal('0'),
            'revenue': Decimal('0'),
        })
        entry['times'] += row['times'] or 0
        entry['revenue'] += row['revenue'] or 0

    ranked = sorted(merged.values(), key=lambda x: x['times'], reverse=True)[:limit]
    for i, row in enumerate(ranked):
        row['times'] = float(row['times'])
        row['revenue'] = str(row['revenue'])
        row['stars'] = max(1, min(5, 5 - i))
    return ranked


def ensure_system_tags(company):
    tags = {}
    for code, name, color in SYSTEM_TAGS:
        tag = CustomerTag.objects.filter(company=company, code=code).first()
        if not tag:
            tag = CustomerTag.objects.filter(company=company, name=name).first()
        if tag:
            updates = []
            if tag.code != code:
                tag.code = code
                updates.append('code')
            if not tag.is_system:
                tag.is_system = True
                updates.append('is_system')
            if updates:
                tag.save(update_fields=updates)
        else:
            tag = CustomerTag.objects.create(
                company=company, code=code, name=name, color=color, is_system=True,
            )
        tags[code] = tag
    return tags


def sync_auto_tags(customer):
    settings = get_loyalty_settings(customer.company)
    tags = ensure_system_tags(customer.company)
    now = timezone.now()
    wanted = set()

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if customer.created_at and customer.created_at >= month_start:
        wanted.add('nouveau')

    if customer.last_order_at:
        days = (now - customer.last_order_at).days
        if days > settings.inactive_days:
            wanted.add('inactif')
        elif days > settings.active_days:
            wanted.add('at_risk')
    elif customer.orders_count == 0:
        wanted.add('nouveau')

    if customer.orders_count >= 10:
        wanted.add('frequent')
    if customer.total_spent >= Decimal('500000') or customer.loyalty_level in (
        LoyaltyLevel.GOLD, LoyaltyLevel.PLATINUM,
    ):
        wanted.add('vip')
        wanted.add('big_spender')
    elif customer.total_spent >= Decimal('200000'):
        wanted.add('big_spender')

    system_codes = {c for c, _, _ in SYSTEM_TAGS}
    for code in system_codes:
        tag = tags[code]
        assigned = CustomerTagAssignment.objects.filter(customer=customer, tag=tag).exists()
        if code in wanted and not assigned:
            CustomerTagAssignment.objects.create(customer=customer, tag=tag)
        elif code not in wanted and assigned:
            CustomerTagAssignment.objects.filter(customer=customer, tag=tag).delete()


@transaction.atomic
def award_loyalty_points(customer, amount, reference='', reason='Achat', user=None):
    if not customer or amount <= 0:
        return customer
    settings = get_loyalty_settings(customer.company)
    per = settings.points_per_amount or Decimal('1000')
    if per <= 0:
        return customer
    points = int(Decimal(str(amount)) // per)
    if points <= 0:
        return customer

    customer.loyalty_points = (customer.loyalty_points or 0) + points
    customer.loyalty_level = level_for_points(settings, customer.loyalty_points)
    customer.save(update_fields=['loyalty_points', 'loyalty_level', 'updated_at'])
    LoyaltyTransaction.objects.create(
        customer=customer,
        points=points,
        balance_after=customer.loyalty_points,
        reason=reason,
        reference=reference,
        created_by=user,
    )
    return customer


def upsert_customer_from_order(company, *, phone, name='', email='', address='', city='',
                               commune='', quartier='', landmark='', whatsapp=''):
    phone = (phone or '').strip()
    if not phone:
        return None
    customer, created = Customer.objects.get_or_create(
        company=company,
        phone=phone,
        defaults={
            'name': name or phone,
            'email': email or '',
            'address': address or '',
            'city': city or '',
            'commune': commune or '',
            'quartier': quartier or '',
            'landmark': landmark or '',
            'whatsapp': whatsapp or phone,
        },
    )
    if not created:
        changed = []
        if name and customer.name in (customer.phone, ''):
            customer.name = name
            changed.append('name')
        for field, value in (
            ('email', email), ('address', address), ('city', city),
            ('commune', commune), ('quartier', quartier), ('landmark', landmark),
            ('whatsapp', whatsapp or phone),
        ):
            if value and not getattr(customer, field):
                setattr(customer, field, value)
                changed.append(field)
        if changed:
            customer.save(update_fields=changed + ['updated_at'])
    return customer


def customer_status(customer, settings=None):
    settings = settings or get_loyalty_settings(customer.company)
    if not customer.is_active:
        return 'inactif'
    if not customer.last_order_at:
        return 'nouveau' if customer.orders_count == 0 else 'actif'
    days = (timezone.now() - customer.last_order_at).days
    if days > settings.inactive_days:
        return 'inactif'
    if days > settings.active_days:
        return 'a_risque'
    return 'actif'


def list_customers_enriched(company, *, search=None, status=None, level=None, tag=None,
                            city=None, min_spent=None):
    settings = get_loyalty_settings(company)
    qs = Customer.objects.filter(company=company).prefetch_related('tag_assignments__tag')
    if search:
        qs = qs.filter(
            Q(name__icontains=search) | Q(phone__icontains=search)
            | Q(email__icontains=search) | Q(city__icontains=search)
        )
    if level:
        qs = qs.filter(loyalty_level=level)
    if city:
        qs = qs.filter(city__icontains=city)
    if min_spent is not None:
        qs = qs.filter(total_spent__gte=min_spent)
    if tag:
        qs = qs.filter(tag_assignments__tag_id=tag)

    rows = []
    for c in qs.distinct().order_by('-total_spent', 'name'):
        st = customer_status(c, settings)
        if status and st != status:
            continue
        tags = [
            {'id': a.tag_id, 'name': a.tag.name, 'color': a.tag.color, 'code': a.tag.code}
            for a in c.tag_assignments.all()
        ]
        avg_basket = (
            (c.total_spent / c.orders_count) if c.orders_count else Decimal('0')
        )
        rows.append({
            'id': c.id,
            'name': c.name,
            'photo': c.photo.url if c.photo else None,
            'phone': c.phone,
            'whatsapp': c.whatsapp or c.phone,
            'email': c.email,
            'city': c.city,
            'last_order_at': c.last_order_at,
            'orders_count': c.orders_count,
            'total_spent': str(c.total_spent),
            'avg_basket': str(avg_basket),
            'credit_limit': str(c.credit_limit),
            'balance': str(c.balance),
            'loyalty_points': c.loyalty_points,
            'loyalty_level': c.loyalty_level,
            'score': c.score,
            'status': st,
            'tags': tags,
            'is_active': c.is_active,
            'created_at': c.created_at,
        })
    return rows


def get_crm_dashboard(company):
    settings = get_loyalty_settings(company)
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    customers = Customer.objects.filter(company=company)
    total_customers = customers.count()
    new_this_month = customers.filter(created_at__gte=month_start).count()

    sales_agg = Sale.objects.filter(
        company=company, status=SaleStatus.COMPLETED, customer__isnull=False,
    ).aggregate(revenue=Sum('total'), count=Count('id'), avg=Avg('total'))
    shop_agg = ShopOrder.objects.filter(
        company=company, status=ShopOrderStatus.DELIVERED, customer__isnull=False,
    ).aggregate(revenue=Sum('total'), count=Count('id'), avg=Avg('total'))

    revenue = (sales_agg['revenue'] or 0) + (shop_agg['revenue'] or 0)
    orders = (sales_agg['count'] or 0) + (shop_agg['count'] or 0)
    avg_order = (Decimal(str(revenue)) / orders) if orders else Decimal('0')

    vip = customers.filter(
        Q(loyalty_level__in=[LoyaltyLevel.GOLD, LoyaltyLevel.PLATINUM])
        | Q(tag_assignments__tag__code='vip')
    ).distinct().count()

    active = 0
    inactive = 0
    for c in customers.only('last_order_at', 'is_active', 'orders_count'):
        st = customer_status(c, settings)
        if st == 'actif':
            active += 1
        elif st == 'inactif':
            inactive += 1

    abandoned = AbandonedCart.objects.filter(company=company, recovered=False).count()

    from shops.models import ProductReview
    reviews_count = ProductReview.objects.filter(company=company, is_visible=True).count()

    with_orders = customers.filter(orders_count__gte=1).count()
    repeat = customers.filter(orders_count__gte=2).count()
    retention = round((repeat / with_orders) * 100, 1) if with_orders else 0

    birthdays = customers.filter(birth_date__month=now.month).count()
    receivables = customers.filter(balance__gt=0).aggregate(total=Sum('balance'))['total'] or 0
    debtors = customers.filter(balance__gt=0).count()

    return {
        'total_customers': total_customers,
        'new_this_month': new_this_month,
        'revenue': str(revenue),
        'vip_count': vip,
        'active_count': active,
        'inactive_count': inactive,
        'abandoned_carts': abandoned,
        'reviews_count': reviews_count,
        'retention_rate': retention,
        'avg_order_value': str(avg_order),
        'orders_count': orders,
        'birthdays_this_month': birthdays,
        'total_receivables': str(receivables),
        'debtors_count': debtors,
    }


def get_customer_360(customer):
    from .credit import list_customer_debts

    refresh_customer_stats(customer)
    customer.refresh_from_db()
    settings = get_loyalty_settings(customer.company)

    sales = list(
        _sale_qs(customer).order_by('-created_at')[:50].values(
            'id', 'reference', 'total', 'status', 'payment_status', 'created_at',
        )
    )
    for s in sales:
        s['source'] = 'sale'
        s['total'] = str(s['total'])

    shops = list(
        ShopOrder.objects.filter(customer=customer).order_by('-created_at')[:50].values(
            'id', 'reference', 'total', 'status', 'payment_method', 'created_at',
        )
    )
    for s in shops:
        s['source'] = 'shop'
        s['payment_status'] = s.pop('payment_method')
        s['total'] = str(s['total'])

    history = sorted(sales + shops, key=lambda x: x['created_at'], reverse=True)[:50]
    avg_basket = (
        (customer.total_spent / customer.orders_count) if customer.orders_count else Decimal('0')
    )
    tags = [
        {'id': a.tag_id, 'name': a.tag.name, 'color': a.tag.color, 'code': a.tag.code}
        for a in customer.tag_assignments.select_related('tag')
    ]
    notes = [
        {
            'id': n.id,
            'content': n.content,
            'created_at': n.created_at,
            'created_by': n.created_by.get_full_name() if n.created_by else '',
        }
        for n in customer.notes.select_related('created_by')[:30]
    ]
    loyalty_tx = [
        {
            'id': t.id,
            'points': t.points,
            'balance_after': t.balance_after,
            'reason': t.reason,
            'reference': t.reference,
            'created_at': t.created_at,
        }
        for t in customer.loyalty_transactions.all()[:30]
    ]
    addresses = [
        {
            'id': a.id, 'label': a.label, 'address': a.address, 'city': a.city,
            'commune': a.commune, 'quartier': a.quartier, 'landmark': a.landmark,
            'is_default': a.is_default,
        }
        for a in customer.addresses.all()
    ]

    score = customer.score
    if score >= 80:
        score_label = 'Excellent client'
    elif score >= 60:
        score_label = 'Bon client'
    elif score >= 40:
        score_label = 'Client moyen'
    else:
        score_label = 'À réactiver'

    return {
        'id': customer.id,
        'name': customer.name,
        'photo': customer.photo.url if customer.photo else None,
        'phone': customer.phone,
        'whatsapp': customer.whatsapp or customer.phone,
        'email': customer.email,
        'address': customer.address,
        'city': customer.city,
        'commune': customer.commune,
        'quartier': customer.quartier,
        'landmark': customer.landmark,
        'gender': customer.gender,
        'profession': customer.profession,
        'company_name': customer.company_name,
        'birth_date': customer.birth_date,
        'created_at': customer.created_at,
        'credit_limit': str(customer.credit_limit),
        'balance': str(customer.balance),
        'debts': list_customer_debts(customer),
        'credit_payments': [
            {
                'id': p.id,
                'amount': str(p.amount),
                'method': p.method,
                'reference': p.reference,
                'notes': p.notes,
                'created_at': p.created_at,
                'created_by_name': p.created_by.get_full_name() if p.created_by else '',
            }
            for p in customer.credit_payments.select_related('created_by')[:20]
        ],
        'loyalty_points': customer.loyalty_points,
        'loyalty_level': customer.loyalty_level,
        'score': score,
        'score_label': score_label,
        'status': customer_status(customer, settings),
        'orders_count': customer.orders_count,
        'total_spent': str(customer.total_spent),
        'avg_basket': str(avg_basket),
        'ltv': str(customer.total_spent),
        'purchase_frequency': purchase_frequency_label(customer),
        'last_order_at': customer.last_order_at,
        'tags': tags,
        'notes': notes,
        'addresses': addresses,
        'preferred_products': preferred_products(customer),
        'order_history': history,
        'loyalty_transactions': loyalty_tx,
        'abandoned_carts': [],
        'recommendations': _simple_recommendations(customer),
    }


def _simple_recommendations(customer):
    recs = []
    prefs = preferred_products(customer, limit=3)
    if len(prefs) >= 2:
        recs.append(
            f"Ce client achète souvent « {prefs[0]['name']} » et « {prefs[1]['name']} »."
        )
    st = customer_status(customer)
    if st in ('inactif', 'a_risque'):
        recs.append('Ce client risque de ne plus revenir. Proposez une remise de 10 %.')
    elif customer.loyalty_level in (LoyaltyLevel.GOLD, LoyaltyLevel.PLATINUM):
        recs.append('Client VIP — proposez une offre exclusive ou une livraison offerte.')
    elif customer.orders_count == 1:
        recs.append('Nouveau client : une petite offre pourrait encourager un 2e achat.')
    return recs


def backfill_company_stats(company):
    for customer in Customer.objects.filter(company=company):
        refresh_customer_stats(customer)
