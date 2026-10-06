# Stokeya — Priorisation MoSCoW

## Must Have (MVP — Phase 1)
Fonctionnalités indispensables pour lancer un pilote commercial.

| Module | Fonctionnalités |
|--------|----------------|
| Auth | Connexion, JWT, rôles de base, reset password |
| Entreprise | Création entreprise, config devise/TVA |
| Boutiques | Multi-boutiques, entrepôts, caisses |
| Produits | CRUD, code-barres, image, prix, catégories, marques, unités |
| Stock | Entrées/sorties, transferts, inventaire, alertes rupture |
| POS | Vente rapide, scan, paiement espèces/mobile money, ticket |
| Clients | CRUD client, historique achats |
| Fournisseurs | CRUD fournisseur |
| Achats | Bon de commande, réception marchandises |
| Dashboard | CA jour/mois, top produits, ruptures |
| Offline | Ventes hors ligne + sync basique |
| Mobile | App Android (priorité) |

## Should Have (Phase 2)
Important mais pas bloquant pour le MVP.

| Module | Fonctionnalités |
|--------|----------------|
| Finance | Dépenses, résultat net, clôture caisse |
| Ventes | Retours, remises, vente à crédit |
| Stock | Lots, dates expiration, blocage lots expirés |
| Rapports | Export PDF/Excel, graphiques avancés |
| Notifications | Paiements en retard, règles personnalisées |
| RH | Fiches employés, permissions granulaires |
| SaaS | Plans abonnement, facturation mensuelle |
| Audit | Journal d'actions sensibles |
| Produits | Variantes, prix par boutique |

## Could Have (Phase 3)
Valeur ajoutée, à planifier après adoption.

| Module | Fonctionnalités |
|--------|----------------|
| Fidélité | Programme points, segmentation clients |
| Comptabilité | Plan comptable, écritures auto, rapprochement |
| Promotions | Bundles, coupons, remises planifiées |
| Intégrations | Wave, Orange Money, MTN MoMo |
| CRM | Campagnes SMS/WhatsApp |
| iOS | Build iOS production |
| Webhooks | Événements sortants pour partenaires |

## Won't Have (V1)
Hors périmètre initial, roadmap long terme.

| Fonctionnalité | Raison |
|----------------|--------|
| IA prévision stock | Complexité, données insuffisantes au départ |
| OCR factures | Nécessite ML/infra dédiée |
| Marketplace intégrée | Produit trop large pour V1 |
| App web complète | Focus mobile-first |
| API publique ouverte | Après stabilisation API interne |
| Gestion salaires complète | Module RH avancé, phase ultérieure |

## Matrice de dépendances

```
Auth → Entreprise → Boutiques → Produits → Stock → POS
                                    ↓
                              Clients/Fournisseurs
                                    ↓
                              Achats → Finance → Rapports
                                    ↓
                              SaaS (après MVP stable)
```
