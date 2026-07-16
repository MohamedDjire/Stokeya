from rest_framework import serializers

from products.models import Product
from suppliers.models import Supplier
from .models import GoodsReceipt, PurchaseOrder, PurchaseOrderItem


class PurchaseOrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class PurchaseOrderCreateSerializer(serializers.Serializer):
    supplier_id = serializers.IntegerField()
    expected_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = PurchaseOrderItemInputSerializer(many=True)

    def validate(self, data):
        company = self.context['request'].user.company
        try:
            data['supplier'] = Supplier.objects.get(id=data['supplier_id'], company=company)
        except Supplier.DoesNotExist:
            raise serializers.ValidationError({'supplier_id': 'Fournisseur introuvable.'})

        products = []
        for item in data['items']:
            try:
                product = Product.objects.get(id=item['product_id'], company=company, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError({
                    'items': f"Produit {item['product_id']} introuvable.",
                })
            products.append({**item, 'product': product})
        data['items'] = products
        return data


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'product', 'product_name', 'quantity',
            'unit_price', 'total', 'quantity_received',
        ]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'reference', 'supplier', 'supplier_name', 'status',
            'total', 'expected_date', 'notes', 'items', 'created_at',
        ]


class GoodsReceiptItemInputSerializer(serializers.Serializer):
    order_item_id = serializers.IntegerField()
    quantity_received = serializers.DecimalField(max_digits=10, decimal_places=3)


class GoodsReceiptCreateSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = GoodsReceiptItemInputSerializer(many=True)

    def validate(self, data):
        order = self.context['order']
        company = self.context['request'].user.company
        from warehouses.models import Warehouse
        try:
            data['warehouse'] = Warehouse.objects.get(
                id=data['warehouse_id'],
                branch__company=company,
                is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'warehouse_id': 'Entrepôt introuvable.'})

        items = []
        for item in data['items']:
            try:
                po_item = PurchaseOrderItem.objects.get(id=item['order_item_id'], order=order)
            except PurchaseOrderItem.DoesNotExist:
                raise serializers.ValidationError({
                    'items': f"Ligne {item['order_item_id']} introuvable.",
                })
            items.append({**item, 'order_item': po_item})
        data['items'] = items
        return data


class GoodsReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoodsReceipt
        fields = ['id', 'reference', 'warehouse', 'notes', 'created_at']
