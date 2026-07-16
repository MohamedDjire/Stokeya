from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from .models import Unit
from .serializers import UnitSerializer


class UnitViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = UnitSerializer
    queryset = Unit.objects.all()
    search_fields = ['name', 'abbreviation']
    ordering_fields = ['name']
