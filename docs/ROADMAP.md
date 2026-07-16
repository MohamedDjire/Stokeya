# Inventra — Roadmap Sprint par Sprint

## Vue d'ensemble

| Phase | Durée | Sprints | Objectif |
|-------|-------|---------|----------|
| Phase 1 — MVP | 10-12 sem | S1-S6 | POS + stock + auth fonctionnels |
| Phase 2 — Business | 6-8 sem | S7-S10 | Finance, rapports, multi-boutiques avancé |
| Phase 3 — SaaS | 6-10 sem | S11-S14 | Multi-tenant, abonnements, sécurité |
| Phase 4 — Scale | Continu | S15+ | IA, intégrations, web |

---

## Phase 1 — MVP

### Sprint 1 (2 sem) — Fondations
**Objectif** : Backend structuré, auth JWT, modèles core.

- [ ] Setup Django + DRF + JWT + PostgreSQL config
- [ ] Modèles : Company, User, Role, Branch, Warehouse
- [ ] API auth : register, login, refresh, logout
- [ ] Setup Expo : navigation, Redux, thème Paper
- [ ] Écrans : Splash, Login, Register

**Definition of Done** : Un utilisateur peut s'inscrire, créer une entreprise et se connecter.

### Sprint 2 (2 sem) — Catalogue
**Objectif** : Gestion complète des produits.

- [ ] Modèles : Category, Brand, Unit, Product, Barcode
- [ ] API CRUD produits avec upload image
- [ ] API catégories, marques, unités
- [ ] Écrans mobile : liste produits, ajout/édition, scan code-barres
- [ ] Recherche et filtres produits

**DoD** : Gérant peut créer 100+ produits avec code-barres depuis le mobile.

### Sprint 3 (2 sem) — Stock
**Objectif** : Mouvements de stock et alertes.

- [ ] Modèles : StockLevel, StockMovement, StockTransfer, StockAdjustment
- [ ] API mouvements stock (entrée, sortie, transfert, inventaire)
- [ ] Calcul stock temps réel par entrepôt
- [ ] Alertes stock faible
- [ ] Écrans mobile : stock, mouvements, inventaire

**DoD** : Stock mis à jour automatiquement après chaque mouvement.

### Sprint 4 (2 sem) — Point de Vente
**Objectif** : Caisse fonctionnelle.

- [ ] Modèles : Sale, SaleItem, Payment, CashRegister
- [ ] API ventes (créer, annuler, historique)
- [ ] Décrémentation stock auto à la vente
- [ ] Écran caisse mobile (scan, panier, paiement)
- [ ] Impression/partage ticket PDF

**DoD** : Caissier peut vendre 50 articles/jour via scan code-barres.

### Sprint 5 (2 sem) — Clients, Fournisseurs, Achats
**Objectif** : Cycle achat complet.

- [ ] Modèles : Customer, Supplier, PurchaseOrder, GoodsReceipt
- [ ] API clients, fournisseurs, commandes, réceptions
- [ ] Lien achat → entrée stock automatique
- [ ] Écrans mobile : clients, fournisseurs, commandes

**DoD** : Commande fournisseur → réception → stock mis à jour.

### Sprint 6 (2 sem) — Dashboard + Offline + Pilote
**Objectif** : MVP prêt pour pilote terrain.

- [ ] API dashboard (CA, top produits, ruptures)
- [ ] Écran dashboard mobile avec graphiques
- [ ] Mode offline : queue locale + sync
- [ ] Tests E2E parcours vente
- [ ] Déploiement staging + pilote 2 commerces

**DoD** : 2 commerces pilotes utilisent Inventra en production staging.

---

## Phase 2 — Business

### Sprint 7 — Finance & Dépenses
- Modèles Expense, ExpenseCategory
- API dépenses, balance, résultat net
- Écran finance mobile

### Sprint 8 — Retours & Remises
- SaleReturn, remises, vente à crédit
- Clôture de caisse journalière

### Sprint 9 — Rapports & Exports
- Export PDF/Excel (Celery async)
- Rapports ventes, stock, finance
- Graphiques avancés dashboard

### Sprint 10 — Notifications & Audit
- Notification rules, push/in-app
- Audit log actions sensibles
- Permissions granulaires RBAC

---

## Phase 3 — SaaS

### Sprint 11 — Multi-tenant
- Isolation données par tenant
- Middleware tenant-scoping
- Super admin panel

### Sprint 12 — Abonnements
- Plans, facturation SaaS, suspension auto
- Limites par plan (users, boutiques, produits)

### Sprint 13 — Sécurité & Performance
- Rate limiting, audit sécurité
- Cache Redis, optimisation requêtes
- Backups automatisés

### Sprint 14 — Production
- CI/CD complet
- Monitoring (Sentry, métriques)
- Documentation API Swagger
- Release Android production

---

## Métriques de succès par phase

| Phase | KPI cible |
|-------|-----------|
| MVP | 2 pilotes actifs, 100+ ventes/jour |
| Business | 10 entreprises, exports utilisés |
| SaaS | 50 entreprises, churn < 5%/mois |
| Scale | 200+ entreprises, API partenaires |
