import secrets
import string

from django.conf import settings
from django.db import models
from django.utils.text import slugify

from common.models import TimeStampedModel


class ShopOrderStatus(models.TextChoices):
    # Cycle B2B / grossiste
    PENDING = 'pending', 'En attente'
    VALIDATED = 'validated', 'Validée'
    PREPARING = 'preparing', 'Préparation'
    READY = 'ready', 'Prête'
    DELIVERED = 'delivered', 'Livrée'
    COMPLETED = 'completed', 'Terminée'
    CANCELLED = 'cancelled', 'Annulée'
    # Anciens statuts (compat lecture)
    RECEIVED = 'received', 'Reçue'
    ACCEPTED = 'accepted', 'Acceptée'
    SHIPPED = 'shipped', 'Expédiée'
    DELIVERING = 'delivering', 'En livraison'
    REFUSED = 'refused', 'Refusée'


class DeliveryMethod(models.TextChoices):
    PICKUP = 'pickup', 'Retrait en magasin'
    HOME = 'home', 'Livraison à domicile'
    EXPRESS = 'express', 'Livraison express'
    RELAY = 'relay', 'Point relais'


class ShopPaymentMethod(models.TextChoices):
    COD = 'cod', 'Paiement à la livraison'
    WAVE = 'wave', 'Wave'
    ORANGE_MONEY = 'orange_money', 'Orange Money'
    MTN_MONEY = 'mtn_money', 'MTN Money'
    CARD = 'card', 'Carte bancaire'
    MIXED = 'mixed', 'Paiement mixte'


def generate_shop_code(length=8):
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(30):
        code = ''.join(secrets.choice(alphabet) for _ in range(length))
        if not OnlineShop.objects.filter(code=code).exists():
            return code
    return secrets.token_hex(4).upper()


class OnlineShop(TimeStampedModel):
    """Une seule boutique en ligne par entreprise, liée à la boutique principale."""
    company = models.OneToOneField(
        'companies.Company', on_delete=models.CASCADE, related_name='online_shop',
    )
    fulfillment_branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.PROTECT,
        related_name='fulfilled_online_shops',
    )
    slug = models.SlugField(max_length=80, unique=True)
    code = models.CharField(max_length=16, unique=True)
    enabled = models.BooleanField(default=True)
    name = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='online_shops/logos/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='online_shops/covers/', blank=True, null=True)
    primary_color = models.CharField(max_length=20, default='#0E8A9A')
    secondary_color = models.CharField(max_length=20, default='#0B2A3A')
    phone = models.CharField(max_length=30, blank=True)
    whatsapp = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    maps_url = models.URLField(blank=True)
    hours = models.CharField(max_length=200, blank=True)
    social_facebook = models.URLField(blank=True)
    social_instagram = models.URLField(blank=True)
    social_tiktok = models.URLField(blank=True)
    terms_of_sale = models.TextField(blank=True)
    return_policy = models.TextField(blank=True)
    show_prices = models.BooleanField(default=True)
    show_stock = models.BooleanField(default=True)
    # Paiement vendeur
    class PaymentTiming(models.TextChoices):
        ON_DELIVERY = 'on_delivery', 'À la livraison'
        BEFORE_DELIVERY = 'before_delivery', 'Avant livraison'
        BOTH = 'both', 'Les deux (choix client)'

    payment_timing = models.CharField(
        max_length=20,
        choices=PaymentTiming.choices,
        default=PaymentTiming.ON_DELIVERY,
    )
    wave_number = models.CharField(max_length=30, blank=True)
    orange_money_number = models.CharField(max_length=30, blank=True)
    accept_cod = models.BooleanField(default=True)
    accept_wave = models.BooleanField(default=True)
    accept_orange_money = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name or self.slug

    @property
    def public_path(self):
        return f'/shop/{self.slug}'

    @property
    def short_path(self):
        return f'/s/{self.code}'


class ShopOrder(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='shop_orders'
    )
    branch = models.ForeignKey(
        'branches.Branch', on_delete=models.PROTECT, related_name='shop_orders'
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shop_orders',
    )
    reference = models.CharField(max_length=50)
    status = models.CharField(
        max_length=20, choices=ShopOrderStatus.choices, default=ShopOrderStatus.PENDING
    )
    stock_reserved = models.BooleanField(default=False)
    stock_deducted = models.BooleanField(default=False)
    status_history = models.JSONField(default=list, blank=True)
    client_note = models.TextField(blank=True)
    adjustment_note = models.TextField(blank=True)
    requires_client_approval = models.BooleanField(default=False)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30)
    whatsapp = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    commune = models.CharField(max_length=100, blank=True)
    quartier = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    landmark = models.CharField(max_length=200, blank=True)
    comment = models.TextField(blank=True)
    delivery_method = models.CharField(
        max_length=20, choices=DeliveryMethod.choices, default=DeliveryMethod.HOME
    )
    payment_method = models.CharField(
        max_length=20, choices=ShopPaymentMethod.choices, default=ShopPaymentMethod.COD
    )
    payment_status = models.CharField(
        max_length=20,
        choices=[
            ('unpaid', 'Non payé'),
            ('pending', 'En attente de confirmation'),
            ('paid', 'Payé'),
        ],
        default='unpaid',
    )
    payment_reference = models.CharField(max_length=100, blank=True)
    sale = models.OneToOneField(
        'sales.Sale',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shop_order',
    )
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    delivery_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['company', 'reference']

    def __str__(self):
        return self.reference


