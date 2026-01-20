# Security First - Guide de Sécurité Obligatoire

## Principe Fondamental

**La sécurité est la priorité absolue.** Chaque fonctionnalité, chaque ligne de code doit être évaluée sous l'angle de la sécurité AVANT d'être implémentée.

---

## Checklist Obligatoire

### Avant chaque développement

- [ ] Les secrets sont-ils uniquement côté backend ?
- [ ] Les données utilisateur sont-elles validées/échappées ?
- [ ] L'authentification est-elle vérifiée sur chaque route sensible ?
- [ ] Les erreurs ne leakent-elles pas d'informations ?

### Avant chaque commit

- [ ] Aucun secret dans le code (API keys, passwords, tokens)
- [ ] Aucun `console.log` avec des données sensibles
- [ ] Les fichiers `.env` sont dans `.gitignore`

---

## Règles de Sécurité

### 1. Gestion des Secrets

```javascript
// ❌ INTERDIT - Secret côté frontend
const VITE_API_KEY = 'sk-xxx'; // Exposé dans le bundle JS

// ✅ OBLIGATOIRE - Secret côté backend uniquement
const API_KEY = process.env.API_KEY; // Jamais préfixé VITE_
```

**Règles :**

- JAMAIS de clés API dans le frontend (pas de préfixe `VITE_` pour les secrets)
- Toutes les clés sensibles dans les variables d'environnement backend
- Rotation des clés si compromises (même suspicion)

### 2. Authentification & Autorisation

```javascript
// ❌ INTERDIT - Route sans authentification
fastify.get('/user-data', async request => {
  return getUserData(request.query.userId);
});

// ✅ OBLIGATOIRE - Authentification + vérification propriétaire
fastify.get('/user-data', { preHandler: [fastify.authenticate] }, async request => {
  const { userId } = request.user; // Depuis le token, pas la query
  return getUserData(userId);
});
```

**Règles :**

- Toute route sensible DOIT avoir `preHandler: [fastify.authenticate]`
- L'userId vient TOUJOURS du token JWT, JAMAIS de la requête client
- Vérifier que l'utilisateur est propriétaire de la ressource

### 3. Validation des Entrées

```javascript
// ❌ INTERDIT - Données utilisateur non validées
const { title } = request.body;
await query(`INSERT INTO tasks (title) VALUES ('${title}')`);

// ✅ OBLIGATOIRE - Paramètres préparés + validation schema
const schema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 500 },
    },
  },
};
fastify.post('/tasks', { schema }, async request => {
  const { title } = request.body;
  await query('INSERT INTO tasks (title) VALUES ($1)', [title]);
});
```

**Règles :**

- TOUJOURS utiliser des paramètres préparés ($1, $2...)
- TOUJOURS définir un schema Fastify pour valider les entrées
- Limiter la longueur des chaînes (maxLength)
- Échapper le HTML avant affichage (`escapeHtml()`)

### 4. Gestion des Erreurs

```javascript
// ❌ INTERDIT - Fuite d'informations
return reply.status(500).send({
  error: 'Database error',
  details: error.message, // Révèle la structure DB
  stack: error.stack, // Révèle le code source
});

// ✅ OBLIGATOIRE - Message générique + log serveur
fastify.log.error({ error: error.message, userId }, 'Database operation failed');
return reply.status(500).send({
  error: 'Operation failed', // Message générique uniquement
});
```

**Règles :**

- JAMAIS `error.message` ou `error.stack` dans les réponses API
- Logger les détails côté serveur uniquement
- Messages d'erreur génériques pour le client

### 5. Stockage des Données Sensibles

```javascript
// ❌ INTERDIT - Tokens en clair dans la DB
await query('INSERT INTO tokens (access_token) VALUES ($1)', [accessToken]);

// ✅ OBLIGATOIRE - Chiffrement AES-256-GCM
import { encrypt, decrypt } from '../utils/crypto.js';
const encryptedToken = encrypt(accessToken);
await query('INSERT INTO tokens (access_token) VALUES ($1)', [encryptedToken]);
```

