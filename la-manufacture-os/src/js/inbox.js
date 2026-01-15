import { isoLocal, ensureTask, nowISO, toast } from './utils.js';
import { saveState, taskApi, isLoggedIn } from './storage.js';
import { isApiMode, api } from './api-client.js';
import { isGoogleConnected, syncTaskToGoogle } from './google-calendar.js';
import { getTeamMembers, onTeamMembersChange } from './team.js';

// Clé API Anthropic pour Claude Opus 4.5
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export const inboxCtx = {
  dateISO: null, // null = auto-detect, otherwise manual override
  urgent: false,
  assignedMemberId: null, // null = self (manager), otherwise team member ID
  isProcessing: false,
};

// Prompt système pour Claude Opus 4.5
const buildSystemPrompt = () => `Tu es un assistant qui extrait des tâches à partir de texte dicté.

RÈGLES STRICTES:
1. Extrais CHAQUE action/tâche distincte mentionnée
2. Titre = MAXIMUM 8 MOTS, commence par un verbe à l'infinitif
3. Supprime tout le blabla, garde uniquement l'essentiel
4. Détecte les dates (demain, lundi, etc.) → format YYYY-MM-DD
5. Détecte l'urgence (urgent, vite, asap, important)
6. Détecte les personnes mentionnées (pour X, avec Y, appeler Z)

EXEMPLE D'ENTRÉE:
"bon alors aujourd'hui il faut que je finisse les trois étagères pour Bruno qui va venir les chercher et après faudra que je les livre à Hossegor, ah et aussi faut que j'aille chercher le tube en laiton à Cambo"

EXEMPLE DE SORTIE:
{
  "tasks": [
    {"text": "Finir les 3 étagères pour Bruno", "date": "2026-01-09", "urgent": false, "owner": null},
    {"text": "Livrer étagères à Hossegor", "date": "2026-01-09", "urgent": false, "owner": null},
    {"text": "Récupérer tube laiton à Cambo", "date": "2026-01-09", "urgent": false, "owner": null}
  ]
}

AUTRE EXEMPLE:
"faudra que je fasse la compta et après me préparer pour mon rendez-vous de ce soir"
→
{
  "tasks": [
    {"text": "Faire la compta", "date": "2026-01-09", "urgent": false, "owner": null},
    {"text": "Se préparer pour rendez-vous ce soir", "date": "2026-01-09", "urgent": false, "owner": null}
  ]
}

Date d'aujourd'hui: ${isoLocal()}

RÉPONDS UNIQUEMENT EN JSON VALIDE, rien d'autre.`;

// Appel à l'API Anthropic (Claude Opus 4.5)
async function parseWithClaude(text) {
  if (!ANTHROPIC_API_KEY) {
    return null; // Fallback au parsing local
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: `Voici ce que j'ai dicté/noté. Extrais toutes les tâches:\n\n"${text}"`
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Erreur API: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || '';

  // Parse le JSON de la réponse
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Réponse invalide de Claude');
  }

  return JSON.parse(jsonMatch[0]);
}

// Fallback: parsing local simple (une ligne = une tâche)
function parseLocally(text, defaultOwner, baseDate, forceUrgent) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  return {
    tasks: lines.map(line => ({
      text: line,
      date: baseDate,
      urgent: forceUrgent || /urgent|asap|vite|important|prioritaire/i.test(line),
      owner: defaultOwner
    }))
  };
}

const formatDateLabel = (iso) => {
  if (!iso) return 'Auto';
  const today = isoLocal();
  const tomorrow = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return isoLocal(d);
  })();

  if (iso === today) return "Aujourd'hui";
  if (iso === tomorrow) return 'Demain';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

export const setInboxDate = (iso) => {
  inboxCtx.dateISO = iso;

  const label = document.getElementById('inboxDateLabel');
  if (label) {
    label.textContent = formatDateLabel(iso);
  }

  const pickBtn = document.getElementById('inboxPickBtn');
  if (pickBtn) {
    pickBtn.classList.toggle('active', iso !== null);
  }
};

export const renderInboxUI = (state) => {
  const assignSel = document.getElementById('inboxOwner');
  if (!assignSel) return;

  // Get team members from team module
  const members = getTeamMembers();

  assignSel.innerHTML = '';

  // First option: Moi (manager's own tasks)
  const selfOpt = document.createElement('option');
  selfOpt.value = '';
  selfOpt.textContent = 'Moi';
  assignSel.appendChild(selfOpt);

  // Add team members
  for (const member of members) {
    const opt = document.createElement('option');
    opt.value = member.id;
    opt.textContent = member.name;
    assignSel.appendChild(opt);
  }

  // Set current value
  assignSel.value = inboxCtx.assignedMemberId || '';

  setInboxDate(inboxCtx.dateISO);

  const urgentBtn = document.getElementById('inboxUrgentBtn');
  if (urgentBtn) {
    urgentBtn.classList.toggle('active', inboxCtx.urgent);
  }
};

