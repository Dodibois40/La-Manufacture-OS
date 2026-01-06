import { isoLocal, ensureTask, nowISO, toast } from './utils.js';
import { saveState, syncTaskToAPI } from './storage.js';

// Edit mode state
let editMode = false;
let selectedTasks = new Set();

const taskRow = (t, state) => {
  const task = ensureTask(t, state.settings.owners[0]);
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
  }

  // iOS Style Checkbox
  const c = document.createElement('div');
  c.className = 'check' + (task.done ? ' done' : '');
  c.addEventListener('click', (e) => {
    e.stopPropagation();
    if (editMode) return; // Disable in edit mode

    if (task.done) {
      task.done = false;
      task.updatedAt = nowISO();
      saveState(state);
      syncTaskToAPI(task, 'update');
      window._renderCallback?.();
      return;
    }

    c.classList.add('animating');
    setTimeout(() => {
      task.done = true;
      task.updatedAt = nowISO();
      saveState(state);
      syncTaskToAPI(task, 'update');
      window._renderCallback?.();
    }, 450);
  });

  const body = document.createElement('div');
  body.className = 'task-body';
  body.style.flex = '1';

  const tx = document.createElement('div');
  tx.className = 'text' + (task.done ? ' done' : '');
  tx.textContent = task.text;

  const meta = document.createElement('div');
  meta.className = 'meta';

  const ownerIcon = '👤';
  const urgentIcon = task.urgent ? ' 🔥' : '';
  meta.innerHTML = `<span class="meta-item">${ownerIcon} ${task.owner}${urgentIcon}</span>`;

  body.appendChild(tx);
  body.appendChild(meta);

  el.appendChild(c);
  el.appendChild(body);

  // Context menu (hidden in edit mode)
  if (!editMode) {
    const more = document.createElement('div');
    more.className = 'task-more';
    more.innerHTML = '⋮';
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.task-menu').forEach(m => m.remove());

      const menu = document.createElement('div');
      menu.className = 'task-menu';
      menu.innerHTML = `
        <div class="menu-item" data-action="urgent">🔥 ${task.urgent ? 'Enlever urgence' : 'Marquer urgent'}</div>
        <div class="menu-item" data-action="tomorrow">⏭️ Reporter à demain</div>
        <div class="menu-item danger" data-action="delete">🗑️ Supprimer</div>
      `;

      menu.addEventListener('click', (me) => {
        const target = me.target.closest('.menu-item');
        if (!target) return;
        const action = target.dataset.action;

        if (action === 'delete') {
          state.tasks = state.tasks.filter(item => item.id !== task.id);
          syncTaskToAPI(task, 'delete');
          toast('Tâche supprimée');
        } else if (action === 'tomorrow') {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          task.date = isoLocal(d);
          task.updatedAt = nowISO();
          syncTaskToAPI(task, 'update');
          toast('Reporté à demain');
        } else if (action === 'urgent') {
          task.urgent = !task.urgent;
          task.updatedAt = nowISO();
          syncTaskToAPI(task, 'update');
        }

        saveState(state);
        window._renderCallback?.();
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
  window._renderCallback?.();
};

const exitEditMode = () => {
  editMode = false;
  selectedTasks.clear();

  const editBar = document.getElementById('editBar');
  const dayActions = document.querySelector('.day-actions');

  if (editBar) editBar.classList.remove('active');
  if (dayActions) dayActions.style.display = 'flex';

  window._renderCallback?.();
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
      // Sync deletions to API
      for (const taskId of selectedTasks) {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) syncTaskToAPI(task, 'delete');
      }
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
  if (dayLabelEl) dayLabelEl.textContent = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const dayList = document.getElementById('dayList');
  if (!dayList) return;
  dayList.innerHTML = '';

  const tasks = state.tasks
    .map(t => ensureTask(t, state.settings.owners[0]))
    .filter(t => t.date === today)
    .sort((a, b) => (b.urgent === true) - (a.urgent === true) || (a.done === true) - (b.done === true));

  // Hide edit button if no tasks
  const editModeBtn = document.getElementById('editModeBtn');
  if (editModeBtn) {
    editModeBtn.style.display = tasks.length > 0 ? 'inline-flex' : 'none';
  }

  if (tasks.length === 0) {
    dayList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌟</div>
        <p>Rien de prévu pour l'instant. Profitez !</p>
      </div>
    `;
  } else {
    for (const t of tasks) dayList.appendChild(taskRow(t, state));
  }

  // Late tasks check
  const late = state.tasks
    .map(t => ensureTask(t, state.settings.owners[0]))
    .filter(t => t.date < today && !t.done);

  const lateBox = document.getElementById('lateBox');
  if (lateBox) {
    lateBox.innerHTML = '';
    if (late.length) {
      const w = document.createElement('div');
      w.className = 'warn';
      w.innerHTML = `<span>⚠️</span> <b>${late.length} tâche(s)</b> en retard sur les jours précédents.`;
      lateBox.appendChild(w);
    }
  }

  const done = tasks.filter(t => t.done).length;
  const progressBadge = document.getElementById('progressBadge');
  if (progressBadge) {
    progressBadge.textContent = `${done}/${tasks.length} aujourd'hui`;
    progressBadge.className = 'badge' + (done === tasks.length && tasks.length > 0 ? ' good' : '');
  }
};

export const renderWeek = (state) => {
  const box = document.getElementById('weekList');
  if (!box) return;
  box.innerHTML = '';

  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const mondayOffset = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - mondayOffset);

  const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getTime());
    d.setDate(base.getDate() + i);
    const iso = isoLocal(d);
    const isToday = iso === isoLocal(new Date());

    const tasks = state.tasks
      .map(t => ensureTask(t, state.settings.owners[0]))
      .filter(t => t.date === iso);

    const open = tasks.filter(t => !t.done).length;
    const progress = tasks.length === 0 ? 0 : (tasks.length - open) / tasks.length;

    const row = document.createElement('div');
    row.className = 'week-row' + (isToday ? ' current' : '');

    const dayMeta = document.createElement('div');
    dayMeta.className = 'week-day-meta';
    dayMeta.innerHTML = `
      <span class="week-day-name">${DAYS_SHORT[i]}</span>
      <span class="week-day-num">${d.getDate()}</span>
    `;

    const content = document.createElement('div');
    content.className = 'week-content';

    const count = document.createElement('div');
    count.className = 'week-count';
    if (tasks.length > 0) {
      count.innerHTML = `<b>${open}</b> restants <span class="dim">/ ${tasks.length}</span>`;

      const barWrap = document.createElement('div');
      barWrap.className = 'week-bar-wrap';
      const bar = document.createElement('div');
      bar.className = 'week-bar';
      bar.style.width = `${progress * 100}%`;
      if (progress === 1) bar.style.background = 'var(--ok)';
      barWrap.appendChild(bar);
      content.appendChild(count);
      content.appendChild(barWrap);
    } else {
      count.innerHTML = `<span class="dim">—</span>`;
      content.appendChild(count);
    }

    row.appendChild(dayMeta);
    row.appendChild(content);

    box.appendChild(row);
  }
};

export const initAddTask = (state, renderCallback) => {
  // handled by commandbar.js global redirect
};
