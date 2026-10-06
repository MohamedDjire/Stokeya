from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCompanyAdmin, IsCompanyMember
from common.permissions_catalog import (
    GRANULAR_FLAGS,
    PERMISSION_FLAG_GROUPS,
    ROLE_DEFAULT_FLAGS,
    ROLE_DESCRIPTIONS,
    ROLE_DISPLAY_NAMES,
    ROLE_ORDER,
    ROLE_SCOPE_RULES,
)
from companies import limits
from .models import Role, UserRole
from .serializers import (
    CompanyUserSerializer,
    CreateUserSerializer,
    RoleSerializer,
    UpdateUserSerializer,
    resolve_assignments,
)
from .utils import seed_company_permissions

User = get_user_model()


def _validate_role_scope(role_code, assignments):
    """Exige PDV/caisse/entrepôt selon le rôle métier."""
    if not role_code:
        return {'role_code': 'Choisissez un rôle.'}
    rules = ROLE_SCOPE_RULES.get(role_code)
    if not rules:
        return None
    errors = {}
    mapping = {
        'branch': ('assigned_branch', 'Point de vente requis pour ce rôle.'),
        'warehouse': ('assigned_warehouse', 'Entrepôt requis pour ce rôle.'),
        'cash_register': ('assigned_cash_register', 'Caisse requise pour ce rôle.'),
    }
    for rule_key, (field, message) in mapping.items():
        need = rules.get(rule_key)
        if need == 'required' and not assignments.get(field):
            errors[field] = message
    return errors or None


class RoleListView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get(self, request):
        # Garantir que les rôles métier existent pour l’entreprise
        seed_company_permissions(request.user.company)
        roles = list(Role.objects.filter(company=request.user.company, is_active=True))
        by_code = {r.code: r for r in roles}
        ordered = []
        for code in ROLE_ORDER:
            if code in by_code:
                ordered.append(by_code.pop(code))
        ordered.extend(sorted(by_code.values(), key=lambda r: r.name))
        payload = []
        for role in ordered:
            if role.code == 'company_admin':
                continue
            row = RoleSerializer(role).data
            row['display_name'] = ROLE_DISPLAY_NAMES.get(role.code, role.name)
            row['description'] = ROLE_DESCRIPTIONS.get(role.code, role.description or '')
            row['scope_rules'] = ROLE_SCOPE_RULES.get(role.code, {
                'branch': 'optional', 'warehouse': 'optional', 'cash_register': 'optional',
            })
            payload.append(row)
        return Response(payload)


class PermissionFlagsCatalogView(APIView):
    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def get(self, request):
        flag_labels = dict(GRANULAR_FLAGS)
        groups = []
        for group in PERMISSION_FLAG_GROUPS:
            groups.append({
                'key': group['key'],
                'label': group['label'],
                'flags': [
                    {'key': key, 'label': flag_labels[key]}
                    for key in group['flags']
                    if key in flag_labels
                ],
            })
        return Response({
            'flags': [{'key': k, 'label': v} for k, v in GRANULAR_FLAGS],
            'groups': groups,
            'role_defaults': ROLE_DEFAULT_FLAGS,
            'role_descriptions': ROLE_DESCRIPTIONS,
            'role_scope_rules': ROLE_SCOPE_RULES,
            'role_order': ROLE_ORDER,
        })


class CompanyUserViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def _company_users(self, request):
        return User.objects.filter(company=request.user.company).prefetch_related(
            'user_roles__role',
        ).select_related(
            'assigned_branch', 'assigned_warehouse', 'assigned_cash_register',
        )

    def list(self, request):
        users = self._company_users(request)
        return Response(CompanyUserSerializer(users, many=True).data)

    def create(self, request):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        limits.check_can_add_user(request.user.company)

        try:
            assignments = resolve_assignments(request.user.company, data)
        except Exception as exc:
            if hasattr(exc, 'detail'):
                return Response(exc.detail, status=400)
            raise

        scope_error = _validate_role_scope(data.get('role_code'), assignments)
        if scope_error:
            return Response(scope_error, status=400)

        user = User.objects.create_user(
            username=data['email'],
            email=data['email'],
            password=data['password'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            phone=data.get('phone', ''),
            company=request.user.company,
            is_company_admin=False,
            permission_flags=data.get('permission_flags') or {},
            **assignments,
        )

        role_code = data.get('role_code')
        if role_code:
            role = Role.objects.filter(company=request.user.company, code=role_code).first()
            if role:
                branch = assignments.get('assigned_branch')
                UserRole.objects.create(user=user, role=role, branch=branch)

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
        if 'permission_flags' in data:
            user.permission_flags = data['permission_flags'] or {}

        try:
            assignments = resolve_assignments(request.user.company, data)
        except Exception as exc:
            if hasattr(exc, 'detail'):
                return Response(exc.detail, status=400)
            raise
        for key, value in assignments.items():
            setattr(user, key, value)

        role_code = data.get('role_code')
        if role_code is None:
            # garder le rôle actuel pour valider le périmètre
            ur = UserRole.objects.filter(user=user).select_related('role').first()
            role_code = ur.role.code if ur else None

        merged = {
            'assigned_branch': user.assigned_branch,
            'assigned_warehouse': user.assigned_warehouse,
            'assigned_cash_register': user.assigned_cash_register,
            **assignments,
        }
        scope_error = _validate_role_scope(role_code, merged)
        if scope_error:
            return Response(scope_error, status=400)

        user.save()

        if data.get('role_code'):
            role = Role.objects.filter(company=request.user.company, code=data['role_code']).first()
            if role:
                UserRole.objects.filter(user=user).delete()
                UserRole.objects.create(
                    user=user,
                    role=role,
                    branch=user.assigned_branch,
                )

        return Response(CompanyUserSerializer(user).data)

    def retrieve(self, request, pk=None):
        try:
            user = self._company_users(request).get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Utilisateur introuvable.'}, status=404)
        return Response(CompanyUserSerializer(user).data)
