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
    const late = tasks.filter(t => !t.done && t.date < today).length; // Should be 0 if carry-over ran, but good to check
    const todayCount = tasks.filter(t => !t.done && t.date === today).length;
    const urgentCount = tasks.filter(t => !t.done && t.urgent).length;

    const html = `
    <div id="briefOverlay" class="brief-overlay">
      <!-- Siri Vortex Effect -->
      <div class="siri-vortex">
        <div class="vortex-orb"></div>
        <div class="vortex-orb"></div>
        <div class="vortex-orb"></div>
        <div class="vortex-orb"></div>
        <div class="vortex-orb"></div>
        <div class="vortex-wave"></div>
      </div>

      <div class="brief-title">Bonjour ${user}</div>
      <div class="brief-subtitle">Voici ton briefing pour aujourd'hui</div>

      <div class="brief-stat">
        <div class="stat-box">
          <div class="b-num">${todayCount}</div>
          <div class="b-lbl">Tâches du jour</div>
        </div>
        <div class="stat-box">
          <div class="b-num" style="color:#ff453a">${urgentCount}</div>
          <div class="b-lbl">Urgences</div>
        </div>
        <div class="stat-box">
          <div class="b-num" style="color:var(--text-sec)">${Math.floor(Math.random() * 20 + 70)}%</div>
          <div class="b-lbl">Énergie</div>
        </div>
      </div>

      <button class="start-btn" id="startDayBtn">Lancer la journée</button>
    </div>
  `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);

    document.getElementById('startDayBtn').addEventListener('click', () => {
        const el = document.getElementById('briefOverlay');
        const btn = document.getElementById('startDayBtn');

        // Feedback immédiat sur le bouton
        btn.style.transform = 'scale(0.95)';
        btn.style.opacity = '0.8';

        // Phase 1: Vortex s'intensifie
        el.classList.add('launching');

        // Phase 2: Flash blanc subtil + fondu
        setTimeout(() => {
            el.classList.add('fading');
        }, 300);

        // Phase 3: Disparition
        setTimeout(() => {
            el.classList.add('hidden');
            localStorage.setItem('last_briefing', today);
        }, 800);

        // Phase 4: Cleanup
        setTimeout(() => el.remove(), 1200);
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
