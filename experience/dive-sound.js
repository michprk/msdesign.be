/* ==========================================================================
   M&S Design — le son de « Sous la surface » (v31), façon vidéo de motion design.
   Tout est synthétisé (aucun fichier, aucun droit) :
   · l’entrée : souffle inversé qui aspire, whoosh qui traverse les pétales (gauche → droite),
     plongeon grave dans l’eau, puis un accord de cloches de verre à l’arrivée ;
   · sous l’eau : une musique très douce (nappe chaude qui change d’accord toutes les 12 s,
     cloches de verre rares avec écho), un grondement d’eau, des gouttes et des bulles réalistes
     (résonance de Minnaert : la note d’une bulle monte en une fraction de seconde) ;
   · les gestes : attraper, lâcher, respirer, anneau de bulles, fleur timide, graine, carpes,
     nuit, remontée.
   Chaîne : interface / eau (filtrée « sous l’eau ») / musique → réverbération + écho ping-pong
   → saturation douce → compresseur → sortie.
   ========================================================================== */
const N = { D3: 146.83, E3: 164.81, Fs3: 185, G3: 196, A3: 220, B3: 246.94, Cs4: 277.18, D4: 293.66, E4: 329.63, Fs4: 369.99, G4: 392, A4: 440, B4: 493.88, Cs5: 554.37, D5: 587.33, E5: 659.25, Fs5: 739.99, A5: 880, B5: 987.77, D6: 1174.66, E6: 1318.51, Fs6: 1479.98, A6: 1760 };
const DAY = [['D3', 'A3', 'E4', 'Fs4'], ['B3', 'D4', 'Fs4', 'A4'], ['G3', 'D4', 'Fs4', 'B4'], ['A3', 'E4', 'Fs4', 'Cs5']];
const NIGHT = [['B3', 'D4', 'Fs4', 'A4'], ['G3', 'B3', 'D4', 'Fs4'], ['E3', 'G3', 'B3', 'D4'], ['Fs3', 'A3', 'Cs4', 'E4']];
const BELLS = ['D5', 'E5', 'Fs5', 'A5', 'B5', 'D6', 'E6', 'Fs6'];

