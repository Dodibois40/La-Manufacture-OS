# 🚀 Guide de Configuration - Système d'Invitation

## ✅ Étape 1 : Configuration Base de Données

### Option A : Neon (Recommandé - Gratuit)

1. **Créer un compte Neon**
   - Allez sur https://neon.tech
   - Cliquez sur "Sign Up" (gratuit)
   - Connectez-vous avec GitHub ou Google

2. **Créer un projet**
   - Cliquez sur "New Project"
   - Nom : `LaManufacture`
   - Région : Choisissez la plus proche (ex: Europe)
   - PostgreSQL version : 16 (par défaut)

3. **Copier la Connection String**
   - Dans le dashboard, cliquez sur "Connection Details"
   - Copiez l'URL complète (format: `postgresql://user:pass@host/dbname?sslmode=require`)

4. **Mettre à jour .env**
   ```bash
   # Ouvrez: la-manufacture-api/.env
   # Remplacez la ligne DATABASE_URL par votre URL Neon
   DATABASE_URL=postgresql://votre-url-neon-ici
   ```

### Option B : Supabase (Alternative gratuite)

1. Allez sur https://supabase.com
2. Créez un projet
3. Dans Settings → Database → Connection string
4. Copiez la "Connection string" (mode: Session)

### Option C : Railway (Alternative)

1. Allez sur https://railway.app
2. Créez un projet + PostgreSQL
3. Copiez la DATABASE_URL

---

## 📧 Étape 2 : Configuration Email (Gmail)

### 1. Créer un App Password Gmail

1. **Activer la validation en 2 étapes** (si pas déjà fait)
   - Allez sur https://myaccount.google.com/security
   - Cliquez sur "Validation en 2 étapes"
   - Suivez les instructions

2. **Créer un App Password**
   - Allez sur https://myaccount.google.com/apppasswords
   - Nom de l'application : `La Manufacture OS`
   - Cliquez sur "Créer"
   - **Copiez le mot de passe de 16 caractères** (ex: `abcd efgh ijkl mnop`)

3. **Mettre à jour .env**
   ```bash
   # Ouvrez: la-manufacture-api/.env
   # Remplacez ces lignes:
   SMTP_USER=votre-email@gmail.com
   SMTP_PASS=abcdefghijklmnop  # Sans espaces !
   ```

### Alternative : Autres fournisseurs email

**Outlook/Hotmail**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=votre-email@outlook.com
SMTP_PASS=votre-mot-de-passe
```

**SendGrid (pour production)**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=votre-api-key-sendgrid
```

---

## 🚀 Étape 3 : Démarrer le Système

### 1. Démarrer le Backend (avec migration automatique)

```bash
cd la-manufacture-api
npm run dev
```

**Vérifications** :
- ✅ `🔄 Running database migrations...`
- ✅ `✅ Database migrations completed`
- ✅ `🚀 La Manufacture API running on http://0.0.0.0:3333`

**Si erreur de migration** :
- Vérifiez que DATABASE_URL est correct
- Vérifiez votre connexion internet
- Le schéma se créera automatiquement !

### 2. Démarrer le Frontend

**Nouveau terminal** :
```bash
cd la-manufacture-os
npm run dev
```

**Accès** :
- Frontend : http://localhost:3000
- Backend API : http://localhost:3333

---

## 🧪 Étape 4 : Tester le Système

### Test 1 : Créer une invitation

1. Ouvrez http://localhost:3000/team.html
2. Cliquez sur l'onglet **"Invitations"**
3. Cliquez sur **"+ Inviter"**
4. Remplissez :
   - Email : votre-email-test@gmail.com
   - Nom : Test Membre
   - Couleur : (au choix)
5. Cliquez sur **"Envoyer l'invitation"**
6. ✅ Message : "Invitation envoyée !"

### Test 2 : Vérifier l'email

1. Ouvrez votre boîte mail
2. Cherchez l'email de "FLOW"
3. Sujet : "XXX vous invite à rejoindre son équipe sur FLOW"
4. Cliquez sur le bouton **"Accepter l'invitation"**

### Test 3 : Accepter l'invitation

