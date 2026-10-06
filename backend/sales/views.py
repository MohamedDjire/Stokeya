from decimal import Decimal
from html import escape

from django.db import OperationalError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from .models import Sale
from .serializers import SaleCreateSerializer, SaleSerializer
from . import services


def _fmt_qty(value):
    qty = Decimal(str(value)).normalize()
    if qty == qty.to_integral_value():
        return str(int(qty))
    return format(qty, 'f')


def _fmt_money(value):
    return f'{int(round(float(value))):,}'.replace(',', ' ')


def _build_receipt_html(sale):
    company = sale.company
    lines = ''.join(
        (
            '<tr>'
            f'<td>{escape(item.product.name)}</td>'
            f'<td style="text-align:center">{_fmt_qty(item.quantity)}</td>'
            f'<td style="text-align:right">{_fmt_money(item.unit_price)}</td>'
            f'<td style="text-align:right">{_fmt_money(item.total)}</td>'
            '</tr>'
        )
        for item in sale.items.select_related('product')
    )
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{escape(sale.reference)}</title>
<style>
body{{font-family:monospace;max-width:300px;margin:0 auto;padding:16px;font-size:12px}}
h1{{font-size:16px;text-align:center;margin:0}}
table{{width:100%;border-collapse:collapse;margin:12px 0}}
th{{text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:4px 0;border-bottom:1px dashed #000}}
th:first-child{{text-align:left}}
th:nth-child(2){{text-align:center}}
td{{padding:4px 0;vertical-align:top}}
td:nth-child(2){{text-align:center;white-space:nowrap}}
.total{{font-weight:bold;font-size:14px}}
hr{{border:none;border-top:1px dashed #000}}
</style></head><body>
<h1>{escape(company.name)}</h1>
<p style="text-align:center">{escape(sale.branch.name)}<br>{sale.created_at.strftime("%d/%m/%Y %H:%M")}</p>
<hr>
<p><strong>{escape(sale.reference)}</strong></p>
<table>
<thead><tr><th>Article</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead>
<tbody>{lines}</tbody>
</table>
<hr>
<p>Sous-total: {_fmt_money(sale.subtotal)} XOF</p>
<p>TVA: {_fmt_money(sale.tax_amount)} XOF</p>
<p class="total">TOTAL: {_fmt_money(sale.total)} XOF</p>
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

    def get_queryset(self):
        qs = super().get_queryset()
        from accounts.utils import get_user_scope, user_has_flag
        user = self.request.user
        scope = get_user_scope(user)
        if scope.get('is_cashier'):
            # Caissier : uniquement ses ventes
            qs = qs.filter(seller=user)
            if scope.get('branch_id'):
                qs = qs.filter(branch_id=scope['branch_id'])
        elif scope.get('is_pos_manager') and scope.get('branch_id'):
            qs = qs.filter(branch_id=scope['branch_id'])
        elif not user.is_company_admin and not user_has_flag(user, 'can_view_profit'):
            # Si seulement « ses ventes » sans vue globale
            if user_has_flag(user, 'can_view_own_sales') and not user_has_flag(user, 'can_modify_stock'):
                if scope.get('branch_id'):
                    qs = qs.filter(branch_id=scope['branch_id'])
        return qs

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
            ref = (entry.get('client_reference') or '').strip()
            serializer = SaleCreateSerializer(
                data={**entry, 'is_offline': True},
                context={'request': request},
            )
            if not serializer.is_valid():
                results.append({
                    'client_reference': ref,
                    'ok': False,
                    'detail': serializer.errors,
                    'retry': False,
                })
                continue
            data = serializer.validated_data
            ref = (data.get('client_reference') or ref or '').strip()
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
                    client_reference=ref or None,
                )
                results.append({
                    'client_reference': ref,
                    'ok': True,
                    'sale': SaleSerializer(sale).data,
                })
            except services.SaleError as exc:
                results.append({
                    'client_reference': ref,
                    'ok': False,
                    'detail': str(exc),
                    'retry': True,
                })
            except OperationalError:
                results.append({
                    'client_reference': ref,
                    'ok': False,
                    'detail': 'Base temporairement occupée, réessayez.',
                    'retry': True,
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
