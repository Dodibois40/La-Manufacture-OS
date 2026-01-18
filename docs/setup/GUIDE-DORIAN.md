# Guide de Deploiement - La Manufacture OS

> **Pour Claude** : Ce guide contient toutes les instructions pour deployer l'application en production. Suis les etapes dans l'ordre.

---

## Contexte

**La Manufacture OS** est une application de gestion de taches avec IA.

- **Frontend** : Vite + Vanilla JS (a deployer sur Netlify)
- **Backend** : Node.js + Fastify + PostgreSQL (a deployer sur Railway)

Le code est pret, teste et fonctionnel. Il ne reste que le deploiement.

---

## Structure du Projet

```
C:\TODO\
├── la-manufacture-os/          <- Frontend (Vite)
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   ├── netlify.toml            <- Config Netlify
│   └── .env.production         <- Variables prod
│
├── la-manufacture-api/         <- Backend (Fastify)
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   └── db/
│   ├── package.json
│   ├── railway.json            <- Config Railway
│   └── .env.example            <- Template variables
│
└── GUIDE-DORIAN.md             <- Ce fichier
```

---

## ETAPE 1 : Deployer le Backend sur Railway

### 1.1 Creer le repo GitHub

```bash
cd C:\TODO\la-manufacture-api

git init
git add .
git commit -m "Initial commit - La Manufacture API"

# Creer le repo sur GitHub : la-manufacture-api
git remote add origin https://github.com/[USERNAME]/la-manufacture-api.git
git branch -M main
git push -u origin main
```

### 1.2 Creer le projet Railway

1. Aller sur **https://railway.app**
2. Se connecter avec GitHub
3. Cliquer **"New Project"** → **"Deploy from GitHub repo"**
4. Selectionner `la-manufacture-api`
5. Railway detecte automatiquement Node.js et commence le build

### 1.3 Ajouter PostgreSQL

1. Dans le projet Railway, cliquer **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway cree automatiquement la variable `DATABASE_URL`

### 1.4 Configurer les Variables d'Environnement

Dans Railway : Service API → **Variables** → **RAW Editor**, coller :

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=3333

# IMPORTANT: Generer un secret JWT aleatoire (minimum 32 caracteres)
JWT_SECRET=GENERER-UNE-CLE-ALEATOIRE-ICI-32-CHARS-MINIMUM

# Cle API Claude (obtenir sur console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-api03-VOTRE-CLE

# CORS - Mettre l'URL Netlify une fois connu (etape 2)
FRONTEND_URL=https://app.lamanufacture64.com

# Email (optionnel - pour email forwarding)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=app-password
EMAIL_INBOX_ADDRESS=todo@lamanufacture64.com
EMAIL_WEBHOOK_SECRET=GENERER-UN-SECRET-ALEATOIRE
```

**Notes importantes :**
- `JWT_SECRET` : Generer avec `openssl rand -base64 32` ou un generateur en ligne
- `ANTHROPIC_API_KEY` : Obtenir sur https://console.anthropic.com
- `FRONTEND_URL` : Sera mis a jour apres le deploiement Netlify

### 1.5 Executer les Migrations

1. Attendre que le deploiement soit termine (voir logs)
2. Dans Railway, ouvrir le **Terminal** du service API
3. Executer :

```bash
npm run db:migrate
```

Resultat attendu : `Database migrations completed successfully`

### 1.6 Verifier le Deploiement

1. Copier l'URL du service (ex: `https://la-manufacture-api-xxx.up.railway.app`)
2. Tester dans le navigateur : `https://[URL]/health`
3. Reponse attendue : `{"status":"ok","timestamp":"..."}`

---

## ETAPE 2 : Deployer le Frontend sur Netlify

### 2.1 Creer le repo GitHub

```bash
cd C:\TODO\la-manufacture-os

git init
git add .
git commit -m "Initial commit - La Manufacture OS"

# Creer le repo sur GitHub : la-manufacture-os
git remote add origin https://github.com/[USERNAME]/la-manufacture-os.git
git branch -M main
git push -u origin main
```

### 2.2 Creer le site Netlify

1. Aller sur **https://app.netlify.com**
2. Se connecter avec GitHub
3. Cliquer **"Add new site"** → **"Import an existing project"**
4. Selectionner GitHub → Choisir `la-manufacture-os`
5. Configurer :
   - **Branch** : `main`
   - **Build command** : `npm run build`
   - **Publish directory** : `dist`
