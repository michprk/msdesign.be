/* ==========================================================================
   M&S Design — le son du Mac
   Synthétisé (Web Audio, aucun fichier, aucune licence), très discret,
   toujours actif : un souffle feutré quand on plonge dans l’écran, et un
   accord doux quand l’écran s’allume (lorsque l’ouverture est rejouée).
   Les navigateurs n’autorisent le son qu’après un premier geste du visiteur
   (clic, toucher, touche) : avant cela, tout reste muet.
   Un lien discret « Couper le son » dans le pied de page suffit (WCAG 1.4.2).
   ========================================================================== */
(() => {
  'use strict';
  const KEY = 'ms_sound';
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch (e) { muted = false; }

  function unlock() {
    if (ctx || muted) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.2;
      master.connect(ctx.destination);
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach((t) => window.addEventListener(t, unlock, { passive: true, capture: true }));
  const ready = () => ctx && !muted && ctx.state === 'running';

  // Souffle : bruit filtré dont le filtre monte, comme l’air déplacé par la caméra
  function whoosh(dur, gain) {
    const t = ctx.currentTime + 0.01;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(1900, t + dur * 0.75);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // Accord doux (ré majeur 9) : nappe de sinusoïdes qui s’éteint lentement
  function chord(gain) {
    const t = ctx.currentTime + 0.02;
    [146.83, 220, 293.66, 369.99, 440, 659.25].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const a = gain * (i < 2 ? 1 : 0.55);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 0.06 + i * 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 2.5);
    });
  }

  const api = {
    get muted() { return muted; },
    zoom() { if (ready()) whoosh(1.0, 0.32); },
    boot() { if (ready()) chord(0.05); },
    setMuted(v) {
      muted = !!v;
      try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (e) { /* navigation privée */ }
      if (!muted) unlock();
    }
  };
  window.__msSound = api;
  window.addEventListener('ms:mac-zoom', () => api.zoom());
  window.addEventListener('ms:mac-boot', () => api.boot());

  // Lien du pied de page
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-sound-mute]').forEach((b) => {
      b.hidden = false;
      const label = () => { b.textContent = muted ? 'Réactiver le son' : 'Couper le son'; };
      label();
      b.addEventListener('click', () => { api.setMuted(!muted); label(); });
    });
  });
})();
