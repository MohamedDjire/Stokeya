from rest_framework import serializers

from categories.models import ProductTag, Tag
from .models import Barcode, Product, ProductBatch


class BarcodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barcode
        fields = ['id', 'code', 'is_primary']


class ProductBatchSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = ProductBatch
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'batch_number',
            'expiry_date', 'quantity', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_product(self, product):
        request = self.context['request']
        if product.company_id != request.user.company_id:
            raise serializers.ValidationError('Produit invalide.')
        return product


class ProductSerializer(serializers.ModelSerializer):
    barcodes = BarcodeSerializer(many=True, required=False)
    category_name = serializers.CharField(source='category.name', read_only=True)
    brand_name = serializers.CharField(source='brand.name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    total_stock = serializers.SerializerMethodField()
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True,
    )
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'description', 'category', 'category_name',
            'brand', 'brand_name', 'unit', 'unit_name', 'purchase_price',
            'sale_price', 'tax_rate', 'min_stock', 'max_stock', 'image',
            'track_batches', 'is_active', 'barcodes', 'total_stock',
            'tag_ids', 'tags', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_stock(self, obj):
        return sum(level.quantity for level in obj.stock_levels.all())

    def get_tags(self, obj):
        return [
            {'id': pt.tag_id, 'name': pt.tag.name, 'color': pt.tag.color}
            for pt in obj.product_tags.select_related('tag').all()
        ]

    def _sync_tags(self, product, tag_ids):
        if tag_ids is None:
            return
        tags = Tag.objects.filter(company=product.company, id__in=tag_ids)
        ProductTag.objects.filter(product=product).exclude(
            tag_id__in=tags.values_list('id', flat=True)
        ).delete()
        for tag in tags:
            ProductTag.objects.get_or_create(product=product, tag=tag)

    def create(self, validated_data):
        barcodes_data = validated_data.pop('barcodes', [])
        tag_ids = validated_data.pop('tag_ids', None)
        product = Product.objects.create(**validated_data)
        for barcode_data in barcodes_data:
            Barcode.objects.create(product=product, **barcode_data)
        self._sync_tags(product, tag_ids)
        return product

    def update(self, instance, validated_data):
        barcodes_data = validated_data.pop('barcodes', None)
        tag_ids = validated_data.pop('tag_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if barcodes_data is not None:
            instance.barcodes.all().delete()
            for barcode_data in barcodes_data:
                Barcode.objects.create(product=instance, **barcode_data)
        self._sync_tags(instance, tag_ids)
        return instance