class ShopOrderItem(models.Model):
    order = models.ForeignKey(ShopOrder, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        'products.Product', on_delete=models.PROTECT, related_name='shop_order_items'
    )
    product_name = models.CharField(max_length=300)
    sku = models.CharField(max_length=100, blank=True)
    barcode = models.CharField(max_length=100, blank=True)
    packaging = models.CharField(max_length=50, blank=True)
    location_hint = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f'{self.product_name} x {self.quantity}'


class ProductReview(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='product_reviews',
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='reviews',
    )
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviews',
    )
    order = models.ForeignKey(
        ShopOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviews',
    )
    author_name = models.CharField(max_length=120)
    author_phone = models.CharField(max_length=30, blank=True)
    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField(blank=True)
    photo = models.ImageField(upload_to='reviews/', blank=True, null=True)
    merchant_reply = models.TextField(blank=True)
    is_visible = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']


class ProductQuestion(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='product_questions',
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='questions',
    )
    author_name = models.CharField(max_length=120)
    author_phone = models.CharField(max_length=30, blank=True)
    question = models.TextField()
    answer = models.TextField(blank=True)
    answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='answered_questions',
    )
    answered_at = models.DateTimeField(null=True, blank=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']


class ProductFavorite(TimeStampedModel):
    company = models.ForeignKey(
        'companies.Company', on_delete=models.CASCADE, related_name='product_favorites',
    )
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='favorites',
    )
    phone = models.CharField(max_length=30, db_index=True)
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='favorites',
    )

    class Meta:
        unique_together = ['company', 'product', 'phone']
        ordering = ['-created_at']


def ensure_online_shop_for_company(company, branch=None, extras=None):
    """Create OnlineShop if missing, using main branch as fulfillment."""
    from branches.models import Branch

    extras = extras or {}
    try:
        shop = company.online_shop
        updatable = {
            'wave_number', 'orange_money_number', 'payment_timing', 'whatsapp', 'phone',
            'address', 'name', 'description', 'hours', 'accept_cod', 'accept_wave',
            'accept_orange_money',
        }
        changed = []
        for key, value in extras.items():
            if key not in updatable or not hasattr(shop, key):
                continue
            if value is None or value == '':
                continue
            if getattr(shop, key) != value:
                setattr(shop, key, value)
                changed.append(key)
        if changed:
            shop.save(update_fields=changed + ['updated_at'])
        return shop
    except OnlineShop.DoesNotExist:
        pass

    main = branch or Branch.objects.filter(company=company, is_main=True).first()
    if not main:
        main = Branch.objects.filter(company=company).order_by('id').first()
    if not main:
        return None

    base = slugify(extras.get('slug') or company.slug or company.name) or 'boutique'
    slug = base
    n = 1
    while OnlineShop.objects.filter(slug=slug).exists():
        n += 1
        slug = f'{base}-{n}'

    shop = OnlineShop.objects.create(
        company=company,
        fulfillment_branch=main,
        slug=slug,
        code=generate_shop_code(),
        enabled=True,
        name=extras.get('name') or company.name,
        description=extras.get('description') or main.shop_description or '',
        whatsapp=extras.get('whatsapp') or main.shop_whatsapp or company.phone or '',
        phone=extras.get('phone') or main.phone or company.phone or '',
        address=extras.get('address') or main.address or company.address or '',
        hours=extras.get('hours') or main.shop_hours or '',
        show_prices=main.shop_show_prices,
        show_stock=main.shop_show_stock,
        cover_image=main.shop_banner or None,
        payment_timing=extras.get('payment_timing') or OnlineShop.PaymentTiming.ON_DELIVERY,
        wave_number=extras.get('wave_number') or '',
        orange_money_number=extras.get('orange_money_number') or '',
        accept_cod=extras.get('accept_cod', True),
        accept_wave=extras.get('accept_wave', True),
        accept_orange_money=extras.get('accept_orange_money', True),
    )
    return shop
