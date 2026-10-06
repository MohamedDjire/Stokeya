from rest_framework.permissions import BasePermission


class IsCompanyMember(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.company_id is not None
        )


class IsCompanyAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_company_admin
        )


class HasFlag(BasePermission):
    """Vérifie un flag granulaire (défini via view.required_flag)."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        flag = getattr(view, 'required_flag', None)
        if not flag:
            return True
        from accounts.utils import user_has_flag
        return user_has_flag(request.user, flag)