1. Vous arrivez sur `/accept-invite.html`
2. Vérifiez les détails de l'invitation
3. Cliquez sur **"Accepter l'invitation"**
4. Si pas connecté : Clerk vous demande de vous inscrire
   - **Important** : Utilisez le même email que l'invitation !
5. Une fois connecté, vous acceptez automatiquement
6. ✅ Redirection vers `/member.html`

### Test 4 : Dashboard Membre

1. Vous êtes sur `/member.html`
2. Vous voyez votre nom en haut
3. Onglets : Mes Tâches | Mes Projets | Temps
4. Pour l'instant vide (normal, aucune tâche assignée)

### Test 5 : Assigner une tâche au membre

1. Retournez sur `/team.html`
2. Onglet **"Invitations"** : Vous voyez le statut **"Acceptée"** ✅
3. Onglet **"Projets"** : Créez un projet
4. Assignez le membre au projet
5. Le membre peut maintenant voir le projet sur son dashboard !

---

## 🔧 Dépannage

### Erreur : "getaddrinfo ENOTFOUND"
- **Cause** : DATABASE_URL incorrect ou manquant
- **Solution** : Vérifiez votre .env, l'URL doit être complète

### Erreur : "Email send error"
- **Cause** : SMTP mal configuré
- **Solution** :
  - Vérifiez SMTP_USER et SMTP_PASS
  - Supprimez les espaces dans SMTP_PASS
  - Vérifiez que la validation 2 étapes est active (Gmail)

### Erreur : "Invitation non trouvée"
- **Cause** : Token expiré (7 jours)
- **Solution** : Demandez au manager de renvoyer l'invitation

### Erreur : "Email ne correspond pas"
- **Cause** : Email Clerk ≠ Email invitation
- **Solution** : Utilisez le même email pour Clerk

### Le membre ne voit rien sur son dashboard
- **Cause** : Aucun projet/tâche assigné
- **Solution** : Le manager doit assigner des projets au membre

---

## 📊 Commandes Utiles

### Vérifier la base de données
```bash
cd la-manufacture-api
node -e "import('pg').then(({default:pg})=>{const c=new pg.Pool({connectionString:process.env.DATABASE_URL});c.query('SELECT version()',(e,r)=>{console.log(e||r.rows[0]);c.end()})})"
```

### Tester l'envoi d'email
```bash
# Depuis la-manufacture-api
node -e "import('./src/services/email.js').then(m=>m.sendTestEmail('votre-email@gmail.com'))"
```

### Réinitialiser la base de données
```bash
# Attention : Supprime toutes les données !
cd la-manufacture-api
# Arrêtez le serveur puis redémarrez
npm run dev
# La migration recrée les tables
```

---

## 🎯 Récapitulatif des URLs

| Page | URL | Description |
|------|-----|-------------|
| Dashboard Manager | http://localhost:3000/team.html | Gestion équipe et invitations |
| Accepter invitation | http://localhost:3000/accept-invite.html?token=XXX | Page d'acceptation (lien dans email) |
| Dashboard Membre | http://localhost:3000/member.html | Espace membre (tâches/projets) |
| API Health | http://localhost:3333/health | Vérifier si API fonctionne |

---

## ✅ Checklist Finale

Avant de déployer en production :

- [ ] DATABASE_URL configuré et testé
- [ ] SMTP configuré et emails envoyés
- [ ] Migration réussie (tables créées)
- [ ] Test invitation envoi → acceptation → dashboard
- [ ] Test assignation projet → membre voit le projet
- [ ] Test log de temps fonctionne
- [ ] Vérifier que membres ne voient QUE leurs projets
- [ ] Configurer FRONTEND_URL pour production
- [ ] Changer NODE_ENV=production pour build final

---

## 🆘 Besoin d'Aide ?

Si vous avez des problèmes :

1. Vérifiez les logs du serveur backend
2. Ouvrez la console du navigateur (F12)
3. Vérifiez le fichier `.env` (pas d'espaces, pas de guillemets)
4. Redémarrez backend + frontend
5. Vérifiez que les ports 3000 et 3333 ne sont pas utilisés

**Logs utiles** :
```bash
# Backend
cd la-manufacture-api
npm run dev 2>&1 | tee logs.txt

# Voir les erreurs API dans le navigateur
# F12 → Console → Network → Cliquez sur une requête → Preview
```

Bon test ! 🚀
