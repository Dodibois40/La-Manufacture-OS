import { isoLocal, ensureTask, nowISO, toast, celebrate } from './utils.js';
import { saveState, taskApi, isLoggedIn } from './storage.js';
import { isApiMode, api } from './api-client.js';
import { openShareModal } from './share.js';
import { initSwipeGestures } from './swipe.js';
import { appCallbacks } from './app-callbacks.js';
import { isGoogleConnected, syncTaskToGoogle, deleteGoogleEvent } from './google-calendar.js';

// Inspirational quotes collection - 60+ citations pour ne jamais voir les memes
const QUOTES = [
  // Classiques
  { text: "La simplicité est la sophistication suprême.", author: "Léonard de Vinci" },
  { text: "Le seul moyen de faire du bon travail est d'aimer ce que vous faites.", author: "Steve Jobs" },
  { text: "Commencez là où vous êtes. Utilisez ce que vous avez. Faites ce que vous pouvez.", author: "Arthur Ashe" },
  { text: "Le succès c'est d'aller d'échec en échec sans perdre son enthousiasme.", author: "Winston Churchill" },
  { text: "La meilleure façon de prédire l'avenir est de le créer.", author: "Peter Drucker" },
  { text: "Un voyage de mille lieues commence par un seul pas.", author: "Lao Tseu" },
  { text: "Ce n'est pas le vent qui décide de votre destination, c'est l'orientation que vous donnez à votre voile.", author: "Jim Rohn" },
  { text: "L'excellence n'est pas un acte, mais une habitude.", author: "Aristote" },
  { text: "La discipline est le pont entre les objectifs et l'accomplissement.", author: "Jim Rohn" },

  // Productivité & Focus
  { text: "Concentrez tous vos efforts sur un seul point, et vous serez étonné du résultat.", author: "Swami Vivekananda" },
  { text: "Ce qui se mesure s'améliore.", author: "Peter Drucker" },
  { text: "Le temps est la ressource la plus rare. Si on ne le gère pas, rien d'autre ne peut être géré.", author: "Peter Drucker" },
  { text: "Fais ce que tu peux, avec ce que tu as, là où tu es.", author: "Theodore Roosevelt" },
  { text: "Une tâche commencée est une tâche à moitié terminée.", author: "Proverbe" },
  { text: "Le secret pour avancer est de commencer.", author: "Mark Twain" },
  { text: "Ne remettez jamais à demain ce que vous pouvez faire aujourd'hui.", author: "Benjamin Franklin" },
  { text: "La productivité n'est jamais un accident. C'est toujours le résultat d'un engagement vers l'excellence.", author: "Paul J. Meyer" },

  // Motivation & Action
  { text: "Le moment présent est le seul moment sur lequel nous avons du contrôle.", author: "Bouddha" },
  { text: "Les grands accomplissements sont le résultat de petits efforts quotidiens.", author: "Robert Collier" },
  { text: "Agissez comme s'il était impossible d'échouer.", author: "Dorothea Brande" },
  { text: "Ce n'est pas parce que les choses sont difficiles que nous n'osons pas, c'est parce que nous n'osons pas qu'elles sont difficiles.", author: "Sénèque" },
  { text: "La seule limite à notre épanouissement de demain sera nos doutes d'aujourd'hui.", author: "Franklin D. Roosevelt" },
  { text: "Croyez que vous pouvez et vous êtes déjà à mi-chemin.", author: "Theodore Roosevelt" },
  { text: "L'action est la clé fondamentale de tout succès.", author: "Pablo Picasso" },
  { text: "Il n'y a qu'une façon d'éviter les critiques: ne rien faire, ne rien dire et n'être rien.", author: "Aristote" },

  // Persévérance
  { text: "Je n'ai pas échoué. J'ai simplement trouvé 10 000 solutions qui ne fonctionnent pas.", author: "Thomas Edison" },
  { text: "Le succès n'est pas final, l'échec n'est pas fatal: c'est le courage de continuer qui compte.", author: "Winston Churchill" },
  { text: "Les obstacles sont ces choses effrayantes que vous voyez quand vous quittez votre objectif des yeux.", author: "Henry Ford" },
  { text: "La persévérance n'est pas une longue course; c'est plusieurs petites courses les unes après les autres.", author: "Walter Elliot" },
  { text: "Notre plus grande gloire n'est pas de ne jamais tomber, mais de nous relever chaque fois.", author: "Confucius" },
  { text: "Le succès est la somme de petits efforts répétés jour après jour.", author: "Robert Collier" },

  // Créativité & Innovation
  { text: "La créativité, c'est l'intelligence qui s'amuse.", author: "Albert Einstein" },
  { text: "L'innovation distingue un leader d'un suiveur.", author: "Steve Jobs" },
  { text: "Soyez vous-même, tous les autres sont déjà pris.", author: "Oscar Wilde" },
  { text: "La logique vous mènera de A à B. L'imagination vous mènera partout.", author: "Albert Einstein" },
  { text: "Les esprits créatifs survivent à tout.", author: "Anna Freud" },

  // Leadership & Travail d'équipe
  { text: "Le talent gagne des matchs, mais le travail d'équipe et l'intelligence gagnent des championnats.", author: "Michael Jordan" },
  { text: "Seul on va plus vite, ensemble on va plus loin.", author: "Proverbe africain" },
  { text: "Un leader est quelqu'un qui connaît le chemin, montre le chemin et emprunte le chemin.", author: "John C. Maxwell" },
  { text: "Le meilleur moyen de diriger est de montrer l'exemple.", author: "Jack Welch" },

  // Sagesse & Philosophie
  { text: "Celui qui déplace une montagne commence par déplacer de petites pierres.", author: "Confucius" },
  { text: "La vie est ce qui arrive quand vous êtes occupé à faire d'autres projets.", author: "John Lennon" },
  { text: "Nous sommes ce que nous faisons de manière répétée. L'excellence n'est donc pas un acte, mais une habitude.", author: "Will Durant" },
  { text: "Le bonheur n'est pas quelque chose de tout fait. Il vient de vos propres actions.", author: "Dalaï Lama" },
  { text: "La connaissance parle, mais la sagesse écoute.", author: "Jimi Hendrix" },
  { text: "Votre temps est limité, ne le gâchez pas en vivant la vie de quelqu'un d'autre.", author: "Steve Jobs" },

  // Ambition & Rêves
  { text: "Visez la lune. Même si vous la manquez, vous atterrirez parmi les étoiles.", author: "Oscar Wilde" },
  { text: "Le futur appartient à ceux qui croient à la beauté de leurs rêves.", author: "Eleanor Roosevelt" },
  { text: "N'attendez pas d'être parfait pour commencer. Commencez et vous serez parfait.", author: "Proverbe" },
  { text: "Les grandes choses ne sont jamais faites par une seule personne. Elles sont faites par une équipe.", author: "Steve Jobs" },
  { text: "Faites de votre vie un rêve, et d'un rêve, une réalité.", author: "Antoine de Saint-Exupéry" },

  // Changement & Adaptation
  { text: "Le changement est la loi de la vie. Et ceux qui ne regardent que le passé ou le présent manqueront certainement l'avenir.", author: "John F. Kennedy" },
  { text: "Si vous voulez des résultats différents, ne faites pas toujours la même chose.", author: "Albert Einstein" },
  { text: "L'adaptabilité n'est pas une imitation. Cela signifie le pouvoir de résistance et d'assimilation.", author: "Mahatma Gandhi" },
  { text: "Tout ce que l'esprit peut concevoir et croire, il peut le réaliser.", author: "Napoleon Hill" },

  // Minimalisme & Essentialisme
  { text: "La perfection est atteinte, non pas lorsqu'il n'y a plus rien à ajouter, mais lorsqu'il n'y a plus rien à retirer.", author: "Antoine de Saint-Exupéry" },
  { text: "Moins mais mieux.", author: "Dieter Rams" },
  { text: "Celui qui sait qu'il en a assez est riche.", author: "Lao Tseu" },
  { text: "L'essentiel est invisible pour les yeux.", author: "Antoine de Saint-Exupéry" },

  // Sport & Performance
  { text: "Je ne perds jamais. Soit je gagne, soit j'apprends.", author: "Nelson Mandela" },
  { text: "La douleur que vous ressentez aujourd'hui sera la force que vous ressentirez demain.", author: "Arnold Schwarzenegger" },
  { text: "Les champions continuent de jouer jusqu'à ce qu'ils réussissent.", author: "Billie Jean King" },
  { text: "La différence entre l'impossible et le possible réside dans la détermination.", author: "Tommy Lasorda" }
];

