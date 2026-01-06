import { toast } from './utils.js';
import { loadState, saveState, initStorageUI } from './storage.js';
import { renderDay, renderWeek, initAddTask, initEditMode } from './views.js';
import { renderInboxUI, initInboxControls, inboxCtx } from './inbox.js';
import { renderConfig, initConfig } from './config.js';
import { initCommandBar } from './commandbar.js';
import { runAutoCarryOver } from './carryover.js';
import { initMorningBriefing, initFocusTimer } from './morning.js';
import { initSpeechToText } from './speech.js';

// Load state
let state = loadState();
window._debugState = state; // Expose for debugging
state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
state.settings = state.settings && typeof state.settings === 'object' ? state.settings : { owners: ['Thibaud'] };
state.settings.owners = Array.isArray(state.settings.owners) && state.settings.owners.length ? state.settings.owners : ['Thibaud'];

// Auto Carry-Over (Silent)
runAutoCarryOver(state);

// Init inbox context
inboxCtx.owner = state.settings.owners[0] || 'Thibaud';

// Storage UI
initStorageUI();

// Navigation
const views = ['day', 'week', 'inbox', 'config'];
const setView = (name) => {
  for (const v of views) {
    const el = document.getElementById('view-' + v);
    const nb = document.getElementById('nav-' + v);
    if (el) el.classList.toggle('active', v === name);
    if (nb) nb.classList.toggle('active', v === name);
  }
  render();
};

// Store setView globally for config.js to access
window._setViewCallback = setView;

// Master render
const render = () => {
  renderDay(state);
  renderWeek(state);
  renderInboxUI(state);
  renderConfig(state);
};

// Store render globally for views.js to access
window._renderCallback = render;

// Navigation listeners
document.getElementById('nav-day')?.addEventListener('click', () => setView('day'));
document.getElementById('nav-week')?.addEventListener('click', () => setView('week'));
document.getElementById('nav-inbox')?.addEventListener('click', () => setView('inbox'));
document.getElementById('nav-config')?.addEventListener('click', () => setView('config'));

// Init modules
initInboxControls(state, render);
initConfig(state, render);
initEditMode(state, render);
initCommandBar(state, render);
initMorningBriefing(state);
initFocusTimer();
initSpeechToText();

// Initial render
render();
toast('Prêt');
