from rest_framework import serializers

from .models import Supplier


class SupplierSerializer(serializers.ModelSerializer):
    orders_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'phone', 'email', 'address',
            'balance', 'is_active', 'orders_count', 'created_at',
        ]
        read_only_fields = ['id', 'balance', 'created_at']

    def get_orders_count(self, obj):
        return obj.purchase_orders.count()
