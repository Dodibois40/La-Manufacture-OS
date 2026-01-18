// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                              A S C E N S I O N                                ║
// ║                     The Sound of Becoming - FLOW Signature                    ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║  Basé sur la recherche en psychoacoustique:                                   ║
// ║  • Quinte parfaite (ratio 3:2) - stabilité et résolution                      ║
// ║  • Double pic dopaminergique: anticipation → climax                           ║
// ║  • Fréquence base ~500Hz (C5) - optimal pour l'éveil                         ║
// ║  • Progression spectrale (THX-inspired) - puissance perçue                    ║
// ║  • 3 notes signature mémorables - identité sonore                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

let hasPlayed = false;

const playChime = () => {
  if (hasPlayed) return;
  hasPlayed = true;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const sr = ctx.sampleRate;

    // ═══════════════════════════════════════════════════════════════
    // MASTER CHAIN - Polish cinématique
    // ═══════════════════════════════════════════════════════════════
    const master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);

    // Compresseur doux pour cohésion
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    comp.connect(master);

    // Reverb - espace cathédrale subtil
    const createReverb = () => {
      const conv = ctx.createConvolver();
      const len = sr * 2.5;
      const imp = ctx.createBuffer(2, len, sr);

      for (let ch = 0; ch < 2; ch++) {
        const d = imp.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          // Decay exponentiel avec early reflections
          const decay = Math.pow(1 - t, 1.8);
          const early = i < sr * 0.05 ? Math.sin(i * 0.01) * 0.3 : 0;
          d[i] = (Math.random() * 2 - 1) * decay * 0.2 + early * decay;
        }
      }
      conv.buffer = imp;
      return conv;
    };

    const reverb = createReverb();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.35;
    reverb.connect(reverbGain);
    reverbGain.connect(comp);

    const dry = ctx.createGain();
    dry.gain.value = 0.75;
    dry.connect(comp);

    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: LE SOUFFLE (0.0s - 0.4s)
    // Anticipation subliminale - le cerveau se prépare
    // ═══════════════════════════════════════════════════════════════
    const playBreath = t => {
      // Sub-rumble très bas - on le sent plus qu'on l'entend
      const sub = ctx.createOscillator();
      const subG = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.value = 55; // A1 - sub bass

      subG.gain.setValueAtTime(0, t);
      subG.gain.linearRampToValueAtTime(0.15, t + 0.2);
      subG.gain.linearRampToValueAtTime(0.08, t + 0.35);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      sub.connect(subG);
      subG.connect(dry);
      sub.start(t);
      sub.stop(t + 0.7);

      // Breath noise - comme une inspiration
      const breathLen = 0.4 * sr;
      const breathBuf = ctx.createBuffer(1, breathLen, sr);
      const breathData = breathBuf.getChannelData(0);

      for (let i = 0; i < breathLen; i++) {
        const p = i / breathLen;
        const env = Math.sin(Math.PI * p) * Math.pow(p, 0.3);
        breathData[i] = (Math.random() * 2 - 1) * env * 0.08;
      }

      const breathSrc = ctx.createBufferSource();
      breathSrc.buffer = breathBuf;

      const breathFilter = ctx.createBiquadFilter();
      breathFilter.type = 'bandpass';
      breathFilter.frequency.setValueAtTime(150, t);
      breathFilter.frequency.exponentialRampToValueAtTime(400, t + 0.3);
      breathFilter.Q.value = 0.8;

      breathSrc.connect(breathFilter);
      breathFilter.connect(reverb);
      breathSrc.start(t);
    };

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2: L'ANCRAGE (0.25s - 0.8s)
    // Fondation puissante - tu es planté, prêt
    // ═══════════════════════════════════════════════════════════════
    const playAnchor = t => {
      // C2 + C3 en octaves - la fondation
      const freqs = [65.41, 130.81]; // C2, C3

      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const vol = i === 0 ? 0.25 : 0.2;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.05);
        g.gain.setValueAtTime(vol, t + 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

        osc.connect(g);
        g.connect(dry);
        g.connect(reverb);
        osc.start(t);
        osc.stop(t + 1.3);
      });

      // Transient doux pour l'attaque
      const click = ctx.createOscillator();
      const clickG = ctx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(200, t);
      click.frequency.exponentialRampToValueAtTime(80, t + 0.03);

      clickG.gain.setValueAtTime(0.12, t);
      clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      click.connect(clickG);
      clickG.connect(dry);
      click.start(t);
      click.stop(t + 0.06);
    };

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: L'ASCENSION (0.35s - 1.4s)
    // Quinte parfaite C→G - la montée qui donne des frissons
    // Inspiré THX: voix qui convergent vers l'harmonie
    // ═══════════════════════════════════════════════════════════════
    const playAscension = t => {
      // Accord C majeur avec 7ème majeure - moderne, aspirationnel
      // Construit progressivement comme le THX Deep Note
      const voices = [
        { freq: 261.63, delay: 0, vol: 0.18 }, // C4
        { freq: 329.63, delay: 0.04, vol: 0.12 }, // E4 (tierce)
        { freq: 392.0, delay: 0.08, vol: 0.15 }, // G4 (quinte parfaite!)
        { freq: 493.88, delay: 0.12, vol: 0.1 }, // B4 (7ème majeure - tension belle)
        { freq: 523.25, delay: 0.16, vol: 0.14 }, // C5 (octave - résolution)
        { freq: 659.25, delay: 0.2, vol: 0.08 }, // E5
        { freq: 783.99, delay: 0.24, vol: 0.1 }, // G5 (quinte haute)
      ];

      voices.forEach(({ freq, delay, vol }) => {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        const g2 = ctx.createGain();

        // Fondamentale en sine pure
        osc.type = 'sine';
        osc.frequency.value = freq;

        // Légère désaccordage pour richesse (chorus naturel)
        osc2.type = 'sine';
        osc2.frequency.value = freq * 1.002;

        // Swell progressif - anticipation → pic
        g.gain.setValueAtTime(0, t + delay);
        g.gain.linearRampToValueAtTime(vol * 0.4, t + delay + 0.08);
        g.gain.linearRampToValueAtTime(vol, t + delay + 0.2);
        g.gain.setValueAtTime(vol, t + delay + 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.4);

        g2.gain.setValueAtTime(0, t + delay);
        g2.gain.linearRampToValueAtTime(vol * 0.15, t + delay + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.0);

        osc.connect(g);
        osc2.connect(g2);
        g.connect(dry);
        g.connect(reverb);
        g2.connect(reverb);

        osc.start(t + delay);
        osc2.start(t + delay);
        osc.stop(t + delay + 1.5);
        osc2.stop(t + delay + 1.1);
      });
    };

    // ═══════════════════════════════════════════════════════════════
    // PHASE 4: LA SIGNATURE (0.55s - 1.2s)
    // 3 notes mémorables - l'ADN sonore de FLOW
    // C5 → G5 → C6 (octave, quinte, octave = résolution parfaite)
    // ═══════════════════════════════════════════════════════════════
    const playSignature = t => {
      const notes = [
        { freq: 523.25, time: 0, dur: 0.25 }, // C5 - départ
        { freq: 783.99, time: 0.12, dur: 0.28 }, // G5 - quinte (élévation)
        { freq: 1046.5, time: 0.26, dur: 0.45 }, // C6 - octave (accomplissement)
      ];

      notes.forEach(({ freq, time: offset, dur }) => {
        // Note principale - bell-like
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        // Attaque nette, sustain, decay élégant
        g.gain.setValueAtTime(0, t + offset);
        g.gain.linearRampToValueAtTime(0.18, t + offset + 0.008);
        g.gain.linearRampToValueAtTime(0.14, t + offset + 0.05);
        g.gain.exponentialRampToValueAtTime(0.06, t + offset + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, t + offset + dur);

        osc.connect(g);
        g.connect(dry);
        g.connect(reverb);
        osc.start(t + offset);
        osc.stop(t + offset + dur + 0.1);

        // Harmonique octave pour brillance (très subtile)
        const harm = ctx.createOscillator();
        const harmG = ctx.createGain();
        harm.type = 'sine';
        harm.frequency.value = freq * 2;

        harmG.gain.setValueAtTime(0, t + offset);
        harmG.gain.linearRampToValueAtTime(0.03, t + offset + 0.01);
        harmG.gain.exponentialRampToValueAtTime(0.001, t + offset + dur * 0.4);

        harm.connect(harmG);
        harmG.connect(reverb);
        harm.start(t + offset);
        harm.stop(t + offset + dur * 0.5);
      });
    };

    // ═══════════════════════════════════════════════════════════════
    // PHASE 5: L'ÉPANOUISSEMENT (0.85s - 2.0s)
    // Shimmer final - comme le soleil qui perce les nuages
    // ═══════════════════════════════════════════════════════════════
    const playBloom = t => {
      // Arpège de lumière descendant
      const shimmer = [
        { freq: 2093.0, delay: 0 }, // C7
        { freq: 1567.98, delay: 0.05 }, // G6
        { freq: 1318.51, delay: 0.1 }, // E6
      ];

      shimmer.forEach(({ freq, delay }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        g.gain.setValueAtTime(0, t + delay);
        g.gain.linearRampToValueAtTime(0.025, t + delay + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.5);

        osc.connect(g);
        g.connect(reverb); // Tout en reverb pour effet éthéré
        osc.start(t + delay);
        osc.stop(t + delay + 0.6);
      });

      // Pad final très doux - résolution complète
      const padFreqs = [523.25, 659.25, 783.99]; // C5, E5, G5 - C majeur pur

      padFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        const vol = 0.04 - i * 0.008;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

        osc.connect(g);
        g.connect(reverb);
        osc.start(t);
        osc.stop(t + 1.3);
      });
    };

    // ═══════════════════════════════════════════════════════════════
    // ORCHESTRATION - Le timing qui crée la magie
    // ═══════════════════════════════════════════════════════════════
    // Timeline optimisée pour double pic dopaminergique:
    // [Anticipation 0-0.35s] → [Climax 0.35-0.85s] → [Résolution 0.85-2.0s]

    playBreath(now); // 0.00s - Anticipation commence
    playAnchor(now + 0.25); // 0.25s - Fondation
    playAscension(now + 0.35); // 0.35s - L'accord qui monte
    playSignature(now + 0.55); // 0.55s - Les 3 notes signature
    playBloom(now + 0.85); // 0.85s - Épanouissement final

    // Cleanup après la reverb
    setTimeout(() => ctx.close(), 4000);
  } catch (e) {
    console.error('Audio error:', e);
  }
};

export const playStartupSound = () => {
  playChime();
};

// Reset pour debug
export const resetSound = () => {
  hasPlayed = false;
};
