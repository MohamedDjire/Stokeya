"""Unités et catégories par défaut pour chaque entreprise."""

from categories.models import Category
from units.models import Unit

DEFAULT_UNITS = [
    ('Unité', 'U'),
    ('Pièce', 'pce'),
    ('Carton', 'ctn'),
    ('Paquet', 'pqt'),
    ('Sac', 'sac'),
    ('Bouteille', 'btl'),
    ('Bidon', 'bdn'),
    ('Pot', 'pot'),
    ('Boîte', 'bte'),
    ('Palette', 'pal'),
    ('Pack', 'pack'),
    ('Lot', 'lot'),
    ('Rouleau', 'rll'),
    ('Tube', 'tube'),
    ('Flacon', 'flc'),
    ('Canette', 'can'),
    ('Caisse', 'cai'),
    ('Ballot', 'bal'),
    ('Fût', 'fut'),
    ('Bobine', 'bob'),
]

# Arbre : nom parent -> liste d'enfants
DEFAULT_CATEGORY_TREE = {
    'Alimentation': ['Riz', 'Huile', 'Farine', 'Sucre', 'Conserves'],
    'Boissons': ['Eau', 'Jus', 'Boissons gazeuses', 'Énergisants', 'Alcools'],
    'Hygiène': ['Savons', 'Dentifrices', 'Shampoings', 'Déodorants'],
    'Cosmétiques': ['Maquillage', 'Parfums', 'Crèmes'],
    'Électronique': ['Téléphones', 'Accessoires', 'Ordinateurs', 'Télévisions'],
    'Quincaillerie': ['Outils', 'Peinture', 'Électricité'],
    'Bureautique': ['Papier', 'Stylos', 'Imprimantes'],
    'Textile': ['Hommes', 'Femmes', 'Enfants'],
    'Médicaments': ['Analgésiques', 'Antibiotiques', 'Vitamines'],
    'Pièces automobiles': ['Moteur', 'Pneus', 'Batteries'],
}


def seed_company_units(company):
    created = 0
    for name, abbreviation in DEFAULT_UNITS:
        _, was_created = Unit.objects.get_or_create(
            company=company,
            name=name,
            defaults={'abbreviation': abbreviation},
        )
        if was_created:
            created += 1
    return created


def seed_company_categories(company):
    created = 0
    for parent_name, children in DEFAULT_CATEGORY_TREE.items():
        parent, parent_created = Category.objects.get_or_create(
            company=company,
            name=parent_name,
            parent=None,
            defaults={'is_active': True},
        )
        if parent_created:
            created += 1
        for child_name in children:
            _, child_created = Category.objects.get_or_create(
                company=company,
                name=child_name,
                parent=parent,
                defaults={'is_active': True},
            )
            if child_created:
                created += 1
    return created


def seed_company_catalog(company):
    """Crée les unités et catégories catalogue pour une entreprise (idempotent)."""
    return {
        'units': seed_company_units(company),
        'categories': seed_company_categories(company),
    }
