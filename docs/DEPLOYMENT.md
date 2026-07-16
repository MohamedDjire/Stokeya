# Déploiement Inventra — Mise en ligne fin de semaine

## Prérequis serveur
- VPS Ubuntu 22+ (2 Go RAM minimum)
- Domaine : `api.inventra.sn` (ou votre domaine)
- Compte Wave Business avec API Key activée

## 1. Préparer le serveur

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
```

## 2. Cloner et configurer

```bash
git clone <votre-repo> inventra
cd inventra
cp .env.example .env
nano .env   # Remplir SECRET_KEY, DB_PASSWORD, WAVE_API_KEY, WAVE_WEBHOOK_SECRET
```

## 3. Lancer avec Docker

```bash
docker compose up -d --build
docker compose logs -f api
```

L'API sera disponible sur `http://VOTRE_IP:8000`

## 4. HTTPS avec Nginx (recommandé)

Installer Nginx + Certbot, proxy vers port 8000 :

```nginx
server {
    listen 443 ssl;
    server_name api.inventra.sn;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        alias /var/lib/docker/volumes/inventra_media_data/_data/;
    }
}
```

## 5. Configurer Wave

1. Aller sur [business.wave.com](https://business.wave.com) → Developer
2. Copier **API Key** → `WAVE_API_KEY` dans `.env`
3. Copier **Webhook Secret** → `WAVE_WEBHOOK_SECRET`
4. Configurer webhook URL : `https://api.inventra.sn/api/v1/payments/wave/webhook/`
5. `WAVE_SUCCESS_URL` et `WAVE_ERROR_URL` : pages de confirmation

## 6. Build APK mobile

```bash
cd mobile
# Mettre l'URL API dans src/config/api.ts
npm install
npx expo prebuild
eas build --platform android --profile preview
```

Ou pour test rapide : `npx expo start` + Expo Go

## 7. Vérifications post-déploiement

- [ ] `POST /api/v1/auth/register/` crée une entreprise
- [ ] `POST /api/v1/auth/login/` retourne JWT
- [ ] Création produit + entrée stock
- [ ] `POST /api/v1/sales/checkout/` vente espèces
- [ ] `POST /api/v1/payments/wave/checkout/` retourne `wave_launch_url`
- [ ] Webhook Wave confirme le paiement
- [ ] Dashboard affiche le CA du jour

## 8. Sauvegardes PostgreSQL

```bash
docker compose exec db pg_dump -U inventra inventra > backup_$(date +%Y%m%d).sql
```

## Variables .env critiques

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Clé Django (générer une longue chaîne aléatoire) |
| `DB_PASSWORD` | Mot de passe PostgreSQL fort |
| `WAVE_API_KEY` | Clé API Wave Business |
| `WAVE_WEBHOOK_SECRET` | Secret signature webhooks |
| `ALLOWED_HOSTS` | Domaine de l'API |

## Support dev local

```bash
cd backend
..\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

SQLite en local par défaut. Pour PostgreSQL local, copier `.env` avec `DB_HOST=localhost`.
