# 🧪 Test Local - La Manufacture OS

Guide pour tester l'application en local avant déploiement.

---

## ✅ Test Mode Local (Sans Backend) - RAPIDE

**Ce mode utilise localStorage comme la V6.5 originale.**

### 1. Démarrer le frontend

```bash
cd C:\TODO\la-manufacture-os
npm run dev
```

### 2. Ouvrir le navigateur

Va sur **http://localhost:3001**

### 3. Tests à faire

- [ ] **Jour** : Voir les tâches d'aujourd'hui (vide au début)
- [ ] **Semaine** : Vue hebdomadaire
- [ ] **Inbox** :
  - [ ] Taper `urgent: Relance APM` et ajouter
  - [ ] Taper `demain: Appeler client` et ajouter
  - [ ] Taper plusieurs lignes et ajouter
  - [ ] Vérifier parsing des dates (lundi, mardi, 15/01, etc.)
  - [ ] Tester `Ctrl+Enter` pour ajouter rapidement
- [ ] **Config** :
  - [ ] Modifier les responsables
  - [ ] Exporter JSON
  - [ ] Vider local
  - [ ] Import JSON
- [ ] **Jour** (retour) :
  - [ ] Voir les tâches créées
  - [ ] Cocher une tâche (done)
  - [ ] Voir badge "En retard" si tâches passées
- [ ] **localStorage** :
  - [ ] Rafraîchir la page → données conservées
  - [ ] F12 → Application → Local Storage → voir `lm_os_state_v65`

✅ **Si tout fonctionne : Mode local validé !**

---

## 🔗 Test Mode API (Avec Backend) - COMPLET

**Ce mode nécessite que le backend tourne.**

### 1. Démarrer le backend

Terminal 1 :
```bash
cd C:\TODO\la-manufacture-api

# Créer .env pour local
echo DATABASE_URL=postgresql://user:pass@localhost:5432/lamanufacture > .env
echo JWT_SECRET=test-secret-local-only-32-chars >> .env
echo NODE_ENV=development >> .env
echo PORT=3333 >> .env
echo FRONTEND_URL=http://localhost:3001 >> .env

# Si tu n'as pas PostgreSQL local, utilise Railway :
# 1. Va dans Railway → ton projet
# 2. Clique sur PostgreSQL → Variables → copie DATABASE_URL
# 3. Remplace dans .env ci-dessus

npm run dev
```

Tu devrais voir :
```
🚀 La Manufacture API running on http://localhost:3333
📊 Environment: development
```

### 2. Migrer la base (première fois uniquement)

```bash
npm run db:migrate
```

### 3. Configurer le frontend pour mode API

Terminal 2 :
```bash
cd C:\TODO\la-manufacture-os

# Créer .env pour mode API
echo VITE_MODE=api > .env
echo VITE_API_URL=http://localhost:3333 >> .env

npm run dev
```

### 4. Ouvrir le navigateur

Va sur **http://localhost:3001**

Tu devrais voir un message en console :
```
🔧 Running in API mode
```

### 5. Tests à faire

#### Auth
- [ ] **Register** :
  - [ ] Créer un compte (email, password, nom)
  - [ ] Vérifier redirection après inscription
- [ ] **Login** :
  - [ ] Se déconnecter
  - [ ] Se reconnecter
  - [ ] Vérifier que les données persistent

#### Tasks
- [ ] **Créer une tâche**
- [ ] **Modifier une tâche** (texte, urgent, statut)
- [ ] **Cocher une tâche** (done)
- [ ] **Supprimer une tâche**
- [ ] **Time tracking** : ajouter du temps à une tâche

#### Inbox
- [ ] **Parser multiple lignes**
- [ ] **Parsing intelligent** (dates, urgent, owner)
- [ ] **Création en masse**

#### Carry-over
- [ ] **Créer une tâche hier** (date passée)
- [ ] **Voir l'alerte "En retard"**
- [ ] **Reporter automatiquement** (bouton carry-over)

