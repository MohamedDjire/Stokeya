from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCompanyAdmin, IsCompanyMember
from companies import limits
from .models import Role, UserRole
from .serializers import (
    CompanyUserSerializer,
    CreateUserSerializer,
    RoleSerializer,
    UpdateUserSerializer,
)

User = get_user_model()


class RoleListView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        roles = Role.objects.filter(company=request.user.company, is_active=True)
        return Response(RoleSerializer(roles, many=True).data)


class CompanyUserViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def _company_users(self, request):
        return User.objects.filter(company=request.user.company).prefetch_related(
            'user_roles__role'
        )

    def list(self, request):
        users = self._company_users(request)
        return Response(CompanyUserSerializer(users, many=True).data)

    def create(self, request):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        limits.check_can_add_user(request.user.company)

        user = User.objects.create_user(
            username=data['email'],
            email=data['email'],
            password=data['password'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            phone=data.get('phone', ''),
            company=request.user.company,
            is_company_admin=False,
        )

        role_code = data.get('role_code')
        if role_code:
            role = Role.objects.filter(company=request.user.company, code=role_code).first()
            if role:
                UserRole.objects.create(user=user, role=role, branch=None)

        return Response(CompanyUserSerializer(user).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        try:
            user = self._company_users(request).get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Utilisateur introuvable.'}, status=404)

        serializer = UpdateUserSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        for field in ('first_name', 'last_name', 'phone'):
            if field in data:
                setattr(user, field, data[field])
        if 'is_active' in data:
            if user.id == request.user.id and not data['is_active']:
                return Response({'detail': 'Vous ne pouvez pas désactiver votre propre compte.'}, status=400)
            user.is_active = data['is_active']
        user.save()

        if data.get('role_code'):
            role = Role.objects.filter(company=request.user.company, code=data['role_code']).first()
            if role:
                UserRole.objects.filter(user=user).delete()
                UserRole.objects.create(user=user, role=role, branch=None)

        return Response(CompanyUserSerializer(user).data)
