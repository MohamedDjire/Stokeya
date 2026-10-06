import secrets
import string

from rest_framework import serializers

from warehouses.models import Warehouse
from .models import Branch, CashRegister


def _ensure_pos_warehouse(branch: Branch):
    """Chaque boutique principale / POS a un stock de vente (POS)."""
    exists = Warehouse.objects.filter(branch=branch, is_pos_stock=True).exists()
    if exists:
        return
    Warehouse.objects.create(
        branch=branch,
        name=f'Stock {branch.name}',
        is_default=True,
        is_active=True,
        is_pos_stock=True,
    )


def _pos_warehouse(branch: Branch):
    return (
        Warehouse.objects.filter(branch=branch, is_pos_stock=True, is_active=True)
        .order_by('-is_default', 'id')
        .first()
    )


class BranchSerializer(serializers.ModelSerializer):
    site_type = serializers.SerializerMethodField()
    pos_warehouse_id = serializers.SerializerMethodField()
    pos_warehouse_name = serializers.SerializerMethodField()
    default_supply_warehouse_name = serializers.CharField(
        source='default_supply_warehouse.name', read_only=True, default=None,
    )

    class Meta:
        model = Branch
        fields = [
            'id', 'name', 'code', 'address', 'city', 'phone', 'manager_name',
            'opening_hours', 'currency', 'is_active', 'is_main', 'site_type',
            'acts_as_warehouse', 'default_supply_warehouse',
            'default_supply_warehouse_name', 'allow_supplier_receipts',
            'pos_warehouse_id', 'pos_warehouse_name', 'created_at',
        ]
        read_only_fields = [
            'id', 'is_main', 'site_type', 'pos_warehouse_id', 'pos_warehouse_name',
            'default_supply_warehouse_name', 'created_at',
        ]

    def get_site_type(self, obj):
        return 'main' if obj.is_main else 'pos'

    def get_pos_warehouse_id(self, obj):
        wh = _pos_warehouse(obj)
        return wh.id if wh else None

    def get_pos_warehouse_name(self, obj):
        wh = _pos_warehouse(obj)
        return wh.name if wh else None

    def validate_default_supply_warehouse(self, warehouse):
        if warehouse is None:
            return warehouse
        request = self.context['request']
        if warehouse.branch.company_id != request.user.company_id:
            raise serializers.ValidationError('Entrepôt d\'approvisionnement invalide.')
        if warehouse.is_pos_stock and not warehouse.branch.is_main:
            raise serializers.ValidationError(
                'L\'approvisionnement doit partir d\'un entrepôt ou du siège, pas d\'un autre point de vente.'
            )
        return warehouse

    def create(self, validated_data):
        # Siège : peut recevoir des achats. PDV : non, sauf option explicite.
        validated_data['is_main'] = False
        validated_data['acts_as_warehouse'] = True
        validated_data.setdefault('allow_supplier_receipts', False)
        validated_data.setdefault('currency', 'XOF')
        branch = super().create(validated_data)
        _ensure_pos_warehouse(branch)
        return branch

    def update(self, instance, validated_data):
        validated_data.pop('is_main', None)
        # Le siège peut toujours recevoir des achats
        if instance.is_main:
            validated_data['allow_supplier_receipts'] = True
        branch = super().update(instance, validated_data)
        _ensure_pos_warehouse(branch)
        return branch


class CashRegisterSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    opened_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CashRegister
        fields = [
            'id', 'branch', 'branch_name', 'name', 'is_open',
            'opened_at', 'opened_by', 'opened_by_name',
            'opening_balance', 'closing_balance', 'session_sales_total',
            'is_active', 'created_at',
        ]
        read_only_fields = [
            'id', 'opened_at', 'opened_by', 'opened_by_name',
            'closing_balance', 'session_sales_total', 'created_at',
        ]

    def get_opened_by_name(self, obj):
        return obj.opened_by.get_full_name() if obj.opened_by else ''


class CashRegisterOpenSerializer(serializers.Serializer):
    opening_balance = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)


class CashRegisterCloseSerializer(serializers.Serializer):
    closing_balance = serializers.DecimalField(max_digits=12, decimal_places=2)
