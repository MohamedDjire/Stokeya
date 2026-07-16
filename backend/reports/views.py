from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCompanyMember
from expenses.models import Expense
from products.models import Product
from sales.models import Sale, SaleItem, SaleStatus


class SalesReportView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        company = request.user.company
        period = request.query_params.get('period', 'month')
        today = timezone.now().date()

        if period == 'today':
            sales = Sale.objects.filter(company=company, status=SaleStatus.COMPLETED, created_at__date=today)
        elif period == 'year':
            sales = Sale.objects.filter(
                company=company, status=SaleStatus.COMPLETED,
                created_at__year=today.year,
            )
        else:
            sales = Sale.objects.filter(
                company=company, status=SaleStatus.COMPLETED,
                created_at__year=today.year, created_at__month=today.month,
            )

        revenue = sales.aggregate(total=Sum('total'))['total'] or 0
        sales_count = sales.count()
        avg_sale = revenue / sales_count if sales_count else 0

        top_products = (
            SaleItem.objects.filter(sale__in=sales)
            .values('product__id', 'product__name')
            .annotate(
                quantity_sold=Sum('quantity'),
                revenue=Sum('total'),
            )
            .order_by('-revenue')[:10]
        )

        return Response({
            'period': period,
            'revenue': revenue,
            'sales_count': sales_count,
            'average_sale': round(avg_sale, 2),
            'top_products': [
                {
                    'id': p['product__id'],
                    'name': p['product__name'],
                    'quantity_sold': p['quantity_sold'],
                    'revenue': p['revenue'],
                }
                for p in top_products
            ],
        })


class FinanceReportView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        company = request.user.company
        today = timezone.now().date()

        revenue_month = Sale.objects.filter(
            company=company,
            status=SaleStatus.COMPLETED,
            created_at__year=today.year,
            created_at__month=today.month,
        ).aggregate(total=Sum('total'))['total'] or 0

        expenses_month = Expense.objects.filter(
            company=company,
            date__year=today.year,
            date__month=today.month,
        ).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'revenue_month': revenue_month,
            'expenses_month': expenses_month,
            'profit_month': revenue_month - expenses_month,
            'products_count': Product.objects.filter(company=company, is_active=True).count(),
        })
