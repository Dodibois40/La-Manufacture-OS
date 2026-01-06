# 📦 La Manufacture OS - Projet Complet

**Status** : ✅ **100% Prêt pour déploiement**

Validé par Thibaud le 6 janvier 2026.

---

## 🎯 Vue d'ensemble

**La Manufacture OS** est ton système d'organisation personnel avec intelligence artificielle.

**Version actuelle** : V7 (Option C complète)
- V6.5 : Version locale (localStorage) ✅
- V7 : Version avec backend API + AI ✅

---

## 📁 Structure du Projet

```
C:\TODO\
├── la-manufacture-os/          🌐 Frontend (Vite + Vanilla JS)
│   ├── src/
│   │   ├── css/                CSS modulaire
│   │   ├── js/                 JavaScript ES6 modules
│   │   └── assets/             Logo (3MB)
│   ├── index.html
│   ├── package.json
│   ├── .env.local              Mode local (test)
│   ├── .env.production         Mode API (prod)
│   ├── netlify.toml            Config Netlify
│   └── README.md
│
├── la-manufacture-api/         🚂 Backend (Node.js + Fastify + PostgreSQL)
│   ├── src/
│   │   ├── routes/             Routes API
│   │   ├── db/                 Database
│   │   ├── services/           Services (vide pour l'instant)
│   │   ├── middleware/         Middleware (vide)
│   │   └── utils/              Utils (vide)
│   ├── package.json
│   ├── .env.example            Template env
│   ├── railway.json            Config Railway
│   └── README.md
│
├── DEPLOIEMENT.md              📘 Guide technique déploiement
├── GUIDE-DORIAN.md             🎓 Guide simplifié pour Dorian
├── TEST-LOCAL.md               🧪 Guide de test local
└── README-PROJET.md            📋 Ce fichier
```

---

## ✨ Fonctionnalités Complètes