**Règles :**

- Tokens OAuth chiffrés avec AES-256-GCM
- Mots de passe hashés avec bcrypt (cost >= 12)
- ENCRYPTION_KEY de 32 bytes minimum

### 6. OAuth & CSRF

```javascript
// ❌ INTERDIT - State prévisible
const state = `user_${userId}`;

// ✅ OBLIGATOIRE - State signé avec HMAC
import { createOAuthState, verifyOAuthState } from '../utils/crypto.js';
const state = createOAuthState(userId); // Inclut timestamp + random + signature
// Dans callback:
const result = verifyOAuthState(state);
if (!result.valid) return error;
```

**Règles :**

- State OAuth signé avec HMAC-SHA256
- Inclure timestamp pour expiration (10 min max)
- Vérifier la signature avant d'utiliser le state

### 7. Headers de Sécurité

```javascript
// ✅ OBLIGATOIRE - Helmet configuré
import helmet from '@fastify/helmet';
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.clerk.com', 'https://api.anthropic.com'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
});
```

### 8. Frontend - Stockage Local

```javascript
// ❌ INTERDIT - Token en localStorage
localStorage.setItem('token', jwtToken); // Vulnérable XSS

// ✅ OBLIGATOIRE - Session gérée par le provider (Clerk)
// Ne stocker que les données non-sensibles
localStorage.setItem('preferences', JSON.stringify({ theme: 'dark' }));
```

**Règles :**

- JAMAIS de tokens JWT en localStorage
- Utiliser la session du provider d'auth (Clerk)
- Données utilisateur non-sensibles uniquement

### 9. Upload de Fichiers

```javascript
// ✅ OBLIGATOIRE - Validation complète
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Vérifier MIME type
if (!ALLOWED_TYPES.includes(file.mimetype)) {
  return reply.status(400).send({ error: 'File type not allowed' });
}

// Vérifier taille
if (file.size > MAX_SIZE) {
  return reply.status(400).send({ error: 'File too large' });
}

// Générer nom aléatoire (ne pas garder le nom original)
const filename = `${crypto.randomUUID()}.${extension}`;
```

### 10. Rate Limiting

```javascript
// ✅ OBLIGATOIRE - Limites par endpoint
await fastify.register(rateLimit, {
  global: true,
  max: 100, // 100 req/min par défaut
  timeWindow: 60000,
});

// Routes sensibles: limites plus strictes
fastify.post(
  '/auth/login',
  {
    config: { rateLimit: { max: 5, timeWindow: 60000 } },
  },
  handler
);
```

---

## Checklist Déploiement

### Variables d'environnement (Railway/Production)

```
DATABASE_URL=postgresql://...         # Connexion SSL obligatoire
ENCRYPTION_KEY=<64-char-hex>          # Généré avec: openssl rand -hex 32
JWT_SECRET=<random-256-bit>           # Différent de dev
CLERK_SECRET_KEY=sk_live_...          # Clé production
GOOGLE_CLIENT_SECRET=...              # Credentials production
NODE_ENV=production                   # Active les protections
```

### SSL/TLS

```javascript
// Production: SSL strict obligatoire
ssl: process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: true } // Vérifier le certificat
  : false;
```

---

## Outils de Vérification

```bash
# Vérifier les secrets dans le code
git secrets --scan

# Headers de sécurité
curl -I https://api.example.com | grep -i "security\|strict\|x-"

# Test SSL
openssl s_client -connect api.example.com:443

# Audit dépendances
npm audit
```

---

## En Cas de Compromission

1. **Rotation immédiate** de toutes les clés affectées
2. **Révoquer** les tokens/sessions existants
3. **Analyser** les logs pour identifier l'étendue
4. **Nettoyer** l'historique Git si secrets commités
5. **Notifier** les utilisateurs si données personnelles affectées

```bash
# Supprimer un fichier de tout l'historique Git
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all
```

---

## Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Clerk Security](https://clerk.com/docs/security/overview)
