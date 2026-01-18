# Server Management

## Environnements

### Development

```bash
# API
cd la-manufacture-api && npm run dev
# Port: 3000

# Frontend
cd la-manufacture-os && npm run dev
# Port: 5173
```

### Production

- **API**: Railway (auto-deploy on push)
- **Frontend**: Netlify (auto-deploy on push)
- **Database**: Railway PostgreSQL

## Variables d'environnement

### API (.env)

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
ANTHROPIC_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Frontend (.env)

```
VITE_API_URL=http://localhost:3000
```

## Logs

```bash
# API logs (dev)
npm run dev  # Logs dans la console

# Railway logs (prod)
railway logs
```

## Health checks

```bash
# API
curl http://localhost:3000/health

# Database
psql $DATABASE_URL -c "SELECT 1;"
```

## Backup

```bash
# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Scaling

- Railway: auto-scale configure
- Netlify: CDN global automatique
