# Inventra API — Sprint 1

Base URL : `http://localhost:8000/api/v1`

## Authentification

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/auth/register/` | Non | Créer entreprise + admin |
| POST | `/auth/login/` | Non | Connexion (email + password) → JWT |
| POST | `/auth/refresh/` | Non | Rafraîchir le token |
| POST | `/auth/logout/` | Oui | Déconnexion |
| GET | `/auth/me/` | Oui | Profil utilisateur |

### Register
```json
{
  "company_name": "Ma Boutique",
  "email": "admin@boutique.sn",
  "password": "MonMotDePasse123",
  "password_confirm": "MonMotDePasse123",
  "first_name": "Amadou",
  "last_name": "Diallo",
  "phone": "+221770000000"
}
```

### Login
```json
{
  "email": "admin@boutique.sn",
  "password": "MonMotDePasse123"
}
```

Réponse :
```json
{
  "access": "<jwt>",
  "refresh": "<jwt>"
}
```

## Entreprise

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET/PATCH | `/company/me/` | Infos entreprise |
| GET | `/company/subscription/` | Abonnement actif |

## Ressources

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| CRUD | `/branches/` | Boutiques |
| CRUD | `/cash-registers/` | Caisses |
| CRUD | `/units/` | Unités de mesure |
| CRUD | `/products/` | Produits |
| GET | `/products/by-barcode/{code}/` | Recherche par code-barres |
| GET | `/dashboard/` | Statistiques tableau de bord |

## Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Lancer le backend

```bash
cd backend
..\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

## Lancer le mobile

```bash
cd mobile
npm start
```

> Sur émulateur Android, l'API est accessible via `http://10.0.2.2:8000`
