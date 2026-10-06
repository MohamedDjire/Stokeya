from decimal import Decimal

from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone

from inventory.models import MovementType
from inventory.services import (
    StockError,
    release_reservation,
    reserve_stock,
    stock_exit,
)
from products.models import Barcode, Product
from warehouses.models import Warehouse

from .models import (
    OnlineShop,
    ProductFavorite,
    ProductQuestion,
    ProductReview,
    ShopOrder,
    ShopOrderItem,
    ShopOrderStatus,
    ShopPaymentMethod,
)


class ShopError(Exception):
    pass


ALLOWED_TRANSITIONS = {
    ShopOrderStatus.PENDING: {ShopOrderStatus.VALIDATED, ShopOrderStatus.CANCELLED},
    ShopOrderStatus.VALIDATED: {ShopOrderStatus.PREPARING, ShopOrderStatus.CANCELLED},
    ShopOrderStatus.PREPARING: {ShopOrderStatus.READY, ShopOrderStatus.CANCELLED},
    ShopOrderStatus.READY: {ShopOrderStatus.DELIVERED, ShopOrderStatus.CANCELLED},
    ShopOrderStatus.DELIVERED: {ShopOrderStatus.COMPLETED},
    ShopOrderStatus.COMPLETED: set(),
    ShopOrderStatus.CANCELLED: set(),
    ShopOrderStatus.RECEIVED: {ShopOrderStatus.VALIDATED, ShopOrderStatus.ACCEPTED, ShopOrderStatus.CANCELLED},
    ShopOrderStatus.ACCEPTED: {ShopOrderStatus.PREPARING, ShopOrderStatus.CANCELLED},
    ShopOrderStatus.SHIPPED: {ShopOrderStatus.DELIVERED, ShopOrderStatus.READY, ShopOrderStatus.CANCELLED},
    ShopOrderStatus.DELIVERING: {ShopOrderStatus.DELIVERED},
    ShopOrderStatus.REFUSED: set(),
}


def get_online_shop(slug=None, code=None):
    from companies.limits import company_has_feature
    from companies.plans import FEATURE_ONLINE_SHOP
    from .models import OnlineShop

    qs = OnlineShop.objects.filter(enabled=True).select_related('company', 'fulfillment_branch')
    shop = None
    if slug:
        shop = qs.filter(slug=slug).first()
    if shop is None and code:
        shop = qs.filter(code=code).first()
    if shop is None:
        return None
    # Pack Starter (3000 F) : pas de boutique en ligne publique
    if not company_has_feature(shop.company, FEATURE_ONLINE_SHOP):
        return None
    return shop


def get_shop_branch(slug=None, code=None):
    shop = get_online_shop(slug=slug, code=code)
    return shop.fulfillment_branch if shop else None


def get_shop_warehouse(branch):
    return (
        Warehouse.objects.filter(branch=branch, is_active=True, is_pos_stock=True)
        .order_by('-is_default', 'id').first()
        or Warehouse.objects.filter(branch=branch, is_active=True)
        .order_by('-is_default', 'id').first()
    )


def _primary_barcode(product):
    bc = product.barcodes.filter(is_primary=True).first() or product.barcodes.first()
    return bc.code if bc else ''


def _location_hint(product, warehouse):
    level = product.stock_levels.filter(warehouse=warehouse).select_related('location').first()
    if level and getattr(level, 'location', None):
        return level.location.code
    batch = product.batches.filter(warehouse=warehouse, location__isnull=False).select_related('location').first()
    if batch and batch.location_id:
        return batch.location.code
    return ''


