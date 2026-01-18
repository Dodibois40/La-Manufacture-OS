# FLOW - Roadmap Second Cerveau

## Vision

Transformer FLOW en un **second cerveau addictif** : vider sa tete, organiser, deleguer, suivre l'avancement. Une app tellement belle et intuitive qu'elle devient jouissive a utiliser.

---

## FAIT (Session du 13/01/2026)

### 1. Systeme de Gamification (`gamification.js`)

- **Streaks** : compteur de jours consecutifs avec celebration
- **Badges** (18 au total) :
  - Streaks : 3j, 7j, 30j
  - Productivite : Early Bird, Night Owl, Perfect Day, Perfect Week
  - Volume : 10, 50, 100, 500 taches
  - Focus : 1h, 10h, 50h cumulees
  - Team : Team Player, Leader
  - Special : Premier pas, Speed Demon
- **Niveaux** (1-10) : Novice -> Legende avec XP
- **Sons** : level up, badge, perfect day

### 2. Swipe Gestures (`swipe.js`)

- Swipe droite = marquer fait
- Swipe gauche = reporter a demain
- Indicateur visuel pendant le swipe
- Support tactile et souris

### 3. Vue Statistiques (`stats.js`)

- Carte niveau avec barre XP
- Grille stats : streak, taches totales, focus, perfect days
- Score de productivite (cercle anime)
- Graphique semaine (barres par jour)
- Grille des badges (debloque/verrouille)

### 4. Quick Dump (`quick-dump.js`)

- Modal "Vide ta tete" (Ctrl+Shift+N)
- Textarea multi-lignes (1 idee = 1 tache)
- Parsing automatique : dates, @owner, urgent, heure
- Tips integres

### 5. CSS Gamification (`gamification.css`)

- Styles streak widget
- Styles stats view complets
- Styles swipe indicators
- Styles quick dump modal
- Responsive mobile

### 6. Integration

- Imports ajoutes dans `app.js`
- `recordTaskCompletion()` appele dans `views.js`
- Quick dump shortcut initialise

---

## FAIT (Session du 14/01/2026)

### 1. Verification Email Clerk

- Formulaire de verification avec input code
- Gestion du workflow sign-up complet
- Deployed to production

### 2. Code Cleanup Production

- Supprime `window._` global callbacks
- Cree `app-callbacks.js` pour communication inter-modules
- Supprime imports inutilises (initAddTask, signOut, etc.)
- Traduit commentaires francais en anglais
- Supprime code mort (initAddTask stub, lateBox, auth.js)
- 217 lignes supprimees

### 3. UX Polish - P1 Items

- **Double-tap pour marquer fait** : event dblclick sur les taches
- **Animations spring** : cubic-bezier spring sur entree + hover/active
- **Sons par type d'action** : playSound.complete pour taches
- **Historique des badges** : notification custom + timeline dans Stats

### 4. UX Polish - P2 Items

- **Themes personnalisables** : Dark, Light, Sunset, Ocean avec CSS variables
- **Selecteur de theme** : UI dans Config avec preview des couleurs
- **Styles de celebration** : Confetti, Fireworks, Stars, None
- **Selecteur de celebration** : UI dans Config avec emojis

---

## A FAIRE (Prochaines sessions)

### P0 - Haute priorite (Addiction)

#### [x] Afficher le streak widget dans le header

```javascript
// Dans app.js ou views.js, ajouter le widget streak dans le header
// a cote du badge de progression
```

#### [x] Ajouter bouton Quick Dump flottant

```html
<!-- Dans index.html, ajouter avant </body> -->
<button class="quick-dump-trigger" id="quickDumpBtn">
  <svg>...</svg>
</button>
```

#### [x] Vue Stats accessible depuis nav

- Bouton Stats ajoute dans la nav (icone barres)
- Vue stats avec container dedie
- Navigation fonctionnelle

#### [x] Initialiser swipe sur la liste de taches

```javascript
// Dans views.js ou app.js apres render
initSwipeGestures(document.querySelector('#dayList'), {
  onDone: taskId => {
    /* mark done */
  },
  onTomorrow: taskId => {
    /* move to tomorrow */
  },
});
```

#### [x] Detection Perfect Day

