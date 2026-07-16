from rest_framework import serializers

from .models import Branch, CashRegister


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['id', 'name', 'address', 'phone', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


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
