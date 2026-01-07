import { isoLocal, ensureTask, nowISO, toast } from './utils.js';
import { smartParseDate, smartParseUrgent, smartParseOwner, cleanTitle } from './parser.js';
import { saveState, taskApi, isLoggedIn } from './storage.js';
import { isApiMode } from './api-client.js';

export const inboxCtx = {
  dateISO: null, // null = auto-detect, otherwise manual override
  urgent: false,
  owner: 'Thibaud',
};

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
      // Toggle: if already has a date, reset to auto
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

  // SMART Inbox Button
  const inboxBtn = document.getElementById('inboxBtn');
  if (inboxBtn) {
    inboxBtn.addEventListener('click', async () => {
      const val = document.getElementById('inbox')?.value || '';
      const baseToday = isoLocal();

      const owners = (state.settings.owners || []).map(x => String(x || '').trim()).filter(Boolean);
      const safeOwners = owners.length ? owners : ['Thibaud'];
      const defaultOwner = safeOwners.includes(inboxCtx.owner) ? inboxCtx.owner : safeOwners[0];

      const lines = val.split('\n');
      let created = 0;
      const tasksToCreate = [];

      for (const line of lines) {
        const raw = String(line || '').trim();
        if (!raw) continue;

        const autoDate = smartParseDate(raw, baseToday);
        const autoUrgent = smartParseUrgent(raw);
        const autoOwner = smartParseOwner(raw, safeOwners, defaultOwner);
        const title = cleanTitle(raw, safeOwners);

        if (!title) continue;

        const finalDate = inboxCtx.dateISO !== null ? inboxCtx.dateISO : autoDate;
        const finalUrgent = inboxCtx.urgent || autoUrgent;
        const finalOwner = autoOwner;

        const newTask = ensureTask({
          text: title,
          owner: finalOwner,
          urgent: finalUrgent,
          date: finalDate,
          done: false,
          updatedAt: nowISO()
        }, state.settings.owners[0]);

        tasksToCreate.push(newTask);
      }

      // Clear textarea immediately
      const inboxTextarea = document.getElementById('inbox');
      if (inboxTextarea) inboxTextarea.value = '';

      // Create tasks (API or local)
      for (const task of tasksToCreate) {
        try {
          if (isApiMode && isLoggedIn()) {
            const apiTask = await taskApi.create(task);
            state.tasks.push(apiTask);
          } else {
            state.tasks.push(task);
          }
          created++;
        } catch (error) {
          console.error('Failed to create task:', error);
          // Still add locally as fallback
          state.tasks.push(task);
          created++;
        }
      }

      saveState(state);
      renderCallback();

      if (created > 0) {
        toast(`${created} tâche${created > 1 ? 's' : ''} ajoutée${created > 1 ? 's' : ''}`);
      } else {
        toast('Rien à ajouter');
      }
    });
  }
};
