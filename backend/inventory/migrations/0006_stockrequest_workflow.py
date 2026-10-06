from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_stockrequest_source'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stockrequest',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Brouillon'),
                    ('pending', 'En attente PDV'),
                    ('pos_validated', 'Envoyée au siège'),
                    ('approved', 'Approuvée siège'),
                    ('rejected', 'Rejetée'),
                    ('fulfilled', 'Transfert créé'),
                    ('cancelled', 'Annulée'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='stockrequest',
            name='transfer',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='stock_requests',
                to='inventory.stocktransfer',
            ),
        ),
    ]
