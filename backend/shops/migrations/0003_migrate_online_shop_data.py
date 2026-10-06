import secrets
import string

from django.db import migrations
from django.utils.text import slugify


def _code(apps):
    OnlineShop = apps.get_model('shops', 'OnlineShop')
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(40):
        code = ''.join(secrets.choice(alphabet) for _ in range(8))
        if not OnlineShop.objects.filter(code=code).exists():
            return code
    return secrets.token_hex(4).upper()


def forwards(apps, schema_editor):
    Company = apps.get_model('companies', 'Company')
    Branch = apps.get_model('branches', 'Branch')
    OnlineShop = apps.get_model('shops', 'OnlineShop')
    Warehouse = apps.get_model('warehouses', 'Warehouse')

    for company in Company.objects.all():
        branches = list(Branch.objects.filter(company=company).order_by('id'))
        if not branches:
            continue
        # Prefer already marked main, else first branch
        main = next((b for b in branches if getattr(b, 'is_main', False)), None) or branches[0]
        if not main.is_main:
            Branch.objects.filter(company=company, is_main=True).update(is_main=False)
            main.is_main = True
            main.save(update_fields=['is_main'])

        # Ensure POS stock on main
        if not Warehouse.objects.filter(branch=main, is_pos_stock=True).exists():
            wh = Warehouse.objects.filter(branch=main).order_by('-is_default', 'id').first()
            if wh:
                wh.is_pos_stock = True
                wh.save(update_fields=['is_pos_stock'])

        if OnlineShop.objects.filter(company=company).exists():
            continue

        source = next((b for b in branches if b.shop_enabled and (b.shop_slug or b.shop_code)), None) or main
        base = slugify(source.shop_slug or company.slug or company.name) or 'boutique'
        slug = base
        n = 1
        while OnlineShop.objects.filter(slug=slug).exists():
            n += 1
            slug = f'{base}-{n}'
        code = source.shop_code if source.shop_code and not OnlineShop.objects.filter(code=source.shop_code).exists() else _code(apps)

        OnlineShop.objects.create(
            company=company,
            fulfillment_branch=main,
            slug=slug,
            code=code,
            enabled=True,
            name=company.name,
            description=source.shop_description or '',
            whatsapp=source.shop_whatsapp or '',
            phone=source.phone or company.phone or '',
            address=source.address or company.address or '',
            hours=source.shop_hours or '',
            show_prices=source.shop_show_prices,
            show_stock=source.shop_show_stock,
        )


def backwards(apps, schema_editor):
    OnlineShop = apps.get_model('shops', 'OnlineShop')
    OnlineShop.objects.all().delete()
    Branch = apps.get_model('branches', 'Branch')
    Branch.objects.filter(is_main=True).update(is_main=False)


class Migration(migrations.Migration):

    dependencies = [
        ('shops', '0002_architecture_online_shop'),
        ('branches', '0004_architecture_online_shop'),
        ('companies', '0003_architecture_online_shop'),
        ('warehouses', '0003_warehouse_is_pos_stock'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