### Core Features (V6.5)
- ✅ **Jour** : Vue quotidienne + badge "En retard"
- ✅ **Semaine** : Résumé hebdo (Lun→Dim)
- ✅ **Inbox** : Capture rapide multi-lignes
- ✅ **Config** : Responsables, Import/Export JSON
- ✅ **Parsing intelligent** : dates (aujourd'hui, demain, lundi, 15/01), urgent, owners
- ✅ **localStorage** : Offline-first avec migration automatique
- ✅ **Raccourcis** : Ctrl/⌘ + Enter

### Nouvelles Features (V7)
- ✅ **Authentication** : JWT + bcrypt
- ✅ **Statuts** : open, en_attente, delegue, bloque, termine
- ✅ **Délégation** : champs owner + assignee
- ✅ **Carry-over automatique** : mode move/duplicate
- ✅ **Time tracking** : temps passé par tâche
- ✅ **Focus Mode** : Claude choisit la prochaine tâche
- ✅ **AI Coach** : Briefing matinal intelligent
- ✅ **Smart Parser** : AI transforme texte brut en tâches
- ✅ **Email forwarding** : todo@lamanufacture64.com → tasks
- ✅ **Activity log** : Historique complet
- ✅ **Backup auto** : Railway PostgreSQL

---

## 🚀 Pour Tester en Local

### Mode Rapide (Sans Backend)

```bash
cd C:\TODO\la-manufacture-os
npm run dev
```

Ouvre **http://localhost:3001**

✅ L'app fonctionne comme avant (localStorage)

### Mode Complet (Avec Backend)

Voir **[TEST-LOCAL.md](TEST-LOCAL.md)** pour les instructions détaillées.

---

## 🎯 Pour Dorian : Déploiement

**👉 Lis le guide complet : [GUIDE-DORIAN.md](GUIDE-DORIAN.md)**

**Résumé ultra-rapide :**

1. **Backend (Railway)** :
   - Push `la-manufacture-api` sur GitHub
   - Créer projet Railway
   - Ajouter PostgreSQL
   - Configurer variables d'environnement
   - Migrer la DB : `npm run db:migrate`

2. **Frontend (Netlify)** :
   - Push `la-manufacture-os` sur GitHub
   - Connecter à Netlify
   - Configurer variables : `VITE_MODE=api`, `VITE_API_URL=...`
   - Configurer domaine : `app.lamanufacture64.com`

**Durée estimée** : 30-45 minutes

---

## 📚 Documentation

| Fichier | Description | Pour qui |
|---------|-------------|----------|
| `README-PROJET.md` | Ce fichier (vue d'ensemble) | Thibaud + Dorian |
| `GUIDE-DORIAN.md` | Guide déploiement simplifié | Dorian |
| `DEPLOIEMENT.md` | Guide technique complet | Dorian (référence) |
| `TEST-LOCAL.md` | Tests en local | Thibaud |
| `la-manufacture-os/README.md` | Doc frontend | Dev |
| `la-manufacture-api/README.md` | Doc backend | Dev |

---

## 🔐 Credentials à Préparer

Pour Dorian, préparer :

1. ✅ **Compte Railway** (backend)
2. ✅ **Compte Netlify** (frontend)
3. ✅ **Compte GitHub** (repos)
4. ✅ **Clé Claude API** : [console.anthropic.com](https://console.anthropic.com)
   - Créer un compte
   - Aller dans **API Keys**
   - Créer une clé (commencer avec $5 de crédit gratuit)
5. ⚠️ **SMTP Email** (optionnel pour email forwarding) :
   - Gmail App Password OU SendGrid

---

## 📊 Stack Technique

### Frontend
- **Build** : Vite 7
- **Style** : CSS Vanilla (modulaire)
- **JS** : ES6 Modules
- **Hosting** : Netlify
- **Domaine** : app.lamanufacture64.com

### Backend
- **Runtime** : Node.js 20+
- **Framework** : Fastify
- **Database** : PostgreSQL (Railway)
- **Auth** : JWT + bcrypt
- **AI** : Claude API (Anthropic)
- **Email** : Nodemailer
- **Hosting** : Railway

### DevOps
- **CI/CD** : GitHub → Auto-deploy (Netlify + Railway)
- **Backup** : Railway auto-backup PostgreSQL
- **Monitoring** : Logs Railway + Netlify Analytics

---

## 🎨 Design

- **Couleurs** :
  - Background : `#000`
  - Cards : `#1c1c1e`
  - Accent : `#d4af37` (or La Manufacture)
  - Text : `#fff`
  - Urgent : `#ff453a`
  - OK : `#32d74b`

- **Police** : -apple-system (Apple-like)
- **Style** : Dark, minimaliste, Apple-inspired

---

## ✅ Checklist Pré-Déploiement

### Code
- [x] Frontend build réussi (`npm run build`)
- [x] Backend routes testées
- [x] Schéma DB créé
- [x] Migrations prêtes
- [x] Mode local testé par Thibaud
- [x] Documentation complète

### Fichiers
- [x] `.env.example` créés (frontend + backend)
- [x] `.gitignore` créés
- [x] `README.md` à jour
- [x] `netlify.toml` créé
- [x] `railway.json` créé

### Guides
- [x] GUIDE-DORIAN.md rédigé
- [x] DEPLOIEMENT.md rédigé
- [x] TEST-LOCAL.md rédigé

---

## 🆘 Support

**En cas de problème :**

1. Consulter [GUIDE-DORIAN.md](GUIDE-DORIAN.md) section Troubleshooting
2. Vérifier les logs :
   - Railway : Dashboard → Service → Logs
   - Netlify : Site → Deploys → Logs
   - Browser : F12 → Console
3. Vérifier les variables d'environnement
4. Tester en local d'abord (voir [TEST-LOCAL.md](TEST-LOCAL.md))

**Docs officielles :**
- Railway : https://docs.railway.app
- Netlify : https://docs.netlify.com
- Fastify : https://www.fastify.io
- Vite : https://vitejs.dev
- Claude API : https://docs.anthropic.com

---

## 🎉 C'est Prêt !

**Ce qui a été fait aujourd'hui :**

1. ✅ Refonte complète V6.5 (code propre, modulaire)
2. ✅ Backend API complet (Node.js + PostgreSQL)
3. ✅ Intégration Claude API (Focus Mode, AI Coach)
4. ✅ Features avancées (statuts, délégation, time tracking, carry-over)
5. ✅ Email forwarding préparé
6. ✅ Documentation complète pour déploiement
7. ✅ Tests locaux validés

**Prochaine étape :**

👉 **Dorian : Déployer en suivant [GUIDE-DORIAN.md](GUIDE-DORIAN.md)**

Une fois déployé, l'app sera accessible sur :
- **Frontend** : https://app.lamanufacture64.com
- **API** : https://la-manufacture-api.up.railway.app (ou URL Railway générée)

---

**Bon déploiement ! 🚀**

*Projet créé avec Claude Code*
*Janvier 2026*
