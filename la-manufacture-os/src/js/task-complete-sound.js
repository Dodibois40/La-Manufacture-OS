// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                           A C C O M P L I S H E D                            ║
// ║                   The Sound of Completion - FLOW Notification                ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  Basé sur la recherche en psychoacoustique:                                  ║
// ║  • Quinte parfaite (ratio 3:2) → résolution et satisfaction                  ║
// ║  • Progression ascendante → accomplissement, progrès                         ║
// ║  • Fréquence ~523Hz (C5) → clarté, éveil sans stress                        ║
// ║  • Timbre bell-like → attention douce, non agressive                        ║
// ║  • Durée courte (~500ms) → notification efficace                            ║
// ║  • 2 notes signature: C5 → G5 (quinte) → satisfaction cérébrale             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/**
 * Son de notification "Tâche Complétée"
 * Déclenché quand Claude Code termine une tâche et attend une action utilisateur
 *
 * Psychologie:
 * - La quinte parfaite (C→G) est universellement perçue comme "résolution"
 * - La progression montante signale l'accomplissement
 * - Le timbre crystallin attire l'attention sans agresser
 * - La reverb courte donne de la présence sans envahir
 */

export const playTaskCompleteSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const sr = ctx.sampleRate;

    // ═══════════════════════════════════════════════════════════════
    // MASTER CHAIN - Son propre et clair
    // ═══════════════════════════════════════════════════════════════
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);

    // Compresseur léger pour cohésion
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.002;
    comp.release.value = 0.1;
    comp.connect(master);

    // Reverb courte - espace mais pas envahissant
    const createReverb = () => {
      const conv = ctx.createConvolver();
      const len = sr * 0.8; // Reverb courte
      const imp = ctx.createBuffer(2, len, sr);

      for (let ch = 0; ch < 2; ch++) {
        const d = imp.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const decay = Math.pow(1 - t, 2.5);
          d[i] = (Math.random() * 2 - 1) * decay * 0.15;
        }
      }
      conv.buffer = imp;
      return conv;
    };

    const reverb = createReverb();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.25;
    reverb.connect(reverbGain);
    reverbGain.connect(comp);

    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    dry.connect(comp);

    // ═══════════════════════════════════════════════════════════════
    // NOTE 1: C5 - L'annonce (0ms)
    // "Quelque chose s'est passé"
    // ═══════════════════════════════════════════════════════════════
    const playFirstNote = t => {
      const freq = 523.25; // C5

      // Oscillateur principal - sine pure pour clarté
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Enveloppe bell-like: attaque rapide, decay naturel
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.006); // Attaque 6ms
      g.gain.linearRampToValueAtTime(0.18, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(g);
      g.connect(dry);
      g.connect(reverb);
      osc.start(t);
      osc.stop(t + 0.4);

      // Harmonique octave - brillance subtile
      const harm = ctx.createOscillator();
      const harmG = ctx.createGain();
      harm.type = 'sine';
      harm.frequency.value = freq * 2; // C6

      harmG.gain.setValueAtTime(0, t);
      harmG.gain.linearRampToValueAtTime(0.04, t + 0.008);
      harmG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      harm.connect(harmG);
      harmG.connect(reverb);
      harm.start(t);
      harm.stop(t + 0.2);

      // Transient doux - "clic" de cloche
      const click = ctx.createOscillator();
      const clickG = ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(1200, t);
      click.frequency.exponentialRampToValueAtTime(600, t + 0.015);

      clickG.gain.setValueAtTime(0.06, t);
      clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

      click.connect(clickG);
      clickG.connect(dry);
      click.start(t);
      click.stop(t + 0.03);
    };

    // ═══════════════════════════════════════════════════════════════
    // NOTE 2: G5 - La résolution (120ms)
    // "C'est accompli!" - Quinte parfaite = satisfaction
    // ═══════════════════════════════════════════════════════════════
    const playSecondNote = t => {
      const freq = 783.99; // G5 - quinte parfaite de C5

      // Oscillateur principal
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Enveloppe légèrement plus longue - résolution
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.006);
      g.gain.linearRampToValueAtTime(0.16, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(g);
      g.connect(dry);
      g.connect(reverb);
      osc.start(t);
      osc.stop(t + 0.55);

      // Harmonique octave
      const harm = ctx.createOscillator();
      const harmG = ctx.createGain();
      harm.type = 'sine';
      harm.frequency.value = freq * 2; // G6

      harmG.gain.setValueAtTime(0, t);
      harmG.gain.linearRampToValueAtTime(0.035, t + 0.01);
      harmG.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      harm.connect(harmG);
      harmG.connect(reverb);
      harm.start(t);
      harm.stop(t + 0.25);

      // Légère tierce pour couleur majeure (E6) - joie subtile
      const third = ctx.createOscillator();
      const thirdG = ctx.createGain();
      third.type = 'sine';
      third.frequency.value = 659.25; // E5

      thirdG.gain.setValueAtTime(0, t + 0.02);
      thirdG.gain.linearRampToValueAtTime(0.03, t + 0.04);
      thirdG.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      third.connect(thirdG);
      thirdG.connect(reverb);
      third.start(t);
      third.stop(t + 0.3);

      // Transient
      const click = ctx.createOscillator();
      const clickG = ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(1400, t);
      click.frequency.exponentialRampToValueAtTime(700, t + 0.012);

      clickG.gain.setValueAtTime(0.05, t);
      clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

      click.connect(clickG);
      clickG.connect(dry);
      click.start(t);
      click.stop(t + 0.025);
    };

    // ═══════════════════════════════════════════════════════════════
    // SHIMMER FINAL (220ms) - Éclat de réussite
    // ═══════════════════════════════════════════════════════════════
    const playShimmer = t => {
      // Très hautes fréquences en descente - "sparkle"
      const shimmerFreqs = [2093, 1567.98, 1318.51]; // C7, G6, E6

      shimmerFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const delay = i * 0.025;
        g.gain.setValueAtTime(0, t + delay);
        g.gain.linearRampToValueAtTime(0.018, t + delay + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.25);

        osc.connect(g);
        g.connect(reverb);
        osc.start(t + delay);
        osc.stop(t + delay + 0.3);
      });
    };

    // ═══════════════════════════════════════════════════════════════
    // ORCHESTRATION
    // Timeline: [C5 0ms] → [G5 120ms] → [Shimmer 220ms]
    // Durée totale: ~550ms
    // ═══════════════════════════════════════════════════════════════
    playFirstNote(now);
    playSecondNote(now + 0.12);
    playShimmer(now + 0.22);

    // Cleanup
    setTimeout(() => ctx.close(), 1500);
  } catch (e) {
    console.error('Task complete sound error:', e);
  }
};

