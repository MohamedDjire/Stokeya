from django.db import transaction
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from common.permissions import IsCompanyMember
from companies import limits
from .models import Warehouse, WarehouseLocation
from .serializers import WarehouseLocationSerializer, WarehouseSerializer


class WarehouseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = WarehouseSerializer

    def get_queryset(self):
        return Warehouse.objects.filter(
            branch__company=self.request.user.company,
        ).select_related('branch').order_by('branch__name', 'name')

    def perform_create(self, serializer):
        is_pos = serializer.validated_data.get('is_pos_stock', False)
        limits.check_can_add_warehouse(self.request.user.company, is_pos_stock=is_pos)
        # Entrepôts de stockage rattachés au siège par défaut
        branch = serializer.validated_data.get('branch')
        if branch and branch.company_id != self.request.user.company_id:
            raise limits.LimitReached('Branche invalide.')
        if not is_pos and branch and not branch.is_main:
            # Forcer rattachement au siège pour le stockage
            from branches.models import Branch
            main = Branch.objects.filter(company=self.request.user.company, is_main=True).first()
            if main:
                serializer.validated_data['branch'] = main
        warehouse = serializer.save()
        if warehouse.is_default:
            Warehouse.objects.filter(
                branch=warehouse.branch, is_default=True,
            ).exclude(pk=warehouse.pk).update(is_default=False)

    def perform_update(self, serializer):
        warehouse = serializer.save()
        if warehouse.is_default:
            Warehouse.objects.filter(
                branch=warehouse.branch, is_default=True,
            ).exclude(pk=warehouse.pk).update(is_default=False)


class WarehouseLocationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = WarehouseLocationSerializer
    filterset_fields = ['warehouse', 'is_active']

    def get_queryset(self):
        return WarehouseLocation.objects.filter(
            warehouse__branch__company=self.request.user.company,
        ).select_related('warehouse').order_by('code')
