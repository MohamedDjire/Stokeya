class CompanyQuerysetMixin:
    company_field = 'company'

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return qs
        if user.company_id:
            return qs.filter(**{self.company_field: user.company})
        return qs.none()

    def perform_create(self, serializer):
        if self.company_field and not self.request.user.is_superuser:
            serializer.save(**{self.company_field: self.request.user.company})
        else:
            serializer.save()