def get_shop_products(online_shop, search=None, category_id=None, sort=None):
    from inventory.services import average_positive_quantity, classify_stock

    branch = online_shop.fulfillment_branch
    warehouse = get_shop_warehouse(branch)
    products = Product.objects.filter(
        company=online_shop.company, is_active=True,
    ).select_related('category', 'brand', 'unit').prefetch_related('barcodes', 'stock_levels')

    if search:
        products = products.filter(
            Q(name__icontains=search) | Q(sku__icontains=search) | Q(barcodes__code__icontains=search)
        ).distinct()
    if category_id:
        products = products.filter(category_id=category_id)
    products = list(products.order_by('-created_at' if sort == 'newest' else 'name'))

    qty_for_avg = []
    for product in products:
        if warehouse:
            level = next(
                (lv for lv in product.stock_levels.all() if lv.warehouse_id == warehouse.id),
                None,
            )
            qty_for_avg.append(level.quantity if level else Decimal('0'))
        else:
            qty_for_avg.append(Decimal('0'))
    avg_qty = average_positive_quantity(qty_for_avg)

    rows = []
    for product, raw_qty in zip(products, qty_for_avg):
        stock_qty = reserved = available = None
        if warehouse:
            level = next(
                (lv for lv in product.stock_levels.all() if lv.warehouse_id == warehouse.id),
                None,
            )
            if level:
                stock_qty = level.quantity
                reserved = level.reserved_quantity or 0
                available = level.available
            else:
                stock_qty = available = Decimal('0')
                reserved = Decimal('0')
        status = classify_stock(raw_qty, product.min_stock, avg_qty)
        rows.append({
            'id': product.id,
            'name': product.name,
            'description': product.description,
            'image': product.image.url if product.image else None,
            'category': product.category.name if product.category else None,
            'category_id': product.category_id,
            'brand': product.brand.name if product.brand else None,
            'sku': product.sku or '',
            'barcode': _primary_barcode(product),
            'packaging': product.packaging or (product.unit.abbreviation if product.unit_id else 'unite'),
            'sale_price': product.sale_price if online_shop.show_prices else None,
            'wholesale_price': product.resolved_wholesale_unit_price() if online_shop.show_prices else None,
            'wholesale_min_qty': product.wholesale_min_qty,
            'tax_rate': product.tax_rate,
            'min_stock': product.min_stock,
            'stock_status': status,
            'in_stock': available is None or available > 0,
            'stock_quantity': stock_qty if online_shop.show_stock else None,
            'available_quantity': available if online_shop.show_stock else None,
            'reserved_quantity': reserved if online_shop.show_stock else None,
            'location_hint': _location_hint(product, warehouse) if warehouse else '',
        })
    return rows


def lookup_product(online_shop, code):
    code = (code or '').strip()
    if not code:
        raise ShopError('Reference ou code-barres requis.')
    company = online_shop.company
    product = Product.objects.filter(company=company, is_active=True, sku__iexact=code).first()
    if not product:
        barcode = Barcode.objects.filter(
            code__iexact=code, product__company=company, product__is_active=True,
        ).select_related('product').first()
        product = barcode.product if barcode else None
    if not product:
        raise ShopError(f'Produit "{code}" introuvable.')
    for row in get_shop_products(online_shop):
        if row['id'] == product.id:
            return row
    return {
        'id': product.id, 'name': product.name, 'sku': product.sku,
        'barcode': _primary_barcode(product), 'sale_price': product.sale_price,
        'wholesale_price': product.resolved_wholesale_unit_price(),
        'wholesale_min_qty': product.wholesale_min_qty,
        'packaging': product.packaging,
    }


def get_shop_home(online_shop):
    from categories.models import Category
    all_products = get_shop_products(online_shop)
    categories = list(
        Category.objects.filter(company=online_shop.company, is_active=True)
        .order_by('name').values('id', 'name')[:40]
    )
    newest = get_shop_products(online_shop, sort='newest')[:12]
    return {
        'shop': {
            'name': online_shop.name, 'description': online_shop.description,
            'logo': (
                online_shop.logo.url if online_shop.logo
                else (online_shop.company.logo.url if online_shop.company.logo else None)
            ),
            'cover_image': online_shop.cover_image.url if online_shop.cover_image else None,
            'primary_color': online_shop.primary_color, 'secondary_color': online_shop.secondary_color,
            'whatsapp': online_shop.whatsapp, 'phone': online_shop.phone, 'hours': online_shop.hours,
            'payment_timing': online_shop.payment_timing,
            'wave_number': online_shop.wave_number,
            'orange_money_number': online_shop.orange_money_number,
            'accept_cod': online_shop.accept_cod,
            'accept_wave': online_shop.accept_wave,
            'accept_orange_money': online_shop.accept_orange_money,
        },
        'categories': categories,
        'newest': newest,
        'bestsellers': all_products[:12],
        'promotions': [p for p in all_products if p.get('wholesale_price')][:12],
    }