```javascript
// Dans views.js, apres chaque completion, verifier si toutes les taches du jour sont faites
const todayTasks = state.tasks.filter(t => t.date === today);
if (todayTasks.length > 0 && todayTasks.every(t => t.done)) {
  recordPerfectDay();
}
```

### P1 - Moyenne priorite (UX)

#### [x] Double-tap pour marquer fait

- Event listener `dblclick` ajoute sur les taches
- Marque la tache comme faite avec animation

#### [x] Animations spring sur les taches

- Animation d'entree : `cubic-bezier(0.175, 0.885, 0.32, 1.275)` avec scale
- Transitions spring sur hover/active
- Effet de rebond subtil

#### [x] Historique des badges gagnes

- Notification custom glassmorphisme avec animation spring
- Timeline dans vue Stats avec badges recents
- Historique complet avec timestamps et temps relatifs

#### [x] Son different par type d'action

- Task complete : son "ding" leger (E5 -> G5)
- Badge : son existant (montee d'accord)
- Level up : fanfare existante (4 notes)
- Perfect day : cascade existante (5 notes)

### P2 - Basse priorite (Polish)

#### [x] Themes personnalisables

- Dark (actuel), Light, Sunset, Ocean
- Stocker dans settings

#### [x] Choix du style de celebration

- Confetti, Fireworks, Stars, None
- Stocker dans settings

#### [ ] Avatar/mascotte qui evolue

- Afficher icone du niveau actuel
- Animation quand on monte de niveau

#### [ ] Easter eggs

- Konami code -> confetti arc-en-ciel
- 100 taches en un jour -> celebration speciale

---

## IDEES FUTURES

### Organisation avancee

- [ ] Projets avec tags couleur (#travail, #perso)
- [ ] Vue Kanban : Inbox -> Aujourd'hui -> En cours -> Fait
- [ ] Liens entre taches (dependances)
- [ ] Notes attachees aux taches

### Equipe

- [ ] Vue "Mon equipe" : qui fait quoi aujourd'hui
- [ ] Timeline d'activite en temps reel
- [ ] Charge de travail par membre
- [ ] Notifications push quand tache assignee faite

### Intelligence

- [ ] Suggestions basees sur l'historique
- [ ] Auto-priorite des taches recurrentes non faites
- [ ] "Focus time" suggere selon patterns
- [ ] Rappels intelligents contextuels

### Calendrier

- [ ] Vue agenda integree (pas juste sync)
- [ ] Time blocking : bloquer du temps pour une tache
- [ ] Conflits visibles : RDV vs tache urgente

---

## FICHIERS CREES/MODIFIES

### Nouveaux fichiers

- `src/js/gamification.js` - Systeme de gamification complet
- `src/js/swipe.js` - Gestures swipe sur les taches
- `src/js/stats.js` - Vue statistiques
- `src/js/quick-dump.js` - Capture rapide
- `src/css/gamification.css` - Styles pour tout ca
- `src/css/themes.css` - Systeme de themes avec 4 variations
- `src/js/app-callbacks.js` - Communication inter-modules

### Fichiers modifies

- `index.html` - Import CSS gamification + theme selector + celebration selector
- `src/js/app.js` - Imports + init quick dump + theme management
- `src/js/views.js` - Import gamification + appel recordTaskCompletion
- `src/js/config.js` - Theme selector + celebration selector handlers
- `src/js/utils.js` - Celebration styles (confetti, fireworks, stars)
- `src/css/app.css` - Animations firework-particle et star-particle

---

## NOTES TECHNIQUES

### Structure gamification state (localStorage)

```javascript
{
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: "2026-01-13",
  totalTasksCompleted: 0,
  totalFocusMinutes: 0,
  totalDelegated: 0,
  perfectDays: 0,
  earlyBirdCount: 0,
  nightOwlCount: 0,
  speedDemonTasks: [],
  unlockedBadges: ["first_task", "streak_3"],
  badgeProgress: {}
}
```

### Raccourcis clavier

- `Ctrl+K` / `Ctrl+Space` : Command bar
- `Ctrl+Shift+N` : Quick dump

### XP rewards

- Task complete : 10 XP
- Task urgent : 15 XP
- Perfect day : 50 XP
- Streak day : 5 XP \* jours
- Focus session : 20 XP
- Badge unlock : 100 XP
