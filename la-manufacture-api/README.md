# La Manufacture OS - Backend API

API Node.js + PostgreSQL pour La Manufacture OS.

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Database**: PostgreSQL (Railway)
- **Auth**: JWT + bcrypt
- **AI**: Claude API (Anthropic)
- **Email**: Nodemailer

## Features

✅ **Authentication** (JWT)
✅ **Tasks CRUD** avec statuts + délégation
✅ **Carry-over automatique** (mode move/duplicate)
✅ **Time tracking** (temps passé par tâche)
✅ **AI Focus Mode** (Claude choisit la prochaine tâche)
✅ **AI Coach** (briefing matinal)
✅ **Email forwarding** (todo@lamanufacture64.com → tasks)
✅ **Activity log** (historique)

## Installation locale

```bash
npm install
cp .env.example .env
# Éditer .env avec vos credentials
npm run db:migrate  # Créer les tables
npm run dev         # Dev server avec hot reload
```

## Déploiement Railway

1. Créer un nouveau projet Railway
2. Ajouter un service PostgreSQL
3. Connecter ce repo GitHub
4. Ajouter les variables d'environnement :
   - `DATABASE_URL` (auto depuis PostgreSQL)
   - `JWT_SECRET`
   - `ANTHROPIC_API_KEY`
   - `SMTP_*` (pour email)
   - `FRONTEND_URL`

5. Railway va auto-détecter et déployer

## API Endpoints

### Auth
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `POST /api/auth/logout` - Se déconnecter
- `GET /api/auth/me` - Info utilisateur

### Tasks
- `GET /api/tasks` - Toutes les tâches
- `GET /api/tasks/today` - Tâches du jour
- `GET /api/tasks/late` - Tâches en retard
- `POST /api/tasks` - Créer une tâche
- `PATCH /api/tasks/:id` - Modifier une tâche
- `DELETE /api/tasks/:id` - Supprimer une tâche
- `POST /api/tasks/carry-over` - Reporter les tâches
- `POST /api/tasks/:id/time` - Ajouter du temps

### AI
- `POST /api/ai/focus-mode` - Mode focus (AI choisit)
- `GET /api/ai/coach/morning` - Briefing matinal
- `POST /api/ai/parse-dump` - Parser texte brut

### Settings
- `GET /api/settings` - Récupérer settings
- `PATCH /api/settings` - Modifier settings

### Email
- `POST /api/email/inbound` - Webhook email
- `GET /api/email/inbox` - Emails non traités
- `POST /api/email/inbox/:id/process` - Traiter email

## Backup PostgreSQL

Railway fait des backups automatiques. Pour backup manuel :

```bash
railway backup create
```

## License

Privé - La Manufacture 64
