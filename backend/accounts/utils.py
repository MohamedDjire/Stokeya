from accounts.models import Permission, Role, RolePermission, UserRole
from common.permissions_catalog import (
    DEFAULT_ROLE_PERMISSIONS,
    GRANULAR_FLAGS,
    PERMISSION_CODES,
    PERMISSION_LABELS,
    ROLE_DEFAULT_FLAGS,
    ROLE_DISPLAY_NAMES,
)


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
        role, created = Role.objects.get_or_create(
            code=code,
            company=company,
            defaults={
                'name': ROLE_DISPLAY_NAMES.get(code, code.replace('_', ' ').title()),
                'description': '',
            },
        )
        if not created:
            # Harmoniser le libellé FR
            desired = ROLE_DISPLAY_NAMES.get(code)
            if desired and role.name != desired:
                role.name = desired
                role.save(update_fields=['name', 'updated_at'])
        roles[code] = role
        RolePermission.objects.filter(role=role).delete()
        for perm_code in perm_codes:
            if perm_code in permissions:
                RolePermission.objects.get_or_create(
                    role=role,
                    permission=permissions[perm_code],
                )
    return roles


def get_user_role_code(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_company_admin or user.is_superuser:
        return 'company_admin'
    ur = UserRole.objects.filter(user=user).select_related('role').first()
    return ur.role.code if ur else None


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


def get_effective_flags(user):
    """Autorisations fines = défauts du rôle + surcharges user.permission_flags."""
    if not user or not user.is_authenticated:
        return {key: False for key, _ in GRANULAR_FLAGS}

    if user.is_superuser or user.is_company_admin:
        return {key: True for key, _ in GRANULAR_FLAGS}

    role_code = get_user_role_code(user) or 'cashier'
    flags = dict(ROLE_DEFAULT_FLAGS.get(role_code, ROLE_DEFAULT_FLAGS['cashier']))
    overrides = user.permission_flags or {}
    if isinstance(overrides, dict):
        for key, _ in GRANULAR_FLAGS:
            if key in overrides and overrides[key] is not None:
                flags[key] = bool(overrides[key])
    return flags


def user_has_flag(user, flag):
    return bool(get_effective_flags(user).get(flag))


def user_has_permission(user, code):
    if user.is_superuser or user.is_company_admin:
        return True
    perms = get_user_permissions(user)
    return 'ALL' in perms or code in perms


def get_user_scope(user):
    """Périmètre : branch / warehouse / caisse."""
    role_code = get_user_role_code(user)
    return {
        'role_code': role_code,
        'branch_id': user.assigned_branch_id,
        'warehouse_id': user.assigned_warehouse_id,
        'cash_register_id': user.assigned_cash_register_id,
        'is_cashier': role_code == 'cashier',
        'is_pos_manager': role_code == 'pos_manager',
        'is_warehouse_staff': role_code in ('warehouse_manager', 'stock_keeper'),
        'flags': get_effective_flags(user),
    }
