from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from companies.limits import check_can_use_online_shop
from . import services
from .models import (
    OnlineShop,
    ProductQuestion,
    ProductReview,
    ShopOrder,
    ensure_online_shop_for_company,
)
from .serializers import (
    OnlineShopSerializer,
    ProductQuestionSerializer,
    ProductReviewSerializer,
    ShopOrderCreateSerializer,
    ShopOrderSerializer,
    ShopOrderStatusUpdateSerializer,
    ShopInfoSerializer,
    ShopProductSerializer,
)


def _resolve_shop(identifier):
    return services.get_online_shop(slug=identifier) or services.get_online_shop(code=identifier)


class OnlineShopSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        from companies.limits import company_has_feature
        from companies.plans import FEATURE_ONLINE_SHOP

        shop = ensure_online_shop_for_company(request.user.company)
        if not shop:
            return Response({'detail': 'Aucune boutique principale.'}, status=400)
        data = OnlineShopSerializer(shop, context={'request': request}).data
        data['feature_available'] = company_has_feature(
            request.user.company, FEATURE_ONLINE_SHOP,
        )
        return Response(data)

    def patch(self, request):
        check_can_use_online_shop(request.user.company)
        shop = ensure_online_shop_for_company(request.user.company)
        if not shop:
            return Response({'detail': 'Aucune boutique principale.'}, status=400)
        serializer = OnlineShopSerializer(
            shop, data=request.data, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(OnlineShopSerializer(shop, context={'request': request}).data)


class ShopDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        return Response(ShopInfoSerializer(shop, context={'request': request}).data)


class ShopHomeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        data = services.get_shop_home(shop)
        # Absolue URLs pour logo / cover
        for key in ('logo', 'cover_image'):
            val = data.get('shop', {}).get(key)
            if val and isinstance(val, str) and val.startswith('/'):
                data['shop'][key] = request.build_absolute_uri(val)
        return Response(data)


class ShopProductListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        rows = services.get_shop_products(
            shop,
            search=request.query_params.get('search'),
            category_id=request.query_params.get('category'),
            sort=request.query_params.get('sort'),
        )
        return Response(ShopProductSerializer(rows, many=True).data)


class ShopProductLookupView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        code = request.query_params.get('code') or request.query_params.get('sku') or ''
        try:
            row = services.lookup_product(shop, code)
        except services.ShopError as exc:
            return Response({'detail': str(exc)}, status=404)
        return Response(ShopProductSerializer(row).data)


class ShopOrderCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)

        serializer = ShopOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            order = services.create_shop_order(
                online_shop=shop,
                items_data=data['items'],
                customer_data=data,
                delivery_method=data.get('delivery_method'),
                payment_method=data.get('payment_method'),
                payment_reference=data.get('payment_reference', ''),
                delivery_fee=data.get('delivery_fee', 0),
                discount_amount=data.get('discount_amount', 0),
            )
        except services.ShopError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response(ShopOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class ShopOrderTrackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        reference = request.query_params.get('reference', '')
        phone = request.query_params.get('phone', '')
        if not reference or not phone:
            return Response({'detail': 'reference et phone requis.'}, status=400)
        try:
            order = services.track_order(reference, phone)
        except services.ShopError as exc:
            return Response({'detail': str(exc)}, status=404)
        return Response(ShopOrderSerializer(order).data)


class ShopReviewCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        qs = ProductReview.objects.filter(
            company=shop.company, is_visible=True,
        ).select_related('product')
        product_id = request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return Response(ProductReviewSerializer(qs[:50], many=True).data)

    def post(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        try:
            review = services.create_review(
                company=shop.company,
                product_id=request.data.get('product_id'),
                rating=request.data.get('rating', 5),
                comment=request.data.get('comment', ''),
                author_name=request.data.get('author_name', ''),
                author_phone=request.data.get('author_phone', ''),
                order_id=request.data.get('order_id'),
            )
        except services.ShopError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(ProductReviewSerializer(review).data, status=201)


class ShopQuestionView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        qs = ProductQuestion.objects.filter(
            company=shop.company, is_published=True,
        ).select_related('product')
        product_id = request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return Response(ProductQuestionSerializer(qs[:50], many=True).data)

    def post(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        try:
            q = services.create_question(
                company=shop.company,
                product_id=request.data.get('product_id'),
                question=request.data.get('question', ''),
                author_name=request.data.get('author_name', ''),
                author_phone=request.data.get('author_phone', ''),
            )
        except services.ShopError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(ProductQuestionSerializer(q).data, status=201)


class ShopFavoriteView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, identifier):
        shop = _resolve_shop(identifier)
        if not shop:
            return Response({'detail': 'Boutique introuvable.'}, status=404)
        phone = request.data.get('phone', '')
        product_id = request.data.get('product_id')
        if not phone or not product_id:
            return Response({'detail': 'phone et product_id requis.'}, status=400)
        try:
            favored = services.toggle_favorite(
                company=shop.company, product_id=product_id, phone=phone,
            )
        except services.ShopError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response({'favorited': favored})


class ShopOrderViewSet(CompanyQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = ShopOrderSerializer
    queryset = ShopOrder.objects.select_related('branch', 'customer').prefetch_related('items__product')
    filterset_fields = ['status', 'branch']
    search_fields = ['reference', 'first_name', 'last_name', 'phone']
    ordering_fields = ['created_at', 'total']

    @action(detail=False, methods=['get'], url_path='pending-count')
    def pending_count(self, request):
        """Nombre de commandes boutique à traiter (badge menu)."""
        from .models import ShopOrderStatus
        count = self.get_queryset().filter(
            status__in=[ShopOrderStatus.PENDING, ShopOrderStatus.RECEIVED],
        ).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        order = self.get_object()
        serializer = ShopOrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.update_order_status(
                order, serializer.validated_data['status'], user=request.user,
            )
        except services.ShopError as exc:
            return Response({'detail': str(exc)}, status=400)
        order.refresh_from_db()
        return Response(ShopOrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        order = self.get_object()
        try:
            services.mark_order_paid(
                order,
                user=request.user,
                payment_reference=request.data.get('payment_reference', ''),
            )
        except services.ShopError as exc:
            return Response({'detail': str(exc)}, status=400)
        order.refresh_from_db()
        return Response(ShopOrderSerializer(order).data)

    @action(detail=True, methods=['get'], url_path='picking-list')
    def picking_list(self, request, pk=None):
        order = self.get_object()
        return Response(services.get_picking_list(order))

    @action(detail=True, methods=['post'], url_path='update-items')
    def update_items(self, request, pk=None):
        order = self.get_object()
        items = request.data.get('items', [])
        try:
            services.update_order_items(
                order, items, user=request.user,
                notify_client=request.data.get('notify_client', True),
            )
        except Exception as exc:
            return Response({'detail': str(exc)}, status=400)
        order.refresh_from_db()
        return Response(ShopOrderSerializer(order).data)


class MerchantQuestionViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = ProductQuestionSerializer
    queryset = ProductQuestion.objects.select_related('product').all()
    filterset_fields = ['product', 'is_published']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    @action(detail=True, methods=['post'], url_path='answer')
    def answer(self, request, pk=None):
        question = self.get_object()
        answer = request.data.get('answer', '')
        if not answer:
            return Response({'detail': 'Réponse requise.'}, status=400)
        services.answer_question(question, answer, request.user)
        return Response(ProductQuestionSerializer(question).data)


class MerchantReviewViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = ProductReviewSerializer
    queryset = ProductReview.objects.select_related('product').all()
    filterset_fields = ['product', 'is_visible']
    http_method_names = ['get', 'patch', 'head', 'options']

    @action(detail=True, methods=['post'], url_path='reply')
    def reply(self, request, pk=None):
        review = self.get_object()
        review.merchant_reply = request.data.get('reply', '')
        review.save(update_fields=['merchant_reply', 'updated_at'])
        return Response(ProductReviewSerializer(review).data)

    @action(detail=True, methods=['post'], url_path='hide')
    def hide(self, request, pk=None):
        review = self.get_object()
        review.is_visible = False
        review.save(update_fields=['is_visible', 'updated_at'])
        return Response(ProductReviewSerializer(review).data)
