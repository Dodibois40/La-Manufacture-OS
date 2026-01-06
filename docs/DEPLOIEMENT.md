# Guide de Déploiement - La Manufacture OS

Guide complet pour déployer La Manufacture OS sur **Netlify** (frontend) + **Railway** (backend).

---

## 📋 Prérequis

- [ ] Compte Netlify (app.netlify.com)
- [ ] Compte Railway (railway.app)
- [ ] Clé API Claude (console.anthropic.com)
- [ ] Compte GitHub (pour CI/CD)

---

## 🚂 Partie 1 : Déployer le Backend sur Railway

### Étape 1 : Créer le projet Railway

1. Aller sur [railway.app](https://railway.app)
2. Cliquer sur **"New Project"**
3. Sélectionner **"Deploy from GitHub repo"**
4. Connecter le repo `la-manufacture-api`

### Étape 2 : Ajouter PostgreSQL

1. Dans le projet Railway, cliquer **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway va automatiquement créer la variable `DATABASE_URL`

### Étape 3 : Configurer les variables d'environnement

Dans **Settings** → **Variables**, ajouter :

```env
# Auto-générée par Railway
DATABASE_URL=postgresql://...

# JWT (générer une clé aléatoire longue)
JWT_SECRET=super-secret-key-minimum-32-characters-change-this

# Claude API (obtenir sur console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Email (configurer Gmail ou autre SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-app-password
EMAIL_INBOX_ADDRESS=todo@lamanufacture64.com

# Production
NODE_ENV=production
PORT=3333

# Frontend (sera l'URL Netlify)
FRONTEND_URL=https://app.lamanufacture64.com
```

### Étape 4 : Déployer

1. Railway va auto-détecter Node.js et déployer
2. Attendre que le build termine (2-3 min)
3. Noter l'URL Railway (ex: `https://la-manufacture-api.up.railway.app`)

### Étape 5 : Migrer la base de données

Dans Railway, ouvrir le **Terminal** du service et exécuter :

```bash
npm run db:migrate
```

Ceci va créer toutes les tables PostgreSQL.

---

## 🌐 Partie 2 : Déployer le Frontend sur Netlify

### Étape 1 : Préparer le frontend

1. Dans `la-manufacture-os`, créer un fichier `.env.production` :

```env
VITE_API_URL=https://la-manufacture-api.up.railway.app
```

2. Créer `netlify.toml` :

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "20"
```

### Étape 2 : Configurer Netlify

1. Aller sur [app.netlify.com](https://app.netlify.com)
2. **"Add new site"** → **"Import an existing project"**
3. Connecter le repo GitHub `la-manufacture-os`
4. Build settings :
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

### Étape 3 : Variables d'environnement

Dans **Site settings** → **Environment variables**, ajouter :

```
VITE_API_URL = https://la-manufacture-api.up.railway.app
```

### Étape 4 : Configurer le domaine

1. Dans **Domain settings**, ajouter le domaine :
   - `app.lamanufacture64.com`
2. Configurer le DNS chez votre registrar :
   - Type : **CNAME**
   - Name : **app**
   - Value : **votre-site.netlify.app**

### Étape 5 : Déployer

Netlify va auto-déployer à chaque push sur `main`.

---

## 📧 Partie 3 : Configurer Email Forwarding

### Option A : Avec SendGrid (recommandé)

1. Créer compte [SendGrid](https://sendgrid.com)
2. Configurer **Inbound Parse** :
   - URL webhook : `https://la-manufacture-api.up.railway.app/api/email/inbound`
   - Domaine : `lamanufacture64.com`
   - Sous-domaine : `todo`

3. Configurer DNS :
   ```
   MX    todo.lamanufacture64.com    mx.sendgrid.net    10
   ```

### Option B : Avec Gmail (simple)

1. Dans Gmail, activer **"App passwords"**
2. Créer un filtre :
   - Si reçu sur `votre-email@gmail.com`
   - Transférer vers l'API via script Google Apps Script

Ou plus simple : utiliser Zapier/Make pour connecter Gmail → API

---

## 🔒 Partie 4 : Sécurité

### Protection du site

**Option 1 : Auth simple dans l'app**
- L'API a déjà JWT
- Frontend demande login/password

**Option 2 : Netlify Password Protection** (très simple)
1. Dans Netlify → **Site settings** → **Access control**
2. Activer **"Password protection"**
3. Définir un mot de passe

**Option 3 : Cloudflare Access** (pro)
- Ajouter site à Cloudflare
- Activer **Access** avec authentification email

### HTTPS

✅ Netlify et Railway activent HTTPS automatiquement

---

## 🔄 Partie 5 : Backup & Monitoring

### Backup PostgreSQL (Railway)

**Automatique** : Railway fait des backups quotidiens

**Manuel** :
```bash
railway backup create
railway backup list
railway backup restore <backup-id>
```

### Monitoring

**Railway** :
- Logs en temps réel dans le Dashboard
- Métriques CPU/RAM/Network

**Netlify** :
- Analytics intégré
- Logs de build et déploiement

### Alertes

Configurer dans Railway :
- **Settings** → **Notifications**
- Ajouter webhook ou email pour alertes

---

## 🚀 Checklist de Déploiement

### Backend (Railway)

- [ ] Projet Railway créé
- [ ] PostgreSQL ajouté
- [ ] Variables d'environnement configurées
- [ ] Déployé avec succès
- [ ] Base de données migrée (`npm run db:migrate`)
- [ ] API accessible (test `/health`)

### Frontend (Netlify)

- [ ] Repo GitHub connecté
- [ ] Build réussi
- [ ] Variables d'environnement ajoutées
- [ ] Domaine `app.lamanufacture64.com` configuré
- [ ] DNS configuré
- [ ] HTTPS actif

### Features

- [ ] Login/Register fonctionne
- [ ] Création de tâches OK
- [ ] Carry-over automatique testé
- [ ] Focus Mode AI testé
- [ ] Time tracking testé
- [ ] Email forwarding configuré (optionnel)

---

## 🆘 Troubleshooting

### API ne répond pas
```bash
# Dans Railway Terminal
npm start
# Vérifier les logs
```

### CORS errors
Vérifier que `FRONTEND_URL` est correct dans Railway

### Database connection error
Vérifier `DATABASE_URL` dans Railway

### Build Netlify fail
```bash
# Tester en local
npm run build
```

---

## 📞 Support

- Railway Docs : https://docs.railway.app
- Netlify Docs : https://docs.netlify.com
- Claude API : https://docs.anthropic.com

---

**C'est prêt ! 🎉**

Une fois déployé, l'app sera accessible sur :
- **Frontend** : https://app.lamanufacture64.com
- **API** : https://la-manufacture-api.up.railway.app