#### Settings
- [ ] **Modifier responsables**
- [ ] **Changer carry-over mode** (move/duplicate)
- [ ] **Activer/désactiver AI**

#### AI Features (si clé Claude configurée)
- [ ] **Focus Mode** : Claude choisit la tâche
- [ ] **AI Coach** : Briefing matinal
- [ ] **Parse Dump** : Parser texte brut avec AI

### 6. Vérifier l'API

Ouvre **http://localhost:3333/health** → tu devrais voir :
```json
{"status":"ok","timestamp":"2026-01-06T..."}
```

### 7. Vérifier la base de données

Si PostgreSQL local ou Railway :
- Ouvre un client SQL (DBeaver, TablePlus, pgAdmin...)
- Connecte-toi avec `DATABASE_URL`
- Vérifie les tables : `users`, `tasks`, `settings`, etc.
- Vérifie que les données sont bien enregistrées

✅ **Si tout fonctionne : Mode API validé !**

---

## 🐛 Troubleshooting

### ❌ Frontend : "Failed to fetch"

**Cause** : Le backend ne tourne pas ou mauvaise URL

**Solution** :
1. Vérifie que le backend tourne sur port 3333
2. Vérifie `.env` dans le frontend : `VITE_API_URL=http://localhost:3333`
3. Redémarre le frontend (`Ctrl+C` puis `npm run dev`)

### ❌ Backend : "Database connection error"

**Cause** : PostgreSQL non accessible

**Solution** :
1. Vérifie `DATABASE_URL` dans `.env`
2. Si PostgreSQL local : démarre le service
3. Sinon, utilise Railway :
   - Copie `DATABASE_URL` depuis Railway
   - Colle dans `.env` du backend

### ❌ Backend : "Cannot find module"

**Cause** : Dépendances pas installées

**Solution** :
```bash
cd C:\TODO\la-manufacture-api
npm install
```

### ❌ "Module is not defined"

**Cause** : Erreur de syntax ou import

**Solution** : Vérifie les logs pour l'erreur exacte

### ❌ CORS errors

**Cause** : Frontend et backend pas synchronisés

**Solution** :
1. Vérifie `FRONTEND_URL` dans le backend `.env`
2. Vérifie `VITE_API_URL` dans le frontend `.env`
3. Redémarre les deux services

---

## 📊 Tableau de Test

### Mode Local
| Feature | Testé | ✅/❌ | Notes |
|---------|-------|------|-------|
| Jour | [ ] | | |
| Semaine | [ ] | | |
| Inbox | [ ] | | |
| Config | [ ] | | |
| localStorage persist | [ ] | | |

### Mode API
| Feature | Testé | ✅/❌ | Notes |
|---------|-------|------|-------|
| Register | [ ] | | |
| Login | [ ] | | |
| Create task | [ ] | | |
| Update task | [ ] | | |
| Delete task | [ ] | | |
| Carry-over | [ ] | | |
| Time tracking | [ ] | | |
| Settings | [ ] | | |
| Focus Mode | [ ] | | Nécessite clé Claude |
| AI Coach | [ ] | | Nécessite clé Claude |

---

## ✅ Validation finale

Avant de passer à Dorian pour déploiement :

- [ ] Mode local fonctionne 100%
- [ ] Mode API fonctionne 100% (avec backend local ou Railway)
- [ ] Pas d'erreurs en console
- [ ] Responsive mobile OK (F12 → Device toolbar)
- [ ] README.md à jour
- [ ] GUIDE-DORIAN.md relu
- [ ] Tous les fichiers commités sur Git

**Commande finale avant push :**
```bash
cd C:\TODO\la-manufacture-os
npm run build  # Vérifie que le build prod fonctionne

cd C:\TODO\la-manufacture-api
npm run build  # (si applicable)
```

Si `npm run build` réussit sans erreur → **Prêt pour déploiement ! 🚀**
