from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from categories.models import ProductTag, Tag
from inventory.models import StockLevel
from inventory.services import (
    StockError,
    average_positive_quantity,
    classify_stock,
    ensure_product_stock,
)
from warehouses.models import Warehouse
from .models import Barcode, Product, ProductBatch


class BarcodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barcode
        fields = ['id', 'code', 'is_primary']


class ProductBatchSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default=None)
    location_code = serializers.CharField(source='location.code', read_only=True, default=None)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = ProductBatch
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'batch_number',
            'manufactured_at', 'expiry_date', 'quantity', 'supplier', 'supplier_name',
            'location', 'location_code', 'warehouse', 'warehouse_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_product(self, product):
        request = self.context['request']
        if product.company_id != request.user.company_id:
            raise serializers.ValidationError('Produit invalide.')
        return product

    def validate_supplier(self, supplier):
        if supplier is None:
            return supplier
        request = self.context['request']
        if supplier.company_id != request.user.company_id:
            raise serializers.ValidationError('Fournisseur invalide.')
        return supplier

    def validate_warehouse(self, warehouse):
        if warehouse is None:
            return warehouse
        request = self.context['request']
        if warehouse.branch.company_id != request.user.company_id:
            raise serializers.ValidationError('Entrepôt invalide.')
        return warehouse

    def validate_location(self, location):
        if location is None:
            return location
        request = self.context['request']
        if location.warehouse.branch.company_id != request.user.company_id:
            raise serializers.ValidationError('Emplacement invalide.')
        return location