6. Cliquer **"Deploy"**

### 2.3 Configurer les Variables d'Environnement

Dans Netlify : **Site configuration** → **Environment variables**, ajouter :

| Variable | Valeur |
|----------|--------|
| `VITE_MODE` | `api` |
| `VITE_API_URL` | `https://[URL-RAILWAY].up.railway.app` |

Remplacer `[URL-RAILWAY]` par l'URL du backend obtenue a l'etape 1.6.

### 2.4 Redeclencher le Build

1. Aller dans **Deploys**
2. Cliquer **"Trigger deploy"** → **"Clear cache and deploy site"**

### 2.5 Configurer le Domaine (optionnel)

Si un domaine personnalise est souhaite (ex: app.lamanufacture64.com) :

1. Dans Netlify → **Domain management** → **Add domain**
2. Entrer : `app.lamanufacture64.com`
3. Configurer le DNS chez le registrar :

```
Type: CNAME
Name: app
Value: [SITE-NETLIFY].netlify.app
```

### 2.6 Mettre a jour FRONTEND_URL dans Railway

**IMPORTANT** : Une fois l'URL Netlify finale connue, retourner dans Railway :

1. Service API → **Variables**
2. Modifier `FRONTEND_URL` avec l'URL exacte du frontend (avec https://)
3. Sauvegarder (redeploy automatique)

---

## ETAPE 3 : Tests de Production

### Checklist de verification

- [ ] `https://[URL-RAILWAY]/health` retourne `{"status":"ok"}`
- [ ] Le frontend s'affiche correctement
- [ ] Pas d'erreurs CORS dans la console navigateur
- [ ] L'inscription fonctionne
- [ ] La connexion fonctionne
- [ ] La creation de tache fonctionne
- [ ] Le checkbox de completion fonctionne
- [ ] L'Inbox fonctionne
- [ ] Les Settings sont sauvegardes

---

## Troubleshooting

### Erreur CORS

**Symptome** : `Access-Control-Allow-Origin` error dans la console

**Solution** :
1. Verifier que `FRONTEND_URL` dans Railway correspond EXACTEMENT a l'URL Netlify
2. Inclure le protocole `https://`
3. Pas de slash final
4. Redeploy le backend

### Database connection error

**Symptome** : Erreur de connexion PostgreSQL

**Solution** :
1. Verifier que PostgreSQL est demarre dans Railway
2. Verifier que `DATABASE_URL` utilise `${{Postgres.DATABASE_URL}}`
3. Relancer les migrations

### Build Netlify echoue

**Symptome** : Le build fail sur Netlify

**Solution** :
1. Verifier les logs de build pour l'erreur exacte
2. Tester localement : `npm run build`
3. Verifier que les variables d'environnement sont definies

### Cookies JWT ne fonctionnent pas

**Symptome** : Deconnexion immediate apres login

**Solution** :
1. Les deux sites doivent etre en HTTPS
2. `FRONTEND_URL` doit correspondre exactement

---

## Informations Techniques

### API Endpoints

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Deconnexion |
| GET | `/api/auth/me` | User courant |
| GET | `/api/tasks` | Liste des taches |
| POST | `/api/tasks` | Creer une tache |
| PATCH | `/api/tasks/:id` | Modifier une tache |
| DELETE | `/api/tasks/:id` | Supprimer une tache |
| GET | `/api/settings` | Parametres |
| PATCH | `/api/settings` | Modifier parametres |
| POST | `/api/ai/focus-mode` | Mode focus IA |
| GET | `/api/ai/coach/morning` | Briefing matin IA |

### Schema Base de Donnees

- `users` : Comptes utilisateurs
- `tasks` : Taches (UUID, date, owner, status, urgent, done)
- `settings` : Preferences par user
- `activity_log` : Historique des actions
- `ai_interactions` : Logs des appels Claude API
- `email_inbox` : Emails recus

### Technologies

- **Frontend** : Vite 7, Vanilla JS, TailwindCSS
- **Backend** : Node.js 20+, Fastify 5, PostgreSQL
- **Auth** : JWT avec cookies httpOnly
- **AI** : Anthropic Claude API (claude-3-5-sonnet)

---

## Contacts

- **Thibaud** : Owner du projet
- **Dorian** : Deploiement

---

*Derniere mise a jour : Janvier 2026*
