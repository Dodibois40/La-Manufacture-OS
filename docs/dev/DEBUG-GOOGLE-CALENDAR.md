# 🔍 Debug Google Calendar Sync

Guide pour diagnostiquer et résoudre les problèmes de synchronisation Google Calendar.

## 🚀 Outil de Diagnostic

### Lancer l'outil de debug

1. Ouvrez votre navigateur et allez sur :

   ```
   http://localhost:3000/debug-google-sync.html
   ```

2. L'outil va automatiquement :
   - ✅ Vérifier votre connexion
   - ✅ Vérifier le statut Google Calendar
   - ✅ Lister tous vos RDV
   - ✅ Permettre de synchroniser manuellement

### Synchroniser un RDV manuellement

1. Dans l'outil de debug, sélectionnez le RDV dans la liste déroulante
2. Cliquez sur "Synchroniser Manuellement"
3. Si ça fonctionne, vous verrez un lien vers Google Calendar

## 🔧 Solutions aux problèmes courants

### ❌ Google Calendar non connecté

**Symptôme :** L'outil affiche "Google Calendar non connecté"

**Solution :**

1. Allez dans **Paramètres** de l'app
2. Cliquez sur **"Connecter Google Calendar"**
3. Autorisez l'accès

### ❌ "Missing required fields" ou "Invalid startTime"

**Symptôme :** Erreur lors de la synchronisation

**Problème :** Le RDV n'a pas d'heure de début (`start_time`)

**Solution :**

1. Éditez le RDV dans l'app
2. Ajoutez une heure (ex: "08:00" ou "14h30")
3. Réessayez la synchronisation

### ❌ Erreur 401 ou 403

**Symptôme :** "Unauthorized" ou "Forbidden"

**Problème :** Token Google expiré ou permissions insuffisantes

**Solution :**

1. Allez dans **Paramètres**
2. Cliquez sur **"Déconnecter"** Google Calendar
3. **Reconnectez-vous** pour rafraîchir les permissions
4. Vérifiez que vous autorisez bien l'accès à votre calendrier

### ❌ Aucun bouton de sync n'apparaît

**Symptôme :** Pas de bouton à côté du badge "RDV"

**Problème :** Le statut Google n'est pas détecté au démarrage

**Solution :**

1. Ouvrez la **Console du navigateur** (F12)
2. Cherchez les erreurs liées à Google
3. Rechargez la page (Ctrl+R ou Cmd+R)
4. Si le problème persiste, déconnectez et reconnectez Google

## 🔐 Vérifier les permissions Google

### Scopes requis

Le scope utilisé est : `https://www.googleapis.com/auth/calendar.events`

Ce scope permet de :

- ✅ Créer des événements
- ✅ Modifier des événements
- ✅ Supprimer des événements
- ✅ Lire les événements

### Vérifier vos permissions

1. Allez sur : https://myaccount.google.com/permissions
2. Trouvez "La Manufacture OS" ou votre app
3. Vérifiez que l'accès au calendrier est autorisé
4. Si les permissions sont limitées, révoquez et reconnectez-vous

## 📝 Logs utiles

### Dans la console du navigateur (F12)

Cherchez ces messages :

```
Google Calendar status: connected/not connected
syncTaskToGoogle called for task: {...}
Sync skipped: googleConnected= ...
```

### Dans les logs du backend

Si vous avez accès aux logs Railway :

```bash
railway logs
```

Cherchez :

```
Incoming sync-event request
Google Calendar sync error
Refreshing Google access token
```

## 🆘 Checklist de dépannage

- [ ] Google Calendar est connecté dans les Paramètres
- [ ] Le RDV a bien `is_event = true` (badge "RDV" visible)
- [ ] Le RDV a une heure de début (`start_time`)
- [ ] La page a été rechargée après la connexion Google
- [ ] Les variables d'environnement Google sont configurées dans le backend
- [ ] Le token Google n'est pas expiré
- [ ] Les permissions Google sont correctes

## 🔄 Reconnexion complète

Si rien ne fonctionne, reconnectez-vous complètement :

1. **Dans l'app :**
   - Paramètres → Déconnecter Google Calendar

2. **Sur Google :**
   - https://myaccount.google.com/permissions
   - Révoquer l'accès à l'application

3. **Reconnectez-vous :**
   - Paramètres → Connecter Google Calendar
   - Autorisez TOUTES les permissions demandées

4. **Testez :**
   - Créez un nouveau RDV avec une heure
   - Vérifiez qu'il apparaît dans Google Calendar

## 📞 Support

Si le problème persiste :

1. Utilisez l'outil de debug : `/debug-google-sync.html`
2. Copiez les logs de la section "5. Logs Console"
3. Vérifiez les erreurs dans la console du navigateur (F12)
