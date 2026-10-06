from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from companies import limits
from inventory.models import StockLevel, StockTransfer, TransferStatus
from inventory.services import average_positive_quantity, classify_stock
from sales.models import Sale, SaleItem, SaleStatus
from warehouses.models import Warehouse
from .models import Branch, CashRegister
from .serializers import (
    BranchSerializer,
    CashRegisterCloseSerializer,
    CashRegisterOpenSerializer,
    CashRegisterSerializer,
)


class BranchViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = BranchSerializer
    queryset = Branch.objects.select_related('default_supply_warehouse').all()
    search_fields = ['name', 'phone', 'code', 'city', 'manager_name']
    ordering_fields = ['name', 'created_at', 'is_main']
    filterset_fields = ['is_active', 'is_main']

    def perform_create(self, serializer):
        limits.check_can_add_branch(self.request.user.company)
        super().perform_create(serializer)

    def destroy(self, request, *args, **kwargs):
        branch = self.get_object()
        if branch.is_main:
            return Response(
                {'detail': 'La boutique principale ne peut pas être supprimée.'},
                status=400,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='dashboard')
    def dashboard(self, request, pk=None):
        branch = self.get_object()
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        warehouse = (
            Warehouse.objects.filter(branch=branch, is_pos_stock=True, is_active=True)
            .order_by('-is_default', 'id')
            .first()
        )

        sales_today = Sale.objects.filter(
            company=request.user.company,
            branch=branch,
            status=SaleStatus.COMPLETED,
            created_at__gte=today_start,
        )
        revenue = sales_today.aggregate(t=Sum('total'))['t'] or Decimal('0')
        sales_count = sales_today.count()
        customers = sales_today.exclude(customer_id=None).values('customer_id').distinct().count()
        items_sold = SaleItem.objects.filter(sale__in=sales_today).aggregate(
            q=Sum('quantity'),
        )['q'] or Decimal('0')

        stock_qty = Decimal('0')
        alert_count = 0
        if warehouse:
            levels = list(
                StockLevel.objects.filter(
                    warehouse=warehouse, product__is_active=True,
                ).select_related('product')
            )
            avg_qty = average_positive_quantity([lv.quantity for lv in levels])
            for lv in levels:
                stock_qty += lv.quantity or 0
                st = classify_stock(lv.quantity, lv.product.min_stock, avg_qty)
                if st in ('low', 'out_of_stock'):
                    alert_count += 1

        pending_transfers = StockTransfer.objects.filter(
            company=request.user.company,
            to_warehouse=warehouse,
            status__in=[
                TransferStatus.PENDING,
                TransferStatus.PREPARING,
                TransferStatus.SHIPPED,
                TransferStatus.IN_TRANSIT,
            ],
        ).count() if warehouse else 0

        return Response({
            'branch_id': branch.id,
            'branch_name': branch.name,
            'site_type': 'main' if branch.is_main else 'pos',
            'pos_warehouse_id': warehouse.id if warehouse else None,
            'default_supply_warehouse_id': branch.default_supply_warehouse_id,
            'allow_supplier_receipts': branch.allow_supplier_receipts or branch.is_main,
            'today': {
                'revenue': revenue,
                'sales_count': sales_count,
                'customers': customers,
                'items_sold': items_sold,
            },
            'stock_quantity': stock_qty,
            'stock_alerts': alert_count,
            'pending_inbound': pending_transfers,
            'currency': branch.currency or 'XOF',
        })


class CashRegisterViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = CashRegisterSerializer
    queryset = CashRegister.objects.select_related('branch', 'opened_by').all()
    filterset_fields = ['branch', 'is_open', 'is_active']
    ordering_fields = ['name', 'created_at']

    @action(detail=True, methods=['post'])
    def open(self, request, pk=None):
        register = self.get_object()
        if register.is_open:
            return Response({'detail': 'Cette caisse est déjà ouverte.'}, status=400)

        serializer = CashRegisterOpenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        register.is_open = True
        register.opened_by = request.user
        register.opened_at = timezone.now()
        register.opening_balance = serializer.validated_data['opening_balance']
        register.closing_balance = None
        register.session_sales_total = None
        register.save()

        return Response(CashRegisterSerializer(register).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        register = self.get_object()
        if not register.is_open:
            return Response({'detail': 'Cette caisse n\'est pas ouverte.'}, status=400)

        serializer = CashRegisterCloseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        sales_total = Sale.objects.filter(
            cash_register=register,
            status=SaleStatus.COMPLETED,
            created_at__gte=register.opened_at,
        ).aggregate(total=Sum('total'))['total'] or Decimal('0')

        register.is_open = False
        register.closing_balance = serializer.validated_data['closing_balance']
        register.session_sales_total = sales_total
        register.save()

        return Response({
            **CashRegisterSerializer(register).data,
            'expected_balance': (register.opening_balance or 0) + sales_total,
        })
