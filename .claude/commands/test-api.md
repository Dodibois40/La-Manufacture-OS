# /test-api

Lance les tests de l'API.

## Tests unitaires

```bash
cd la-manufacture-api && npm test
```

## Tests manuels

### Auth

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

### Tasks

```bash
# Get tasks
curl http://localhost:3000/api/tasks \
  -H "Cookie: token=YOUR_JWT_TOKEN"

# Create task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -d '{"title":"Test task"}'
```

### AI Parser

```bash
# Test QUASAR parser
cd la-manufacture-api && node tests/test-parser-direct.js
```