def _map_shop_payment_method(method):
    from sales.models import PaymentMethod
    if method == ShopPaymentMethod.COD:
        return PaymentMethod.CASH
    if method in (
        ShopPaymentMethod.WAVE, ShopPaymentMethod.ORANGE_MONEY, ShopPaymentMethod.MTN_MONEY,
    ):
        return PaymentMethod.MOBILE_MONEY
    if method == ShopPaymentMethod.CARD:
        return PaymentMethod.CARD
    return PaymentMethod.OTHER


def _validate_payment_choice(online_shop, payment_method):
    timing = online_shop.payment_timing
    method = payment_method or ShopPaymentMethod.COD

    if method == ShopPaymentMethod.COD:
        if not online_shop.accept_cod:
            raise ShopError('Le paiement à la livraison n\'est pas accepté.')
        if timing == OnlineShop.PaymentTiming.BEFORE_DELIVERY:
            raise ShopError('Cette boutique exige un paiement avant la livraison (Wave / Orange Money).')
    elif method == ShopPaymentMethod.WAVE:
        if not online_shop.accept_wave:
            raise ShopError('Wave n\'est pas accepté.')
        if not online_shop.wave_number:
            raise ShopError('Numéro Wave du vendeur non configuré.')
    elif method == ShopPaymentMethod.ORANGE_MONEY:
        if not online_shop.accept_orange_money:
            raise ShopError('Orange Money n\'est pas accepté.')
        if not online_shop.orange_money_number:
            raise ShopError('Numéro Orange Money du vendeur non configuré.')
    else:
        raise ShopError('Mode de paiement non supporté.')
    return method


def create_sale_from_shop_order(order, user=None):
    """Crée une Sale liée à la commande boutique (sans resortir le stock)."""
    from sales.models import Payment, PaymentStatus, Sale, SaleItem, SaleStatus
    from sales.services import _generate_reference

    if order.sale_id:
        return order.sale

    client_ref = f'shop-{order.id}'
    existing = Sale.objects.filter(company=order.company, client_reference=client_ref).first()
    if existing:
        order.sale = existing
        order.save(update_fields=['sale', 'updated_at'])
        return existing

    method = _map_shop_payment_method(order.payment_method)
    is_paid = order.payment_status == 'paid' or (
        order.payment_method == ShopPaymentMethod.COD
        and order.status in (ShopOrderStatus.DELIVERED, ShopOrderStatus.COMPLETED)
    )
    if order.payment_method == ShopPaymentMethod.COD and order.status in (
        ShopOrderStatus.DELIVERED, ShopOrderStatus.COMPLETED,
    ) and order.payment_status != 'paid':
        order.payment_status = 'paid'
        order.save(update_fields=['payment_status', 'updated_at'])
        is_paid = True

    sale = Sale.objects.create(
        company=order.company,
        branch=order.branch,
        customer=order.customer,
        seller=user,
        reference=_generate_reference(order.company),
        status=SaleStatus.COMPLETED,
        payment_status=PaymentStatus.PAID if is_paid else PaymentStatus.UNPAID,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        discount_amount=order.discount_amount,
        total=order.total,
        notes=f'Commande boutique {order.reference}',
        client_reference=client_ref,
    )
    for item in order.items.select_related('product').all():
        SaleItem.objects.create(
            sale=sale,
            product=item.product,
            quantity=item.quantity,
            unit_price=item.unit_price,
            tax_rate=item.tax_rate,
            discount=item.discount,
            total=item.total,
        )
    Payment.objects.create(
        sale=sale,
        method=method,
        amount=order.total,
        reference=order.payment_reference or order.reference,
        status='completed' if is_paid else 'pending',
    )
    order.sale = sale
    order.save(update_fields=['sale', 'updated_at'])
    return sale