// Shuffle array using Fisher-Yates algorithm (seeded for consistency within 2min windows)
const shuffleWithSeed = (array, seed) => {
  const shuffled = [...array];
  let m = shuffled.length, t, i;
  while (m) {
    i = Math.floor(((seed * 9301 + 49297) % 233280) / 233280 * m--);
    seed = (seed * 9301 + 49297) % 233280;
    t = shuffled[m];
    shuffled[m] = shuffled[i];
    shuffled[i] = t;
  }
  return shuffled;
};

// Get current quote - changes every 2 minutes
const getQuoteOfDay = () => {
  const now = Date.now();
  const twoMinutes = 2 * 60 * 1000;
  const windowIndex = Math.floor(now / twoMinutes);

  // Use window index as seed for shuffling, then pick based on window
  const shuffled = shuffleWithSeed(QUOTES, Math.floor(windowIndex / QUOTES.length));
  return shuffled[windowIndex % QUOTES.length];
};

// Start quote rotation interval
let quoteInterval = null;
const startQuoteRotation = () => {
  if (quoteInterval) return;
  quoteInterval = setInterval(() => {
    const quoteEl = document.querySelector('.daily-inspiration');
    if (quoteEl) {
      const quote = getQuoteOfDay();
      quoteEl.innerHTML = `
        <p class="inspiration-text">"${quote.text}"</p>
        <p class="inspiration-author">— ${quote.author}</p>
      `;
      // Add fade animation
      quoteEl.classList.remove('fade-in');
      void quoteEl.offsetWidth; // Trigger reflow
      quoteEl.classList.add('fade-in');
    } else {
      // If element not found (view changed), stop rotation
      stopQuoteRotation();
    }
  }, 2 * 60 * 1000); // Every 2 minutes
};

