import { isoLocal, ensureTask, nowISO, toast } from './utils.js';
import { saveState, taskApi, isLoggedIn } from './storage.js';
import { isApiMode } from './api-client.js';

// Clé API Anthropic pour Claude Opus 4.5
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export const inboxCtx = {
  dateISO: null, // null = auto-detect, otherwise manual override
  urgent: false,
  owner: 'Thibaud',
  isProcessing: false,
};

// Prompt système pour Claude Opus 4.5
const buildSystemPrompt = () => `Tu es un assistant de productivité expert. L'utilisateur va te dicter ou écrire des notes en vrac, souvent de manière informelle, désorganisée, ou comme s'il parlait à voix haute.

Ta mission : extraire et structurer TOUTES les tâches/actions mentionnées.

RÈGLES IMPORTANTES:
1. Chaque action distincte = une tâche séparée
2. Détecte les dates relatives (demain, lundi, 15 janvier, la semaine prochaine, dans 3 jours, etc.) et convertis-les en dates absolues
3. Détecte l'urgence (urgent, asap, critique, important, vite, prioritaire, etc.)
4. Détecte les responsables si mentionnés ("pour Pierre", "avec Marie", "appeler Jean", etc.)
5. Reformule proprement le titre de chaque tâche (clair, concis, actionnable, commence par un verbe)
6. Si pas de date précise détectée, utilise la date du jour
7. Ne rate AUCUNE tâche mentionnée, même implicitement
8. Ignore les mots de liaison et reformule intelligemment

RÉPONDS UNIQUEMENT en JSON valide avec ce format:
{
  "tasks": [
    {
      "text": "Titre clair de la tâche",
      "date": "YYYY-MM-DD",
      "urgent": true ou false,
      "owner": "Prénom ou null"
    }
  ]
}

Date d'aujourd'hui: ${isoLocal()}`;

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
      model: 'claude-opus-4-5-20250514',
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
  const ownerSel = document.getElementById('inboxOwner');
  if (!ownerSel) return;

  const owners = (state.settings.owners || []).map(x => String(x || '').trim()).filter(Boolean);
  const safeOwners = owners.length ? owners : ['Thibaud'];

  ownerSel.innerHTML = '';
  for (const o of safeOwners) {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    ownerSel.appendChild(opt);
  }
  if (!safeOwners.includes(inboxCtx.owner)) inboxCtx.owner = safeOwners[0];
  ownerSel.value = inboxCtx.owner;

  setInboxDate(inboxCtx.dateISO);

  const urgentBtn = document.getElementById('inboxUrgentBtn');
  if (urgentBtn) {
    urgentBtn.classList.toggle('active', inboxCtx.urgent);
  }
};

export const initInboxControls = (state, renderCallback) => {
  renderInboxUI(state);

  const ownerSel = document.getElementById('inboxOwner');
  if (ownerSel) {
    ownerSel.addEventListener('change', (e) => {
      inboxCtx.owner = e.target.value;
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
      const owners = (state.settings.owners || []).map(x => String(x || '').trim()).filter(Boolean);
      const safeOwners = owners.length ? owners : ['Thibaud'];
      const defaultOwner = safeOwners.includes(inboxCtx.owner) ? inboxCtx.owner : safeOwners[0];

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
          result = parseLocally(text, defaultOwner, finalDate, inboxCtx.urgent);
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
          // Owner: celui détecté par Claude ou le défaut
          const finalOwner = task.owner || defaultOwner;

          const newTask = ensureTask({
            text: taskText,
            owner: finalOwner,
            urgent: finalUrgent,
            date: finalDate,
            done: false,
            updatedAt: nowISO()
          }, defaultOwner);

          try {
            if (isApiMode && isLoggedIn()) {
              const apiTask = await taskApi.create(newTask);
              state.tasks.push(apiTask);
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
