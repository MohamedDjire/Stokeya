from django.db import models
from common.models import CompanyScopedModel


class Category(CompanyScopedModel):
    name = models.CharField(max_length=200)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Tag(CompanyScopedModel):
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default='#1565C0')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        unique_together = ['company', 'name']

    def __str__(self):
        return self.name


class ProductTag(models.Model):
    product = models.ForeignKey(
        'products.Product', on_delete=models.CASCADE, related_name='product_tags'
    )
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name='product_tags')

    class Meta:
        unique_together = ['product', 'tag']