/**
 * Son de notification "Action Requise"
 * Variante légèrement différente pour signaler qu'une interaction est nécessaire
 *
 * Différence: ajoute une 3ème note (C6) pour "appel à l'action"
 */
export const playActionRequiredSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const sr = ctx.sampleRate;

    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.002;
    comp.release.value = 0.1;
    comp.connect(master);

    // Reverb
    const createReverb = () => {
      const conv = ctx.createConvolver();
      const len = sr * 0.6;
      const imp = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = imp.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5) * 0.12;
        }
      }
      conv.buffer = imp;
      return conv;
    };

    const reverb = createReverb();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.2;
    reverb.connect(reverbGain);
    reverbGain.connect(comp);

    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    dry.connect(comp);

    // 3 notes: C5 → G5 → C6 (octave + quinte = "lève-toi et agis!")
    const notes = [
      { freq: 523.25, time: 0, dur: 0.15 }, // C5
      { freq: 783.99, time: 0.1, dur: 0.15 }, // G5
      { freq: 1046.5, time: 0.2, dur: 0.25 }, // C6 - appel à l'action
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      g.gain.setValueAtTime(0, now + time);
      g.gain.linearRampToValueAtTime(0.18, now + time + 0.006);
      g.gain.linearRampToValueAtTime(0.14, now + time + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(g);
      g.connect(dry);
      g.connect(reverb);
      osc.start(now + time);
      osc.stop(now + time + dur + 0.1);

      // Harmonique
      const harm = ctx.createOscillator();
      const harmG = ctx.createGain();
      harm.type = 'sine';
      harm.frequency.value = freq * 2;
      harmG.gain.setValueAtTime(0, now + time);
      harmG.gain.linearRampToValueAtTime(0.03, now + time + 0.01);
      harmG.gain.exponentialRampToValueAtTime(0.001, now + time + dur * 0.5);
      harm.connect(harmG);
      harmG.connect(reverb);
      harm.start(now + time);
      harm.stop(now + time + dur * 0.6);
    });

    setTimeout(() => ctx.close(), 1200);
  } catch (e) {
    console.error('Action required sound error:', e);
  }
};

export default playTaskCompleteSound;
