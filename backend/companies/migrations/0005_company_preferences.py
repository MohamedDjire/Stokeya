from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0004_subscription_hub'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='slogan',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='company',
            name='website',
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name='company',
            name='tax_id',
            field=models.CharField(blank=True, max_length=100, verbose_name='Identifiant fiscal'),
        ),
        migrations.AddField(
            model_name='company',
            name='preferences',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