// Stop quote rotation and cleanup interval
export const stopQuoteRotation = () => {
  if (quoteInterval) {
    clearInterval(quoteInterval);
    quoteInterval = null;
  }
};

// Edit mode state
let editMode = false;
let selectedTasks = new Set();

// Focus 3 collapse state (session only)
let moreTasksExpanded = false;
let doneTasksExpanded = false;
let overdueExpanded = false;

const taskRow = (t, state) => {
  const task = ensureTask(t, 'Moi');
  const el = document.createElement('div');
  el.className = 'task' + (task.done ? ' completed' : '');
  el.dataset.taskId = task.id;

  // In edit mode, add selectable class
  if (editMode) {
    el.classList.add('selectable');
    if (selectedTasks.has(task.id)) {
      el.classList.add('selected');
    }
    el.addEventListener('click', () => {
      if (selectedTasks.has(task.id)) {
        selectedTasks.delete(task.id);
        el.classList.remove('selected');
      } else {
        selectedTasks.add(task.id);
        el.classList.add('selected');
      }
      updateSelectedCount();
    });
  } else {
    // Double-tap/double-click to mark as done
    el.addEventListener('dblclick', (e) => {
      if (task.done) return; // Already done

      // Mark as done with animation
      const checkbox = el.querySelector('.check');
      if (checkbox) {
        checkbox.classList.add('animating');
      }

      setTimeout(() => {
        task.done = true;
        task.updatedAt = nowISO();
        saveState(state);
        appCallbacks.render?.();
        celebrate();
        toast('Fait');
      }, 450);
    });
  }

  // iOS Style Checkbox
  const c = document.createElement('div');
  c.className = 'check' + (task.done ? ' done' : '');
  c.addEventListener('click', (e) => {
    e.stopPropagation();
    if (editMode) return; // Disable in edit mode

    c.classList.add('animating');
    setTimeout(async () => {
      task.done = true;
      task.updatedAt = nowISO();

      if (isApiMode && isLoggedIn()) {
        try {
          await taskApi.update(task.id, { done: true });
        } catch (e) {
          console.error('API update failed:', e);
        }
      }

      saveState(state);
      appCallbacks.render?.();
      celebrate();
      toast('Fait');
    }, 450);
  });

  // Handle uncheck separately to be clearer
  if (task.done) {
    c.addEventListener('click', async (e) => {
      e.stopPropagation();
      task.done = false;
      task.updatedAt = nowISO();

      if (isApiMode && isLoggedIn()) {
        try {
          await taskApi.update(task.id, { done: false });
        } catch (e) {
          console.error('API update failed:', e);
        }
      }

      saveState(state);
      appCallbacks.render?.();
    });
  }

  const body = document.createElement('div');
  body.className = 'task-body';
  body.style.flex = '1';

  const tx = document.createElement('div');
  tx.className = 'text' + (task.done ? ' done' : '');

  // If event, show time before text
  if (task.is_event && task.start_time) {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'task-event-time';
    timeSpan.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${task.start_time.slice(0, 5)}`;
    tx.appendChild(timeSpan);
  }

  tx.appendChild(document.createTextNode(task.text));

  // Add event badge if it's a RDV
  if (task.is_event) {
    const eventBadge = document.createElement('span');
    eventBadge.className = 'task-event-badge';
    eventBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>RDV`;
    tx.appendChild(eventBadge);

    // Add Google Calendar sync button if connected
    if (isGoogleConnected()) {
      const syncBtn = document.createElement('button');
      syncBtn.className = 'google-sync-btn';
      syncBtn.title = task.google_event_id ? 'Synchronisé avec Google Calendar' : 'Cliquez pour synchroniser avec Google Calendar';
      syncBtn.innerHTML = task.google_event_id
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01" fill="none" stroke="currentColor" stroke-width="2"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      syncBtn.style.opacity = task.google_event_id ? '0.5' : '1';
      syncBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!task.google_event_id) {
          try {
            const googleEventId = await syncTaskToGoogle(task);
            if (googleEventId) {
              if (isApiMode && isLoggedIn()) {
                await api.tasks.update(task.id, { google_event_id: googleEventId });
                task.google_event_id = googleEventId;
              }
              toast('✅ Synchronisé avec Google Calendar');
              if (appCallbacks.render) appCallbacks.render();
            }
          } catch (error) {
            console.error('Sync error:', error);
            toast('❌ Erreur de synchronisation');
          }
        }
      });
      tx.appendChild(syncBtn);
    }
  }

  const meta = document.createElement('div');
  meta.className = 'meta';

  const ownerIcon = '👤';
  const urgentIcon = task.urgent ? ' 🔥' : '';

  // Indicateur de partage si la tache vient de quelqu'un d'autre
  let sharedIndicator = '';
  if (task.shared_by_name) {
    sharedIndicator = `<span class="meta-item shared-indicator">📤 De ${task.shared_by_name}</span>`;
  }

  // Location indicator for events
  let locationIndicator = '';
  if (task.is_event && task.location) {
    locationIndicator = `<span class="meta-item task-event-location"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${task.location}</span>`;
  }

  meta.innerHTML = `<span class="meta-item">${ownerIcon} ${task.owner}${urgentIcon}</span>${locationIndicator}${sharedIndicator}`;

  body.appendChild(tx);
  body.appendChild(meta);

  el.appendChild(c);
  el.appendChild(body);

  // Quick Actions Bar (visible on hover)
  if (!editMode) {
    const quickActions = document.createElement('div');
    quickActions.className = 'task-quick-actions';

    // Tomorrow action
    const tomorrowBtn = document.createElement('button');
    tomorrowBtn.className = 'quick-action-btn';
    tomorrowBtn.title = 'Reporter à demain';
    tomorrowBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    tomorrowBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const newDate = isoLocal(d);
      task.date = newDate;
      task.updatedAt = nowISO();

      if (isApiMode && isLoggedIn()) {
        try {
          await taskApi.update(task.id, { date: newDate });
          // Re-sync to Google if it's an event
          if (task.is_event) {
            if (isGoogleConnected()) {
              await syncTaskToGoogle(task);
            } else {
              toast('Mis à jour, mais Google non connecté', 'info');
            }
          }
        } catch (e) {
          console.error('API update failed:', e);
        }
      }

      saveState(state);
      appCallbacks.render?.();
      toast('→ Demain');
    });

    // Focus/Timer action
    const focusBtn = document.createElement('button');
    focusBtn.className = 'quick-action-btn focus';
    focusBtn.title = 'Lancer le timer';
    focusBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      import('./focus-mode.js').then(mod => mod.startFocusMode(task, state, appCallbacks.render));
    });

    // Urgent toggle action
    const urgentBtn = document.createElement('button');
    urgentBtn.className = 'quick-action-btn' + (task.urgent ? ' active' : '');
    urgentBtn.title = task.urgent ? 'Enlever urgence' : 'Marquer urgent';
    urgentBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    urgentBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newUrgent = !task.urgent;
      task.urgent = newUrgent;
      task.updatedAt = nowISO();

      if (isApiMode && isLoggedIn()) {
        try {
          await taskApi.update(task.id, { urgent: newUrgent });
        } catch (e) {
          console.error('API update failed:', e);
        }
      }

      saveState(state);
      appCallbacks.render?.();
      toast(task.urgent ? '🔥 Urgent' : 'Urgence retirée');
    });

    quickActions.appendChild(tomorrowBtn);
    if (!task.done) quickActions.appendChild(focusBtn);
    quickActions.appendChild(urgentBtn);

    el.appendChild(quickActions);

    // Context menu (three dots)
    const more = document.createElement('div');
    more.className = 'task-more';
    more.innerHTML = '⋮';
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.task-menu').forEach(m => m.remove());

      const menu = document.createElement('div');
      menu.className = 'task-menu';

      // Option Partager uniquement en mode API et pour les taches qu'on possede
      const isOwned = !task.access_type || task.access_type === 'owner';
      const shareOption = isApiMode && isOwned
        ? `<div class="menu-item" data-action="share">📤 Partager</div>`
        : '';

      menu.innerHTML = `
        <div class="menu-item" data-action="urgent">🔥 ${task.urgent ? 'Enlever urgence' : 'Marquer urgent'}</div>
        <div class="menu-item" data-action="tomorrow">⏭️ Reporter à demain</div>
        <div class="menu-item" data-action="next-week">📅 Semaine prochaine</div>
        ${shareOption}
        <div class="menu-item danger" data-action="delete">🗑️ Supprimer</div>
      `;

      menu.addEventListener('click', async (me) => {
        const target = me.target.closest('.menu-item');
        if (!target) return;
        const action = target.dataset.action;

        if (action === 'delete') {
          if (isApiMode && isLoggedIn()) {
            try {
              await taskApi.delete(task.id);
              if (task.google_event_id) {
                await deleteGoogleEvent(task.google_event_id);
              }
            } catch (e) {
              console.error('API delete failed:', e);
            }
          }
          state.tasks = state.tasks.filter(item => item.id !== task.id);
          toast('Tâche supprimée');
        } else if (action === 'tomorrow') {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          const newDate = isoLocal(d);
          task.date = newDate;
          task.updatedAt = nowISO();
          if (isApiMode && isLoggedIn()) {
            await taskApi.update(task.id, { date: newDate });
            if (task.is_event) {
              if (isGoogleConnected()) await syncTaskToGoogle(task);
              else toast('Google non connecté', 'info');
            }
          }
          toast('Reporté à demain');
        } else if (action === 'next-week') {
          const d = new Date();
          const dayOfWeek = d.getDay();
          const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
          d.setDate(d.getDate() + daysUntilMonday);
          const newDate = isoLocal(d);
          task.date = newDate;
          task.updatedAt = nowISO();
          if (isApiMode && isLoggedIn()) {
            await taskApi.update(task.id, { date: newDate });
            if (task.is_event) {
              if (isGoogleConnected()) await syncTaskToGoogle(task);
              else toast('Google non connecté', 'info');
            }
          }
          toast('Reporté à lundi prochain');
        } else if (action === 'urgent') {
          const newUrgent = !task.urgent;
          task.urgent = newUrgent;
          task.updatedAt = nowISO();
          if (isApiMode && isLoggedIn()) {
            await taskApi.update(task.id, { urgent: newUrgent });
          }
        } else if (action === 'share') {
          openShareModal(task.id, task.text);
          menu.remove();
          return; // Ne pas sauvegarder/rerender
        }

        saveState(state);
        appCallbacks.render?.();
        menu.remove();
      });

      const rect = more.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = `${rect.bottom + 5}px`;
      menu.style.right = `${window.innerWidth - rect.right}px`;
      menu.style.zIndex = '9999';

      const closeMenu = (ce) => {
        if (!menu.contains(ce.target) && ce.target !== more) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 10);

      document.body.appendChild(menu);
    });
    el.appendChild(more);
  }

  return el;
};

