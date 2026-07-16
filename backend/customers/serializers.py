from rest_framework import serializers

from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    sales_count = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'address',
            'credit_limit', 'balance', 'loyalty_points',
            'is_active', 'sales_count', 'created_at',
        ]
        read_only_fields = ['id', 'balance', 'loyalty_points', 'created_at']

    def get_sales_count(self, obj):
        return obj.sales.count()
