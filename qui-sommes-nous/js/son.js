// =============================================================================
// Le son, très discret et entièrement synthétisé (aucun fichier audio) :
//   - le vent pendant la descente, qui suit la vitesse du défilement ;
//   - la rumeur de la ville sous les nuages ;
//   - un souffle doux quand on entre par la fenêtre, puis l'ambiance feutrée du studio ;
//   - une petite note (piano feutré) à l'ouverture d'un chapitre.
// Il démarre au premier geste (le navigateur l'exige) ; « Couper le son » le coupe.
// =============================================================================

export function creerSon() {
  let ctx = null, maitre = null, vent = null, ville = null, piece = null;
  let actif = true;
  try { actif = localStorage.getItem('ms_son') !== 'off'; } catch (e) { /* stockage indisponible */ }

  function bruit(duree = 2) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * duree, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; }   // bruit « rose » adouci
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s;
  }

  function couche(freq, q, type = 'bandpass') {
    const src = bruit(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    src.connect(f).connect(g).connect(maitre); src.start();
    return { f, g };
  }

  function demarrer() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    maitre = ctx.createGain(); maitre.gain.value = actif ? 0.5 : 0;
    const comp = ctx.createDynamicsCompressor(); maitre.connect(comp).connect(ctx.destination);
    vent = couche(900, 0.6); ville = couche(140, 0.7, 'lowpass'); piece = couche(220, 0.5, 'lowpass');
  }

  const doux = (param, valeur, duree = 0.6) => { if (ctx) param.setTargetAtTime(valeur, ctx.currentTime, duree / 3); };

  return {
    demarrer,
    get actif() { return actif; },
    basculer() {
      actif = !actif;
      try { localStorage.setItem('ms_son', actif ? 'on' : 'off'); } catch (e) { /* rien */ }
      if (maitre) doux(maitre.gain, actif ? 0.5 : 0, 0.4);
      return actif;
    },
    /** Pendant la descente : p = avancement (0 → 1), vitesse = vitesse du défilement. */
    vol(p, vitesse) {
      if (!ctx) return;
      doux(vent.g.gain, Math.min(0.05, 0.012 + Math.abs(vitesse) * 0.0009) * (p < 0.6 ? 1 : 0.4), 0.3);
      doux(vent.f.frequency, 600 + Math.min(1600, Math.abs(vitesse) * 40), 0.3);
      doux(ville.g.gain, p > 0.42 ? 0.035 : 0.0, 1.2);
      doux(piece.g.gain, 0, 0.8);
    },
    /** On entre dans le studio : souffle, puis ambiance feutrée. */
    entrer() {
      if (!ctx) return;
      doux(vent.g.gain, 0.05, 0.2); doux(vent.f.frequency, 400, 1.2);
      setTimeout(() => { doux(vent.g.gain, 0, 1.0); doux(ville.g.gain, 0.012, 1.5); doux(piece.g.gain, 0.03, 1.5); }, 900);
    },
    sortir() { if (ctx) { doux(piece.g.gain, 0, 1.0); doux(ville.g.gain, 0.035, 1.2); } },
    /** Une note de piano feutré (sinusoïdes qui s'éteignent vite). */
    note(freq = 523.25) {
      if (!ctx || !actif) return;
      const t = ctx.currentTime;
      [1, 2, 3].forEach((h, k) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = freq * h; o.type = 'sine';
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 / (k + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8 / h);
        o.connect(g).connect(maitre); o.start(t); o.stop(t + 2);
      });
    },
  };
}
