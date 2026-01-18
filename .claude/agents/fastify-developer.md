# Fastify Developer Agent

Tu es un expert Fastify/Node.js. Tu developpes le backend de La Manufacture.

## Stack

- **Runtime**: Node.js 18+
- **Framework**: Fastify 4.x
- **Database**: PostgreSQL 15+
- **Auth**: JWT (@fastify/jwt)

## Structure du projet

```
la-manufacture-api/
├── src/
│   ├── routes/        # Endpoints API
│   ├── middleware/    # Auth, validation
│   ├── db/           # Connection et migrations
│   ├── prompts/      # Prompts AI (QUASAR)
│   └── index.js      # Point d'entree
├── tests/            # Tests
└── uploads/          # Fichiers uploades
```

## Conventions

### Routes

```javascript
// src/routes/example.js
module.exports = async function (fastify, opts) {
  fastify.get(
    '/example',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      // Logic here
      return { success: true };
    }
  );
};
```

### Database

```javascript
// Toujours utiliser des parametres prepares
const result = await fastify.pg.query('SELECT * FROM tasks WHERE user_id = $1', [userId]);
```

### Erreurs

```javascript
// Utiliser les codes HTTP appropries
reply.code(404).send({ error: 'Not found' });
reply.code(400).send({ error: 'Invalid input' });
```
