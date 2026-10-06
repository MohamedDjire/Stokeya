from django.http import HttpResponse
from django.utils import timezone
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
from .models import Product, ProductBatch, ProductImportBatch
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
        detail=False,
        methods=['post'],
        url_path='import-analyze',
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_analyze(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'Aucun fichier fourni (champ "file").'}, status=400)
        try:
            result = import_service.analyze_upload(
                company=request.user.company,
                user=request.user,
                filename=upload.name,
                file_bytes=upload.read(),
            )
        except import_service.ImportError_ as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result, status=201)

    @action(detail=False, methods=['post'], url_path=r'import-batches/(?P<batch_id>[0-9]+)/prepare')
    def import_prepare(self, request, batch_id=None):
        """Applique le mapping (si colonnes obligatoires manquantes) et renvoie le tableau."""
        batch = ProductImportBatch.objects.filter(
            company=request.user.company, id=batch_id,
        ).first()
        if not batch:
            return Response({'detail': 'Import introuvable.'}, status=404)
        try:
            result = import_service.build_editable_rows(
                batch,
                column_mapping=request.data.get('column_mapping'),
            )
        except import_service.ImportError_ as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)

    @action(detail=False, methods=['post'], url_path=r'import-batches/(?P<batch_id>[0-9]+)/validate')
    def import_validate(self, request, batch_id=None):
        batch = ProductImportBatch.objects.filter(
            company=request.user.company, id=batch_id,
        ).first()
        if not batch:
            return Response({'detail': 'Import introuvable.'}, status=404)
        try:
            result = import_service.validate_batch(
                batch=batch,
                column_mapping=request.data.get('column_mapping'),
                duplicate_policy=request.data.get(
                    'duplicate_policy', import_service.DUPLICATE_IGNORE,
                ),
                auto_create=bool(request.data.get('auto_create_related', True)),
            )
        except import_service.ImportError_ as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)

    @action(detail=False, methods=['post'], url_path=r'import-batches/(?P<batch_id>[0-9]+)/execute')
    def import_execute(self, request, batch_id=None):
        batch = ProductImportBatch.objects.filter(
            company=request.user.company, id=batch_id,
        ).first()
        if not batch:
            return Response({'detail': 'Import introuvable.'}, status=404)

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

        rows = request.data.get('rows')
        try:
            if rows is not None:
                result = import_service.execute_from_rows(
                    batch=batch,
                    user=request.user,
                    rows=rows,
                    max_new=remaining,
                )
            else:
                if request.data.get('column_mapping') is not None:
                    batch.column_mapping = import_service._normalize_mapping(
                        request.data.get('column_mapping'),
                    )
                    batch.save(update_fields=['column_mapping', 'updated_at'])
                result = import_service.execute_batch(
                    batch=batch,
                    user=request.user,
                    max_new=remaining,
                    duplicate_policy=request.data.get(
                        'duplicate_policy', import_service.DUPLICATE_UPDATE,
                    ),
                )
        except import_service.ImportError_ as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result, status=201)

    @action(detail=False, methods=['post'], url_path=r'import-batches/(?P<batch_id>[0-9]+)/undo')
    def import_undo(self, request, batch_id=None):
        batch = ProductImportBatch.objects.filter(
            company=request.user.company, id=batch_id,
        ).first()
        if not batch:
            return Response({'detail': 'Import introuvable.'}, status=404)
        try:
            result = import_service.undo_batch(batch=batch, user=request.user)
        except import_service.ImportError_ as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)

    @action(detail=False, methods=['get'], url_path='import-history')
    def import_history(self, request):
        batches = (
            ProductImportBatch.objects
            .filter(company=request.user.company)
            .select_related('created_by')
            .order_by('-created_at')[:50]
        )
        now = timezone.now()
        data = []
        for batch in batches:
            can_undo = (
                batch.status == ProductImportBatch.Status.COMPLETED
                and batch.can_undo_until
                and now <= batch.can_undo_until
            )
            data.append({
                'id': batch.id,
                'filename': batch.filename,
                'status': batch.status,
                'total_rows': batch.total_rows,
                'created_count': batch.created_count,
                'updated_count': batch.updated_count,
                'skipped_count': batch.skipped_count,
                'errors_count': len(batch.errors or []),
                'created_at': batch.created_at,
                'can_undo_until': batch.can_undo_until,
                'can_undo': can_undo,
                'created_by': (
                    batch.created_by.get_full_name() or batch.created_by.email
                    if batch.created_by else None
                ),
            })
        return Response(data)

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