const updateSelectedCount = () => {
  const countEl = document.getElementById('selectedCount');
  if (countEl) {
    const count = selectedTasks.size;
    countEl.textContent = `${count} sélectionnée${count > 1 ? 's' : ''}`;
  }
};

const enterEditMode = () => {
  editMode = true;
  selectedTasks.clear();

  const editBar = document.getElementById('editBar');
  const editModeBtn = document.getElementById('editModeBtn');
  const dayActions = document.querySelector('.day-actions');

  if (editBar) editBar.classList.add('active');
  if (dayActions) dayActions.style.display = 'none';

  updateSelectedCount();
  appCallbacks.render?.();
};

const exitEditMode = () => {
  editMode = false;
  selectedTasks.clear();

  const editBar = document.getElementById('editBar');
  const dayActions = document.querySelector('.day-actions');

  if (editBar) editBar.classList.remove('active');
  if (dayActions) dayActions.style.display = 'flex';

  appCallbacks.render?.();
};

export const initEditMode = (state, renderCallback) => {
  const editModeBtn = document.getElementById('editModeBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

  if (editModeBtn) {
    editModeBtn.addEventListener('click', enterEditMode);
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', exitEditMode);
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', () => {
      if (selectedTasks.size === 0) {
        toast('Aucune tâche sélectionnée');
        return;
      }

      const count = selectedTasks.size;
      state.tasks = state.tasks.filter(t => !selectedTasks.has(t.id));
      saveState(state);

      toast(`${count} tâche${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}`);
      exitEditMode();
    });
  }
};

