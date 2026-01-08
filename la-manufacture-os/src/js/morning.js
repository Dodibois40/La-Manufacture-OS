import { isoLocal, nowISO } from './utils.js';

export const initMorningBriefing = (state) => {
    // Check if first launch of the day
    const today = isoLocal();
    const lastLaunch = localStorage.getItem('last_briefing');

    // If already seen today, skip (unless debug force)
    if (lastLaunch === today && !window.location.search.includes('forceBrief')) return;

    const user = state.settings.owners[0] || 'Thibaud';

    // Stats calculation
    const tasks = state.tasks || [];
    const todayCount = tasks.filter(t => !t.done && t.date === today).length;
    const urgentCount = tasks.filter(t => !t.done && t.urgent).length;
    const completedToday = tasks.filter(t => t.done && t.date === today).length;
    const totalToday = todayCount + completedToday;
    const progress = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

    const html = `
    <div id="briefOverlay" class="brief-overlay-spacex">
      <!-- Stars Background -->
      <div class="stars"></div>

      <!-- Planet Container - Earth -->
      <div class="planet-container">
        <div class="planet-glow"></div>
        <div class="planet">
          <div class="planet-surface"></div>
          <div class="planet-continents"></div>
          <div class="planet-clouds"></div>
          <div class="planet-cities"></div>
          <div class="planet-shadow"></div>
          <div class="planet-atmosphere"></div>
          <div class="planet-highlight"></div>
        </div>
      </div>

      <!-- Content Left Side -->
      <div class="brief-content-spacex">
        <h1 class="brief-greeting">BONJOUR ${user.toUpperCase()}</h1>
        <p class="brief-tagline">Voici ton briefing pour aujourd'hui</p>

        <div class="brief-stats-spacex">
          <div class="stat-row">
            <span class="stat-value">${todayCount}</span>
            <span class="stat-label">tâches à faire</span>
          </div>
          <div class="stat-row ${urgentCount > 0 ? 'urgent' : ''}">
            <span class="stat-value">${urgentCount}</span>
            <span class="stat-label">urgences</span>
          </div>
          <div class="stat-row">
            <span class="stat-value">${progress}%</span>
            <span class="stat-label">complété</span>
          </div>
        </div>

        <button class="btn-spacex" id="startDayBtn">
          <span>EXPLORER</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);

    document.getElementById('startDayBtn').addEventListener('click', () => {
        const el = document.getElementById('briefOverlay');
        const btn = document.getElementById('startDayBtn');

        // Feedback immédiat
        btn.style.transform = 'scale(0.95)';

        // Zoom into planet effect
        el.classList.add('launching');

        // Disparition
        setTimeout(() => {
            el.classList.add('hidden');
            localStorage.setItem('last_briefing', today);
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
                alert("Focus terminé ! Pause.");
                el.classList.remove('active');
            }
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            el.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
            document.title = `(${m}:${s < 10 ? '0' : ''}${s}) La Manufacture`;
        }, 1000);
    };
};
