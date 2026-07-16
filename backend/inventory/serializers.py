from rest_framework import serializers

from products.models import Product
from warehouses.models import Warehouse
from .models import StockMovement, StockRequest, StockRequestItem


class StockMovementInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    reference = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        user = self.context['request'].user
        company = user.company

        try:
            product = Product.objects.get(id=data['product_id'], company=company, is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError({'product_id': 'Produit introuvable.'})

        try:
            warehouse = Warehouse.objects.select_related('branch').get(
                id=data['warehouse_id'],
                branch__company=company,
                is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'warehouse_id': 'Entrepôt introuvable.'})

        data['product'] = product
        data['warehouse'] = warehouse
        return data


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'warehouse', 'movement_type',
            'quantity', 'reference', 'notes', 'created_by_name', 'created_at',
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else 'Système'


class TransferItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)


class StockTransferInputSerializer(serializers.Serializer):
    from_warehouse_id = serializers.IntegerField()
    to_warehouse_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = TransferItemInputSerializer(many=True)

    def validate(self, data):
        company = self.context['request'].user.company
        try:
            data['from_warehouse'] = Warehouse.objects.get(
                id=data['from_warehouse_id'], branch__company=company, is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'from_warehouse_id': 'Entrepôt source introuvable.'})
        try:
            data['to_warehouse'] = Warehouse.objects.get(
                id=data['to_warehouse_id'], branch__company=company, is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'to_warehouse_id': 'Entrepôt destination introuvable.'})

        items = []
        for item in data['items']:
            try:
                product = Product.objects.get(id=item['product_id'], company=company, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError({'items': f"Produit {item['product_id']} introuvable."})
            items.append({**item, 'product': product})
        data['items'] = items
        return data


class AdjustmentItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    expected_quantity = serializers.DecimalField(max_digits=10, decimal_places=3)
    actual_quantity = serializers.DecimalField(max_digits=10, decimal_places=3)


class StockAdjustmentInputSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField()
    reason = serializers.CharField(max_length=200)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = AdjustmentItemInputSerializer(many=True)

    def validate(self, data):
        company = self.context['request'].user.company
        try:
            data['warehouse'] = Warehouse.objects.get(
                id=data['warehouse_id'], branch__company=company, is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'warehouse_id': 'Entrepôt introuvable.'})

        items = []
        for item in data['items']:
            try:
                product = Product.objects.get(id=item['product_id'], company=company, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError({'items': f"Produit {item['product_id']} introuvable."})
            items.append({**item, 'product': product})
        data['items'] = items
        return data


class StockRequestItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = StockRequestItem
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'quantity', 'quantity_fulfilled',
        ]


class StockRequestSerializer(serializers.ModelSerializer):
    items = StockRequestItemSerializer(many=True)
    from_warehouse_name = serializers.CharField(
        source='from_warehouse.name', read_only=True, default=None,
    )
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = StockRequest
        fields = [
            'id', 'reference', 'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name', 'status', 'status_display',
            'notes', 'requested_by', 'requested_by_name', 'processed_by',
            'items', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'reference', 'requested_by', 'processed_by',
            'created_at', 'updated_at',
        ]

    def get_requested_by_name(self, obj):
        return obj.requested_by.get_full_name() if obj.requested_by else None

    def validate(self, data):
        company = self.context['request'].user.company
        to_wh = data.get('to_warehouse') or getattr(self.instance, 'to_warehouse', None)
        from_wh = data.get('from_warehouse', getattr(self.instance, 'from_warehouse', None))
        if to_wh and to_wh.branch.company_id != company.id:
            raise serializers.ValidationError({'to_warehouse': 'Entrepôt invalide.'})
        if from_wh and from_wh.branch.company_id != company.id:
            raise serializers.ValidationError({'from_warehouse': 'Entrepôt invalide.'})
        return data

    def create(self, validated_data):
        from django.utils import timezone

        items_data = validated_data.pop('items')
        request = self.context['request']
        company = request.user.company
        stamp = timezone.now().strftime('%Y%m%d')
        count = StockRequest.objects.filter(
            company=company, reference__startswith=f'REQ-{stamp}',
        ).count()
        reference = f'REQ-{stamp}-{count + 1:03d}'
        stock_request = StockRequest.objects.create(
            company=company,
            reference=reference,
            requested_by=request.user,
            **validated_data,
        )
        for item in items_data:
            StockRequestItem.objects.create(request=stock_request, **item)
        return stock_request

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                StockRequestItem.objects.create(request=instance, **item)
        return instance