class ProductSerializer(serializers.ModelSerializer):
    barcodes = BarcodeSerializer(many=True, required=False)
    category_name = serializers.CharField(source='category.name', read_only=True)
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    total_stock = serializers.SerializerMethodField()
    stock_status = serializers.SerializerMethodField()
    initial_stock = serializers.DecimalField(
        max_digits=12, decimal_places=3, required=False, allow_null=True, write_only=True,
    )
    stock_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=3, required=False, allow_null=True, write_only=True,
    )
    warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.all(), required=False, allow_null=True, write_only=True,
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True,
    )
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'description', 'category', 'category_name',
            'brand', 'brand_name', 'unit', 'unit_name', 'purchase_price',
            'sale_price', 'wholesale_price', 'wholesale_min_qty',
            'wholesale_discount_type', 'wholesale_discount_value',
            'tax_rate', 'min_stock', 'max_stock', 'image',
            'track_batches', 'is_active', 'barcodes', 'total_stock', 'stock_status',
            'initial_stock', 'stock_quantity', 'warehouse',
            'tag_ids', 'tags', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_stock(self, obj):
        total = sum(
            (level.quantity for level in obj.stock_levels.all()),
            Decimal('0'),
        )
        return float(total)

    def _avg_stock(self):
        if 'avg_stock' not in self.context:
            request = self.context.get('request')
            company = getattr(getattr(request, 'user', None), 'company', None)
            if company is None:
                self.context['avg_stock'] = 0
            else:
                qtys = StockLevel.objects.filter(
                    product__company=company, product__is_active=True,
                ).values_list('quantity', flat=True)
                self.context['avg_stock'] = average_positive_quantity(qtys)
        return self.context['avg_stock']

    def get_stock_status(self, obj):
        total = sum(
            (level.quantity for level in obj.stock_levels.all()),
            Decimal('0'),
        )
        return classify_stock(total, obj.min_stock, self._avg_stock())

    def get_tags(self, obj):
        tags = getattr(obj, '_prefetched_objects_cache', {}).get('product_tags')
        iterable = tags if tags is not None else obj.product_tags.all()
        return [
            {'id': pt.tag_id, 'name': pt.tag.name, 'color': pt.tag.color}
            for pt in iterable
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        inst = self.instance
        sale = Decimal(str(attrs.get('sale_price', inst.sale_price if inst else 0)))
        dtype = attrs.get(
            'wholesale_discount_type',
            inst.wholesale_discount_type if inst else Product.WholesaleDiscountType.PRICE,
        )
        dval = attrs.get(
            'wholesale_discount_value',
            inst.wholesale_discount_value if inst else None,
        )
        wprice = attrs.get(
            'wholesale_price',
            inst.wholesale_price if inst else None,
        )
        if dtype == Product.WholesaleDiscountType.PERCENT and dval is not None and Decimal(str(dval)) > 0:
            attrs['wholesale_price'] = (
                sale * (Decimal('100') - Decimal(str(dval))) / Decimal('100')
            ).quantize(Decimal('0.01'))
        elif dtype == Product.WholesaleDiscountType.AMOUNT and dval is not None and Decimal(str(dval)) > 0:
            computed = sale - Decimal(str(dval))
            attrs['wholesale_price'] = computed.quantize(Decimal('0.01')) if computed > 0 else None
        elif wprice is not None and Decimal(str(wprice or 0)) > 0:
            attrs['wholesale_price'] = Decimal(str(wprice))
        elif 'wholesale_price' in attrs or 'wholesale_discount_value' in attrs:
            if not wprice and not dval:
                attrs['wholesale_price'] = None
        return attrs

    def validate_warehouse(self, warehouse):
        if warehouse is None:
            return warehouse
        request = self.context['request']
        if warehouse.branch.company_id != request.user.company_id:
            raise serializers.ValidationError('Entrepôt invalide.')
        return warehouse

    def _sync_tags(self, product, tag_ids):
        if tag_ids is None:
            return
        tags = Tag.objects.filter(company=product.company, id__in=tag_ids)
        ProductTag.objects.filter(product=product).exclude(
            tag_id__in=tags.values_list('id', flat=True)
        ).delete()
        for tag in tags:
            ProductTag.objects.get_or_create(product=product, tag=tag)

    def _apply_stock(self, product, *, quantity, warehouse, user, notes):
        if quantity is None:
            ensure_product_stock(product, warehouse=warehouse, user=user, notes=notes)
            return
        try:
            qty = Decimal(str(quantity))
        except (InvalidOperation, TypeError):
            raise serializers.ValidationError({'stock_quantity': 'Quantité invalide.'}) from None
        try:
            ensure_product_stock(
                product, warehouse=warehouse, quantity=qty, user=user, notes=notes,
            )
        except StockError as exc:
            raise serializers.ValidationError({'stock_quantity': str(exc)}) from exc

    def create(self, validated_data):
        barcodes_data = validated_data.pop('barcodes', [])
        tag_ids = validated_data.pop('tag_ids', None)
        initial_stock = validated_data.pop('initial_stock', None)
        validated_data.pop('stock_quantity', None)
        warehouse = validated_data.pop('warehouse', None)
        product = Product.objects.create(**validated_data)
        for barcode_data in barcodes_data:
            Barcode.objects.create(product=product, **barcode_data)
        self._sync_tags(product, tag_ids)
        request = self.context.get('request')
        user = request.user if request else None
        qty = initial_stock if initial_stock is not None else Decimal('0')
        self._apply_stock(
            product, quantity=qty, warehouse=warehouse, user=user, notes='Stock initial',
        )
        return product

    def update(self, instance, validated_data):
        barcodes_data = validated_data.pop('barcodes', None)
        tag_ids = validated_data.pop('tag_ids', None)
        stock_quantity = validated_data.pop('stock_quantity', None)
        validated_data.pop('initial_stock', None)
        warehouse = validated_data.pop('warehouse', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if barcodes_data is not None:
            instance.barcodes.all().delete()
            for barcode_data in barcodes_data:
                Barcode.objects.create(product=instance, **barcode_data)
        self._sync_tags(instance, tag_ids)

        request = self.context.get('request')
        user = request.user if request else None
        if stock_quantity is not None:
            self._apply_stock(
                instance,
                quantity=stock_quantity,
                warehouse=warehouse,
                user=user,
                notes='Mise à jour stock produit',
            )
        else:
            ensure_product_stock(instance, warehouse=warehouse, user=user)
        return instance