export function createDiveSound() {
  let ac = null, out = null, ui = null, water = null, muffle = null, music = null, verb = null, dly = null, noiseBuf = null, swellBuf = null;
  let muted = false, timer = 0, chordAt = 0, chordIx = 0, nextBell = 0, nightOn = false, playing = false, bed = null, riser = null;
  const now = () => ac.currentTime;
  const g = (v = 0) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const env = (p, pts) => { p.cancelScheduledValues(pts[0][0]); p.setValueAtTime(pts[0][1], pts[0][0]); for (let i = 1; i < pts.length; i++) { const [t, v, k] = pts[i]; if (k === 'exp') p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); else p.linearRampToValueAtTime(v, t); } };
  const noise = (t, dur) => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random() * 2.5); s.stop(t + dur + 0.1); return s; };
  const filt = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  // envoi vers un bus, avec réverbération (wet), écho (echo) et position stéréo (p)
  function to(node, bus, { wet = 0, echo = 0, p = 0 } = {}) {
    const pn = ac.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, p)); node.connect(pn); pn.connect(bus);
    if (wet) { const w = g(wet); pn.connect(w); w.connect(verb); }
    if (echo) { const e = g(echo); pn.connect(e); e.connect(dly); }
    return pn;
  }
  function osc(type, f, t, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(t + dur); return o; }

  function init() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { return false; }
    const sr = ac.sampleRate;
    // sortie : coupe-bas, saturation très douce (colle les sons entre eux), compresseur
    const hp = filt('highpass', 28, 0.5), sat = ac.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.25) / Math.tanh(1.25); }
    sat.curve = curve; sat.oversample = '2x';
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.24;
    out = g(0); out.connect(hp); hp.connect(sat); sat.connect(comp); comp.connect(ac.destination);
    // réverbération : une grande salle sombre, stéréo
    const len = Math.floor(sr * 3.8), ir = ac.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / sr; lp += ((Math.random() * 2 - 1) - lp) * (0.32 - 0.24 * Math.min(1, t / 3.8)); d[i] = lp * Math.pow(1 - t / 3.8, 2.3) * (t < 0.02 ? t / 0.02 : 1); } }
    verb = ac.createConvolver(); verb.buffer = ir; const vr = g(0.5); verb.connect(vr); vr.connect(out);
    // écho ping-pong (gauche 0,36 s, droite 0,54 s), qui s’assombrit à chaque rebond
    dly = g(1); const dl = ac.createDelay(1.5), dr = ac.createDelay(1.5), fb = g(0.36), dlp = filt('lowpass', 2600), mL = ac.createChannelMerger(2);
    dl.delayTime.value = 0.36; dr.delayTime.value = 0.54; dly.connect(dl); dl.connect(dlp); dlp.connect(dr); dr.connect(fb); fb.connect(dl);
    dl.connect(mL, 0, 0); dr.connect(mL, 0, 1); const dg = g(0.34); mL.connect(dg); dg.connect(out);
    ui = g(0.9); ui.connect(out);
    muffle = filt('lowpass', 14000, 0.4); muffle.connect(out);
    water = g(0.9); water.connect(muffle);
    const mlp = filt('lowpass', 4200, 0.4); music = g(0); music.connect(mlp); mlp.connect(out);
    const mv = g(0.75); music.connect(mv); mv.connect(verb);
    // bruit rose (base de tous les souffles)
    noiseBuf = ac.createBuffer(1, sr * 3, sr);
    { const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.12) * 1.6; } }
    // « souffle inversé » (un souffle et un accord joués à l’envers) : le classique qui aspire vers un impact
    { const L = Math.floor(sr * 1.25); swellBuf = ac.createBuffer(2, L, sr);
      for (let c = 0; c < 2; c++) { const d = swellBuf.getChannelData(c); let lp = 0; const fr = [N.D4, N.A4, N.E5, N.Fs5].map((f) => f * (c ? 1.003 : 1));
        for (let i = 0; i < L; i++) { const t = i / sr, k = Math.pow(t / 1.25, 3.2); lp += ((Math.random() * 2 - 1) - lp) * (0.05 + 0.55 * k); let s = lp * 0.9;
          for (let j = 0; j < 4; j++) s += Math.sin(2 * Math.PI * fr[j] * t + j) * 0.12 * k;
          d[i] = s * k * (i > L - 64 ? (L - i) / 64 : 1); } } }
    // le fond de l’eau : grondement grave qui respire + un léger pétillement
    { const rb = ac.createBufferSource(); rb.buffer = noiseBuf; rb.loop = true; const lp = filt('lowpass', 210, 0.5);
      const lfo = ac.createOscillator(), lg = g(90); lfo.frequency.value = 0.08; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      const fz = ac.createBufferSource(); fz.buffer = noiseBuf; fz.loop = true; const bp = filt('bandpass', 1400, 0.6), fg = g(0.008);
      bed = g(0); rb.connect(lp); lp.connect(bed); fz.connect(bp); bp.connect(fg); fg.connect(bed); bed.connect(water); rb.start(); fz.start(0, 1.3);
      const fl = ac.createOscillator(), fl2 = g(0.006); fl.frequency.value = 0.13; fl.connect(fl2); fl2.connect(fg.gain); fl.start(); }
    // la montée vers l’équipe (silencieuse tant qu’on ne charge pas)
    { const rs = ac.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true; const rbp = filt('bandpass', 300, 1.1), rg = g(0);
      const ro = ac.createOscillator(); ro.type = 'sawtooth'; ro.frequency.value = 110; const rlp = filt('lowpass', 400, 0.8), rog = g(0);
      rs.connect(rbp); rbp.connect(rg); rg.connect(ui); ro.connect(rlp); rlp.connect(rog); rog.connect(ui); rs.start(); ro.start(); riser = { rbp, rg, ro, rlp, rog }; }
    document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });
    return true;
  }

  /* ---------- les briques ---------- */
  // une cloche de verre (synthèse FM) : attaque nette, longue résonance, un peu d’écho
  function bell(t, f, vol = 0.05, p = 0, bus = music, echo = 0.35) {
    const c = osc('sine', f, t, 3.2), m = osc('sine', f * 3.5, t, 3.2), mi = g(0); env(mi.gain, [[t, f * 2.2], [t + 0.9, f * 0.05, 'exp']]);
    m.connect(mi); mi.connect(c.frequency);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.004, vol], [t + 3, 0.0001, 'exp']]); c.connect(v); to(v, bus, { wet: 0.5, echo, p });
  }
  // une bulle (résonance de Minnaert) : la note monte en une fraction de seconde
  function bubble(t, f, vol, p = 0, bus = water) {
    const o = osc('sine', f, t, 0.16); env(o.frequency, [[t, f], [t + 0.05, f * 1.7, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.003, vol], [t + 0.09, 0.0001, 'exp']]); o.connect(v); to(v, bus, { wet: 0.25, p });
  }
  // un souffle filtré qui balaie le spectre et traverse l’image (whoosh)
  function swoosh(t, d, f0, f1, f2, vol, p0 = -0.8, p1 = 0.8, bus = ui, wet = 0.3) {
    const a = noise(t, d), bp = filt('bandpass', f0, 1.1); env(bp.frequency, [[t, f0], [t + d * 0.5, f1, 'exp'], [t + d, f2, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + d * 0.45, vol], [t + d, 0.0001, 'exp']]);
    const pn = ac.createStereoPanner(); env(pn.pan, [[t, p0], [t + d, p1]]); a.connect(bp); bp.connect(v); v.connect(pn); pn.connect(bus);
    if (wet) { const w = g(wet); pn.connect(w); w.connect(verb); }
  }
  // un coup grave (sub qui tombe + attaque claire)
  function hit(t, vol = 0.8, f0 = 90, f1 = 34, bus = ui, dur = 1.4) {
    const o = osc('sine', f0, t, dur + 0.1); env(o.frequency, [[t, f0], [t + dur * 0.5, f1, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.005, vol], [t + dur, 0.0001, 'exp']]); o.connect(v); to(v, bus, { wet: 0.1 });
    const n = noise(t, 0.05), hpf = filt('highpass', 2400); const vn = g(0); env(vn.gain, [[t, vol * 0.35], [t + 0.045, 0.0001, 'exp']]); n.connect(hpf); hpf.connect(vn); to(vn, bus, { wet: 0.35 });
  }
  function bubbles(n = 8, spread = 0.8, vol = 0.8, p = 0, bus = water) {
    if (!ac || muted) return; const t0 = now();
    for (let i = 0; i < n; i++) { const t = t0 + Math.pow(Math.random(), 1.4) * spread; bubble(t, 380 + Math.random() * 1500, (0.05 + Math.random() * 0.07) * vol, p + (Math.random() - 0.5) * 0.7, bus); }
  }

  /* ---------- la musique sous l’eau ---------- */
  function pad(t) {
    const set = nightOn ? NIGHT : DAY, ch = set[chordIx++ % set.length];
    ch.forEach((n, k) => {
      [-7, 7].forEach((cents) => {
        const o = osc('sawtooth', N[n] * (k === 0 ? 0.5 : 1), t, 14.4); o.detune.value = cents + (Math.random() - 0.5) * 4;
        const lp = filt('lowpass', 520 + k * 90, 0.4), v = g(0); env(v.gain, [[t, 0], [t + 4.5, 0.016 / (1 + k * 0.4)], [t + 10, 0.016 / (1 + k * 0.4)], [t + 14.2, 0]]);
        o.connect(lp); lp.connect(v); to(v, music, { p: cents < 0 ? -0.35 : 0.35 });
      });
    });
    const s = osc('sine', N[ch[0]] * 0.25, t, 14.4), vs = g(0); env(vs.gain, [[t, 0], [t + 5, 0.05], [t + 10, 0.05], [t + 14.2, 0]]); s.connect(vs); vs.connect(music);
  }
  function schedule() {
    if (!ac || ac.state !== 'running' || !playing) return;
    const t = now();
    if (t + 0.5 > chordAt) { pad(chordAt); chordAt += 12; }
    while (nextBell < t + 0.6) { bell(nextBell, N[BELLS[Math.floor(Math.random() * BELLS.length)]] * (nightOn ? 0.5 : 1), 0.022 + Math.random() * 0.02, (Math.random() - 0.5) * 0.9); nextBell += [3.6, 4.8, 6, 7.2][Math.floor(Math.random() * 4)]; }
  }
  function underwater(t) {                                       // on est dans l’eau : tout se feutre, la musique arrive
    env(muffle.frequency, [[t, muffle.frequency.value], [t + 0.35, 1800, 'exp'], [t + 3, nightOn ? 1100 : 2800, 'exp']]);
    env(bed.gain, [[t, bed.gain.value], [t + 2, 0.06]]);
    env(music.gain, [[t, music.gain.value], [t + 6, 0.55]]);
    if (!playing) { playing = true; chordAt = t + 0.4; nextBell = t + 3; }
  }

  /* ---------- l’entrée : on plonge dans la fleur ---------- */
  // T = { through, water, arrive } : instants (s) où la caméra traverse les pétales, entre dans l’eau, se pose
  function enter(T) {
    if (!ac) return; const t = now() + 0.03;
    const sw = ac.createBufferSource(); sw.buffer = swellBuf; const sv = g(0.95), sl = filt('lowpass', 9000, 0.4);
    sw.connect(sl); sl.connect(sv); to(sv, ui, { wet: 0.3 }); sw.start(Math.max(t, t + T.through - 1.3));
    swoosh(t + T.through - 0.42, 0.95, 380, 3600, 520, 0.6, -0.9, 0.9, ui, 0.35);
    const air = osc('sine', 190, t + T.through - 0.3, 0.9); env(air.frequency, [[t + T.through - 0.3, 190], [t + T.through + 0.5, 70, 'exp']]);
    const va = g(0); env(va.gain, [[t + T.through - 0.3, 0], [t + T.through, 0.12], [t + T.through + 0.55, 0.0001, 'exp']]); air.connect(va); to(va, ui);
    const tw = t + T.water;                                         // l’eau : coup sourd, souffle d’eau, bulles
    hit(tw, 0.9, 74, 30, ui, 1.6);
    const n = noise(tw, 1.3), lp = filt('lowpass', 2600, 0.8); env(lp.frequency, [[tw, 2600], [tw + 1.2, 180, 'exp']]);
    const vn = g(0); env(vn.gain, [[tw, 0], [tw + 0.02, 0.5], [tw + 1.25, 0.0001, 'exp']]); n.connect(lp); lp.connect(vn); to(vn, ui, { wet: 0.3 });
    setTimeout(() => { bubbles(28, 1.8, 1.1, 0, water); }, (T.water + 0.1) * 1000);
    underwater(tw);
    const ta = t + T.arrive;                                        // la fleur se pose : un accord de verre qui s’ouvre
    ['D5', 'Fs5', 'A5', 'E6'].forEach((k, i) => bell(ta + i * 0.075, N[k], 0.05, -0.45 + i * 0.3, music, 0.45));
  }

  /* ---------- les gestes ---------- */
  function drop(p = 0, vol = 1) {                                 // une goutte à la surface (on l’entend d’en dessous)
    if (!ac || muted) return; const t = now() + 0.01;
    const n = noise(t, 0.01), hpf = filt('highpass', 3000); const vn = g(0); env(vn.gain, [[t, 0.08 * vol], [t + 0.008, 0.0001, 'exp']]); n.connect(hpf); hpf.connect(vn); to(vn, water, { wet: 0.4, p });
    bubble(t + 0.004, 900 + Math.random() * 700, 0.12 * vol, p);
  }
  function grab() {
    if (!ac || muted) return; const t = now();
    hit(t, 0.28, 140, 70, water, 0.3);
    swoosh(t, 0.32, 300, 900, 260, 0.14, 0, 0, water, 0.2);
  }
  function release(force = 1) {
    if (!ac || muted) return; const t = now();
    swoosh(t, 0.55 + force * 0.25, 260, 1300 + force * 900, 300, 0.12 + force * 0.12, 0.4, -0.4, water, 0.3);
    bubbles(Math.round(6 + force * 8), 0.7, 0.8);
  }
  function breathe() {                                            // la fleur respire : un souffle, quelques cloches, un anneau de bulles
    if (!ac || muted) return; const t = now();
    const a = noise(t, 1.8), bp = filt('bandpass', 600, 0.9); env(bp.frequency, [[t, 500], [t + 0.5, 1100, 'exp'], [t + 1.7, 400, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.45, 0.13], [t + 1.75, 0.0001, 'exp']]); a.connect(bp); bp.connect(v); to(v, water, { wet: 0.5 });
    ['A5', 'D6'].forEach((k, i) => bell(t + 0.35 + i * 0.12, N[k] * (nightOn ? 0.5 : 1), 0.03, i ? 0.3 : -0.3, music, 0.4));
    const o = osc('sine', 210, t + 0.1, 0.4); env(o.frequency, [[t + 0.1, 210], [t + 0.32, 330, 'exp']]);   // le « bloup » de l’anneau
    const vo = g(0); env(vo.gain, [[t + 0.1, 0], [t + 0.12, 0.2], [t + 0.38, 0.0001, 'exp']]); o.connect(vo); to(vo, water, { wet: 0.3 });
    bubbles(12, 1, 0.7);
  }
  function ringPop(p = 0) {                                       // l’anneau arrive à la surface
    if (!ac || muted) return; const t = now();
    bubble(t, 520, 0.16, p); bubble(t + 0.05, 760, 0.1, p + 0.2);
    const n = noise(t, 0.3), bp = filt('bandpass', 1600, 0.7); const v = g(0); env(v.gain, [[t, 0], [t + 0.02, 0.07], [t + 0.28, 0.0001, 'exp']]); n.connect(bp); bp.connect(v); to(v, water, { wet: 0.4, p });
  }
  function wave(p = 0) {                                          // un clic dans l’eau : une onde qui pousse tout
    if (!ac || muted) return; const t = now();
    swoosh(t, 0.7, 200, 700, 160, 0.2, p - 0.3, p + 0.3, water, 0.35);
    hit(t, 0.22, 110, 55, water, 0.5); bubbles(6, 0.5, 0.6, p);
  }
  function shy() {                                                // la fleur timide se referme d’un coup
    if (!ac || muted) return; const t = now() + 0.005;
    swoosh(t, 0.3, 2600, 1200, 500, 0.16, 0.5, -0.5, water, 0.25);
    [N.A5, N.E5].forEach((f, i) => bell(t + i * 0.09, f * (nightOn ? 0.5 : 1), 0.035, i ? -0.2 : 0.2, water, 0.2));
  }
  function sprout(p = 0) {                                        // une graine : un « pop », puis une petite montée de verre
    if (!ac || muted) return; const t = now() + 0.01;
    bubble(t, 260, 0.2, p); bubble(t + 0.04, 420, 0.12, p);
    ['D6', 'Fs6', 'A6'].forEach((k, i) => bell(t + 0.75 + i * 0.13, N[k] * (nightOn ? 0.5 : 1), 0.028, p + (i - 1) * 0.2, music, 0.5));
    bubbles(6, 0.6, 0.6, p);
  }
  function feed(p = 0) {                                          // les granulés tombent dans l’eau
    if (!ac || muted) return; const t0 = now();
    for (let i = 0; i < 7; i++) bubble(t0 + i * 0.05 + Math.random() * 0.04, 1200 + Math.random() * 900, 0.07, p + (Math.random() - 0.5) * 0.4);
  }
  function koiEat(p = 0) { if (!ac || muted) return; const t = now(); bubble(t, 240, 0.14, p); bubble(t + 0.06, 330, 0.07, p); }
  function koiFlee(p = 0) { if (!ac || muted) return; const t = now(); swoosh(t, 0.42, 900, 600, 220, 0.16, p + 0.3, p - 0.5, water, 0.2); }
  function night(on) {
    nightOn = on; if (!ac) return; const t = now();
    env(muffle.frequency, [[t, muffle.frequency.value], [t + 2.2, on ? 1100 : 2800, 'exp']]);
    if (muted) return;
    const o = osc('sine', on ? 120 : 45, t, 2.4); env(o.frequency, [[t, on ? 120 : 45], [t + 2.2, on ? 38 : 110, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.3, 0.22], [t + 2.3, 0.0001, 'exp']]); o.connect(v); to(v, ui, { wet: 0.3 });
    (on ? ['Fs5', 'D5', 'B4'] : ['D5', 'Fs5', 'A5']).forEach((k, i) => bell(t + 0.2 + i * 0.16, N[k], 0.035, (i - 1) * 0.35, music, 0.5));
    chordAt = Math.min(chordAt, t + 2.5);                          // l’accord suivant arrive vite, dans la couleur de la nuit
  }
  function rise(p) {                                              // la remontée vers l’équipe
    if (!ac || !riser) return; const t = now(), k = muted ? 0 : 1;
    riser.rbp.frequency.setTargetAtTime(300 + p * 4800, t, 0.08); riser.rg.gain.setTargetAtTime(k * p * p * 0.3, t, 0.08);
    riser.ro.frequency.setTargetAtTime(110 * Math.pow(4, p), t, 0.08); riser.rlp.frequency.setTargetAtTime(400 + p * 2600, t, 0.08); riser.rog.gain.setTargetAtTime(k * p * p * 0.05, t, 0.08);
  }
  function surface() {
    if (!ac || muted) return; const t = now();
    riser.rg.gain.setTargetAtTime(0, t, 0.05); riser.rog.gain.setTargetAtTime(0, t, 0.05);
    env(muffle.frequency, [[t, muffle.frequency.value], [t + 0.6, 14000, 'exp']]);
    swoosh(t, 0.9, 400, 5200, 900, 0.4, -0.6, 0.6, ui, 0.4); hit(t + 0.05, 0.35, 120, 60, ui, 0.6);
    ['D6', 'A6'].forEach((k, i) => bell(t + 0.1 + i * 0.1, N[k], 0.04, i ? 0.4 : -0.4, ui, 0.5));
  }
  function tick(p = 0) {                                          // une poignée du dessin technique qui apparaît
    if (!ac || muted) return; const t = now(), o = osc('sine', 3100 + Math.random() * 400, t, 0.05);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.002, 0.03], [t + 0.03, 0.0001, 'exp']]); o.connect(v); to(v, ui, { wet: 0.15, p });
  }
  function reveal() {                                             // le dessin devient la vraie fleur
    if (!ac || muted) return; const t = now();
    hit(t, 0.32, 70, 40, ui, 1.4);
    ['D5', 'A5', 'E6'].forEach((k, i) => bell(t + 0.05 + i * 0.09, N[k], 0.035, (i - 1) * 0.4, ui, 0.45));
  }
  function hover() { if (!ac || muted) return; const t = now(), o = osc('sine', 2500, t, 0.05); const v = g(0); env(v.gain, [[t, 0], [t + 0.002, 0.025], [t + 0.04, 0.0001, 'exp']]); o.connect(v); to(v, ui, { wet: 0.1 }); }
  function settle(n) {                                            // le son allumé après coup (déjà au fond) : directement l’ambiance
    if (!ac) return; nightOn = !!n; underwater(now());
  }

  return {
    start() {                                                     // à appeler dans un geste (clic, touche)
      if (!init()) return false;
      if (ac.state === 'suspended') ac.resume();
      env(out.gain, [[now(), out.gain.value], [now() + 0.4, muted ? 0 : 1]]);
      clearInterval(timer); timer = setInterval(schedule, 250);
      return true;
    },
    setMuted(m) { muted = m; if (ac) env(out.gain, [[now(), out.gain.value], [now() + 0.35, m ? 0 : 1]]); },
    get ready() { return !!ac; }, get running() { return !!ac && ac.state === 'running'; }, get muted() { return muted; },
    enter, drop, bubbles, grab, release, breathe, ringPop, wave, shy, sprout, feed, koiEat, koiFlee, night, rise, surface, tick, reveal, hover, settle,
  };
}
