import { isoLocal, ensureTask, nowISO, toast, celebrate } from './utils.js';
import { saveState, taskApi, isLoggedIn } from './storage.js';
import { isApiMode } from './api-client.js';

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
      window._renderCallback?.();
      return;
    }

    c.classList.add('animating');
    setTimeout(() => {
      task.done = true;
      task.updatedAt = nowISO();
      saveState(state);
      window._renderCallback?.();
      // 🎉 Célébration !
      celebrate();
      toast('✨ Bien joué !', 'success');
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
          toast('Tâche supprimée');
        } else if (action === 'tomorrow') {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          task.date = isoLocal(d);
          task.updatedAt = nowISO();
          toast('Reporté à demain');
        } else if (action === 'urgent') {
          task.urgent = !task.urgent;
          task.updatedAt = nowISO();
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

  // --- ZEN MODE BUTTON ---
  // On insère le bouton Mode Zen (Focus) avant la liste si il y a des tâches
  if (tasks.filter(t => !t.done).length > 0) {
    const focusContainer = document.createElement('div');
    focusContainer.className = 'focus-launch-container';
    focusContainer.innerHTML = `
        <button class="btn-focus-start" id="startZenMode">
           <span class="icon">🧘</span>
           <span class="text">Mode Focus</span>
        </button>
     `;
    focusContainer.querySelector('#startZenMode').addEventListener('click', () => {
      // Trigger Focus Mode
      const firstTask = tasks.find(t => !t.done);
      if (firstTask) {
        import('./focus-mode.js').then(mod => mod.startFocusMode(firstTask, state, window._renderCallback));
      }
    });
    dayList.appendChild(focusContainer);
  }

  if (tasks.length === 0) {
    dayList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">☀️</div>
        <p>Journée libre. Ajoutez une tâche pour commencer.</p>
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
    const tasks = state.tasks.filter(t => t.date === iso);
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
  addBtn.style.display = 'block';

  const tasks = state.tasks
    .map(t => ensureTask(t, state.settings.owners[0]))
    .filter(t => t.date === selectedDate);

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
        const commandBar = document.getElementById('commandbar');
        const input = document.getElementById('commandbar-input');
        if (commandBar && input) {
          commandBar.classList.add('active');
          input.focus();
        }
      }
    });
  }
};

export const initAddTask = (state, renderCallback) => {
  // handled by commandbar.js global redirect
};
