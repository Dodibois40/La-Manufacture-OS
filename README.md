# 🚀 La Manufacture OS - Système de Gestion de Tâches

Système complet de gestion de tâches et de productivité avec synchronisation Google Calendar et intelligence artificielle.

## 📁 Structure du Projet

```
todo/
├── la-manufacture-os/     # Frontend (React/Vite)
├── la-manufacture-api/    # Backend API (Node.js/Fastify)
└── docs/                  # Documentation
```

## 🎯 Démarrage Rapide

### Frontend (la-manufacture-os)
```bash
cd la-manufacture-os
npm install
npm run dev
```

### Backend (la-manufacture-api)
```bash
cd la-manufacture-api
npm install
npm start
```

## 📚 Documentation

- **[Guide de Déploiement](docs/DEPLOIEMENT.md)** - Déployer sur Railway + Netlify
- **[Guide Utilisateur](docs/GUIDE-DORIAN.md)** - Comment utiliser l'application
- **[Tests Locaux](docs/TEST-LOCAL.md)** - Configuration et tests en local
- **[Vue d'ensemble du Projet](docs/README-PROJET.md)** - Architecture et fonctionnalités

## ✨ Fonctionnalités Principales

- ✅ Gestion de tâches avec dates et priorités
- 📅 Synchronisation Google Calendar (RDV)
- 🤖 Intelligence artificielle (Claude API)
- 👥 Gestion d'équipe et collaboration
- 📊 Suivi du temps et statistiques
- 🔔 Notifications en temps réel
- 📧 Création de tâches par email
- 🎯 Mode Focus et revue quotidienne

## 🛠️ Technologies

### Frontend
- Vite + Vanilla JavaScript
- CSS moderne (iOS-style)
- Service Workers (PWA)

### Backend
- Node.js + Fastify
- PostgreSQL
- Google Calendar API
- Claude API (Anthropic)

## 🔐 Configuration

Copiez les fichiers `.env.example` et renommez-les en `.env` :

```bash
# Backend
cp la-manufacture-api/.env.example la-manufacture-api/.env

# Frontend
cp la-manufacture-os/.env la-manufacture-os/.env.local
```

Configurez vos variables d'environnement (voir les fichiers `.env.example`).

## 🚀 Déploiement

Consultez le [Guide de Déploiement](docs/DEPLOIEMENT.md) pour déployer sur :
- **Frontend** : Netlify
- **Backend** : Railway
- **Base de données** : Railway PostgreSQL

## 📝 Licence

Projet privé - La Manufacture 64

## 🤝 Support

Pour toute question ou problème, consultez la documentation dans le dossier `docs/`.
