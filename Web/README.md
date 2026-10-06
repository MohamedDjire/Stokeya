# Stokeya — Application Web

Version web (React) d'Stokeya, connectée au même backend Django que l'application mobile.
Mêmes fonctionnalités, architecture adaptée au desktop (sidebar, tableaux, graphiques).

## Stack

- **Vite + React 18 + TypeScript**
- **MUI (Material UI)** — composants et thème
- **Recharts** — graphiques
- **Redux Toolkit** — état d'authentification
- **React Router** — navigation
- **Axios** — client API (JWT + refresh automatique)

## Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'URL de l'API
cp .env.example .env
# puis éditer VITE_API_URL (par défaut http://localhost:8000/api/v1)

# 3. Lancer en développement
npm run dev
# → http://localhost:5173

# 4. Build de production
npm run build
npm run preview
```

Le backend Django doit tourner (par défaut `http://localhost:8000`) et
autoriser les requêtes CORS depuis `http://localhost:5173`.

## Fonctionnalités

- Authentification (connexion, inscription entreprise, mot de passe oublié)
- Tableau de bord avec indicateurs et graphique d'évolution
- Produits : liste, création/édition, import CSV/Excel/PDF, image
- Caisse (POS) : panier, client, encaissement, ticket imprimable
- Stock : état, mouvements, entrées/sorties par entrepôt
- Clients, Fournisseurs, Achats (commandes + réception), Dépenses
- Statistiques : graphiques (CA, recettes/dépenses, paiements, catégories,
  top produits), filtres boutique/vendeur, export PDF et Excel
- Utilisateurs & rôles (admin)
- Abonnement : packs, usage, changement de plan
- Profil : compte, entreprise, autorisations, déconnexion

## Structure

```
src/
  api/         # Clients API (mêmes endpoints que le mobile)
  components/  # Layout, composants partagés
  config/      # Configuration API
  pages/       # Une page par module
  store/       # Redux (auth)
  utils/       # Formatage, permissions
  theme.ts     # Thème MUI
```
