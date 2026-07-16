"""Analytics avancées : séries temporelles, croissance et répartitions."""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCompanyMember
from expenses.models import Expense
from inventory.models import StockLevel
from products.models import Product
from sales.models import Payment, PaymentMethod, Sale, SaleItem, SaleStatus

PAYMENT_LABELS = {choice.value: choice.label for choice in PaymentMethod}

MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']


def _pct_change(current, previous):
    current = float(current or 0)
    previous = float(previous or 0)
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


def _period_bounds(period, today):
    if period == 'week':
        start = today - timedelta(days=6)
        prev_start = start - timedelta(days=7)
        prev_end = start - timedelta(days=1)
    elif period == 'year':
        start = today.replace(month=1, day=1)
        prev_start = start.replace(year=start.year - 1)
        prev_end = start - timedelta(days=1)
    else:
        period = 'month'
        start = today - timedelta(days=29)
        prev_start = start - timedelta(days=30)
        prev_end = start - timedelta(days=1)
    return period, start, prev_start, prev_end


def _trend(sales_qs, period, start, today):
    if period == 'year':
        rows = (
            sales_qs.annotate(bucket=TruncMonth('created_at'))
            .values('bucket')
            .annotate(revenue=Sum('total'), count=Count('id'))
        )
        data = {r['bucket'].date().replace(day=1): r for r in rows}
        labels, revenue, counts = [], [], []
        for m in range(1, today.month + 1):
            key = today.replace(month=m, day=1)
            row = data.get(key)
            labels.append(MONTH_LABELS[m - 1])
            revenue.append(float(row['revenue']) if row else 0.0)
            counts.append(row['count'] if row else 0)
        return {'labels': labels, 'revenue': revenue, 'counts': counts}

    rows = (
        sales_qs.annotate(bucket=TruncDate('created_at'))
        .values('bucket')
        .annotate(revenue=Sum('total'), count=Count('id'))
    )
    data = {r['bucket']: r for r in rows}
    labels, revenue, counts = [], [], []
    day = start
    while day <= today:
        row = data.get(day)
        labels.append(f'{day.day:02d}/{day.month:02d}')
        revenue.append(float(row['revenue']) if row else 0.0)
        counts.append(row['count'] if row else 0)
        day += timedelta(days=1)
    return {'labels': labels, 'revenue': revenue, 'counts': counts}


def _revenue_vs_expenses(company, today, branch_id=None, seller_id=None):
    labels, revenue, expenses, profit = [], [], [], []
    year, month = today.year, today.month
    months = []
    for _ in range(6):
        months.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    months.reverse()

    sales_base = Sale.objects.filter(company=company, status=SaleStatus.COMPLETED)
    if branch_id:
        sales_base = sales_base.filter(branch_id=branch_id)
    if seller_id:
        sales_base = sales_base.filter(seller_id=seller_id)
    expenses_base = Expense.objects.filter(company=company)
    if branch_id:
        expenses_base = expenses_base.filter(branch_id=branch_id)

    for (y, m) in months:
        rev = sales_base.filter(created_at__year=y, created_at__month=m).aggregate(t=Sum('total'))['t'] or 0
        exp = expenses_base.filter(date__year=y, date__month=m).aggregate(t=Sum('amount'))['t'] or 0
        labels.append(MONTH_LABELS[m - 1])
        revenue.append(float(rev))
        expenses.append(float(exp))
        profit.append(float(rev) - float(exp))

    return {'labels': labels, 'revenue': revenue, 'expenses': expenses, 'profit': profit}


def compute_analytics(company, period='month', branch_id=None, seller_id=None):
    """Calcule l'ensemble des statistiques pour une entreprise et des filtres donnés."""
    today = timezone.now().date()
    period, start, prev_start, prev_end = _period_bounds(period, today)

    completed = Sale.objects.filter(company=company, status=SaleStatus.COMPLETED)
    if branch_id:
        completed = completed.filter(branch_id=branch_id)
    if seller_id:
        completed = completed.filter(seller_id=seller_id)
    current_sales = completed.filter(created_at__date__gte=start, created_at__date__lte=today)
    previous_sales = completed.filter(created_at__date__gte=prev_start, created_at__date__lte=prev_end)

    cur_rev = current_sales.aggregate(t=Sum('total'))['t'] or Decimal('0')
    cur_count = current_sales.count()
    prev_rev = previous_sales.aggregate(t=Sum('total'))['t'] or Decimal('0')
    prev_count = previous_sales.count()
    avg_basket = (cur_rev / cur_count) if cur_count else Decimal('0')

    kpis = {
        'revenue': float(cur_rev),
        'revenue_growth': _pct_change(cur_rev, prev_rev),
        'sales_count': cur_count,
        'sales_growth': _pct_change(cur_count, prev_count),
        'average_basket': round(float(avg_basket), 2),
        'active_products': Product.objects.filter(company=company, is_active=True).count(),
    }

    payments = (
        Payment.objects.filter(sale__in=current_sales)
        .values('method')
        .annotate(total=Sum('amount'), count=Count('id'))
        .order_by('-total')
    )
    payment_methods = [
        {
            'method': p['method'],
            'label': PAYMENT_LABELS.get(p['method'], p['method']),
            'total': float(p['total'] or 0),
            'count': p['count'],
        }
        for p in payments
    ]

    categories = (
        SaleItem.objects.filter(sale__in=current_sales)
        .values('product__category__name')
        .annotate(revenue=Sum('total'))
        .order_by('-revenue')[:6]
    )
    category_breakdown = [
        {'name': c['product__category__name'] or 'Sans catégorie', 'revenue': float(c['revenue'] or 0)}
        for c in categories
    ]

    top_products = (
        SaleItem.objects.filter(sale__in=current_sales)
        .values('product__id', 'product__name')
        .annotate(quantity=Sum('quantity'), revenue=Sum('total'))
        .order_by('-revenue')[:5]
    )
    top = [
        {
            'id': p['product__id'],
            'name': p['product__name'],
            'quantity': float(p['quantity'] or 0),
            'revenue': float(p['revenue'] or 0),
        }
        for p in top_products
    ]

    low_stock = StockLevel.objects.filter(
        product__company=company,
        product__is_active=True,
        quantity__lte=F('product__min_stock'),
    ).count()

    return {
        'period': period,
        'kpis': kpis,
        'sales_trend': _trend(current_sales, period, start, today),
        'revenue_vs_expenses': _revenue_vs_expenses(company, today, branch_id, seller_id),
        'payment_methods': payment_methods,
        'category_breakdown': category_breakdown,
        'top_products': top,
        'low_stock_count': low_stock,
    }


class AnalyticsView(APIView):
    """Vue unique alimentant le tableau de bord statistique."""

    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        data = compute_analytics(
            request.user.company,
            period=request.query_params.get('period', 'month'),
            branch_id=request.query_params.get('branch') or None,
            seller_id=request.query_params.get('seller') or None,
        )
        return Response(data)


class AnalyticsFiltersView(APIView):
    """Options de filtres disponibles : boutiques et vendeurs."""

    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        from branches.models import Branch
        from django.contrib.auth import get_user_model

        company = request.user.company
        branches = Branch.objects.filter(company=company).values('id', 'name')
        User = get_user_model()
        sellers = (
            User.objects.filter(company=company, is_active=True)
            .values('id', 'first_name', 'last_name', 'email')
        )
        return Response({
            'branches': [{'id': b['id'], 'name': b['name']} for b in branches],
            'sellers': [
                {
                    'id': s['id'],
                    'name': (f"{s['first_name']} {s['last_name']}".strip() or s['email']),
                }
                for s in sellers
            ],
        })
