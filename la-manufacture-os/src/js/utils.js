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

// 🎉 Confetti celebration for completed tasks
export const celebrate = () => {
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
  playSound('complete');
};

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                         ✓  A C C O M P L I S H E D  ✓                        ║
// ║                    The Sound of Completion - FLOW Signature                   ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  Psychoacoustic Design:                                                       ║
// ║  • Perfect Fifth (3:2 ratio) - universally satisfying resolution              ║
// ║  • Two-phase dopamine: micro-anticipation → main hit                          ║
// ║  • Bell-like timbre with harmonic shimmer                                     ║
// ║  • ~400ms total - short but satisfying                                        ║
// ║  • Based on Netflix "Ta-dum" & iPhone success sound research                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const playCompletionSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Master output with subtle compression
    const master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);

    // Soft reverb for polish
    const createReverb = () => {
      const conv = ctx.createConvolver();
      const len = ctx.sampleRate * 0.5;
      const imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = imp.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5) * 0.15;
        }
      }
      conv.buffer = imp;
      return conv;
    };

    const reverb = createReverb();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.25;
    reverb.connect(reverbGain);
    reverbGain.connect(master);

    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    dry.connect(master);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: MICRO-ANTICIPATION (0-40ms)
    // Subtle "breath" before the hit - primes the brain
    // ═══════════════════════════════════════════════════════════════
    const anticipation = ctx.createOscillator();
    const antGain = ctx.createGain();
    anticipation.type = 'sine';
    anticipation.frequency.value = 880; // A5 - tension note

    antGain.gain.setValueAtTime(0, now);
    antGain.gain.linearRampToValueAtTime(0.08, now + 0.015);
    antGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    anticipation.connect(antGain);
    antGain.connect(reverb);
    anticipation.start(now);
    anticipation.stop(now + 0.05);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: THE HIT (40-200ms)
    // Perfect fifth C6→G6 - the satisfying resolution
    // Bell-like attack with rich harmonics
    // ═══════════════════════════════════════════════════════════════

    // Fundamental: C6 (1046.50 Hz)
    const fundamental = ctx.createOscillator();
    const fundGain = ctx.createGain();
    fundamental.type = 'sine';
    fundamental.frequency.value = 1046.50;

    fundGain.gain.setValueAtTime(0, now + 0.035);
    fundGain.gain.linearRampToValueAtTime(0.35, now + 0.04); // Sharp attack
    fundGain.gain.setValueAtTime(0.35, now + 0.06);
    fundGain.gain.exponentialRampToValueAtTime(0.08, now + 0.2);
    fundGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    fundamental.connect(fundGain);
    fundGain.connect(dry);
    fundGain.connect(reverb);
    fundamental.start(now + 0.035);
    fundamental.stop(now + 0.45);

    // Perfect Fifth: G6 (1567.98 Hz) - THE resolution
    const fifth = ctx.createOscillator();
    const fifthGain = ctx.createGain();
    fifth.type = 'sine';
    fifth.frequency.value = 1567.98;

    fifthGain.gain.setValueAtTime(0, now + 0.038);
    fifthGain.gain.linearRampToValueAtTime(0.25, now + 0.045);
    fifthGain.gain.setValueAtTime(0.25, now + 0.07);
    fifthGain.gain.exponentialRampToValueAtTime(0.05, now + 0.22);
    fifthGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    fifth.connect(fifthGain);
    fifthGain.connect(dry);
    fifthGain.connect(reverb);
    fifth.start(now + 0.038);
    fifth.stop(now + 0.42);

    // Slight detune for warmth (chorus effect)
    const detuned = ctx.createOscillator();
    const detGain = ctx.createGain();
    detuned.type = 'sine';
    detuned.frequency.value = 1046.50 * 1.003; // Slightly sharp

    detGain.gain.setValueAtTime(0, now + 0.04);
    detGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    detGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    detuned.connect(detGain);
    detGain.connect(reverb);
    detuned.start(now + 0.04);
    detuned.stop(now + 0.35);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: SPARKLE/SHIMMER (100-400ms)
    // High harmonics that give the "magical" quality
    // ═══════════════════════════════════════════════════════════════

    // Octave sparkle: C7 (2093 Hz)
    const sparkle = ctx.createOscillator();
    const sparkleGain = ctx.createGain();
    sparkle.type = 'sine';
    sparkle.frequency.value = 2093.00;

    sparkleGain.gain.setValueAtTime(0, now + 0.04);
    sparkleGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    sparkle.connect(sparkleGain);
    sparkleGain.connect(reverb);
    sparkle.start(now + 0.04);
    sparkle.stop(now + 0.3);

    // High shimmer: E7 (2637 Hz) - major third for brightness
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = 2637.02;

    shimmerGain.gain.setValueAtTime(0, now + 0.05);
    shimmerGain.gain.linearRampToValueAtTime(0.06, now + 0.065);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(reverb);
    shimmer.start(now + 0.05);
    shimmer.stop(now + 0.25);

    // Bell transient for attack definition
    const transient = ctx.createOscillator();
    const transGain = ctx.createGain();
    transient.type = 'triangle';
    transient.frequency.setValueAtTime(3000, now + 0.035);
    transient.frequency.exponentialRampToValueAtTime(1500, now + 0.06);

    transGain.gain.setValueAtTime(0.15, now + 0.035);
    transGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    transient.connect(transGain);
    transGain.connect(dry);
    transient.start(now + 0.035);
    transient.stop(now + 0.1);

    // Cleanup
    setTimeout(() => ctx.close(), 600);
  } catch (e) {
    // Audio non supporté
  }
};

// 🔊 Sons
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

// Confirmation Dialog - FLOW Style (no emoji icons)
// Alias pour triggerConfetti
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
