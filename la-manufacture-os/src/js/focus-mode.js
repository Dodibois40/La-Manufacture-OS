import { nowISO, toast, playSound, celebrate } from './utils.js';
import { saveState } from './storage.js';

let interval = null;
let isPaused = false;

// Durées disponibles
const DURATIONS = [
    { label: 'Quick', minutes: 15, icon: '⚡' },
    { label: 'Standard', minutes: 25, icon: '🎯' },
    { label: 'Deep', minutes: 45, icon: '🧘' }
];

export const startFocusMode = (task, state, renderCallback) => {
    // 1. Create Overlay HTML avec sélection de durée
    const overlay = document.createElement('div');
    overlay.id = 'focusOverlay';
    overlay.className = 'focus-overlay';

    overlay.innerHTML = `
        <div class="focus-background"></div>

        <div class="focus-header">
            <button id="focusClose" class="focus-btn-icon" aria-label="Fermer">✕</button>
        </div>

        <div class="focus-content">
            <div class="focus-label">FOCUS ACTUEL</div>
            <h1 class="focus-title">${task.text}</h1>

            <!-- Sélection de durée -->
            <div class="focus-duration-select" id="durationSelect">
                ${DURATIONS.map((d, i) => `
                    <button class="focus-duration-btn ${i === 1 ? 'active' : ''}" data-minutes="${d.minutes}">
                        <span class="duration-icon">${d.icon}</span>
                        <span class="duration-label">${d.label}</span>
                        <span class="duration-time">${d.minutes} min</span>
                    </button>
                `).join('')}
            </div>

            <div class="focus-timer-ring">
                <svg viewBox="0 0 100 100">
                    <circle class="ring-bg" cx="50" cy="50" r="45"></circle>
                    <circle class="ring-progress" id="ringProgress" cx="50" cy="50" r="45"></circle>
                </svg>
                <div class="timer-text" id="timerValue">25:00</div>
            </div>

            <p class="focus-sub text-center" id="focusMantra">Une chose à la fois.</p>
        </div>

        <div class="focus-actions">
            <button class="focus-btn secondary" id="focusPause">⏸️ Pause</button>
            <button class="focus-btn secondary" id="focusSkip">Sauter</button>
            <button class="focus-btn primary" id="focusDone">Terminé ✓</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // 2. État du timer
    let selectedMinutes = 25;
    let timeLeft = selectedMinutes * 60;
    let totalTime = timeLeft;
    isPaused = false;

    // Sélection de durée
    const durationBtns = overlay.querySelectorAll('.focus-duration-btn');
    const durationSelect = document.getElementById('durationSelect');

    durationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Ne changer que si on n'a pas encore commencé (ou presque pas)
            if (timeLeft >= totalTime - 5) {
                durationBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedMinutes = parseInt(btn.dataset.minutes);
                timeLeft = selectedMinutes * 60;
                totalTime = timeLeft;
                updateTimer();
            }
        });
    });

    // 3. Timer Logic
    const updateTimer = () => {
        const timerEl = document.getElementById('timerValue');
        const circle = document.getElementById('ringProgress');

        if (!timerEl || !circle) return;

        const min = Math.floor(timeLeft / 60);
        const sec = timeLeft % 60;
        timerEl.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;

        // Update Ring
        const r = 45;
        const c = 2 * Math.PI * r;
        const progress = timeLeft / totalTime;
        const offset = c * (1 - progress);
        circle.style.strokeDashoffset = offset;

        // Masquer la sélection de durée une fois commencé
        if (timeLeft < totalTime - 2 && durationSelect) {
            durationSelect.style.opacity = '0';
            durationSelect.style.pointerEvents = 'none';
        }

        // Timer terminé !
        if (timeLeft === 0) {
            clearInterval(interval);
            playSound('timer');

            const mantra = document.getElementById('focusMantra');
            if (mantra) {
                mantra.textContent = "⏰ Temps écoulé !";
                mantra.style.color = "var(--accent)";
            }

            toast('Timer terminé ! 🎉', 'success');
        }

        if (!isPaused && timeLeft > 0) {
            timeLeft--;
        }
    };

    interval = setInterval(updateTimer, 1000);
    updateTimer();

    // 4. Actions
    const close = () => {
        clearInterval(interval);
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 400);
    };

    // Fermer
    document.getElementById('focusClose').addEventListener('click', close);

    // Pause/Resume
    const pauseBtn = document.getElementById('focusPause');
    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? '▶️ Reprendre' : '⏸️ Pause';
        pauseBtn.classList.toggle('paused', isPaused);

        const mantra = document.getElementById('focusMantra');
        if (mantra) {
            mantra.textContent = isPaused ? 'Session en pause...' : 'Une chose à la fois.';
        }
    });

    // Terminé
    document.getElementById('focusDone').addEventListener('click', () => {
        task.done = true;
        task.updatedAt = nowISO();
        saveState(state);

        const mantra = document.getElementById('focusMantra');
        if (mantra) {
            mantra.textContent = "Excellent travail !";
            mantra.style.color = "var(--success)";
        }

        celebrate();
        playSound('complete');

        setTimeout(() => {
            close();
            renderCallback();
            toast('✨ Session terminée. Bravo !', 'success');
        }, 800);
    });

    // Sauter
    document.getElementById('focusSkip').addEventListener('click', () => {
        toast('Session passée', 'warning');
        close();
    });
};
