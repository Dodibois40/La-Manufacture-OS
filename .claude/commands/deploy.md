# /deploy

Deploiement du projet La Manufacture.

## Frontend (Netlify)

```bash
cd la-manufacture-os
npm run build
npx netlify-cli deploy --prod
```

## Backend (Railway)

```bash
# Le backend est deploye automatiquement via Git
git push origin main
```

## Checklist pre-deploy

- [ ] Tests passes
- [ ] Build sans erreur
- [ ] Variables d'environnement a jour
- [ ] Migrations appliquees

## URLs

- **Frontend**: https://la-manufacture-os.netlify.app
- **API**: https://la-manufacture-api.railway.app
