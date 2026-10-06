from rest_framework import serializers

from .models import (
    DeliveryMethod,
    OnlineShop,
    ProductFavorite,
    ProductQuestion,
    ProductReview,
    ShopOrder,
    ShopOrderItem,
    ShopOrderStatus,
    ShopPaymentMethod,
)


class OnlineShopSerializer(serializers.ModelSerializer):
    shop_url = serializers.SerializerMethodField()
    short_url = serializers.SerializerMethodField()
    fulfillment_branch_name = serializers.CharField(
        source='fulfillment_branch.name', read_only=True,
    )
    company_name = serializers.CharField(source='company.name', read_only=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = OnlineShop
        fields = [
            'id', 'slug', 'code', 'enabled', 'name', 'description',
            'logo', 'logo_url', 'cover_image', 'primary_color', 'secondary_color',
            'phone', 'whatsapp', 'address', 'maps_url', 'hours',
            'social_facebook', 'social_instagram', 'social_tiktok',
            'terms_of_sale', 'return_policy', 'show_prices', 'show_stock',
            'payment_timing', 'wave_number', 'orange_money_number',
            'accept_cod', 'accept_wave', 'accept_orange_money',
            'fulfillment_branch', 'fulfillment_branch_name', 'company_name',
            'shop_url', 'short_url', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'slug', 'code', 'logo_url', 'fulfillment_branch', 'fulfillment_branch_name',
            'company_name', 'shop_url', 'short_url', 'created_at', 'updated_at',
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')

        def abs_url(f):
            if not f:
                return None
            return request.build_absolute_uri(f.url) if request else f.url

        if obj.logo:
            return abs_url(obj.logo)
        if obj.company_id and obj.company.logo:
            return abs_url(obj.company.logo)
        return None

    def get_shop_url(self, obj):
        return obj.public_path

    def get_short_url(self, obj):
        return obj.short_path


class ShopInfoSerializer(serializers.ModelSerializer):
    """Public shop payload (OnlineShop)."""
    company_name = serializers.CharField(source='company.name', read_only=True)
    currency = serializers.CharField(source='company.currency', read_only=True)
    shop_slug = serializers.CharField(source='slug', read_only=True)
    shop_code = serializers.CharField(source='code', read_only=True)
    shop_description = serializers.CharField(source='description', read_only=True)
    shop_banner = serializers.ImageField(source='cover_image', read_only=True)
    shop_whatsapp = serializers.CharField(source='whatsapp', read_only=True)
    shop_hours = serializers.CharField(source='hours', read_only=True)
    shop_show_prices = serializers.BooleanField(source='show_prices', read_only=True)
    shop_show_stock = serializers.BooleanField(source='show_stock', read_only=True)
    logo = serializers.SerializerMethodField()

    class Meta:
        model = OnlineShop
        fields = [
            'id', 'name', 'slug', 'code', 'description', 'logo', 'cover_image',
            'primary_color', 'secondary_color', 'phone', 'whatsapp', 'address',
            'maps_url', 'hours', 'social_facebook', 'social_instagram', 'social_tiktok',
            'terms_of_sale', 'return_policy', 'show_prices', 'show_stock',
            'payment_timing', 'wave_number', 'orange_money_number',
            'accept_cod', 'accept_wave', 'accept_orange_money',
            'company_name', 'currency',
            # legacy aliases for existing frontends
            'shop_slug', 'shop_code', 'shop_description', 'shop_banner',
            'shop_whatsapp', 'shop_hours', 'shop_show_prices', 'shop_show_stock',
        ]

    def get_logo(self, obj):
        request = self.context.get('request')

        def abs_url(f):
            if not f:
                return None
            return request.build_absolute_uri(f.url) if request else f.url

        if obj.logo:
            return abs_url(obj.logo)
        if obj.company_id and obj.company.logo:
            return abs_url(obj.company.logo)
        return None


class ShopProductSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    image = serializers.CharField(allow_null=True)
    category = serializers.CharField(allow_null=True)
    category_id = serializers.IntegerField(allow_null=True, required=False)
    brand = serializers.CharField(allow_null=True)
    sale_price = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    wholesale_price = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True, required=False)
    wholesale_min_qty = serializers.DecimalField(max_digits=10, decimal_places=3, required=False, allow_null=True)
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    in_stock = serializers.BooleanField()
    min_stock = serializers.DecimalField(max_digits=10, decimal_places=3, required=False, allow_null=True)
    stock_status = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stock_quantity = serializers.DecimalField(max_digits=10, decimal_places=3, allow_null=True)
    available_quantity = serializers.DecimalField(max_digits=10, decimal_places=3, allow_null=True, required=False)
    reserved_quantity = serializers.DecimalField(max_digits=10, decimal_places=3, allow_null=True, required=False)
    sku = serializers.CharField(allow_blank=True, required=False)
    barcode = serializers.CharField(allow_blank=True, required=False)
    packaging = serializers.CharField(allow_blank=True, required=False)
    location_hint = serializers.CharField(allow_blank=True, required=False)


class ShopOrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)


class ShopOrderCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    customer_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    whatsapp = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    commune = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    quartier = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    address = serializers.CharField(required=False, allow_blank=True, default='')
    customer_address = serializers.CharField(required=False, allow_blank=True)
    landmark = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')
    comment = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True)
    delivery_method = serializers.CharField(required=False, default=DeliveryMethod.HOME)
    payment_method = serializers.ChoiceField(
        choices=ShopPaymentMethod.choices, required=False, default=ShopPaymentMethod.COD,
    )
    payment_reference = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    delivery_fee = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0,
    )
    discount_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, default=0,
    )
    items = ShopOrderItemInputSerializer(many=True)

    def validate(self, attrs):
        if not attrs.get('phone') and attrs.get('customer_phone'):
            attrs['phone'] = attrs['customer_phone']
        if not attrs.get('first_name') and attrs.get('customer_name'):
            parts = attrs['customer_name'].split(' ', 1)
            attrs['first_name'] = parts[0]
            if len(parts) > 1:
                attrs['last_name'] = parts[1]
        if not attrs.get('address') and attrs.get('customer_address'):
            attrs['address'] = attrs['customer_address']
        if attrs.get('notes') and not attrs.get('comment'):
            attrs['comment'] = attrs['notes']
        # Map delivery "delivery" alias from web
        dm = attrs.get('delivery_method') or 'home'
        if dm == 'delivery':
            attrs['delivery_method'] = DeliveryMethod.HOME
        elif dm == 'pickup':
            attrs['delivery_method'] = DeliveryMethod.PICKUP
        if not attrs.get('phone'):
            raise serializers.ValidationError({'phone': 'Téléphone obligatoire.'})
        if not attrs.get('first_name'):
            raise serializers.ValidationError({'first_name': 'Nom obligatoire.'})
        return attrs

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('La commande doit contenir au moins un article.')
        return items


class ShopOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopOrderItem
        fields = [
            'id', 'product', 'product_name', 'sku', 'barcode', 'packaging',
            'location_hint', 'quantity', 'unit_price', 'discount', 'tax_rate', 'total',
        ]


class ShopOrderSerializer(serializers.ModelSerializer):
    items = ShopOrderItemSerializer(many=True, read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    customer_name = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    total_quantity = serializers.SerializerMethodField()

    class Meta:
        model = ShopOrder
        fields = [
            'id', 'reference', 'branch', 'branch_name', 'customer', 'customer_name',
            'status', 'status_display', 'items_count', 'total_quantity',
            'first_name', 'last_name', 'phone', 'whatsapp', 'email', 'city', 'commune',
            'quartier', 'address', 'landmark', 'comment', 'client_note', 'adjustment_note',
            'requires_client_approval', 'delivery_method', 'payment_method',
            'payment_status', 'payment_reference', 'sale',
            'subtotal', 'delivery_fee', 'discount_amount', 'tax_amount', 'total', 'items',
            'stock_reserved', 'stock_deducted', 'status_history',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_customer_name(self, obj):
        return f'{obj.first_name} {obj.last_name}'.strip()

    def get_items_count(self, obj):
        return obj.items.count()

    def get_total_quantity(self, obj):
        return str(sum((i.quantity for i in obj.items.all()), start=0))


class ShopOrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ShopOrderStatus.choices)


class ProductReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = ProductReview
        fields = [
            'id', 'product', 'product_name', 'author_name', 'rating', 'comment',
            'photo', 'merchant_reply', 'is_visible', 'created_at',
        ]
        read_only_fields = ['id', 'merchant_reply', 'is_visible', 'created_at', 'product_name']


class ProductQuestionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = ProductQuestion
        fields = [
            'id', 'product', 'product_name', 'author_name', 'question', 'answer',
            'is_published', 'answered_at', 'created_at',
        ]
        read_only_fields = ['id', 'answer', 'is_published', 'answered_at', 'created_at', 'product_name']
