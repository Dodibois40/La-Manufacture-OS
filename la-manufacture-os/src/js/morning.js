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
      <div class="stars"></div>
      <div class="planet-container">
        <div class="planet-glow"></div>
        <div class="planet">
          <div class="planet-day"></div>
          <div class="planet-clouds"></div>
          <div class="planet-cities-mask">
            <div class="planet-night"></div>
          </div>
          <div class="planet-shadow"></div>
          <div class="planet-atmosphere"></div>
        </div>
      </div>

      <!-- Content - Centered Mission Control Style -->
      <div class="brief-content-mission">
        <div class="mission-date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</div>
        <h1 class="mission-greeting">Bonjour, ${user}</h1>
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
        const el = document.getElementById('briefOverlay');
        const btn = document.getElementById('startDayBtn');

        // Feedback immédiat
        btn.style.transform = 'scale(0.95)';

        // Zoom into planet effect
        el.classList.add('launching');

        // Show main content
        document.body.classList.remove('briefing-active');

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
