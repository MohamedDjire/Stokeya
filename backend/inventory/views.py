from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from warehouses.models import Warehouse
from . import services
from .models import RequestStatus, StockRequest
from .serializers import (
    StockAdjustmentInputSerializer,
    StockMovementInputSerializer,
    StockMovementSerializer,
    StockRequestSerializer,
    StockTransferInputSerializer,
)


class StockViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def _get_warehouse(self, request, warehouse_id):
        return Warehouse.objects.select_related('branch').get(
            id=warehouse_id,
            branch__company=request.user.company,
            is_active=True,
        )

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
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response({'id': transfer.id, 'status': transfer.status}, status=status.HTTP_201_CREATED)

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
        'from_warehouse', 'to_warehouse', 'requested_by', 'processed_by',
    ).prefetch_related('items__product')
    filterset_fields = ['status', 'from_warehouse', 'to_warehouse']
    search_fields = ['reference', 'notes']
    ordering_fields = ['created_at', 'reference']

    def _set_status(self, request, new_status):
        stock_request = self.get_object()
        stock_request.status = new_status
        stock_request.processed_by = request.user
        stock_request.save(update_fields=['status', 'processed_by', 'updated_at'])
        return Response(self.get_serializer(stock_request).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        stock_request = self.get_object()
        if stock_request.status not in (RequestStatus.PENDING, RequestStatus.DRAFT):
            return Response({'detail': 'Cette requête ne peut plus être approuvée.'}, status=400)
        return self._set_status(request, RequestStatus.APPROVED)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        stock_request = self.get_object()
        if stock_request.status not in (
            RequestStatus.PENDING, RequestStatus.DRAFT, RequestStatus.APPROVED,
        ):
            return Response({'detail': 'Cette requête ne peut plus être rejetée.'}, status=400)
        return self._set_status(request, RequestStatus.REJECTED)

    @action(detail=True, methods=['post'])
    def fulfill(self, request, pk=None):
        stock_request = self.get_object()
        if stock_request.status not in (RequestStatus.APPROVED, RequestStatus.PENDING):
            return Response({'detail': 'Approuvez la requête avant de la servir.'}, status=400)
        if not stock_request.from_warehouse_id:
            return Response(
                {'detail': 'Indiquez un entrepôt source pour servir la requête.'},
                status=400,
            )
        items_data = [
            {
                'product': item.product,
                'product_id': item.product_id,
                'quantity': item.quantity,
            }
            for item in stock_request.items.all()
        ]
        try:
            services.stock_transfer(
                from_warehouse=stock_request.from_warehouse,
                to_warehouse=stock_request.to_warehouse,
                items_data=items_data,
                user=request.user,
                company=request.user.company,
                notes=f'Service requête {stock_request.reference}',
            )
        except services.StockError as exc:
            return Response({'detail': str(exc)}, status=400)

        for item in stock_request.items.all():
            item.quantity_fulfilled = item.quantity
            item.save(update_fields=['quantity_fulfilled'])

        stock_request.status = RequestStatus.FULFILLED
        stock_request.processed_by = request.user
        stock_request.save(update_fields=['status', 'processed_by', 'updated_at'])
        return Response(self.get_serializer(stock_request).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        stock_request = self.get_object()
        if stock_request.status == RequestStatus.FULFILLED:
            return Response({'detail': 'Une requête servie ne peut pas être annulée.'}, status=400)
        return self._set_status(request, RequestStatus.CANCELLED)


class WarehouseListView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        warehouses = Warehouse.objects.filter(
            branch__company=request.user.company,
            is_active=True,
        ).select_related('branch').order_by('branch__name', 'name')
        data = [
            {
                'id': w.id,
                'name': w.name,
                'branch_id': w.branch_id,
                'branch_name': w.branch.name,
                'is_default': w.is_default,
            }
            for w in warehouses
        ]
        return Response(data)
