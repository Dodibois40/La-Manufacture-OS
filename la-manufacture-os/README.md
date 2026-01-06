# La Manufacture OS - Frontend

Interface web pour La Manufacture OS - Ton système d'organisation personnel.

## Stack

- **Build Tool**: Vite 7
- **Styling**: CSS Vanilla (modulaire)
- **JavaScript**: ES6 Modules (Vanilla JS)
- **Hosting**: Netlify

## Features

✅ **Mode Dual** : Fonctionne en mode `local` (localStorage) OU `api` (backend)
✅ **Jour / Semaine / Inbox / Config**
✅ **Parsing intelligent** (dates, préfixes, owners)
✅ **Responsive** (Mobile-first)
✅ **Offline-first** (mode local)
✅ **Focus Mode** (AI choisit la tâche)
✅ **AI Coach** (briefing matinal)
✅ **Time Tracking**
✅ **Carry-over automatique**

## Installation locale

```bash
npm install
npm run dev  # http://localhost:3001
```

## Modes de fonctionnement

### Mode Local (sans backend)

```env
# .env.local
VITE_MODE=local
```

Toutes les données sont dans `localStorage`. Parfait pour tester l'UI.

### Mode API (avec backend)

```env
# .env
VITE_MODE=api
VITE_API_URL=http://localhost:3333
```

Le frontend appelle l'API backend. Nécessite que `la-manufacture-api` tourne.

## Tester en local

### Option 1 : Mode local uniquement (rapide)

```bash
npm run dev
```

L'app fonctionne comme la V6.5 (localStorage).

### Option 2 : Mode API (backend requis)

Terminal 1 - Backend :
```bash
cd ../la-manufacture-api
npm run dev
```

Terminal 2 - Frontend :
```bash
# Créer .env
echo "VITE_MODE=api" > .env
echo "VITE_API_URL=http://localhost:3333" >> .env

npm run dev
```

## Build pour production

```bash
npm run build  # Output dans dist/
```

## Déploiement

Voir [GUIDE-DORIAN.md](../GUIDE-DORIAN.md) pour les instructions complètes.

**Résumé :**
1. Push sur GitHub
2. Connecter à Netlify
3. Configurer variables d'environnement :
   - `VITE_MODE=api`
   - `VITE_API_URL=https://votre-api.railway.app`
4. Déployer !

## Structure

```
src/
├── css/
│   ├── variables.css    # Design tokens
│   ├── reset.css        # Reset CSS
│   ├── components.css   # Composants UI
│   └── app.css          # Layout
├── js/
│   ├── app.js           # Point d'entrée
│   ├── utils.js         # Utilitaires
│   ├── storage.js       # localStorage + migration
│   ├── parser.js        # Parsing Inbox
│   ├── inbox.js         # Logique Inbox
│   ├── views.js         # Rendu Jour/Semaine
│   ├── config.js        # Settings
│   └── api-client.js    # Client API (nouveau)
└── assets/
    └── logo.png         # Logo (3MB)
```

## Développement

### Ajouter une nouvelle vue

1. Ajouter HTML dans `index.html`
2. Ajouter CSS dans `src/css/app.css`
3. Ajouter logique dans `src/js/views.js`
4. Enregistrer dans navigation (`app.js`)

### Ajouter un endpoint API

1. Ajouter dans `src/js/api-client.js`
2. Utiliser dans les composants

## License

Privé - La Manufacture 64
