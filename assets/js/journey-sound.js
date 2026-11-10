/* ==========================================================================
   M&S Design — le son du voyage de l’équipe, façon vidéo de motion design.
   Tout est synthétisé (aucun fichier, aucun droit) :
   · une musique très douce : nappe et koto (cordes pincées, Karplus-Strong),
     gamme japonaise (ré, mi, fa, la, si bémol) ;
   · un vent d’hiver en fond ;
   · les effets : whoosh qui traverse l’image de droite à gauche, montée,
     impact grave à l’arrivée, petits « tic » des lettres, swish, survol, clic.
   Chaîne : bus musique + bus effets → réverbération → compresseur → sortie.
   ========================================================================== */
const NOTE = { D3: 146.83, E3: 164.81, F3: 174.61, A3: 220, Bb3: 233.08, D4: 293.66, E4: 329.63, F4: 349.23, A4: 440, Bb4: 466.16, D5: 587.33, A5: 880 };
const MELODY = ['D4', 'E4', 'F4', 'A4', 'Bb4', 'D5', 'A3', 'Bb3', 'D3'];

export function createSound() {
  let ac = null, out = null, sfx = null, music = null, verb = null, noiseBuf = null, plucks = {}, muted = false, timer = 0, chordAt = 0, chordIx = 0, nextPluck = 0, lastNote = 3;
  const now = () => ac.currentTime;

  function impulse(sec = 3.2) {
    const sr = ac.sampleRate, len = Math.floor(sr * sec), b = ac.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) { const t = i / sr, n = Math.random() * 2 - 1; lp += (n - lp) * (0.35 - 0.25 * Math.min(1, t / sec)); d[i] = lp * Math.pow(1 - t / sec, 2.6) * (t < 0.012 ? t / 0.012 : 1); }
    }
    return b;
  }
  function karplus(freq, sec = 3.8) {
    const sr = ac.sampleRate, N = Math.max(2, Math.round(sr / freq)), len = Math.floor(sr * sec), b = ac.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin((i / N) * Math.PI));
    for (let i = 1; i < N; i++) d[i] = d[i] * 0.55 + d[i - 1] * 0.45;               // attaque adoucie (plectre en ivoire, pas métallique)
    const decay = Math.pow(0.0005, 1 / (sr * sec * 0.9));
    for (let i = N; i < len; i++) { const a = d[i - N], b = i - N - 1 >= 0 ? d[i - N - 1] : a; d[i] = (a + b) * 0.5 * decay; }
    let pk = 0; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < len; i++) d[i] /= pk || 1;
    return b;
  }
  function init() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { return false; }
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
    out = ac.createGain(); out.gain.value = 0; out.connect(comp); comp.connect(ac.destination);
    verb = ac.createConvolver(); verb.buffer = impulse(); const vg = ac.createGain(); vg.gain.value = 0.42; verb.connect(vg); vg.connect(out);
    sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(out);
    music = ac.createGain(); music.gain.value = 0.0; music.connect(out);
    const mv = ac.createGain(); mv.gain.value = 0.9; music.connect(mv); mv.connect(verb);
    const sr = ac.sampleRate; noiseBuf = ac.createBuffer(1, sr * 3, sr); { const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.12) * 1.6; } }
    Object.entries(NOTE).forEach(([k, f]) => { plucks[k] = karplus(f); });
    wind();
    document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });
    return true;
  }
  const g = (v = 0) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const noise = (t, dur) => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random(); s.start(t, Math.random() * 2); s.stop(t + dur + 0.1); return s; };
  const env = (p, pts) => { p.cancelScheduledValues(pts[0][0]); p.setValueAtTime(pts[0][1], pts[0][0]); for (let i = 1; i < pts.length; i++) { const [t, v, k] = pts[i]; if (k === 'exp') p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); else p.linearRampToValueAtTime(v, t); } };
  const send = (node, wet, dest = sfx) => { node.connect(dest); if (wet) { const w = g(wet); node.connect(w); w.connect(verb); } };

  /* le vent d’hiver, en fond : bruit grave dont le filtre respire */
  function wind() {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.4;
    const lfo = ac.createOscillator(), lg = g(160); lfo.frequency.value = 0.07; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const v = g(0.04); s.connect(lp); lp.connect(v); v.connect(sfx); s.start();
  }

  /* la musique : une nappe qui change d’accord toutes les 12 s, et le koto */
  const CHORDS = [['D3', 'A3', 'E4'], ['Bb3', 'F4', 'D4'], ['F3', 'A3', 'E4'], ['A3', 'E4', 'Bb3']];
  function pad(t) {
    const ch = CHORDS[chordIx++ % CHORDS.length];
    ch.forEach((n, k) => {
      [0, 1].forEach((det) => {
        const o = ac.createOscillator(); o.type = det ? 'triangle' : 'sine'; o.frequency.value = NOTE[n] * (det ? 1.003 : 0.5 * (k === 0 ? 1 : 2));
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const v = g(0); env(v.gain, [[t, 0], [t + 4, 0.05 / (k + 1)], [t + 10, 0.05 / (k + 1)], [t + 14, 0]]);
        o.connect(lp); lp.connect(v); v.connect(music); o.start(t); o.stop(t + 14.2);
      });
    });
  }
  function pluck(t, name, vol = 0.32, pan = 0, dest = music) {
    const s = ac.createBufferSource(); s.buffer = plucks[name]; s.playbackRate.value = 1;
    const p = ac.createStereoPanner(); p.pan.value = pan; const v = g(vol);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    s.connect(lp); lp.connect(v); v.connect(p); p.connect(dest); if (dest !== music) { const w = g(0.5); p.connect(w); w.connect(verb); }
    s.start(t);
  }
  function schedule() {
    if (!ac || ac.state !== 'running') return;
    const t = now();
    if (t + 0.5 > chordAt) { pad(chordAt); chordAt += 12; }
    while (nextPluck < t + 0.6) {
      lastNote = Math.max(0, Math.min(MELODY.length - 1, lastNote + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      pluck(nextPluck, MELODY[lastNote], 0.2 + Math.random() * 0.12, (Math.random() - 0.5) * 0.6);
      if (Math.random() < 0.28) pluck(nextPluck + 0.16, MELODY[Math.max(0, lastNote - 2)], 0.14, (Math.random() - 0.5) * 0.6);
      nextPluck += [1.6, 2.4, 3.2, 3.2, 4.8][Math.floor(Math.random() * 5)];
    }
  }

  /* ---------- les effets ---------- */
  // le whoosh d’un trajet : on passe devant le décor, il file de droite à gauche
  function whoosh(dur = 2.6) {
    if (!ac || muted) return; const t = now() + 0.01;
    const a = noise(t, dur), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    env(bp.frequency, [[t, 260], [t + dur * 0.42, 2600, 'exp'], [t + dur, 380, 'exp']]);
    const va = g(0); env(va.gain, [[t, 0], [t + dur * 0.12, 0.08], [t + dur * 0.42, 0.62], [t + dur * 0.8, 0.12], [t + dur, 0]]);
    const pan = ac.createStereoPanner(); env(pan.pan, [[t, 0.85], [t + dur, -0.85]]);
    a.connect(bp); bp.connect(va); va.connect(pan); send(pan, 0.25);
    const b = noise(t, dur), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const vb = g(0); env(vb.gain, [[t, 0], [t + dur * 0.45, 0.9], [t + dur, 0]]); b.connect(lp); lp.connect(vb); send(vb, 0);
    const o = ac.createOscillator(); o.type = 'sine'; env(o.frequency, [[t, 70], [t + dur * 0.45, 118, 'exp'], [t + dur, 52, 'exp']]);
    const vo = g(0); env(vo.gain, [[t, 0], [t + dur * 0.45, 0.16], [t + dur, 0]]); o.connect(vo); send(vo, 0); o.start(t); o.stop(t + dur + 0.05);
  }
  // l’arrivée : coup grave, attaque claire, petit carillon de koto
  function arrive() {
    if (!ac || muted) return; const t = now() + 0.01;
    const o = ac.createOscillator(); o.type = 'sine'; env(o.frequency, [[t, 96], [t + 0.5, 38, 'exp']]);
    const vo = g(0); env(vo.gain, [[t, 0], [t + 0.004, 0.95], [t + 1.3, 0.0001, 'exp']]); o.connect(vo); send(vo, 0.12); o.start(t); o.stop(t + 1.4);
    const k = ac.createOscillator(); k.type = 'triangle'; env(k.frequency, [[t, 180], [t + 0.12, 62, 'exp']]);
    const vk = g(0); env(vk.gain, [[t, 0], [t + 0.003, 0.3], [t + 0.18, 0.0001, 'exp']]); k.connect(vk); send(vk, 0.1); k.start(t); k.stop(t + 0.2);
    const n = noise(t, 0.06), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const vn = g(0); env(vn.gain, [[t, 0.3], [t + 0.05, 0.0001, 'exp']]); n.connect(hp); hp.connect(vn); send(vn, 0.4);
    pluck(t + 0.05, 'D5', 0.3, -0.15, sfx); pluck(t + 0.2, 'A5', 0.16, 0.2, sfx);
  }
  // un « tic » par lettre du prénom qui apparaît
  function ticks(n, gap = 0.045, delay = 0.1) {
    if (!ac || muted) return;
    for (let i = 0; i < n; i++) {
      const t = now() + delay + i * gap, o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 2400 + (i % 3) * 260;
      const v = g(0); env(v.gain, [[t, 0], [t + 0.002, 0.07], [t + 0.03, 0.0001, 'exp']]);
      const p = ac.createStereoPanner(); p.pan.value = -0.5 + (i / Math.max(1, n - 1)) * 0.6;
      o.connect(v); v.connect(p); send(p, 0.15); o.start(t); o.stop(t + 0.05);
    }
  }
  // le swish d’une ligne qui se dessine
  function swish(delay = 0) {
    if (!ac || muted) return; const t = now() + delay, d = 0.32;
    const a = noise(t, d), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; env(bp.frequency, [[t, 1800], [t + d, 7000, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + d * 0.6, 0.16], [t + d, 0]]); a.connect(bp); bp.connect(v); send(v, 0.3);
  }
  function hover() {
    if (!ac || muted) return; const t = now(), o = ac.createOscillator(); o.frequency.value = 1900;
    const v = g(0); env(v.gain, [[t, 0], [t + 0.002, 0.035], [t + 0.04, 0.0001, 'exp']]); o.connect(v); send(v, 0.1); o.start(t); o.stop(t + 0.06);
  }
  function click() {
    if (!ac || muted) return; const t = now(), o = ac.createOscillator(); env(o.frequency, [[t, 520], [t + 0.05, 980, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.003, 0.14], [t + 0.09, 0.0001, 'exp']]); o.connect(v); send(v, 0.2); o.start(t); o.stop(t + 0.1);
  }
  // l’entrée : une montée, puis l’impact, et la musique arrive
  function enter() {
    if (!ac) return; const t = now() + 0.02, d = 1.1;
    const a = noise(t, d), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; env(bp.frequency, [[t, 300], [t + d, 5200, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + d * 0.95, 0.35, 'exp'], [t + d + 0.05, 0]]); a.connect(bp); bp.connect(v); send(v, 0.35);
    const o = ac.createOscillator(); o.type = 'sawtooth'; env(o.frequency, [[t, 110], [t + d, 440, 'exp']]);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
    const vo = g(0); env(vo.gain, [[t, 0], [t + d * 0.95, 0.06], [t + d + 0.03, 0]]); o.connect(lp); lp.connect(vo); send(vo, 0.3); o.start(t); o.stop(t + d + 0.1);
    setTimeout(arrive, d * 1000);
    env(music.gain, [[t + d, 0], [t + d + 6, 0.3]]);
    chordAt = t + d; nextPluck = t + d + 2.2;
  }

  return {
    start() {                                 // à appeler dans un geste de l’utilisateur (clic, touche)
      if (!init()) return false;
      if (ac.state === 'suspended') ac.resume();
      env(out.gain, [[now(), out.gain.value], [now() + 0.4, muted ? 0 : 1]]);
      if (music.gain.value < 0.01) { env(music.gain, [[now(), 0], [now() + 4, 0.3]]); chordAt = now() + 0.2; nextPluck = now() + 1.5; }   // son activé plus tard : la musique arrive aussi
      clearInterval(timer); timer = setInterval(schedule, 250);
      return true;
    },
    setMuted(m) { muted = m; if (ac) env(out.gain, [[now(), out.gain.value], [now() + 0.35, m ? 0 : 1]]); },
    get ready() { return !!ac; },
    get running() { return !!ac && ac.state === 'running'; },
    get muted() { return muted; },
    whoosh, arrive, ticks, swish, hover, click, enter,
  };
}
