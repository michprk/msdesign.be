/* Strate — l'ambiance sonore, synthétisée (aucun fichier, aucun droit d'auteur).
   Au jardin : un peu de vent dans les feuilles, de rares oiseaux.
   Sous terre : tout s'assourdit, une note grave, des gouttes près de la nappe.
   Très bas : le volume se règle sur l'appareil. */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const VOLUME = 0.6;

export function createAmbience() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 9000; muffle.Q.value = 0.4; muffle.connect(master);

  // bruit rose, en boucle (vent et feuillage)
  const len = ctx.sampleRate * 6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.55; }
    for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] *= k; d[len - 1 - i] *= k; }     // pas de clic à la boucle
  }
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const wind = ctx.createBiquadFilter(); wind.type = 'bandpass'; wind.frequency.value = 520; wind.Q.value = 0.55;
  const windGain = ctx.createGain(); windGain.gain.value = 0.32;
  noise.connect(wind).connect(windGain).connect(muffle);
  const leaves = ctx.createBiquadFilter(); leaves.type = 'highpass'; leaves.frequency.value = 2600;
  const leavesGain = ctx.createGain(); leavesGain.gain.value = 0.06;
  noise.connect(leaves).connect(leavesGain).connect(muffle);
  // rafales lentes
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06; const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 170; lfo.connect(lfoAmt).connect(wind.frequency);
  const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13; const lfo2Amt = ctx.createGain(); lfo2Amt.gain.value = 0.09; lfo2.connect(lfo2Amt).connect(windGain.gain);
  const lfo3 = ctx.createOscillator(); lfo3.frequency.value = 0.21; const lfo3Amt = ctx.createGain(); lfo3Amt.gain.value = 0.03; lfo3.connect(lfo3Amt).connect(leavesGain.gain);

  // sous terre : une note grave, très douce
  const drone = ctx.createGain(); drone.gain.value = 0; drone.connect(master);
  [55, 82.5].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = i ? 0.35 : 0.6; o.connect(g).connect(drone); o.start(); });

  // un écho court pour les gouttes (effet de cavité)
  const echo = ctx.createDelay(1); echo.delayTime.value = 0.23; const fb = ctx.createGain(); fb.gain.value = 0.32; const echoOut = ctx.createGain(); echoOut.gain.value = 0.5;
  echo.connect(fb).connect(echo); echo.connect(echoOut).connect(master);

  const pan = (v) => { if (!ctx.createStereoPanner) return null; const p = ctx.createStereoPanner(); p.pan.value = v; return p; };
  function bird(t0) {
    const notes = 2 + Math.floor(Math.random() * 3), base = 3000 + Math.random() * 1500, out = ctx.createGain(); out.gain.value = 0.045;
    const p = pan(Math.random() * 1.6 - 0.8); if (p) out.connect(p).connect(muffle); else out.connect(muffle);
    for (let n = 0; n < notes; n++) {
      const t = t0 + n * (0.09 + Math.random() * 0.05), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(base * (1.15 + Math.random() * 0.2), t); o.frequency.exponentialRampToValueAtTime(base * 0.72, t + 0.07);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
    }
  }
  function drop(t0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = 900 + Math.random() * 500;
    o.type = 'sine'; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 0.38, t0 + 0.06);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    const p = pan(Math.random() * 1.2 - 0.6); o.connect(g); if (p) { g.connect(p); p.connect(master); p.connect(echo); } else { g.connect(master); g.connect(echo); }
    o.start(t0); o.stop(t0 + 0.25);
  }

  let started = false, muted = true, progress = 0, last = -1, nextBird = 0, nextDrop = 0, timer = 0;
  function tick() {
    if (muted || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if (progress < 0.45 && t > nextBird) { bird(t + 0.05); nextBird = t + 4 + Math.random() * 7; }
    if (progress > 1.35 && progress < 2.5 && t > nextDrop) { drop(t + 0.02); nextDrop = t + 0.7 + Math.random() * 1.6; }
  }
  document.addEventListener('visibilitychange', () => { if (!started) return; if (document.hidden) ctx.suspend(); else if (!muted) ctx.resume(); });

  return {
    start() {
      if (!started) { noise.start(); lfo.start(); lfo2.start(); lfo3.start(); started = true; timer = setInterval(tick, 250); nextBird = ctx.currentTime + 1.5; }
      ctx.resume(); muted = false;
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 1.2);
    },
    mute() { muted = true; master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.25); },
    setProgress(p) {
      progress = p; if (!started || Math.abs(p - last) < 0.01) return; last = p;
      const depth = smooth(0.35, 1, p) * (1 - smooth(2.3, 2.9, p)), now = ctx.currentTime;
      muffle.frequency.setTargetAtTime(lerp(9000, 360, depth), now, 0.25);
      windGain.gain.setTargetAtTime(lerp(0.32, 0.1, depth), now, 0.3);
      drone.gain.setTargetAtTime(depth * 0.05, now, 0.4);
    },
  };
}