export const renderDay = (state) => {
  const d = new Date();
  const today = isoLocal(d);

  const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  const dayNumEl = document.getElementById('dayNum');
  const dayLabelEl = document.getElementById('dayLabel');

  if (dayNumEl) dayNumEl.textContent = String(d.getDate());
  if (dayLabelEl) dayLabelEl.textContent = `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]}`;

  const dayList = document.getElementById('dayList');
  if (!dayList) return;
  dayList.innerHTML = '';

  // Get overdue tasks (not done, date < today)
  const overdueTasks = state.tasks
    .map(t => ensureTask(t, 'Moi'))
    .filter(t => t.date < today && !t.done)
    .sort((a, b) => (b.urgent === true) - (a.urgent === true));

  // Get today's tasks
  const todayTasks = state.tasks
    .map(t => ensureTask(t, 'Moi'))
    .filter(t => (t.date || '').split('T')[0] === today)
    .sort((a, b) => (b.urgent === true) - (a.urgent === true) || (a.done === true) - (b.done === true));

  // Combined count for edit button
  const allTasks = [...overdueTasks, ...todayTasks];

  // Hide edit button if no tasks
  const editModeBtn = document.getElementById('editModeBtn');
  if (editModeBtn) {
    editModeBtn.style.display = allTasks.length > 0 ? 'inline-flex' : 'none';
  }

  // Always show inspirational quote at the top
  const quote = getQuoteOfDay();
  const quoteEl = document.createElement('div');
  quoteEl.className = 'daily-inspiration';
  quoteEl.innerHTML = `
    <p class="inspiration-text">"${quote.text}"</p>
    <p class="inspiration-author">— ${quote.author}</p>
  `;
  dayList.appendChild(quoteEl);

  // --- ZEN MODE BUTTON ---
  const pendingTasks = allTasks.filter(t => !t.done);
  if (pendingTasks.length > 0) {
    const focusContainer = document.createElement('div');
    focusContainer.className = 'focus-launch-container';
    focusContainer.innerHTML = `
        <button class="btn-focus-start" id="startZenMode">
           <svg class="focus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <circle cx="12" cy="12" r="10"/>
             <circle cx="12" cy="12" r="6"/>
             <circle cx="12" cy="12" r="2"/>
           </svg>
           <span class="text">Mode Focus</span>
        </button>
     `;
    focusContainer.querySelector('#startZenMode').addEventListener('click', () => {
      const firstTask = pendingTasks[0];
      if (firstTask) {
        import('./focus-mode.js').then(mod => mod.startFocusMode(firstTask, state, appCallbacks.render));
      }
    });
    dayList.appendChild(focusContainer);
  }

  // ═══════════════════════════════════════════════════════════════
  // "CERVEAU VIDÉ" INDICATOR - Trust signal for cognitive offloading
  // Shows when: no overdue tasks + all today's tasks done
  // ═══════════════════════════════════════════════════════════════
  const allTodayDone = todayTasks.length > 0 && todayTasks.every(t => t.done);
  const noOverdue = overdueTasks.length === 0;

  if (noOverdue && allTodayDone) {
    const brainClearEl = document.createElement('div');
    brainClearEl.className = 'brain-clear-indicator';
    brainClearEl.innerHTML = `
      <div class="brain-clear-icon">✓</div>
      <div class="brain-clear-text">
        <span class="brain-clear-title">Esprit clair</span>
        <span class="brain-clear-sub">Rien à traiter, profite du moment.</span>
      </div>
    `;
    dayList.appendChild(brainClearEl);
  }

  // ═══════════════════════════════════════════════════════════════
  // OVERDUE SECTION - Make it actionable with "Rescue All" button
  // ═══════════════════════════════════════════════════════════════
  if (overdueTasks.length > 0) {
    const overdueSection = document.createElement('div');
    overdueSection.className = 'overdue-section';
    overdueSection.innerHTML = `
      <div class="section-header overdue">
        <span class="section-icon">⚠️</span>
        <span class="section-title">En retard</span>
        <span class="section-count">${overdueTasks.length}</span>
        <button class="rescue-all-btn" id="rescueAllBtn">Tout à aujourd'hui</button>
      </div>
    `;
    dayList.appendChild(overdueSection);

    // Handle "Rescue All" button
    const rescueBtn = overdueSection.querySelector('#rescueAllBtn');
    if (rescueBtn) {
      rescueBtn.addEventListener('click', async () => {
        rescueBtn.disabled = true;
        rescueBtn.textContent = '...';

        for (const task of overdueTasks) {
          task.date = today;
          task.updatedAt = nowISO();
          if (isApiMode && isLoggedIn()) {
            try {
              await taskApi.update(task.id, { date: today });
            } catch (e) {
              console.error('API update failed:', e);
            }
          }
        }

        saveState(state);
        toast(`${overdueTasks.length} tâche${overdueTasks.length > 1 ? 's' : ''} reprogrammée${overdueTasks.length > 1 ? 's' : ''}`);
        appCallbacks.render?.();
      });
    }

    // Focus 3: show max 3 overdue tasks
    const focusOverdue = overdueTasks.slice(0, 3);
    const moreOverdue = overdueTasks.slice(3);

    for (const t of focusOverdue) {
      const row = taskRow(t, state);
      row.classList.add('overdue-task');
      dayList.appendChild(row);
    }

    // Show "more" button if needed
    if (moreOverdue.length > 0) {
      const moreContainer = document.createElement('div');
      moreContainer.className = 'collapsed-tasks' + (overdueExpanded ? ' expanded' : '');
      for (const t of moreOverdue) {
        const row = taskRow(t, state);
        row.classList.add('overdue-task');
        moreContainer.appendChild(row);
      }

      const moreBtn = document.createElement('button');
      moreBtn.className = 'show-more-tasks';
      moreBtn.innerHTML = overdueExpanded
        ? `<span class="show-more-icon">−</span> Masquer`
        : `<span class="show-more-icon">+</span> ${moreOverdue.length} autre${moreOverdue.length > 1 ? 's' : ''} en retard`;
      moreBtn.addEventListener('click', () => {
        overdueExpanded = !overdueExpanded;
        appCallbacks.render?.();
      });

      dayList.appendChild(moreBtn);
      dayList.appendChild(moreContainer);
    }
  }

  // --- TODAY SECTION with Focus 3 ---
  // Separate pending and done tasks
  const pendingToday = todayTasks.filter(t => !t.done);
  const doneToday = todayTasks.filter(t => t.done);

  if (todayTasks.length > 0 || overdueTasks.length > 0) {
    if (overdueTasks.length > 0) {
      // Only show header if we have overdue section above
      const todaySection = document.createElement('div');
      todaySection.className = 'today-section';
      todaySection.innerHTML = `
        <div class="section-header today">
          <span class="section-icon">☀️</span>
          <span class="section-title">Aujourd'hui</span>
          <span class="section-count">${pendingToday.length}</span>
        </div>
      `;
      dayList.appendChild(todaySection);
    }

    // Focus 3: show max 3 pending tasks
    const focusTasks = pendingToday.slice(0, 3);
    const moreTasks = pendingToday.slice(3);

    for (const t of focusTasks) {
      dayList.appendChild(taskRow(t, state));
    }

    // Show "more" button for additional pending tasks
    if (moreTasks.length > 0) {
      const moreContainer = document.createElement('div');
      moreContainer.className = 'collapsed-tasks' + (moreTasksExpanded ? ' expanded' : '');
      for (const t of moreTasks) {
        moreContainer.appendChild(taskRow(t, state));
      }

      const moreBtn = document.createElement('button');
      moreBtn.className = 'show-more-tasks';
      moreBtn.innerHTML = moreTasksExpanded
        ? `<span class="show-more-icon">−</span> Masquer`
        : `<span class="show-more-icon">+</span> ${moreTasks.length} autre${moreTasks.length > 1 ? 's' : ''} tâche${moreTasks.length > 1 ? 's' : ''}`;
      moreBtn.addEventListener('click', () => {
        moreTasksExpanded = !moreTasksExpanded;
        appCallbacks.render?.();
      });

      dayList.appendChild(moreBtn);
      dayList.appendChild(moreContainer);
    }

    // Show done tasks collapsed
    if (doneToday.length > 0) {
      const doneBtn = document.createElement('button');
      doneBtn.className = 'show-more-tasks done-toggle';
      doneBtn.innerHTML = doneTasksExpanded
        ? `<span class="show-more-icon">−</span> Masquer terminées`
        : `<span class="show-more-icon">✓</span> ${doneToday.length} terminée${doneToday.length > 1 ? 's' : ''}`;
      doneBtn.addEventListener('click', () => {
        doneTasksExpanded = !doneTasksExpanded;
        appCallbacks.render?.();
      });

      const doneContainer = document.createElement('div');
      doneContainer.className = 'collapsed-tasks done-section' + (doneTasksExpanded ? ' expanded' : '');
      for (const t of doneToday) {
        doneContainer.appendChild(taskRow(t, state));
      }

      dayList.appendChild(doneBtn);
      dayList.appendChild(doneContainer);
    }
  }

  // Empty state
  if (allTasks.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'day-empty-state';
    emptyEl.innerHTML = `
      <p>Aucune tâche pour aujourd'hui</p>
      <p class="empty-hint">Appuie sur <kbd>Ctrl</kbd> + <kbd>Space</kbd> pour ajouter</p>
    `;
    dayList.appendChild(emptyEl);
  }

  // Progress badge - include overdue in count
  const totalPending = allTasks.filter(t => !t.done).length;
  const totalDone = allTasks.filter(t => t.done).length;
  const progressBadge = document.getElementById('progressBadge');
  if (progressBadge) {
    if (overdueTasks.length > 0) {
      progressBadge.textContent = `${totalDone}/${allTasks.length} (+${overdueTasks.length} retard)`;
      progressBadge.className = 'badge bad';
    } else {
      progressBadge.textContent = `${totalDone}/${todayTasks.length} aujourd'hui`;
      progressBadge.className = 'badge' + (totalDone === todayTasks.length && todayTasks.length > 0 ? ' good' : '');
    }
  }

  // Init swipe gestures
  initSwipeGestures(dayList, {
    onDone: (taskId) => {
      const task = state.tasks.find(t => t.id === taskId);
      if (task && !task.done) {
        task.done = true;
        task.updatedAt = nowISO();
        saveState(state);
        celebrate();
        toast('Fait!');
        appCallbacks.render?.();
      }
    },
    onTomorrow: (taskId) => {
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        task.date = isoLocal(d);
        task.updatedAt = nowISO();
        saveState(state);
        toast('-> Demain');
        appCallbacks.render?.();
      }
    }
  });

  // Start quote rotation only when day view is active
  startQuoteRotation();
};

