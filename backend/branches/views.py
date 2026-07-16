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
from sales.models import Sale, SaleStatus
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
    queryset = Branch.objects.all()
    search_fields = ['name', 'phone']
    ordering_fields = ['name', 'created_at']

    def perform_create(self, serializer):
        limits.check_can_add_branch(self.request.user.company)
        super().perform_create(serializer)


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
