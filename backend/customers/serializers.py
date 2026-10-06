from decimal import Decimal

from rest_framework import serializers

from .models import (
    Customer,
    CustomerAddress,
    CustomerNote,
    CustomerPayment,
    CustomerTag,
    LoyaltySettings,
)


class CustomerTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerTag
        fields = ['id', 'name', 'color', 'is_system', 'code', 'created_at']
        read_only_fields = ['id', 'is_system', 'created_at']


class CustomerNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomerNote
        fields = ['id', 'content', 'is_private', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_by_name', 'created_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else ''


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = [
            'id', 'label', 'address', 'city', 'commune', 'quartier',
            'landmark', 'is_default', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class LoyaltySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySettings
        fields = [
            'id', 'points_per_amount', 'bronze_max', 'silver_max', 'gold_max',
            'active_days', 'inactive_days',
        ]
        read_only_fields = ['id']


class CustomerPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    method = serializers.ChoiceField(
        choices=['cash', 'mobile_money', 'card', 'other'],
        default='cash',
    )
    reference = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    sale_id = serializers.IntegerField(required=False, allow_null=True)


class CustomerPaymentReadSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomerPayment
        fields = [
            'id', 'amount', 'method', 'reference', 'notes',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else ''


class CustomerSerializer(serializers.ModelSerializer):
    sales_count = serializers.IntegerField(source='orders_count', read_only=True)
    tags = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'whatsapp', 'email', 'photo', 'address',
            'city', 'commune', 'quartier', 'landmark', 'gender', 'profession',
            'company_name', 'birth_date', 'credit_limit', 'balance',
            'loyalty_points', 'loyalty_level', 'score', 'is_active',
            'last_order_at', 'orders_count', 'total_spent', 'sales_count',
            'tags', 'status', 'created_at',
        ]
        read_only_fields = [
            'id', 'balance', 'loyalty_points', 'loyalty_level', 'score',
            'last_order_at', 'orders_count', 'total_spent', 'sales_count',
            'tags', 'status', 'created_at',
        ]

    def get_tags(self, obj):
        return [
            {'id': a.tag_id, 'name': a.tag.name, 'color': a.tag.color, 'code': a.tag.code}
            for a in obj.tag_assignments.select_related('tag')
        ]

    def get_status(self, obj):
        from .services import customer_status
        return customer_status(obj)