// Planning calendar state
let currentMonth = new Date();
let selectedDate = null;

export const renderWeek = (state) => {
  renderPlanning(state);
};

const renderPlanning = (state) => {
  renderCalendar(state);
  renderDayDetail(state);
};

const renderCalendar = (state) => {
  const grid = document.getElementById('calendarGrid');
  const titleEl = document.getElementById('monthTitle');
  if (!grid || !titleEl) return;

  // Update title
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  titleEl.textContent = `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  grid.innerHTML = '';

  // Day headers
  const dayHeaders = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  dayHeaders.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = day;
    grid.appendChild(header);
  });

  // Get first day of month
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  // Get offset (Monday = 0)
  const startOffset = (firstDay.getDay() + 6) % 7;

  // Previous month days
  const prevMonthLastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const cell = createCalendarDay(day, true, state);
    grid.appendChild(cell);
  }

  // Current month days
  const today = isoLocal(new Date());
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const iso = isoLocal(date);
    const cell = createCalendarDay(day, false, state, date, iso === today, iso);
    grid.appendChild(cell);
  }

  // Next month days to fill grid
  const totalCells = grid.children.length - 7; // Minus headers
  const remainingCells = 42 - totalCells - 7; // 6 weeks * 7 days
  for (let day = 1; day <= remainingCells; day++) {
    const cell = createCalendarDay(day, true, state);
    grid.appendChild(cell);
  }
};

const createCalendarDay = (dayNumber, otherMonth, state, date = null, isToday = false, iso = null) => {
  const cell = document.createElement('div');
  cell.className = 'calendar-day';
  if (otherMonth) cell.classList.add('other-month');
  if (isToday) cell.classList.add('today');
  if (selectedDate && iso === selectedDate) cell.classList.add('selected');

  const number = document.createElement('div');
  number.className = 'calendar-day-number';
  number.textContent = dayNumber;
  cell.appendChild(number);

  if (iso && !otherMonth) {
    const tasks = state.tasks.filter(t => (t.date || '').split('T')[0] === iso);
    const openTasks = tasks.filter(t => !t.done).length;

    if (tasks.length > 0) {
      cell.classList.add('has-tasks');
      const count = document.createElement('div');
      count.className = 'calendar-day-count';
      count.textContent = `${openTasks}/${tasks.length}`;
      cell.appendChild(count);
    }

    cell.addEventListener('click', () => {
      selectedDate = iso;
      renderPlanning(state);
    });
  }

  return cell;
};

const renderDayDetail = (state) => {
  const titleEl = document.getElementById('selectedDayTitle');
  const listEl = document.getElementById('dayTasksList');
  const addBtn = document.getElementById('addTaskToDay');

  if (!titleEl || !listEl || !addBtn) return;

  if (!selectedDate) {
    titleEl.textContent = 'Sélectionne un jour';
    listEl.innerHTML = '<div class="empty-state">Clique sur un jour pour voir ses tâches</div>';
    addBtn.style.display = 'none';
    return;
  }

  const date = new Date(selectedDate + 'T00:00:00');
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  titleEl.textContent = `${dayNames[date.getDay()]} ${date.getDate()}`;
  addBtn.style.display = 'inline-flex';

  const tasks = state.tasks
    .map(t => ensureTask(t, 'Moi'))
    .filter(t => (t.date || '').split('T')[0] === selectedDate);

  listEl.innerHTML = '';

  if (tasks.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Aucune tâche ce jour-là</div>';
  } else {
    tasks.forEach(task => {
      listEl.appendChild(taskRow(task, state));
    });
  }
};

// Initialize month navigation
export const initPlanningControls = (state, renderCallback) => {
  const prevBtn = document.getElementById('prevMonth');
  const nextBtn = document.getElementById('nextMonth');
  const addBtn = document.getElementById('addTaskToDay');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentMonth.setMonth(currentMonth.getMonth() - 1);
      renderCallback();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      renderCallback();
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (selectedDate) {
        // Open command bar with pre-filled date
        const overlay = document.getElementById('cmdBarOverlay');
        const input = document.getElementById('cmdInput');
        if (overlay && input) {
          // Format date for display
          const date = new Date(selectedDate + 'T00:00:00');
          const day = date.getDate();
          const month = date.getMonth() + 1;
          const dateStr = `${day}/${month}`;

          overlay.classList.add('active');
          input.value = `${dateStr} `;
          input.focus();
          // Trigger preview update
          input.dispatchEvent(new Event('input'));
        }
      }
    });
  }
};

