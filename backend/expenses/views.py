from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from .models import Expense, ExpenseCategory
from .serializers import ExpenseCategorySerializer, ExpenseSerializer


class ExpenseCategoryViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = ExpenseCategorySerializer
    queryset = ExpenseCategory.objects.all()
    search_fields = ['name']
    filterset_fields = ['is_active']


class ExpenseViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = ExpenseSerializer
    queryset = Expense.objects.select_related('category', 'branch', 'created_by')
    filterset_fields = ['category', 'branch', 'date']
    search_fields = ['description']
    ordering_fields = ['date', 'amount', 'created_at']