def mark_order_paid(order, user=None, payment_reference=''):
    if order.payment_status == 'paid':
        return order
    order.payment_status = 'paid'
    if payment_reference:
        order.payment_reference = payment_reference
    order.save(update_fields=['payment_status', 'payment_reference', 'updated_at'])
    _append_history(order, order.status, user=user, note='Paiement confirmé')
    order.save(update_fields=['status_history', 'updated_at'])
    if order.sale_id:
        from sales.models import PaymentStatus
        sale = order.sale
        sale.payment_status = PaymentStatus.PAID
        sale.save(update_fields=['payment_status'])
        sale.payments.update(status='completed')
    elif order.status in (ShopOrderStatus.DELIVERED, ShopOrderStatus.COMPLETED):
        create_sale_from_shop_order(order, user=user)
    return order


def _generate_order_reference(company):
    today = timezone.now().strftime('%Y%m%d')
    prefix = f'CMD-{today}-'
    last = ShopOrder.objects.filter(company=company, reference__startswith=prefix).aggregate(Max('reference'))['reference__max']
    num = int(last.split('-')[-1]) + 1 if last else 1
    return f'{prefix}{num:04d}'


def _append_history(order, status, user=None, note=''):
    history = list(order.status_history or [])
    history.append({
        'status': status, 'at': timezone.now().isoformat(),
        'by': user.get_full_name() if user else 'Systeme', 'note': note,
    })
    order.status_history = history


def _line_price(product, quantity):
    return product.unit_price_for_qty(quantity)


