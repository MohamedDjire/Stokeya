from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from companies import limits
from inventory.models import StockLevel, StockMovement
from . import import_service
from .models import Product, ProductBatch
from .serializers import ProductBatchSerializer, ProductSerializer


class ProductViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    serializer_class = ProductSerializer
    queryset = Product.objects.select_related(
        'category', 'brand', 'unit'
    ).prefetch_related('barcodes', 'stock_levels', 'product_tags__tag')
    search_fields = ['name', 'sku', 'barcodes__code']
    filterset_fields = ['category', 'brand', 'is_active']
    ordering_fields = ['name', 'sale_price', 'created_at']

    def perform_create(self, serializer):
        limits.check_can_add_product(self.request.user.company)
        super().perform_create(serializer)

    @action(detail=False, methods=['get'], url_path='by-barcode/(?P<code>[^/.]+)')
    def by_barcode(self, request, code=None):
        product = self.get_queryset().filter(barcodes__code=code, is_active=True).first()
        if not product:
            return Response({'detail': 'Produit introuvable.'}, status=404)
        return Response(self.get_serializer(product).data)

    @action(detail=True, methods=['get'], url_path='traceability')
    def traceability(self, request, pk=None):
        product = self.get_object()
        company = request.user.company
        levels = StockLevel.objects.filter(
            product=product, warehouse__branch__company=company,
        ).select_related('warehouse', 'warehouse__branch')
        movements = StockMovement.objects.filter(
            product=product, warehouse__branch__company=company,
        ).select_related('warehouse', 'created_by').order_by('-created_at')[:100]
        batches = ProductBatch.objects.filter(
            product=product, company=company,
        ).order_by('-expiry_date')
        return Response({
            'product': self.get_serializer(product).data,
            'stock_levels': [
                {
                    'warehouse_id': level.warehouse_id,
                    'warehouse_name': level.warehouse.name,
                    'branch_name': level.warehouse.branch.name,
                    'quantity': str(level.quantity),
                }
                for level in levels
            ],
            'batches': ProductBatchSerializer(batches, many=True).data,
            'movements': [
                {
                    'id': movement.id,
                    'warehouse_name': movement.warehouse.name,
                    'movement_type': movement.movement_type,
                    'quantity': str(movement.quantity),
                    'reference': movement.reference,
                    'notes': movement.notes,
                    'created_by': (
                        movement.created_by.get_full_name() if movement.created_by else None
                    ),
                    'created_at': movement.created_at,
                }
                for movement in movements
            ],
        })

    @action(detail=False, methods=['get'], url_path='import-template')
    def import_template(self, request):
        content = import_service.build_csv_template()
        response = HttpResponse(content, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="modele_produits.csv"'
        return response

    @action(
        detail=False,
        methods=['post'],
        url_path='import',
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_products(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'Aucun fichier fourni (champ "file").'}, status=400)

        remaining = limits.remaining_products(request.user.company)
        if remaining == 0:
            return Response(
                {
                    'detail': (
                        'Limite de produits de votre abonnement atteinte. '
                        'Passez à un pack supérieur.'
                    ),
                },
                status=403,
            )

        try:
            result = import_service.import_products(
                company=request.user.company,
                user=request.user,
                filename=upload.name,
                file_bytes=upload.read(),
                max_new=remaining,
            )
        except import_service.ImportError_ as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response(result, status=201)

    @action(
        detail=True,
        methods=['post'],
        url_path='upload-image',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_image(self, request, pk=None):
        product = self.get_object()
        image = request.FILES.get('image')
        if not image:
            return Response({'detail': 'Aucune image fournie (champ "image").'}, status=400)
        product.image = image
        product.save(update_fields=['image'])
        return Response(self.get_serializer(product).data)


class ProductBatchViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = ProductBatchSerializer
    queryset = ProductBatch.objects.select_related('product').all()
    search_fields = ['batch_number', 'product__name', 'product__sku']
    filterset_fields = ['product']
    ordering_fields = ['expiry_date', 'batch_number', 'created_at']
