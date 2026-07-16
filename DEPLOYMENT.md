# Déploiement Inventra

Ce document prépare le projet pour la publication mobile et la mise en ligne web.

## 1. Mobile Android — Play Store

### Fichiers déjà préparés
- `mobile/app.json`
- `mobile/eas.json`
- `mobile/.env.example`

### À renseigner avant publication
1. Créer un projet EAS :
   - `cd mobile`
   - `npx eas-cli login`
   - `npx eas-cli init`
2. Remplacer `expo.extra.eas.projectId` dans `mobile/app.json`
3. Définir l'API de production :
   - `EXPO_PUBLIC_API_URL=https://api.inventra.sn/api/v1`
4. Vérifier le package Android :
   - `com.inventra.app`
   - Si vous voulez un autre identifiant, le changer avant la première publication

### Build de test
```bash
cd mobile
npx eas-cli build --platform android --profile preview
```

### Build Play Store
```bash
cd mobile
npx eas-cli build --platform android --profile production
```

Le build de production génère un `.aab` à envoyer dans Google Play Console.

## 2. Web + Backend — mise en ligne

### Fichiers déjà préparés
- `backend/Dockerfile`
- `backend/.dockerignore`
- `render.yaml`
- `web/.env.example`

### Déploiement recommandé
- Backend Django sur Render via Docker
- Base PostgreSQL Render
- Frontend web Vite en site statique Render

### Variables backend à configurer
- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS=api.inventra.sn`
- `CORS_ALLOWED_ORIGINS=https://inventra.sn`
- `WAVE_API_KEY`
- `WAVE_WEBHOOK_SECRET`
- `WAVE_SUCCESS_URL`
- `WAVE_ERROR_URL`

### Variables web à configurer
- `VITE_API_URL=https://api.inventra.sn/api/v1`
- `VITE_APP_URL=https://inventra.sn`

## 3. Ordre conseillé de mise en production

1. Déployer le backend
2. Vérifier les migrations et l'admin Django
3. Déployer le web
4. Vérifier la connexion web avec l'API HTTPS
5. Générer un build mobile preview
6. Tester sur téléphone réel
7. Générer le build Android production
8. Publier sur le Play Store

## 4. Checklist avant mise en ligne

### Mobile
- [ ] Backend HTTPS fonctionnel
- [ ] `EXPO_PUBLIC_API_URL` pointe vers la prod
- [ ] Icône et splash définitifs
- [ ] Compte Google Play Developer créé
- [ ] Politique de confidentialité prête
- [ ] Tests sur appareil réel

### Web
- [ ] Domaine `inventra.sn` configuré
- [ ] Sous-domaine `api.inventra.sn` configuré
- [ ] HTTPS actif
- [ ] CORS configuré
- [ ] Variables Wave en production
- [ ] Compte admin de production créé

## 5. Commandes utiles

### Backend local
```bash
cd backend
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

### Web local
```bash
cd web
npm install
npm run build
```

### Mobile local
```bash
cd mobile
npm install
npx tsc --noEmit
```