@transaction.atomic
def create_shop_order(online_shop, items_data, customer_data, **extra):
    if not items_data:
        raise ShopError('La commande doit contenir au moins un article.')
    company = online_shop.company
    branch = online_shop.fulfillment_branch
    if not branch or not getattr(branch, 'is_main', True):
        from branches.models import Branch
        branch = Branch.objects.filter(company=company, is_main=True).first() or branch
    warehouse = get_shop_warehouse(branch)
    if not warehouse:
        raise ShopError('Aucun entrepot configure pour la boutique principale.')

    payment_method = _validate_payment_choice(
        online_shop, extra.get('payment_method') or ShopPaymentMethod.COD,
    )
    payment_reference = (extra.get('payment_reference') or customer_data.get('payment_reference') or '').strip()
    if payment_method == ShopPaymentMethod.COD:
        payment_status = 'unpaid'
    else:
        payment_status = 'pending'
        if online_shop.payment_timing == OnlineShop.PaymentTiming.BEFORE_DELIVERY and not payment_reference:
            # Référence optionnelle : le client peut indiquer le n° de transaction
            pass

    phone = (customer_data.get('phone') or '').strip()
    full_name = f"{customer_data.get('first_name', '')} {customer_data.get('last_name', '')}".strip()
    customer = None
    if phone:
        from customers.services import upsert_customer_from_order
        customer = upsert_customer_from_order(
            company, phone=phone, name=full_name or phone,
            email=customer_data.get('email', ''), address=customer_data.get('address', ''),
            city=customer_data.get('city', ''), commune=customer_data.get('commune', ''),
            quartier=customer_data.get('quartier', ''), landmark=customer_data.get('landmark', ''),
            whatsapp=customer_data.get('whatsapp', '') or phone,
        )

    subtotal = tax_amount = Decimal('0')
    order_items = []
    for item in items_data:
        try:
            product = Product.objects.get(id=item['product_id'], company=company, is_active=True)
        except Product.DoesNotExist:
            raise ShopError(f"Produit {item.get('product_id')} introuvable.")
        quantity = Decimal(str(item['quantity']))
        if quantity <= 0:
            raise ShopError('Quantite invalide.')
        level = product.stock_levels.filter(warehouse=warehouse).first()
        available = level.available if level else Decimal('0')
        if available < quantity:
            raise ShopError(f'Stock insuffisant pour {product.name} (disponible {available}).')
        unit_price = Decimal(str(item.get('unit_price', _line_price(product, quantity))))
        discount = Decimal(str(item.get('discount', 0) or 0))
        tax_rate = Decimal(str(item.get('tax_rate', product.tax_rate or 0)))
        line_ht = (unit_price * quantity) - discount
        line_tax = line_ht * tax_rate / Decimal('100')
        line_total = line_ht + line_tax
        subtotal += line_ht
        tax_amount += line_tax
        order_items.append({
            'product': product, 'product_name': product.name, 'sku': product.sku or '',
            'barcode': _primary_barcode(product), 'packaging': product.packaging or '',
            'location_hint': _location_hint(product, warehouse), 'quantity': quantity,
            'unit_price': unit_price, 'discount': discount, 'tax_rate': tax_rate, 'total': line_total,
        })

    delivery_fee = Decimal(str(extra.get('delivery_fee', 0) or 0))
    discount_amount = Decimal(str(extra.get('discount_amount', 0) or 0))
    total = max(Decimal('0'), subtotal + tax_amount + delivery_fee - discount_amount)

    order = ShopOrder.objects.create(
        company=company, branch=branch, customer=customer,
        reference=_generate_order_reference(company), status=ShopOrderStatus.PENDING,
        first_name=customer_data.get('first_name', ''), last_name=customer_data.get('last_name', ''),
        phone=phone, whatsapp=customer_data.get('whatsapp', ''), email=customer_data.get('email', ''),
        city=customer_data.get('city', ''), commune=customer_data.get('commune', ''),
        quartier=customer_data.get('quartier', ''), address=customer_data.get('address', ''),
        landmark=customer_data.get('landmark', ''), comment=customer_data.get('comment', ''),
        client_note=customer_data.get('comment', '') or customer_data.get('notes', ''),
        delivery_method=extra.get('delivery_method') or 'home',
        payment_method=payment_method,
        payment_status=payment_status,
        payment_reference=payment_reference,
        subtotal=subtotal, tax_amount=tax_amount, delivery_fee=delivery_fee,
        discount_amount=discount_amount, total=total, stock_reserved=False, stock_deducted=False,
    )
    _append_history(order, ShopOrderStatus.PENDING, note='Commande creee')
    order.save(update_fields=['status_history'])
    for item in order_items:
        ShopOrderItem.objects.create(order=order, **item)

    order_id = order.pk

    def _notify_staff():
        from notifications.services import notify_new_shop_order
        try:
            fresh = ShopOrder.objects.prefetch_related('items').get(pk=order_id)
            notify_new_shop_order(fresh)
        except Exception:
            # La commande est déjà créée : une notif manquante ne doit pas bloquer.
            pass

    transaction.on_commit(_notify_staff)
    return order


def _reserve_order(order, user=None):
    if order.stock_reserved:
        return
    warehouse = get_shop_warehouse(order.branch)
    if not warehouse:
        raise ShopError('Aucun entrepot pour reserver le stock.')
    for item in order.items.select_related('product'):
        try:
            reserve_stock(item.product, warehouse, item.quantity)
        except StockError as exc:
            raise ShopError(str(exc)) from exc
    order.stock_reserved = True
    order.save(update_fields=['stock_reserved', 'updated_at'])


def _release_order_reservation(order):
    if not order.stock_reserved or order.stock_deducted:
        return
    warehouse = get_shop_warehouse(order.branch)
    if not warehouse:
        return
    for item in order.items.select_related('product'):
        release_reservation(item.product, warehouse, item.quantity)
    order.stock_reserved = False
    order.save(update_fields=['stock_reserved', 'updated_at'])


