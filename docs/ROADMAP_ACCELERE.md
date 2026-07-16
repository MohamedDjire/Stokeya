# Roadmap accélérée — Mise en ligne fin de semaine

## Aujourd'hui → Mercredi
- [x] Auth + entreprise + permissions
- [x] Produits + catégories + marques
- [x] Stock entrée/sortie + stats
- [x] **Caisse POS** (vente + décrémentation stock)
- [x] **Wave Checkout API** + webhook
- [x] PostgreSQL + Docker Compose
- [x] Doc déploiement

## Mercredi → Jeudi
- [ ] Tests terrain complets (vente espèces + Wave sandbox)
- [ ] Configurer domaine + HTTPS (Nginx + Certbot)
- [ ] Brancher clés Wave production dans `.env`
- [ ] Build APK Android (EAS ou prebuild)

## Jeudi → Vendredi
- [ ] Déploiement VPS production
- [ ] Pilote avec 1-2 commerces réels
- [ ] Corrections bugs critiques
- [ ] **MISE EN LIGNE**

## Semaine 2 (post-lancement)
- Clients / fournisseurs CRUD mobile
- Achats + réception
- Rapports PDF
- Orange Money
- Mode offline avancé

## Endpoints clés production

| Endpoint | Usage |
|----------|-------|
| `POST /api/v1/auth/register/` | Inscription |
| `POST /api/v1/auth/login/` | Connexion |
| `POST /api/v1/sales/checkout/` | Vente POS |
| `POST /api/v1/payments/wave/checkout/` | Paiement Wave |
| `POST /api/v1/payments/wave/webhook/` | Confirmation Wave |
| `GET /api/v1/dashboard/` | Stats |

## Commandes déploiement rapide

```bash
cp .env.example .env
# Éditer .env avec vos clés
docker compose up -d --build
```
