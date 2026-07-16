from rest_framework import serializers

from customers.models import Customer
from products.models import Product
from .models import Payment, Sale, SaleItem


class SaleItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)


class SaleCreateSerializer(serializers.Serializer):
    branch_id = serializers.IntegerField()
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    cash_register_id = serializers.IntegerField(required=False, allow_null=True)
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(
        choices=['cash', 'mobile_money', 'card', 'credit'],
        default='cash',
    )
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    is_offline = serializers.BooleanField(required=False, default=False)
    client_reference = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=64, default='',
    )
    items = SaleItemInputSerializer(many=True)

    def validate(self, data):
        user = self.context['request'].user
        company = user.company

        from branches.models import Branch, CashRegister
        try:
            data['branch'] = Branch.objects.get(id=data['branch_id'], company=company)
        except Branch.DoesNotExist:
            raise serializers.ValidationError({'branch_id': 'Boutique introuvable.'})

        if data.get('customer_id'):
            try:
                data['customer'] = Customer.objects.get(id=data['customer_id'], company=company)
            except Customer.DoesNotExist:
                raise serializers.ValidationError({'customer_id': 'Client introuvable.'})
        else:
            data['customer'] = None

        if data.get('cash_register_id'):
            try:
                data['cash_register'] = CashRegister.objects.get(
                    id=data['cash_register_id'], company=company
                )
            except CashRegister.DoesNotExist:
                raise serializers.ValidationError({'cash_register_id': 'Caisse introuvable.'})
        else:
            data['cash_register'] = None

        if data.get('warehouse_id'):
            from warehouses.models import Warehouse
            try:
                data['warehouse'] = Warehouse.objects.get(
                    id=data['warehouse_id'],
                    branch__company=company,
                )
            except Warehouse.DoesNotExist:
                raise serializers.ValidationError({'warehouse_id': 'Entrepôt introuvable.'})
        else:
            data['warehouse'] = None

        return data


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            'id', 'product', 'product_name', 'quantity',
            'unit_price', 'tax_rate', 'discount', 'total',
        ]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'method', 'amount', 'reference', 'status', 'created_at']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    seller_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'reference', 'branch', 'branch_name', 'customer', 'customer_name',
            'seller', 'seller_name', 'status', 'payment_status', 'subtotal', 'tax_amount',
            'discount_amount', 'total', 'notes', 'is_offline', 'client_reference',
            'synced_at', 'items', 'payments', 'created_at',
        ]

    def get_seller_name(self, obj):
        return obj.seller.get_full_name() if obj.seller else ''

    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else ''