def _deduct_order_stock(order, user=None):
    if order.stock_deducted:
        return
    warehouse = get_shop_warehouse(order.branch)
    if not warehouse:
        raise ShopError('Aucun entrepot pour sortir le stock.')
    for item in order.items.select_related('product'):
        try:
            stock_exit(
                product=item.product, warehouse=warehouse, quantity=item.quantity, user=user,
                notes=f'Commande boutique {order.reference}', reference=order.reference,
                movement_type=MovementType.SALE, from_reservation=order.stock_reserved,
            )
        except StockError as exc:
            raise ShopError(str(exc)) from exc
    order.stock_deducted = True
    order.stock_reserved = False
    order.save(update_fields=['stock_deducted', 'stock_reserved', 'updated_at'])


@transaction.atomic
def update_order_status(order, new_status, user=None):
    if new_status == ShopOrderStatus.ACCEPTED:
        new_status = ShopOrderStatus.VALIDATED
    if new_status == ShopOrderStatus.RECEIVED:
        new_status = ShopOrderStatus.PENDING
    if new_status in (ShopOrderStatus.SHIPPED, ShopOrderStatus.DELIVERING):
        new_status = ShopOrderStatus.READY
    if new_status == ShopOrderStatus.REFUSED:
        new_status = ShopOrderStatus.CANCELLED

    allowed = ALLOWED_TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        # legacy soft allow
        legacy_ok = order.status in (
            ShopOrderStatus.RECEIVED, ShopOrderStatus.ACCEPTED, ShopOrderStatus.SHIPPED, ShopOrderStatus.DELIVERING,
        )
        if not legacy_ok:
            raise ShopError(f'Transition invalide : {order.get_status_display()} -> {new_status}.')

    if new_status == ShopOrderStatus.PREPARING:
        _reserve_order(order, user)
    if new_status == ShopOrderStatus.CANCELLED:
        _release_order_reservation(order)
    if new_status in (ShopOrderStatus.DELIVERED, ShopOrderStatus.COMPLETED):
        try:
            shop = order.company.online_shop
        except OnlineShop.DoesNotExist:
            shop = None
        if (
            shop
            and shop.payment_timing == OnlineShop.PaymentTiming.BEFORE_DELIVERY
            and order.payment_method != ShopPaymentMethod.COD
            and order.payment_status != 'paid'
        ):
            raise ShopError('Confirmez le paiement avant de marquer la commande comme livrée.')
        if not order.stock_reserved and not order.stock_deducted:
            _reserve_order(order, user)
        _deduct_order_stock(order, user)

    order.status = new_status
    _append_history(order, new_status, user=user)
    order.save(update_fields=['status', 'status_history', 'updated_at'])

    if new_status in (ShopOrderStatus.DELIVERED, ShopOrderStatus.COMPLETED):
        create_sale_from_shop_order(order, user=user)
        if new_status == ShopOrderStatus.DELIVERED and order.customer_id:
            from customers.services import award_loyalty_points, refresh_customer_stats
            award_loyalty_points(
                order.customer, order.total, reference=order.reference,
                reason='Commande boutique', user=user,
            )
            refresh_customer_stats(order.customer)
    return order


