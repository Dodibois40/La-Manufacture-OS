import { isoLocal } from './utils.js';
import { playStartupSound } from './startup-sound.js';

export const initMorningBriefing = async (state, user = null) => {
  // Check if first launch of the day
  const today = isoLocal();
  let lastLaunch = null;
  try {
    lastLaunch = localStorage.getItem('last_briefing');
  } catch (e) {
    // localStorage indisponible (nav privee iOS)
  }

  // If already seen today, skip (unless debug force)
  if (lastLaunch === today && !window.location.search.includes('forceBrief')) return;

  const userName = user?.name || 'Moi';

  // Stats calculation
  const tasks = state.tasks || [];
  const todayCount = tasks.filter(t => !t.done && (t.date || '').split('T')[0] === today).length;
  const urgentCount = tasks.filter(t => !t.done && t.urgent).length;

  const html = `
    <div id="briefOverlay" class="brief-overlay-spacex">
      <div class="stars"></div>
      <div class="sunrise-bg"></div>

      <!-- Content - Centered Mission Control Style -->
      <div class="brief-content-mission">
        <div class="mission-date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div>
        <h1 class="mission-greeting">Bonjour, ${userName}</h1>
        <p class="mission-tagline">${todayCount > 0 ? `${todayCount} objectif${todayCount > 1 ? 's' : ''} aujourd'hui.` : 'Aucune mission planifiée.'}</p>
        ${urgentCount > 0 ? `<p class="mission-urgent">${urgentCount} prioritaire${urgentCount > 1 ? 's' : ''}</p>` : ''}
        <button class="btn-mission" id="startDayBtn">
          C'est parti
        </button>
      </div>
    </div>
  `;

  // Hide main content while briefing is shown
  document.body.classList.add('briefing-active');

  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstElementChild);

  document.getElementById('startDayBtn').addEventListener('click', () => {
    playStartupSound();

    const el = document.getElementById('briefOverlay');
    const btn = document.getElementById('startDayBtn');

    // Feedback immédiat
    btn.style.transform = 'scale(0.95)';

    // Solar flare effect
    el.classList.add('launching');

    // Show main content
    document.body.classList.remove('briefing-active');

    // Disparition
    setTimeout(() => {
      el.classList.add('hidden');
      try {
        localStorage.setItem('last_briefing', today);
      } catch (e) {}
    }, 600);

    // Cleanup
    setTimeout(() => el.remove(), 1000);
  });
};

// Simple global Focus Timer
export const initFocusTimer = () => {
  const div = document.createElement('div');
  div.id = 'focusTimer';
  div.className = 'focus-timer';
  div.innerHTML = '25:00';
  document.body.appendChild(div);

  let interval = null;
  let seconds = 25 * 60;

  window.startFocus = () => {
    const el = document.getElementById('focusTimer');
    el.classList.add('active');
    seconds = 25 * 60;

    if (interval) clearInterval(interval);

    interval = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(interval);
        alert('Focus terminé ! Pause.');
        el.classList.remove('active');
      }
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      el.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      document.title = `(${m}:${s < 10 ? '0' : ''}${s}) La Manufacture`;
    }, 1000);
  };
};
