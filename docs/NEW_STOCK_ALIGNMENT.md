# Alignement avec new_stock

Ce document résume la logique reprise du projet `new_stock` et son adaptation dans Inventra.

## Architecture reprise

| new_stock | Inventra |
|-----------|----------|
| Vue 3 + Pinia | React Native + Redux |
| PHP API monolithique | Django REST API modulaire |
| `app_magasins` | `branches` + `warehouses` |
| `app_stock_magasins` | `inventory.StockLevel` |
| `app_stock_mouvements` | `inventory.StockMovement` |
| Codes permissions GP/GS/GV... | `accounts.Permission` + `RolePermission` |

## Permissions (copiées)

- `GP` produits
- `GS` stock
- `GV` ventes
- `GU` utilisateurs
- `GC` comptabilité
- `GT` entrepôts
- `GCM` commandes
- `GF` fournisseurs
- `GCL` clients
- `GCS` caisse
- `ALL` tous droits

## Stock (logique reprise)

Endpoints Inventra équivalents :

| new_stock | Inventra |
|-----------|----------|
| `etat_stock` | `GET /api/v1/stock/status/{warehouse_id}/` |
| `mouvements_stock` | `GET /api/v1/stock/movements/{warehouse_id}/` |
| `stats_stock` | `GET /api/v1/stock/stats/{warehouse_id}/` |
| `entree_stock` | `POST /api/v1/stock/entry/` |
| `sortie_stock` | `POST /api/v1/stock/exit/` |

Règles métier reprises :
- mise à jour automatique du stock après mouvement
- statut `OK` / `Stock bas` / `Rupture`
- historique des mouvements
- stats mensuelles entrées/sorties

## Mobile

- Dashboard avec cartes modules selon permissions
- Écran Stock : entrée/sortie, onglets stock actuel + historique