export const initInboxControls = (state, renderCallback) => {
  renderInboxUI(state);

  // Subscribe to team members changes to update dropdown
  onTeamMembersChange(() => {
    renderInboxUI(state);
  });

  const assignSel = document.getElementById('inboxOwner');
  if (assignSel) {
    assignSel.addEventListener('change', (e) => {
      // Empty string means "Moi" (manager's own task), otherwise it's a member ID
      inboxCtx.assignedMemberId = e.target.value || null;
    });
  }

  const urgentBtn = document.getElementById('inboxUrgentBtn');
  if (urgentBtn) {
    urgentBtn.addEventListener('click', () => {
      inboxCtx.urgent = !inboxCtx.urgent;
      urgentBtn.classList.toggle('active', inboxCtx.urgent);
      toast(inboxCtx.urgent ? 'Urgent activé' : 'Urgent désactivé');
    });
  }

  const dateInput = document.getElementById('inboxDateInput');
  const pickBtn = document.getElementById('inboxPickBtn');

  if (pickBtn && dateInput) {
    pickBtn.addEventListener('click', () => {
      if (inboxCtx.dateISO !== null) {
        setInboxDate(null);
        toast('Mode Auto');
      } else {
        dateInput.value = isoLocal();
        if (dateInput.showPicker) dateInput.showPicker();
        else dateInput.click();
      }
    });

    dateInput.addEventListener('change', () => {
      if (dateInput.value) {
        setInboxDate(dateInput.value);
        toast(`Date: ${formatDateLabel(dateInput.value)}`);
      }
    });
  }

  const ta = document.getElementById('inbox');
  if (ta) {
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('inboxBtn')?.click();
      }
    });
  }

  // Bouton Ajouter - avec parsing Claude Opus 4.5
  const inboxBtn = document.getElementById('inboxBtn');
  if (inboxBtn) {
    inboxBtn.addEventListener('click', async () => {
      const inboxTextarea = document.getElementById('inbox');
      const val = inboxTextarea?.value || '';
      const text = val.trim();

      if (!text) {
        toast('Rien à ajouter');
        return;
      }

      if (inboxCtx.isProcessing) return;

      const baseToday = isoLocal();

      // Get assigned member ID (null = manager's own task)
      const assignedMemberId = inboxCtx.assignedMemberId;

      // Activer le mode processing
      inboxCtx.isProcessing = true;
      const originalBtnText = inboxBtn.querySelector('span')?.textContent || 'Ajouter';
      if (inboxBtn.querySelector('span')) {
        inboxBtn.querySelector('span').textContent = 'Claude analyse...';
      }
      inboxBtn.disabled = true;

      let result;
      let usedAI = false;

      try {
        // Essayer Claude Opus 4.5
        if (ANTHROPIC_API_KEY) {
          result = await parseWithClaude(text);
          usedAI = true;
        }

        // Fallback local si pas de clé ou erreur
        if (!result) {
          const finalDate = inboxCtx.dateISO !== null ? inboxCtx.dateISO : baseToday;
          result = parseLocally(text, null, finalDate, inboxCtx.urgent);
        }

        // Créer les tâches
        let created = 0;
        for (const task of result.tasks) {
          const taskText = task.text?.trim();
          if (!taskText) continue;

          // Si date manuelle définie, l'utiliser en override
          const finalDate = inboxCtx.dateISO !== null ? inboxCtx.dateISO : (task.date || baseToday);
          // Si urgent manuel activé, forcer urgent
          const finalUrgent = inboxCtx.urgent || task.urgent || false;

          // If a team member is selected, assign to them via team API
          if (assignedMemberId && isApiMode && isLoggedIn()) {
            try {
              await api.team.addTask(assignedMemberId, taskText, finalDate, finalUrgent);
              created++;
              continue; // Skip normal task creation
            } catch (error) {
              console.error('Error assigning to team member:', error);
              toast('Erreur assignation: ' + error.message);
              continue;
            }
          }

          // Otherwise create as manager's own task
          // Detect if this is an event/RDV (has a specific time)
          let eventData = { is_event: false };
          if (isApiMode && isLoggedIn()) {
            try {
              eventData = await api.ai.detectEvent(taskText);
            } catch (e) {
              console.warn('Event detection failed:', e);
            }
          }

          const newTask = ensureTask({
            text: (eventData.isEvent && eventData.title) ? eventData.title : taskText,
            owner: null, // No longer using owner field
            urgent: finalUrgent,
            date: finalDate,
            done: false,
            updatedAt: nowISO(),
            // Event fields
            is_event: eventData.isEvent || false,
            start_time: eventData.startTime || null,
            end_time: eventData.endTime || null,
            location: eventData.location || null,
          });

          try {
            if (isApiMode && isLoggedIn()) {
              const apiTask = await taskApi.create(newTask);
              state.tasks.push(apiTask);

              // Sync to Google Calendar if event and connected
              if (apiTask.is_event) {
                if (isGoogleConnected()) {
                  try {
                    const googleEventId = await syncTaskToGoogle(apiTask);
                    if (googleEventId) {
                      await api.tasks.update(apiTask.id, { google_event_id: googleEventId });
                      apiTask.google_event_id = googleEventId;
                    }
                  } catch (syncError) {
                    console.warn('Google sync failed:', syncError);
                  }
                } else {
                  toast('RDV créé, mais Google Calendar non connecté', 'info');
                }
              }
            } else {
              state.tasks.push(newTask);
            }
            created++;
          } catch (error) {
            console.error('Erreur création tâche:', error);
            state.tasks.push(newTask);
            created++;
          }
        }

        // Clear et refresh
        if (inboxTextarea) inboxTextarea.value = '';
        saveState(state);
        renderCallback();

        if (created > 0) {
          const aiTag = usedAI ? ' ✨' : '';
          toast(`${created} tâche${created > 1 ? 's' : ''} ajoutée${created > 1 ? 's' : ''}${aiTag}`);
        } else {
          toast('Aucune tâche détectée');
        }

      } catch (error) {
        console.error('Erreur parsing:', error);
        toast(`Erreur: ${error.message}`, 'error');
      } finally {
        // Reset UI
        inboxCtx.isProcessing = false;
        if (inboxBtn.querySelector('span')) {
          inboxBtn.querySelector('span').textContent = originalBtnText;
        }
        inboxBtn.disabled = false;
      }
    });
  }
};
