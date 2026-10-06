# Stokeya — Cahier des charges V3 (Mise en ligne fin de semaine)

## Objectif immédiat
Mettre **Stokeya** en production d'ici la fin de la semaine avec :
- Backend Django + PostgreSQL
- App mobile Android (Expo)
- Paiements **Wave** (priorité)
- Auth, produits, stock, caisse POS

## Périmètre release V1 (cette semaine)

| Module | Statut cible | Priorité |
|--------|--------------|----------|
| Auth JWT + entreprise | ✅ Fait | P0 |
| Produits / catégories / marques | ✅ Fait | P0 |
| Stock entrée/sortie | ✅ Fait | P0 |
| **Caisse POS** | 🚀 En cours | P0 |
| **Paiement Wave** | 🚀 En cours | P0 |
| Dashboard stats | ✅ Fait | P0 |
| PostgreSQL production | 🚀 En cours | P0 |
| Docker déploiement | 🚀 En cours | P0 |
| Clients / fournisseurs CRUD | Semaine 2 | P1 |
| Achats complets | Semaine 2 | P1 |
| Offline avancé | Semaine 2 | P1 |
| SaaS abonnements | Semaine 3 | P2 |

## Paiements Wave

### Flux
1. Caissier crée une vente → total calculé
2. Si paiement Wave : `POST /api/v1/payments/wave/checkout/`
3. Backend crée session Wave → retourne `wave_launch_url`
4. Mobile ouvre l'URL Wave (client paie sur son téléphone)
5. Wave envoie webhook → backend confirme paiement → vente validée
6. Paiement espèces : validation immédiate sans Wave

### Variables d'environnement
```
WAVE_API_KEY=wave_sn_prod_xxx
WAVE_WEBHOOK_SECRET=whsec_xxx
WAVE_SUCCESS_URL=https://api.stokeya.com/payments/wave/success/
WAVE_ERROR_URL=https://api.stokeya.com/payments/wave/error/
```

### Sécurité
- Vérification signature HMAC webhook
- Idempotence via `event_id` unique
- Montants en XOF entiers (pas de décimales)

## Stack production

| Composant | Technologie |
|-----------|-------------|
| API | Django 6 + DRF + Gunicorn |
| DB | PostgreSQL 16 |
| Cache | Redis (sessions, Celery futur) |
| Fichiers | Volume local / S3 futur |
| Mobile | Expo 54 → APK |
| Paiement | Wave Checkout API |
| Déploiement | Docker Compose |

## Permissions (reprises de new_stock)
`GP` produits · `GS` stock · `GV` ventes · `GU` users · `GC` compta · `GT` entrepôts · `GCL` clients · `GF` fournisseurs · `GCS` caisse · `ALL`

## Planning accéléré (fin de semaine)

| Jour | Livrable |
|------|----------|
| Lun-Mar | POS + Wave API + PostgreSQL + Docker |
| Mer | Tests terrain + corrections |
| Jeu | Build APK + déploiement serveur |
| Ven | Mise en ligne production + pilote |

## Critères de mise en ligne
- [ ] Inscription entreprise fonctionnelle
- [ ] Création produit + stock
- [ ] Vente POS avec espèces
- [ ] Vente POS avec Wave (sandbox puis prod)
- [ ] Dashboard CA du jour
- [ ] HTTPS sur l'API
- [ ] PostgreSQL avec backups
- [ ] APK installable sur Android

## Évolutions post-lancement
- Orange Money / MTN MoMo
- Mode offline complet
- Rapports PDF
- Multi-boutiques avancé
- SaaS facturation
