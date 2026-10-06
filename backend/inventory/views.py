import csv

from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from products.models import Product
from warehouses.models import Warehouse
from . import services
from .models import (
    InventorySession,
    InventorySessionStatus,
    RequestStatus,
    StockRequest,
    StockTransfer,
)
from .serializers import (
    ImportFromMainInputSerializer,
    InventoryCountItemSerializer,
    InventorySessionCreateSerializer,
    InventorySessionSerializer,
    ReplenishmentInputSerializer,
    StockAdjustmentInputSerializer,
    StockMovementInputSerializer,
    StockMovementSerializer,
    StockRequestSerializer,
    StockTransferInputSerializer,
    StockTransferSerializer,
    TransferReceiveInputSerializer,
)


def _truthy(value):
    return str(value).lower() in ('1', 'true', 'yes', 'oui')


class StockViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def _get_warehouse(self, request, warehouse_id):
        return Warehouse.objects.select_related('branch').get(
            id=warehouse_id,
            branch__company=request.user.company,
            is_active=True,
        )

    def _get_transfer(self, request, transfer_id):
        return StockTransfer.objects.select_related(
            'from_warehouse', 'to_warehouse', 'from_warehouse__branch', 'to_warehouse__branch',
            'created_by', 'received_by',
        ).prefetch_related('items__product').get(
            id=transfer_id, company=request.user.company,
        )

    def _list_filters(self, request):
        params = request.query_params
        return {
            'search': params.get('search') or None,
            'status': params.get('status') or None,
            'warehouse_id': params.get('warehouse_id') or params.get('warehouse') or None,
            'branch_id': params.get('branch_id') or params.get('branch') or None,
            'category_id': params.get('category_id') or params.get('category') or None,
            'brand_id': params.get('brand_id') or params.get('brand') or None,
            'expired': _truthy(params.get('expired', '')),
            'expiring_soon': _truthy(params.get('expiring_soon', '')),
        }

    @action(detail=False, methods=['get'], url_path='status/(?P<warehouse_id>[^/.]+)')
    def status(self, request, warehouse_id=None):
        try:
            warehouse = self._get_warehouse(request, warehouse_id)
        except Warehouse.DoesNotExist:
            return Response({'detail': 'Entrepôt introuvable.'}, status=404)
        return Response(services.get_stock_status(warehouse))

    @action(detail=False, methods=['get'], url_path='movements/(?P<warehouse_id>[^/.]+)')
    def movements(self, request, warehouse_id=None):
        try:
            warehouse = self._get_warehouse(request, warehouse_id)
        except Warehouse.DoesNotExist:
            return Response({'detail': 'Entrepôt introuvable.'}, status=404)
        return Response(services.get_stock_movements(warehouse))

    @action(detail=False, methods=['get'], url_path='stats/(?P<warehouse_id>[^/.]+)')
    def stats(self, request, warehouse_id=None):
        try:
            warehouse = self._get_warehouse(request, warehouse_id)
        except Warehouse.DoesNotExist:
            return Response({'detail': 'Entrepôt introuvable.'}, status=404)
        return Response(services.get_stock_stats(warehouse))

    @action(detail=False, methods=['get'], url_path='alerts/(?P<warehouse_id>[^/.]+)')
    def alerts(self, request, warehouse_id=None):
        try:
            warehouse = self._get_warehouse(request, warehouse_id)
        except Warehouse.DoesNotExist:
            return Response({'detail': 'Entrepôt introuvable.'}, status=404)
        return Response(services.get_stock_alerts(warehouse))

    @action(detail=False, methods=['get'], url_path='alerts-summary')
    def alerts_summary(self, request):
        """Compteur d'alertes stock (faible + rupture) pour le badge menu."""
        from companies.subscription_service import ensure_stock_alert_notifications

        summary = services.get_company_stock_alert_summary(request.user.company)
        ensure_stock_alert_notifications(request.user.company, summary)
        return Response(summary)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        warehouse_id = request.query_params.get('warehouse')
        warehouse = None
        if warehouse_id:
            try:
                warehouse = self._get_warehouse(request, warehouse_id)
            except Warehouse.DoesNotExist:
                return Response({'detail': 'Entrepôt introuvable.'}, status=404)
        return Response(services.get_stock_dashboard(request.user.company, warehouse))

    @action(detail=False, methods=['get'], url_path='list-items')
    def list_items(self, request):
        rows = services.get_stock_list(request.user.company, self._list_filters(request))
        return Response(rows)

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        rows = services.get_stock_list(request.user.company, self._list_filters(request))

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="stock.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow([
            'Produit', 'SKU', 'Code-barres', 'Catégorie', 'Marque', 'Entrepôt', 'Boutique',
            'Quantité', 'Réservé', 'Disponible', 'Stock min', 'Stock max',
            'Prix achat', 'Prix vente', 'Valeur stock', 'Statut', 'Emplacement',
        ])
        for row in rows:
            writer.writerow([
                row['name'], row['sku'], row['barcode'], row['category'] or '', row['brand'] or '',
                row['warehouse'], row['branch'], row['quantity'], row['reserved'], row['available'],
                row['min_stock'], row['max_stock'] or '', row['purchase_price'], row['sale_price'],
                row['stock_value'], row['status'], row['location_code'] or '',
            ])
        return response

    @action(detail=False, methods=['get'], url_path='transfers')
    def transfers(self, request):
        warehouse_id = request.query_params.get('warehouse')
        warehouse = None
        if warehouse_id:
            try:
                warehouse = self._get_warehouse(request, warehouse_id)
            except Warehouse.DoesNotExist:
                return Response({'detail': 'Entrepôt introuvable.'}, status=404)
        return Response(services.get_transfer_history(request.user.company, warehouse))

    @action(detail=False, methods=['get'], url_path='rankings')
    def rankings(self, request):
        days = int(request.query_params.get('days', 90))
        limit = int(request.query_params.get('limit', 10))
        return Response(services.get_product_rankings(request.user.company, days=days, limit=limit))

    @action(detail=False, methods=['post'], url_path='entry')
    def entry(self, request):
        serializer = StockMovementInputSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            movement = services.stock_entry(
                product=data['product'],
                warehouse=data['warehouse'],
                quantity=data['quantity'],
                user=request.user,
                notes=data.get('notes', ''),
                reference=data.get('reference', ''),
                movement_type=data.get('movement_type') or None,
                reason=data.get('reason', ''),
                supplier=data.get('supplier'),
                invoice_ref=data.get('invoice_ref', ''),
                unit_cost=data.get('unit_cost'),
                batch=data.get('batch'),
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(
            StockMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='exit')
    def exit(self, request):
        serializer = StockMovementInputSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            movement = services.stock_exit(
                product=data['product'],
                warehouse=data['warehouse'],
                quantity=data['quantity'],
                user=request.user,
                notes=data.get('notes', ''),
                reference=data.get('reference', ''),
                movement_type=data.get('movement_type') or None,
                reason=data.get('reason', ''),
                supplier=data.get('supplier'),
                invoice_ref=data.get('invoice_ref', ''),
                unit_cost=data.get('unit_cost'),
                batch=data.get('batch'),
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(
            StockMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='transfer')
    def transfer(self, request):
        serializer = StockTransferInputSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            transfer = services.stock_transfer(
                from_warehouse=data['from_warehouse'],
                to_warehouse=data['to_warehouse'],
                items_data=data['items'],
                user=request.user,
                company=request.user.company,
                notes=data.get('notes', ''),
                carrier=data.get('carrier', ''),
                auto_prepare=data.get('auto_prepare', True),
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(
            StockTransferSerializer(transfer).data, status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='transfer/import-from-main')
    def transfer_import_from_main(self, request):
        serializer = ImportFromMainInputSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            transfer = services.import_from_main(
                to_warehouse=data['to_warehouse'],
                items_data=data['items'],
                user=request.user,
                company=request.user.company,
                notes=data.get('notes', ''),
                complete_now=data.get('complete_now', False),
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(
            StockTransferSerializer(transfer).data, status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='transfer/suggest-replenishment')
    def transfer_suggest_replenishment(self, request):
        serializer = ReplenishmentInputSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = services.suggest_replenishment(
                company=request.user.company,
                to_warehouse=data['to_warehouse'],
                from_warehouse=data.get('from_warehouse'),
                days=data.get('days', 30),
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='transfer/parse-file')
    def transfer_parse_file(self, request):
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'Fichier requis (.xlsx ou .csv).'}, status=400)
        try:
            result = services.parse_transfer_file(request.user.company, uploaded)
        except Exception as exc:  # noqa: BLE001
            return Response({'detail': f'Fichier illisible : {exc}'}, status=400)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='transfer/(?P<transfer_id>[^/.]+)/prepare')
    def transfer_prepare(self, request, transfer_id=None):
        try:
            transfer = self._get_transfer(request, transfer_id)
        except StockTransfer.DoesNotExist:
            return Response({'detail': 'Transfert introuvable.'}, status=404)
        try:
            services.prepare_transfer(transfer, request.user)
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(StockTransferSerializer(transfer).data)

    @action(detail=False, methods=['post'], url_path='transfer/(?P<transfer_id>[^/.]+)/ship')
    def transfer_ship(self, request, transfer_id=None):
        try:
            transfer = self._get_transfer(request, transfer_id)
        except StockTransfer.DoesNotExist:
            return Response({'detail': 'Transfert introuvable.'}, status=404)
        try:
            services.ship_transfer(transfer, request.user)
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(StockTransferSerializer(transfer).data)

    @action(detail=False, methods=['post'], url_path='transfer/(?P<transfer_id>[^/.]+)/receive')
    def transfer_receive(self, request, transfer_id=None):
        try:
            transfer = self._get_transfer(request, transfer_id)
        except StockTransfer.DoesNotExist:
            return Response({'detail': 'Transfert introuvable.'}, status=404)
        serializer = TransferReceiveInputSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        try:
            services.receive_transfer(
                transfer,
                request.user,
                items_received=serializer.validated_data.get('items'),
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(StockTransferSerializer(transfer).data)

    @action(detail=False, methods=['post'], url_path='transfer/(?P<transfer_id>[^/.]+)/cancel')
    def transfer_cancel(self, request, transfer_id=None):
        try:
            transfer = self._get_transfer(request, transfer_id)
        except StockTransfer.DoesNotExist:
            return Response({'detail': 'Transfert introuvable.'}, status=404)
        try:
            services.cancel_transfer(transfer, request.user)
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(StockTransferSerializer(transfer).data)

    @action(detail=False, methods=['post'], url_path='adjust')
    def adjust(self, request):
        serializer = StockAdjustmentInputSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            adjustment = services.stock_adjustment(
                warehouse=data['warehouse'],
                items_data=data['items'],
                user=request.user,
                company=request.user.company,
                reason=data['reason'],
                notes=data.get('notes', ''),
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response({'id': adjustment.id, 'reason': adjustment.reason}, status=status.HTTP_201_CREATED)


class StockRequestViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = StockRequestSerializer
    queryset = StockRequest.objects.select_related(
        'from_warehouse', 'to_warehouse', 'requested_by', 'processed_by', 'transfer',
    ).prefetch_related('items__product')
    filterset_fields = ['status', 'source', 'from_warehouse', 'to_warehouse']
    search_fields = ['reference', 'notes']
    ordering_fields = ['created_at', 'reference']

    def get_queryset(self):
        qs = super().get_queryset()
        from accounts.utils import get_user_scope
        scope = get_user_scope(self.request.user)
        if scope.get('is_cashier') and scope.get('branch_id'):
            qs = qs.filter(to_warehouse__branch_id=scope['branch_id'])
        elif scope.get('is_pos_manager') and scope.get('branch_id'):
            qs = qs.filter(to_warehouse__branch_id=scope['branch_id'])
        elif scope.get('is_warehouse_staff') and scope.get('warehouse_id'):
            qs = qs.filter(
                Q(from_warehouse_id=scope['warehouse_id'])
                | Q(to_warehouse_id=scope['warehouse_id'])
            )
        return qs

    def _set_status(self, request, new_status):
        stock_request = self.get_object()
        stock_request.status = new_status
        stock_request.processed_by = request.user
        stock_request.save(update_fields=['status', 'processed_by', 'updated_at'])
        return Response(self.get_serializer(stock_request).data)

    @action(detail=False, methods=['post'], url_path='cashier-alert')
    def cashier_alert(self, request):
        """Alerte caissier : produit uniquement, quantité proposée automatiquement."""
        product_id = request.data.get('product_id')
        to_warehouse_id = request.data.get('to_warehouse_id')
        if not product_id:
            return Response({'detail': 'product_id requis.'}, status=400)
        try:
            product = Product.objects.get(
                id=product_id, company=request.user.company, is_active=True,
            )
        except Product.DoesNotExist:
            return Response({'detail': 'Produit introuvable.'}, status=400)
        to_wh = None
        if to_warehouse_id:
            try:
                to_wh = Warehouse.objects.get(
                    id=to_warehouse_id, branch__company=request.user.company,
                )
            except Warehouse.DoesNotExist:
                return Response({'detail': 'Entrepôt introuvable.'}, status=400)
        try:
            req = services.create_cashier_alert(
                company=request.user.company,
                user=request.user,
                product=product,
                to_warehouse=to_wh,
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(self.get_serializer(req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='pos-validate')
    def pos_validate(self, request, pk=None):
        """Responsable PDV : confirme / ajuste quantités puis envoie au siège."""
        stock_request = self.get_object()
        items = request.data.get('items')
        notes = request.data.get('notes')
        updates = None
        if items:
            updates = [
                {
                    'product_id': int(i['product_id'] if 'product_id' in i else i['product']),
                    'quantity': i['quantity'],
                }
                for i in items
            ]
        try:
            services.pos_validate_request(
                stock_request, request.user, items_updates=updates, notes=notes,
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(self.get_serializer(stock_request).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        stock_request = self.get_object()
        from_wh = None
        from_id = request.data.get('from_warehouse_id') or request.data.get('from_warehouse')
        if from_id:
            try:
                from_wh = Warehouse.objects.get(
                    id=from_id, branch__company=request.user.company,
                )
            except Warehouse.DoesNotExist:
                return Response({'detail': 'Entrepôt source introuvable.'}, status=400)
        try:
            services.hq_approve_request(stock_request, request.user, from_warehouse=from_wh)
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(self.get_serializer(stock_request).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        stock_request = self.get_object()
        if stock_request.status not in (
            RequestStatus.PENDING, RequestStatus.DRAFT,
            RequestStatus.POS_VALIDATED, RequestStatus.APPROVED,
        ):
            return Response({'detail': 'Cette requête ne peut plus être rejetée.'}, status=400)
        return self._set_status(request, RequestStatus.REJECTED)

    @action(detail=True, methods=['post'])
    def fulfill(self, request, pk=None):
        """Siège : crée le transfert (préparation). Réception = flux transfert."""
        stock_request = self.get_object()
        from_wh = None
        from_id = request.data.get('from_warehouse_id') or request.data.get('from_warehouse')
        if from_id:
            try:
                from_wh = Warehouse.objects.get(
                    id=from_id, branch__company=request.user.company,
                )
            except Warehouse.DoesNotExist:
                return Response({'detail': 'Entrepôt source introuvable.'}, status=400)
        try:
            req, transfer = services.fulfill_request_as_transfer(
                stock_request, request.user, from_warehouse=from_wh,
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        data = self.get_serializer(req).data
        data['transfer_id'] = transfer.id
        data['transfer_reference'] = transfer.reference
        return Response(data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        stock_request = self.get_object()
        if stock_request.status == RequestStatus.FULFILLED:
            return Response({'detail': 'Une requête servie ne peut pas être annulée.'}, status=400)
        return self._set_status(request, RequestStatus.CANCELLED)


class InventorySessionViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = InventorySessionSerializer
    queryset = InventorySession.objects.select_related(
        'warehouse', 'created_by', 'validated_by',
    ).prefetch_related('items__product')
    filterset_fields = ['status', 'warehouse']
    search_fields = ['reference', 'notes']
    ordering_fields = ['created_at', 'reference']

    def create(self, request, *args, **kwargs):
        serializer = InventorySessionCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        session = services.create_inventory_session(
            company=request.user.company,
            warehouse=data['warehouse'],
            user=request.user,
            product_ids=data.get('product_ids'),
            notes=data.get('notes', ''),
        )
        return Response(
            InventorySessionSerializer(session).data, status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='count-item')
    def count_item(self, request, pk=None):
        session = self.get_object()
        serializer = InventoryCountItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.count_inventory_item(
                session,
                serializer.validated_data['product_id'],
                serializer.validated_data['counted_quantity'],
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(InventorySessionSerializer(session).data)

    @action(detail=True, methods=['post'], url_path='validate')
    def validate_session(self, request, pk=None):
        session = self.get_object()
        try:
            services.validate_inventory_session(session, request.user)
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(InventorySessionSerializer(session).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        session = self.get_object()
        if session.status == InventorySessionStatus.COMPLETED:
            return Response({'detail': 'Une session validée ne peut pas être annulée.'}, status=400)
        session.status = InventorySessionStatus.CANCELLED
        session.save(update_fields=['status', 'updated_at'])
        return Response(InventorySessionSerializer(session).data)


class WarehouseListView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        warehouses = Warehouse.objects.filter(
            branch__company=request.user.company,
            is_active=True,
        ).select_related('branch').annotate(
            products_in_stock=Count(
                'stock_levels',
                filter=Q(stock_levels__product__is_active=True, stock_levels__quantity__gt=0),
            ),
        ).order_by('branch__name', 'name')
        data = [
            {
                'id': w.id,
                'name': w.name,
                'code': w.code,
                'branch_id': w.branch_id,
                'branch_name': w.branch.name,
                'branch_is_main': w.branch.is_main,
                'is_default': w.is_default,
                'is_pos_stock': w.is_pos_stock,
                'products_in_stock': w.products_in_stock,
            }
            for w in warehouses
        ]
        return Response(data)
