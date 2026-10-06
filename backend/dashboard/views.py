from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from branches.models import Branch
from common.permissions import IsCompanyMember
from customers.models import Customer
from inventory.models import MovementType, StockAdjustment, StockLevel, StockMovement
from inventory.services import average_positive_quantity, classify_stock
from products.models import Product
from purchases.models import OrderStatus, PurchaseOrder
from sales.models import PaymentStatus, Sale, SaleStatus
from suppliers.models import Supplier
from warehouses.models import Warehouse


def build_dashboard(company):
    today = timezone.now().date()

    # ── Ventes / CA ──────────────────────────────────────────────────────────
    sales_today = Sale.objects.filter(
        company=company, status=SaleStatus.COMPLETED, created_at__date=today,
    )
    sales_month = Sale.objects.filter(
        company=company, status=SaleStatus.COMPLETED,
        created_at__year=today.year, created_at__month=today.month,
    )
    revenue_today = sales_today.aggregate(total=Sum('total'))['total'] or 0
    revenue_month = sales_month.aggregate(total=Sum('total'))['total'] or 0
    sales_count_today = sales_today.count()

    # ── Catalogue & multi-sites ──────────────────────────────────────────────
    products_count = Product.objects.filter(company=company, is_active=True).count()
    branches_count = Branch.objects.filter(company=company, is_active=True).count()
    warehouses_count = Warehouse.objects.filter(
        branch__company=company, is_active=True,
    ).count()
    suppliers_count = Supplier.objects.filter(company=company, is_active=True).count()
    customers_count = Customer.objects.filter(company=company, is_active=True).count()
    inventories_count = StockAdjustment.objects.filter(company=company).count()

    # ── Stock levels ─────────────────────────────────────────────────────────
    levels = list(
        StockLevel.objects.filter(
            product__company=company, product__is_active=True,
        ).select_related('product', 'warehouse', 'warehouse__branch')
    )

    stock_value = Decimal('0')
    stock_qty = Decimal('0')
    in_stock = 0
    out_of_stock = 0
    low_stock = 0
    negative_stock = 0
    over_max = 0
    low_stock_products = []
    out_of_stock_products = []
    negative_products = []
    restock_products = []
    avg_qty = average_positive_quantity([level.quantity for level in levels])

    for level in levels:
        product = level.product
        qty = level.quantity
        stock_qty += qty
        stock_value += qty * (product.purchase_price or Decimal('0'))
        status = classify_stock(qty, product.min_stock, avg_qty)
        item = {
            'id': product.id,
            'name': product.name,
            'quantity': qty,
            'min_stock': product.min_stock,
            'warehouse': level.warehouse.name,
            'status': status,
        }

        if qty < 0:
            negative_stock += 1
            negative_products.append(item)
            restock_products.append(item)
        elif status == 'out_of_stock':
            out_of_stock += 1
            out_of_stock_products.append(item)
            restock_products.append(item)
        else:
            in_stock += 1
            if status == 'low':
                low_stock += 1
                low_stock_products.append(item)
                restock_products.append(item)

        if product.max_stock and qty > product.max_stock:
            over_max += 1

    # Rotation stock simplifiée : sorties / stock moyen sur 30 jours
    since_30 = timezone.now() - timedelta(days=30)
    exits_30 = StockMovement.objects.filter(
        warehouse__branch__company=company,
        created_at__gte=since_30,
        movement_type__in=[MovementType.OUT, MovementType.SALE],
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0')
    avg_stock = stock_qty if stock_qty > 0 else Decimal('1')
    rotation = float(exits_30 / avg_stock) if avg_stock else 0.0

    # Âge stock approximatif : jours depuis dernier mouvement (moyenne)
    from django.db.models import Max
    last_by_product = (
        StockMovement.objects.filter(warehouse__branch__company=company)
        .values('product_id')
        .annotate(last_at=Max('created_at'))
    )
    ages = []
    now = timezone.now()
    for row in last_by_product:
        if row['last_at']:
            ages.append((now - row['last_at']).days)
    stock_age_avg = round(sum(ages) / len(ages), 1) if ages else 0

    # ── Achats fournisseurs ──────────────────────────────────────────────────
    po = PurchaseOrder.objects.filter(company=company)
    purchases = {
        'to_validate': po.filter(status=OrderStatus.DRAFT).count(),
        'to_receive': po.filter(status=OrderStatus.ORDERED).count(),
        'partial': po.filter(status=OrderStatus.PARTIAL).count(),
        'suppliers_count': suppliers_count,
    }

    # ── Ventes clients (pipeline) ────────────────────────────────────────────
    sales_qs = Sale.objects.filter(company=company)
    customer_orders = {
        'awaiting_payment': sales_qs.filter(
            status=SaleStatus.COMPLETED, payment_status=PaymentStatus.UNPAID,
        ).count(),
        'partial_payment': sales_qs.filter(
            status=SaleStatus.COMPLETED, payment_status=PaymentStatus.PARTIAL,
        ).count(),
        'draft': sales_qs.filter(status=SaleStatus.DRAFT).count(),
        'customers_count': customers_count,
    }

    # ── Alertes ──────────────────────────────────────────────────────────────
    alerts = {
        'automatic': low_stock + out_of_stock + negative_stock + over_max,
        'untreated': out_of_stock + negative_stock,
        'to_restock': len(restock_products),
        'negative': negative_stock,
        'over_max': over_max,
        'low_stock': low_stock,
        'out_of_stock': out_of_stock,
    }

    # ── Évolution stock (30 jours) ───────────────────────────────────────────
    start = today - timedelta(days=29)
    movements = (
        StockMovement.objects.filter(
            warehouse__branch__company=company,
            created_at__date__gte=start,
        )
        .annotate(day=TruncDate('created_at'))
        .values('day', 'movement_type')
        .annotate(qty=Sum('quantity'))
    )
    # Reconstruct approximate daily stock qty from net movements (baseline = current)
    by_day = {start + timedelta(days=i): Decimal('0') for i in range(30)}
    for row in movements:
        day = row['day']
        if day not in by_day:
            continue
        mt = row['movement_type']
        qty = row['qty'] or Decimal('0')
        if mt in (MovementType.IN, MovementType.PURCHASE, MovementType.RETURN):
            by_day[day] += qty
        elif mt in (MovementType.OUT, MovementType.SALE):
            by_day[day] -= qty
        # adjustments/transfers ignored for net simplicity

    # Walk backwards from current stock to estimate historical quantity
    labels, qty_series, value_series = [], [], []
    running = stock_qty
    days_sorted = sorted(by_day.keys(), reverse=True)
    hist_qty = {}
    for day in days_sorted:
        hist_qty[day] = running
        running -= by_day[day]  # undo today's net change to get yesterday

    # Purchases / sales / margin for chart tabs
    purchase_rows = (
        PurchaseOrder.objects.filter(
            company=company,
            created_at__date__gte=start,
            status__in=[OrderStatus.ORDERED, OrderStatus.PARTIAL, OrderStatus.RECEIVED],
        )
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(total=Sum('total'))
    )
    purchase_map = {r['day']: float(r['total'] or 0) for r in purchase_rows}

    sale_rows = (
        Sale.objects.filter(
            company=company,
            status=SaleStatus.COMPLETED,
            created_at__date__gte=start,
        )
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(total=Sum('total'), cost=Sum('subtotal'))
    )
    sale_map = {r['day']: float(r['total'] or 0) for r in sale_rows}

    # Approximate margin = revenue - purchase_price * qty sold (simplified: use tax-excl subtotal * rough)
    # Better: use sale items — keep simple with revenue vs purchases
    for i in range(30):
        day = start + timedelta(days=i)
        labels.append(f'{day.day:02d}/{day.month:02d}')
        q = float(hist_qty.get(day, stock_qty))
        qty_series.append(round(q, 2))
        # value approx = qty * avg unit cost
        avg_cost = float(stock_value / stock_qty) if stock_qty else 0
        value_series.append(round(q * avg_cost, 0))

    purchases_series = [purchase_map.get(start + timedelta(days=i), 0) for i in range(30)]
    sales_series = [sale_map.get(start + timedelta(days=i), 0) for i in range(30)]
    margin_series = [
        round(sales_series[i] - purchases_series[i], 0) for i in range(30)
    ]

    return {
        # Compatibilité existante
        'revenue_today': revenue_today,
        'revenue_month': revenue_month,
        'sales_count_today': sales_count_today,
        'products_count': products_count,
        'low_stock_count': low_stock + out_of_stock,
        'low_stock_products': (low_stock_products + restock_products)[:10],

        # Vue stock globale (style monstock)
        'stock_overview': {
            'products': products_count,
            'stock_qty': stock_qty,
            'stock_value': stock_value,
            'stock_age_avg': stock_age_avg,
            'rotation': round(rotation, 2),
            'branches': branches_count,
            'warehouses': warehouses_count,
            'inventories': inventories_count,
            'in_stock': in_stock,
            'out_of_stock': out_of_stock,
            'low_stock': low_stock,
            'negative_stock': negative_stock,
            'over_max': over_max,
        },

        'purchases_summary': purchases,
        'customer_orders': customer_orders,
        'alerts': alerts,
        'alert_lists': {
            'to_restock': restock_products[:10],
            'negative': negative_products[:10],
            'low_stock': low_stock_products[:10],
            'out_of_stock': out_of_stock_products[:10],
        },

        'charts': {
            'labels': labels,
            'stock_qty': qty_series,
            'stock_value': value_series,
            'purchases': purchases_series,
            'sales': sales_series,
            'margin': margin_series,
        },

        'sites_overview': _build_sites_overview(company, levels),
    }


def _build_sites_overview(company, levels):
    """Vue multi-sites : stock + demandes par boutique / entrepôt."""
    from inventory.models import RequestStatus, StockRequest

    pending_statuses = [
        RequestStatus.PENDING,
        RequestStatus.POS_VALIDATED,
        RequestStatus.APPROVED,
    ]
    request_counts = {
        r['to_warehouse_id']: r['c']
        for r in StockRequest.objects.filter(
            company=company, status__in=pending_statuses,
        ).values('to_warehouse_id').annotate(c=Count('id'))
    }

    # Agrégat stock par warehouse
    by_wh = {}
    for level in levels:
        wid = level.warehouse_id
        if wid not in by_wh:
            by_wh[wid] = {
                'warehouse_id': wid,
                'warehouse_name': level.warehouse.name,
                'branch_id': level.warehouse.branch_id,
                'branch_name': level.warehouse.branch.name,
                'is_pos_stock': level.warehouse.is_pos_stock,
                'is_main': level.warehouse.branch.is_main,
                'stock_qty': Decimal('0'),
                'stock_value': Decimal('0'),
            }
        qty = level.quantity or Decimal('0')
        by_wh[wid]['stock_qty'] += qty
        by_wh[wid]['stock_value'] += qty * (level.product.purchase_price or Decimal('0'))

    warehouses = Warehouse.objects.filter(
        branch__company=company, is_active=True,
    ).select_related('branch')
    sites = []
    for wh in warehouses:
        row = by_wh.get(wh.id, {
            'warehouse_id': wh.id,
            'warehouse_name': wh.name,
            'branch_id': wh.branch_id,
            'branch_name': wh.branch.name,
            'is_pos_stock': wh.is_pos_stock,
            'is_main': wh.branch.is_main,
            'stock_qty': Decimal('0'),
            'stock_value': Decimal('0'),
        })
        kind = 'main' if wh.branch.is_main and wh.is_pos_stock else (
            'pos' if wh.is_pos_stock else 'warehouse'
        )
        sites.append({
            **row,
            'kind': kind,
            'pending_requests': request_counts.get(wh.id, 0),
            'stock_qty': float(row['stock_qty']),
            'stock_value': float(row['stock_value']),
        })

    # Trier : siège, entrepôts, PDV
    order = {'main': 0, 'warehouse': 1, 'pos': 2}
    sites.sort(key=lambda s: (order.get(s['kind'], 9), s['branch_name'], s['warehouse_name']))
    return sites


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        return Response(build_dashboard(request.user.company))
