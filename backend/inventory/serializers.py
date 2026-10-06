from rest_framework import serializers

from products.models import Product, ProductBatch
from suppliers.models import Supplier
from warehouses.models import Warehouse
from .models import (
    InventorySession,
    InventorySessionItem,
    MovementType,
    RequestStatus,
    StockMovement,
    StockRequest,
    StockRequestItem,
    StockTransfer,
    StockTransferItem,
)


class StockMovementInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    reference = serializers.CharField(required=False, allow_blank=True, default='')
    movement_type = serializers.ChoiceField(
        choices=MovementType.choices, required=False, allow_blank=True, default='',
    )
    reason = serializers.CharField(required=False, allow_blank=True, default='')
    supplier_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    invoice_ref = serializers.CharField(required=False, allow_blank=True, default='')
    unit_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, default=None,
    )
    batch_number = serializers.CharField(required=False, allow_blank=True, default='')
    expiry_date = serializers.DateField(required=False, allow_null=True, default=None)

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

        supplier = None
        supplier_id = data.get('supplier_id')
        if supplier_id:
            try:
                supplier = Supplier.objects.get(id=supplier_id, company=company)
            except Supplier.DoesNotExist:
                raise serializers.ValidationError({'supplier_id': 'Fournisseur introuvable.'})

        batch = None
        batch_number = data.get('batch_number')
        if batch_number:
            batch, _ = ProductBatch.objects.get_or_create(
                company=company,
                product=product,
                batch_number=batch_number,
                defaults={
                    'expiry_date': data.get('expiry_date'),
                    'supplier': supplier,
                    'warehouse': warehouse,
                },
            )

        data['product'] = product
        data['warehouse'] = warehouse
        data['supplier'] = supplier
        data['batch'] = batch
        return data


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True, default=None)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'warehouse', 'warehouse_name',
            'movement_type', 'quantity', 'old_quantity', 'new_quantity', 'unit_cost',
            'reference', 'invoice_ref', 'reason', 'notes', 'supplier', 'supplier_name',
            'batch', 'batch_number', 'created_by_name', 'created_at',
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else 'Système'


class TransferItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)


class TransferReceiveItemSerializer(serializers.Serializer):
    item_id = serializers.IntegerField(required=False)
    product_id = serializers.IntegerField(required=False)
    quantity_received = serializers.DecimalField(max_digits=10, decimal_places=3)
    variance_reason = serializers.ChoiceField(
        choices=['broken', 'lost', 'stolen', 'other'],
        required=False,
        allow_blank=True,
        default='',
    )
    variance_notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        if not data.get('item_id') and not data.get('product_id'):
            raise serializers.ValidationError('item_id ou product_id requis.')
        return data


class TransferReceiveInputSerializer(serializers.Serializer):
    items = TransferReceiveItemSerializer(many=True, required=False)


class StockTransferInputSerializer(serializers.Serializer):
    from_warehouse_id = serializers.IntegerField()
    to_warehouse_id = serializers.IntegerField()
    carrier = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    auto_prepare = serializers.BooleanField(required=False, default=True)
    items = TransferItemInputSerializer(many=True)

    def validate(self, data):
        company = self.context['request'].user.company
        try:
            data['from_warehouse'] = Warehouse.objects.select_related('branch').get(
                id=data['from_warehouse_id'], branch__company=company, is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'from_warehouse_id': 'Emplacement source introuvable.'})
        try:
            data['to_warehouse'] = Warehouse.objects.select_related('branch').get(
                id=data['to_warehouse_id'], branch__company=company, is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'to_warehouse_id': 'Emplacement destination introuvable.'})

        items = []
        for item in data['items']:
            try:
                product = Product.objects.get(id=item['product_id'], company=company, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError({'items': f"Produit {item['product_id']} introuvable."})
            items.append({**item, 'product': product})
        data['items'] = items
        return data


class ReplenishmentInputSerializer(serializers.Serializer):
    to_warehouse_id = serializers.IntegerField()
    from_warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    days = serializers.IntegerField(required=False, default=30, min_value=1, max_value=365)

    def validate(self, data):
        company = self.context['request'].user.company
        try:
            data['to_warehouse'] = Warehouse.objects.select_related('branch').get(
                id=data['to_warehouse_id'], branch__company=company, is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'to_warehouse_id': 'Destination introuvable.'})
        from_id = data.get('from_warehouse_id')
        if from_id:
            try:
                data['from_warehouse'] = Warehouse.objects.select_related('branch').get(
                    id=from_id, branch__company=company, is_active=True,
                )
            except Warehouse.DoesNotExist:
                raise serializers.ValidationError({'from_warehouse_id': 'Source introuvable.'})
        else:
            data['from_warehouse'] = None
        return data


