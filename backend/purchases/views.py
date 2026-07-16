from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from .models import PurchaseOrder
from .serializers import (
    GoodsReceiptCreateSerializer,
    GoodsReceiptSerializer,
    PurchaseOrderCreateSerializer,
    PurchaseOrderSerializer,
)
from . import services


class PurchaseOrderViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = PurchaseOrderSerializer
    queryset = PurchaseOrder.objects.select_related('supplier').prefetch_related('items__product')
    http_method_names = ['get', 'post', 'head', 'options']
    search_fields = ['reference', 'supplier__name']
    filterset_fields = ['status', 'supplier']
    ordering_fields = ['created_at', 'total']

    def create(self, request, *args, **kwargs):
        serializer = PurchaseOrderCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            order = services.create_purchase_order(
                company=request.user.company,
                supplier=data['supplier'],
                items_data=data['items'],
                user=request.user,
                expected_date=data.get('expected_date'),
                notes=data.get('notes', ''),
            )
        except services.PurchaseError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(PurchaseOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        order = self.get_object()
        serializer = GoodsReceiptCreateSerializer(
            data=request.data,
            context={'request': request, 'order': order},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            receipt = services.receive_goods(
                order=order,
                warehouse=data['warehouse'],
                items_data=data['items'],
                user=request.user,
                notes=data.get('notes', ''),
            )
        except services.PurchaseError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(GoodsReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)