@transaction.atomic
def update_order_items(order, items_data, user=None, notify_client=True):
    if order.status not in (
        ShopOrderStatus.PENDING, ShopOrderStatus.VALIDATED, ShopOrderStatus.PREPARING,
        ShopOrderStatus.RECEIVED, ShopOrderStatus.ACCEPTED,
    ):
        raise ShopError('Cette commande ne peut plus etre modifiee.')
    was_reserved = order.stock_reserved
    if was_reserved:
        _release_order_reservation(order)
    warehouse = get_shop_warehouse(order.branch)
    order.items.all().delete()
    subtotal = tax_amount = Decimal('0')
    for item in items_data:
        if Decimal(str(item.get('quantity', 0))) <= 0:
            continue
        product = Product.objects.get(id=item['product_id'], company=order.company)
        quantity = Decimal(str(item['quantity']))
        unit_price = Decimal(str(item.get('unit_price', product.sale_price)))
        discount = Decimal(str(item.get('discount', 0) or 0))
        tax_rate = Decimal(str(item.get('tax_rate', product.tax_rate or 0)))
        line_ht = (unit_price * quantity) - discount
        line_tax = line_ht * tax_rate / Decimal('100')
        subtotal += line_ht
        tax_amount += line_tax
        ShopOrderItem.objects.create(
            order=order, product=product, product_name=product.name, sku=product.sku or '',
            barcode=_primary_barcode(product), packaging=product.packaging or '',
            location_hint=_location_hint(product, warehouse) if warehouse else '',
            quantity=quantity, unit_price=unit_price, discount=discount, tax_rate=tax_rate,
            total=line_ht + line_tax,
        )
    order.subtotal = subtotal
    order.tax_amount = tax_amount
    order.total = subtotal + tax_amount + order.delivery_fee - order.discount_amount
    order.requires_client_approval = bool(notify_client)
    order.adjustment_note = f'Commande ajustee le {timezone.now().strftime("%d/%m/%Y %H:%M")}'
    order.save()
    if was_reserved and order.status == ShopOrderStatus.PREPARING:
        _reserve_order(order, user)
    return order


def get_picking_list(order):
    lines = [{
        'product_id': item.product_id, 'product_name': item.product_name, 'sku': item.sku,
        'barcode': item.barcode, 'packaging': item.packaging, 'quantity': str(item.quantity),
        'location': item.location_hint or '-',
    } for item in order.items.select_related('product').all()]
    lines.sort(key=lambda x: x['location'])
    return {'reference': order.reference, 'customer': f'{order.first_name} {order.last_name}'.strip(), 'status': order.status, 'lines': lines}


def track_order(reference, phone):
    order = ShopOrder.objects.filter(reference=reference.strip(), phone=phone.strip()).prefetch_related('items').first()
    if not order:
        raise ShopError('Commande introuvable.')
    return order


def create_review(*, company, product_id, rating, comment='', author_name='', author_phone='', order_id=None, photo=None):
    try:
        product = Product.objects.get(id=product_id, company=company, is_active=True)
    except Product.DoesNotExist:
        raise ShopError('Produit introuvable.')
    customer = None
    if author_phone:
        from customers.models import Customer
        customer = Customer.objects.filter(company=company, phone=author_phone).first()
    order = ShopOrder.objects.filter(company=company, id=order_id).first() if order_id else None
    return ProductReview.objects.create(
        company=company, product=product, customer=customer, order=order,
        author_name=author_name or (customer.name if customer else 'Client'),
        author_phone=author_phone or '', rating=max(1, min(5, int(rating))), comment=comment or '', photo=photo,
    )


def create_question(*, company, product_id, question, author_name='', author_phone=''):
    try:
        product = Product.objects.get(id=product_id, company=company, is_active=True)
    except Product.DoesNotExist:
        raise ShopError('Produit introuvable.')
    return ProductQuestion.objects.create(
        company=company, product=product, author_name=author_name or 'Visiteur',
        author_phone=author_phone or '', question=question, is_published=False,
    )


def answer_question(question, answer, user):
    question.answer = answer
    question.answered_by = user
    question.answered_at = timezone.now()
    question.is_published = True
    question.save()
    return question


def toggle_favorite(*, company, product_id, phone):
    try:
        product = Product.objects.get(id=product_id, company=company, is_active=True)
    except Product.DoesNotExist:
        raise ShopError('Produit introuvable.')
    phone = phone.strip()
    fav = ProductFavorite.objects.filter(company=company, product=product, phone=phone).first()
    if fav:
        fav.delete()
        return False
    from customers.models import Customer
    customer = Customer.objects.filter(company=company, phone=phone).first()
    ProductFavorite.objects.create(company=company, product=product, phone=phone, customer=customer)
    return True
