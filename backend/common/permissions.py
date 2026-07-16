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
