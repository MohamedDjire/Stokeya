from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from common.mixins import CompanyQuerysetMixin
from common.permissions import IsCompanyMember
from .models import Category, Tag
from .serializers import CategorySerializer, TagSerializer


class CategoryViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = CategorySerializer
    queryset = Category.objects.select_related('parent').all()
    search_fields = ['name', 'parent__name']
    filterset_fields = ['is_active', 'parent']
    ordering_fields = ['name', 'created_at']


class TagViewSet(CompanyQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    serializer_class = TagSerializer
    queryset = Tag.objects.all()
    search_fields = ['name']
    filterset_fields = ['is_active']
    ordering_fields = ['name', 'created_at']