class ImportFromMainInputSerializer(serializers.Serializer):
    to_warehouse_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    complete_now = serializers.BooleanField(required=False, default=False)
    items = TransferItemInputSerializer(many=True)

    def validate(self, data):
        company = self.context['request'].user.company
        try:
            data['to_warehouse'] = Warehouse.objects.select_related('branch').get(
                id=data['to_warehouse_id'], branch__company=company, is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'to_warehouse_id': 'Entrepôt introuvable.'})
        items = []
        for item in data['items']:
            try:
                product = Product.objects.get(id=item['product_id'], company=company, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError({'items': f"Produit {item['product_id']} introuvable."})
            items.append({**item, 'product': product})
        data['items'] = items
        return data


class StockTransferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = StockTransferItem
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'quantity',
            'quantity_received', 'variance_reason', 'variance_notes',
        ]


class StockTransferSerializer(serializers.ModelSerializer):
    items = StockTransferItemSerializer(many=True, read_only=True)
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    total_quantity = serializers.SerializerMethodField()

    class Meta:
        model = StockTransfer
        fields = [
            'id', 'reference', 'from_warehouse', 'from_warehouse_name', 'to_warehouse',
            'to_warehouse_name', 'status', 'status_display', 'carrier', 'notes',
            'shipped_at', 'received_at', 'items', 'items_count', 'total_quantity',
            'created_by_name', 'received_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else 'Système'

    def get_received_by_name(self, obj):
        return obj.received_by.get_full_name() if obj.received_by else None

    def get_items_count(self, obj):
        return obj.items.count()

    def get_total_quantity(self, obj):
        return sum((i.quantity for i in obj.items.all()), 0)


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
    transfer_id = serializers.IntegerField(read_only=True, allow_null=True)
    transfer_reference = serializers.CharField(
        source='transfer.reference', read_only=True, default=None, allow_null=True,
    )

    class Meta:
        model = StockRequest
        fields = [
            'id', 'reference', 'from_warehouse', 'from_warehouse_name',
            'to_warehouse', 'to_warehouse_name', 'status', 'status_display',
            'source', 'notes', 'requested_by', 'requested_by_name', 'processed_by',
            'transfer_id', 'transfer_reference',
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
        from accounts.utils import get_user_role_code

        items_data = validated_data.pop('items')
        request = self.context['request']
        company = request.user.company
        stamp = timezone.now().strftime('%Y%m%d')
        count = StockRequest.objects.filter(
            company=company, reference__startswith=f'REQ-{stamp}',
        ).count()
        reference = f'REQ-{stamp}-{count + 1:03d}'
        source = validated_data.get('source') or 'manual'
        role = get_user_role_code(request.user)
        if role == 'pos_manager' and source == 'manual':
            source = 'pos_manager'
            validated_data['source'] = source
            validated_data['status'] = RequestStatus.POS_VALIDATED
        elif role == 'cashier':
            source = 'cashier_alert'
            validated_data['source'] = source
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


class InventorySessionItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    difference = serializers.SerializerMethodField()

    class Meta:
        model = InventorySessionItem
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'system_quantity', 'counted_quantity', 'difference', 'notes',
        ]

    def get_difference(self, obj):
        return obj.difference


class InventorySessionSerializer(serializers.ModelSerializer):
    items = InventorySessionItemSerializer(many=True, read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    counted_count = serializers.SerializerMethodField()

    class Meta:
        model = InventorySession
        fields = [
            'id', 'reference', 'warehouse', 'warehouse_name', 'status', 'status_display',
            'notes', 'items', 'items_count', 'counted_count',
            'created_by_name', 'validated_by_name', 'validated_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else 'Système'

    def get_validated_by_name(self, obj):
        return obj.validated_by.get_full_name() if obj.validated_by else None

    def get_items_count(self, obj):
        return obj.items.count()

    def get_counted_count(self, obj):
        return obj.items.exclude(counted_quantity__isnull=True).count()


class InventorySessionCreateSerializer(serializers.Serializer):
    warehouse_id = serializers.IntegerField()
    product_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, data):
        company = self.context['request'].user.company
        try:
            data['warehouse'] = Warehouse.objects.get(
                id=data['warehouse_id'], branch__company=company, is_active=True,
            )
        except Warehouse.DoesNotExist:
            raise serializers.ValidationError({'warehouse_id': 'Entrepôt introuvable.'})
        return data


class InventoryCountItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    counted_quantity = serializers.DecimalField(max_digits=10, decimal_places=3)
