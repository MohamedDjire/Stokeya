from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from . import services
from .models import Customer, CustomerNote, CustomerTag, CustomerTagAssignment
from .serializers import (
    CustomerNoteSerializer,
    CustomerPaymentReadSerializer,
    CustomerPaymentSerializer,
    CustomerSerializer,
    CustomerTagSerializer,
    LoyaltySettingsSerializer,
)


class CustomerViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = CustomerSerializer
    queryset = Customer.objects.prefetch_related('tag_assignments__tag').all()
    search_fields = ['name', 'phone', 'email', 'city', 'whatsapp']
    filterset_fields = ['is_active', 'loyalty_level', 'city', 'gender']
    ordering_fields = ['name', 'created_at', 'total_spent', 'orders_count', 'loyalty_points', 'score']

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        return Response(services.get_crm_dashboard(request.user.company))

    @action(detail=False, methods=['get'], url_path='list-enriched')
    def list_enriched(self, request):
        params = request.query_params
        min_spent = params.get('min_spent')
        rows = services.list_customers_enriched(
            request.user.company,
            search=params.get('search'),
            status=params.get('status'),
            level=params.get('level'),
            tag=params.get('tag'),
            city=params.get('city'),
            min_spent=min_spent,
        )
        return Response(rows)

    @action(detail=False, methods=['post'], url_path='backfill-stats')
    def backfill_stats(self, request):
        services.backfill_company_stats(request.user.company)
        return Response({'detail': 'Statistiques clients recalculées.'})

    @action(detail=True, methods=['get'], url_path='profile')
    def profile(self, request, pk=None):
        customer = self.get_object()
        return Response(services.get_customer_360(customer))

    @action(detail=True, methods=['get', 'post'], url_path='notes')
    def notes(self, request, pk=None):
        customer = self.get_object()
        if request.method == 'GET':
            qs = customer.notes.select_related('created_by')
            return Response(CustomerNoteSerializer(qs, many=True).data)
        serializer = CustomerNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = CustomerNote.objects.create(
            customer=customer,
            content=serializer.validated_data['content'],
            is_private=serializer.validated_data.get('is_private', True),
            created_by=request.user,
        )
        return Response(CustomerNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='tags')
    def assign_tag(self, request, pk=None):
        customer = self.get_object()
        tag_id = request.data.get('tag_id')
        tag_name = request.data.get('name')
        if tag_id:
            tag = CustomerTag.objects.filter(company=request.user.company, id=tag_id).first()
        elif tag_name:
            tag, _ = CustomerTag.objects.get_or_create(
                company=request.user.company,
                name=tag_name.strip(),
                defaults={'color': request.data.get('color', '#0D9488')},
            )
        else:
            return Response({'detail': 'tag_id ou name requis.'}, status=400)
        if not tag:
            return Response({'detail': 'Tag introuvable.'}, status=404)
        CustomerTagAssignment.objects.get_or_create(customer=customer, tag=tag)
        return Response(services.get_customer_360(customer))

    @action(detail=True, methods=['delete'], url_path=r'tags/(?P<tag_id>[^/.]+)')
    def remove_tag(self, request, pk=None, tag_id=None):
        customer = self.get_object()
        CustomerTagAssignment.objects.filter(
            customer=customer, tag_id=tag_id, tag__is_system=False,
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], url_path='debts')
    def debts(self, request, pk=None):
        from .credit import list_customer_debts
        customer = self.get_object()
        return Response({
            'balance': str(customer.balance),
            'credit_limit': str(customer.credit_limit),
            'debts': list_customer_debts(customer),
        })

    @action(detail=True, methods=['get', 'post'], url_path='payments')
    def payments(self, request, pk=None):
        from .credit import CreditError, list_customer_debts, record_customer_payment
        from .models import CustomerPayment

        customer = self.get_object()
        if request.method == 'GET':
            qs = CustomerPayment.objects.filter(customer=customer).select_related('created_by')[:50]
            return Response(CustomerPaymentReadSerializer(qs, many=True).data)

        serializer = CustomerPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            payment = record_customer_payment(
                company=request.user.company,
                customer=customer,
                amount=data['amount'],
                method=data.get('method', 'cash'),
                reference=data.get('reference', ''),
                notes=data.get('notes', ''),
                user=request.user,
                sale_id=data.get('sale_id'),
            )
        except CreditError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        customer.refresh_from_db()
        return Response(
            {
                'payment': CustomerPaymentReadSerializer(payment).data,
                'balance': str(customer.balance),
                'debts': list_customer_debts(customer),
            },
            status=status.HTTP_201_CREATED,
        )


class CustomerTagViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = CustomerTagSerializer
    queryset = CustomerTag.objects.all()
    search_fields = ['name', 'code']

    def perform_destroy(self, instance):
        if instance.is_system:
            return
        instance.delete()


class LoyaltySettingsView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        settings = services.get_loyalty_settings(request.user.company)
        return Response(LoyaltySettingsSerializer(settings).data)

    def patch(self, request):
        settings = services.get_loyalty_settings(request.user.company)
        serializer = LoyaltySettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
