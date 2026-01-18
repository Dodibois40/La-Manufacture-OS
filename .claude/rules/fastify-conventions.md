# Fastify Conventions

## Structure des routes

```javascript
// src/routes/[resource].js
module.exports = async function (fastify, opts) {
  // GET /resource
  fastify.get('/', async (request, reply) => {});

  // GET /resource/:id
  fastify.get('/:id', async (request, reply) => {});

  // POST /resource
  fastify.post('/', async (request, reply) => {});

  // PUT /resource/:id
  fastify.put('/:id', async (request, reply) => {});

  // DELETE /resource/:id
  fastify.delete('/:id', async (request, reply) => {});
};
```

## Authentication

```javascript
// Route protegee
fastify.get(
  '/protected',
  {
    preHandler: [fastify.authenticate],
  },
  async (request, reply) => {
    const userId = request.user.id;
    // ...
  }
);
```

## Validation

```javascript
const schema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 },
      description: { type: 'string' },
    },
  },
};

fastify.post('/', { schema }, async (request, reply) => {});
```

## Reponses

```javascript
// Succes
return { success: true, data: result };

// Erreur
reply.code(400).send({ error: 'Message explicite' });

// Not found
reply.code(404).send({ error: 'Resource not found' });
```

## Database

```javascript
// Toujours utiliser des parametres prepares
const { rows } = await fastify.pg.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [
  taskId,
  userId,
]);
```
