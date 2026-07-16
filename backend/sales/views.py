from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from .models import Sale
from .serializers import SaleCreateSerializer, SaleSerializer
from . import services


def _build_receipt_html(sale):
    company = sale.company
    lines = ''.join(
        f'<tr><td>{item.product.name}</td>'
        f'<td style="text-align:right">{item.quantity}</td>'
        f'<td style="text-align:right">{item.unit_price:,.0f}</td>'
        f'<td style="text-align:right">{item.total:,.0f}</td></tr>'
        for item in sale.items.all()
    )
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{sale.reference}</title>
<style>
body{{font-family:monospace;max-width:300px;margin:0 auto;padding:16px;font-size:12px}}
h1{{font-size:16px;text-align:center;margin:0}}
table{{width:100%;border-collapse:collapse;margin:12px 0}}
td{{padding:4px 0}} .total{{font-weight:bold;font-size:14px}}
hr{{border:none;border-top:1px dashed #000}}
</style></head><body>
<h1>{company.name}</h1>
<p style="text-align:center">{sale.branch.name}<br>{sale.created_at.strftime("%d/%m/%Y %H:%M")}</p>
<hr>
<p><strong>{sale.reference}</strong></p>
<table>{lines}</table>
<hr>
<p>Sous-total: {sale.subtotal:,.0f} XOF</p>
<p>TVA: {sale.tax_amount:,.0f} XOF</p>
<p class="total">TOTAL: {sale.total:,.0f} XOF</p>
<p style="text-align:center;margin-top:16px">Merci de votre visite !</p>
</body></html>'''


class SaleViewSet(CompanyQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = SaleSerializer
    queryset = Sale.objects.select_related(
        'branch', 'customer', 'seller'
    ).prefetch_related('items__product', 'payments')
    filterset_fields = ['branch', 'status', 'payment_status']
    search_fields = ['reference']
    ordering_fields = ['created_at', 'total']

    @action(detail=False, methods=['post'])
    def checkout(self, request):
        serializer = SaleCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            sale = services.create_sale(
                company=request.user.company,
                branch=data['branch'],
                seller=request.user,
                items_data=data['items'],
                customer=data.get('customer'),
                cash_register=data.get('cash_register'),
                payment_method=data['payment_method'],
                discount_amount=data.get('discount_amount', 0),
                notes=data.get('notes', ''),
                warehouse=data.get('warehouse'),
                is_offline=data.get('is_offline', False),
                client_reference=(data.get('client_reference') or None),
            )
        except services.SaleError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='sync')
    def sync(self, request):
        """Synchronise une liste de ventes créées hors ligne."""
        payload = request.data
        sales_data = payload if isinstance(payload, list) else payload.get('sales', [])
        if not isinstance(sales_data, list) or not sales_data:
            return Response({'detail': 'Liste de ventes requise.'}, status=400)

        results = []
        for entry in sales_data:
            serializer = SaleCreateSerializer(data={**entry, 'is_offline': True}, context={'request': request})
            if not serializer.is_valid():
                results.append({
                    'client_reference': entry.get('client_reference'),
                    'ok': False,
                    'detail': serializer.errors,
                })
                continue
            data = serializer.validated_data
            try:
                sale = services.create_sale(
                    company=request.user.company,
                    branch=data['branch'],
                    seller=request.user,
                    items_data=data['items'],
                    customer=data.get('customer'),
                    cash_register=data.get('cash_register'),
                    payment_method=data['payment_method'],
                    discount_amount=data.get('discount_amount', 0),
                    notes=data.get('notes', ''),
                    warehouse=data.get('warehouse'),
                    is_offline=True,
                    client_reference=(data.get('client_reference') or None),
                )
                results.append({
                    'client_reference': data.get('client_reference') or '',
                    'ok': True,
                    'sale': SaleSerializer(sale).data,
                })
            except services.SaleError as exc:
                results.append({
                    'client_reference': data.get('client_reference') or '',
                    'ok': False,
                    'detail': str(exc),
                })

        synced = sum(1 for r in results if r['ok'])
        return Response({'synced': synced, 'total': len(results), 'results': results})

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        sale = self.get_object()
        return Response({
            'reference': sale.reference,
            'html': _build_receipt_html(sale),
            'total': sale.total,
        })
