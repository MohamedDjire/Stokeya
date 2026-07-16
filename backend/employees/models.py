from django.db import models
from common.models import CompanyScopedModel


class Employee(CompanyScopedModel):
    user = models.OneToOneField(
        'accounts.User', on_delete=models.CASCADE, related_name='employee_profile'
    )
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees',
    )
    position = models.CharField(max_length=100, blank=True)
    salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['user__first_name']

    def __str__(self):
        return str(self.user)
