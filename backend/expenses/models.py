from django.db import models
from common.models import CompanyScopedModel


class ExpenseCategory(CompanyScopedModel):
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'expense categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Expense(CompanyScopedModel):
    category = models.ForeignKey(
        ExpenseCategory, on_delete=models.PROTECT, related_name='expenses'
    )
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='expenses',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField()
    date = models.DateField()
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='expenses',
    )

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'{self.category.name} — {self.amount}'
