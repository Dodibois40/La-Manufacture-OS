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

// Task completion feedback - just sound, no gamification
export const celebrate = () => {
  playSound('complete');
};

// Completion sound - warm wooden "tok"
const playCompletionSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // Main tone - warm G4 (392Hz)
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.value = 392;
    mainGain.gain.setValueAtTime(0.6, now);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    main.connect(mainGain);
    mainGain.connect(master);
    main.start(now);
    main.stop(now + 0.3);

    // Octave for brightness - G5 (784Hz)
    const high = ctx.createOscillator();
    const highGain = ctx.createGain();
    high.type = 'sine';
    high.frequency.value = 784;
    highGain.gain.setValueAtTime(0.25, now);
    highGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    high.connect(highGain);
    highGain.connect(master);
    high.start(now);
    high.stop(now + 0.2);

    // Low thump for warmth - G3 (196Hz)
    const low = ctx.createOscillator();
    const lowGain = ctx.createGain();
    low.type = 'sine';
    low.frequency.value = 196;
    lowGain.gain.setValueAtTime(0.3, now);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    low.connect(lowGain);
    lowGain.connect(master);
    low.start(now);
    low.stop(now + 0.15);

    // Soft click for attack
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1200, now);
    click.frequency.exponentialRampToValueAtTime(400, now + 0.02);
    clickGain.gain.setValueAtTime(0.15, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    click.connect(clickGain);
    clickGain.connect(master);
    click.start(now);
    click.stop(now + 0.05);

    setTimeout(() => ctx.close(), 400);
  } catch (e) {
    // Audio non supporté
  }
};

// Sons
export const playSound = (type) => {
  if (type === 'complete') {
    playCompletionSound();
    return;
  }

  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';

    if (type === 'timer') {
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'prout') {
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

    setTimeout(() => audioCtx.close(), 1000);
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

// Confirmation Dialog - FLOW Style
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
