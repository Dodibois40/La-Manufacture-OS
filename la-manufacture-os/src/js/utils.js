// Utility functions

export const isoLocal = (d = new Date()) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().split('T')[0];
};

export const nowISO = () => new Date().toISOString();

export const toast = (msg, type = 'default') => {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type !== 'default' ? ` toast-${type}` : '');
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => t.classList.remove('show'), 1800);
};

// Get celebration style from settings
const getCelebrationStyle = () => {
  try {
    const state = JSON.parse(localStorage.getItem('lm_os_state') || '{}');
    return state.settings?.celebrationStyle || 'confetti';
  } catch (e) {
    return 'confetti';
  }
};

// 🎉 Célébration confetti pour les tâches complétées
export const celebrate = () => {
  const style = getCelebrationStyle();

  if (style === 'none') return;

  if (style === 'fireworks') {
    celebrateFireworks();
  } else if (style === 'stars') {
    celebrateStars();
  } else {
    celebrateConfetti();
  }

  playSound('complete');
};

const celebrateConfetti = () => {
  let container = document.getElementById('confetti-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'confetti-container';
    document.body.appendChild(container);
  }
  container.innerHTML = '';

  const colors = ['#FFD60A', '#FF9F0A', '#30D158', '#0A84FF', '#FF453A', '#BF5AF2'];
  const confettiCount = 40;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.3 + 's';
    confetti.style.animationDuration = (Math.random() * 1 + 1.5) + 's';
    container.appendChild(confetti);
  }

  setTimeout(() => container.innerHTML = '', 2500);
};

const celebrateFireworks = () => {
  let container = document.getElementById('confetti-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'confetti-container';
    document.body.appendChild(container);
  }
  container.innerHTML = '';

  const colors = ['#FFD60A', '#FF9F0A', '#FF453A', '#BF5AF2'];

  // Create multiple firework bursts
  for (let burst = 0; burst < 3; burst++) {
    setTimeout(() => {
      const x = 20 + Math.random() * 60; // Random horizontal position
      const y = 20 + Math.random() * 40; // Random vertical position

      for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework-particle';
        particle.style.left = x + 'vw';
        particle.style.top = y + 'vh';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        const angle = (Math.PI * 2 * i) / 20;
        const velocity = 100 + Math.random() * 50;
        particle.style.setProperty('--tx', Math.cos(angle) * velocity + 'px');
        particle.style.setProperty('--ty', Math.sin(angle) * velocity + 'px');

        container.appendChild(particle);
      }
    }, burst * 400);
  }

  setTimeout(() => container.innerHTML = '', 2500);
};

const celebrateStars = () => {
  let container = document.getElementById('confetti-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'confetti-container';
    document.body.appendChild(container);
  }
  container.innerHTML = '';

  const starCount = 30;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star-particle';
    star.textContent = '⭐';
    star.style.left = Math.random() * 100 + 'vw';
    star.style.top = Math.random() * 100 + 'vh';
    star.style.animationDelay = Math.random() * 0.3 + 's';
    star.style.fontSize = (12 + Math.random() * 20) + 'px';
    container.appendChild(star);
  }

  setTimeout(() => container.innerHTML = '', 2000);
};

// 🔊 Sons subtils
export const playSound = (type) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';

    if (type === 'complete') {
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      oscillator.frequency.setValueAtTime(739.99, audioCtx.currentTime + 0.08); // F#5
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.16); // A5
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.35);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.35);
    } else if (type === 'timer') {
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'prout') {
      // Son de prout style Tesla - fréquences basses descendantes
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.15);
      oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.4);
      oscillator.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.6);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.3);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.6);
    }
  } catch (e) {
    // Audio non supporté
  }
};

export const storageOK = () => {
  try {
    localStorage.setItem('__lm_test', '1');
    const ok = localStorage.getItem('__lm_test') === '1';
    localStorage.removeItem('__lm_test');
    return ok;
  } catch (_) {
    return false;
  }
};

export const ensureTask = (t, defaultOwner) => {
  const task = t && typeof t === 'object' ? t : {};
  if (!task.id) task.id = Date.now() + Math.random();
  if (!task.text) task.text = '';
  if (!task.owner) task.owner = defaultOwner || 'Thibaud';
  if (!task.date) task.date = isoLocal();
  task.done = Boolean(task.done);
  task.urgent = Boolean(task.urgent);
  if (!task.updatedAt) task.updatedAt = nowISO();
  return task;
};

// Confirmation Dialog - FLOW Style (no emoji icons)
// Alias pour triggerConfetti (utilisé par gamification.js)
export const triggerConfetti = celebrate;

export const confirmDialog = ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-title">${title}</div>
        <div class="confirm-message">${message}</div>
        <div class="confirm-actions">
          <button class="confirm-btn cancel" data-action="cancel">${cancelText}</button>
          <button class="confirm-btn ${danger ? 'danger' : 'primary'}" data-action="confirm">${confirmText}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('[data-action="cancel"]').onclick = () => close(false);
    overlay.querySelector('[data-action="confirm"]').onclick = () => close(true);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };

    document.body.appendChild(overlay);
  });
};
