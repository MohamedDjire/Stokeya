from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from .models import Supplier
from .serializers import SupplierSerializer


class SupplierViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = SupplierSerializer
    queryset = Supplier.objects.all()
    search_fields = ['name', 'phone', 'email']
    filterset_fields = ['is_active']
    ordering_fields = ['name', 'created_at']
