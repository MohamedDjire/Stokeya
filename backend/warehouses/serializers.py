from rest_framework import serializers

from branches.models import Branch
from .models import Warehouse, WarehouseLocation


class WarehouseSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    locations_count = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = [
            'id', 'branch', 'branch_name', 'name', 'is_default', 'is_active',
            'locations_count', 'created_at',
        ]

    def get_locations_count(self, obj):
        return obj.locations.filter(is_active=True).count()

    def validate_branch(self, branch):
        request = self.context['request']
        if branch.company_id != request.user.company_id:
            raise serializers.ValidationError('Boutique invalide.')
        return branch


class WarehouseLocationSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model = WarehouseLocation
        fields = [
            'id', 'warehouse', 'warehouse_name', 'code', 'name', 'is_active', 'created_at',
        ]

    def validate_warehouse(self, warehouse):
        request = self.context['request']
        if warehouse.branch.company_id != request.user.company_id:
            raise serializers.ValidationError('Entrepôt invalide.')
        return warehouse
