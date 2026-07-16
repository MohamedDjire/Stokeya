from accounts.models import Permission, RolePermission, UserRole
from common.permissions_catalog import DEFAULT_ROLE_PERMISSIONS, PERMISSION_CODES, PERMISSION_LABELS


def seed_company_permissions(company):
    permissions = {}
    for code in PERMISSION_CODES:
        perm, _ = Permission.objects.get_or_create(
            codename=code,
            defaults={
                'name': PERMISSION_LABELS.get(code, code),
                'module': PERMISSION_LABELS.get(code, code),
            },
        )
        permissions[code] = perm

    roles = {}
    for code, perm_codes in DEFAULT_ROLE_PERMISSIONS.items():
        from accounts.models import Role
        role, _ = Role.objects.get_or_create(
            code=code,
            company=company,
            defaults={'name': code.replace('_', ' ').title()},
        )
        roles[code] = role
        RolePermission.objects.filter(role=role).delete()
        for perm_code in perm_codes:
            RolePermission.objects.get_or_create(
                role=role,
                permission=permissions[perm_code],
            )
    return roles


def get_user_permissions(user):
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser or user.is_company_admin:
        return list(PERMISSION_CODES)

    codes = set()
    user_roles = UserRole.objects.filter(user=user).select_related('role')
    for user_role in user_roles:
        role_perms = RolePermission.objects.filter(
            role=user_role.role,
        ).select_related('permission')
        for rp in role_perms:
            if rp.permission.codename in PERMISSION_CODES:
                codes.add(rp.permission.codename)
    return sorted(codes)


def user_has_permission(user, code):
    if user.is_superuser or user.is_company_admin:
        return True
    perms = get_user_permissions(user)
    return 'ALL' in perms or code in perms
