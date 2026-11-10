/* ==========================================================================
   M&S Design — le son de « Sous la surface ». Tout est synthétisé (aucun fichier).
   · à la surface : des gouttes d’eau (un « ploc » = une note qui monte très vite) ;
   · sous l’eau : un grondement grave, une nappe très douce, des bulles ;
   · les gestes : plongeon, fleur attrapée, relâchée, qui respire ;
   · la remontée (chargement vers l’équipe) : un souffle qui monte.
   Chaîne : effets + nappe → filtre « sous l’eau » → réverbération → compresseur.
   ========================================================================== */
export function createDiveSound() {
  let ac = null, out = null, bus = null, muffle = null, verb = null, noiseBuf = null, pad = null, riser = null, muted = false;
  const now = () => ac.currentTime;
  const g = (v = 0) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const env = (p, pts) => { p.cancelScheduledValues(pts[0][0]); p.setValueAtTime(pts[0][1], pts[0][0]); for (let i = 1; i < pts.length; i++) { const [t, v, k] = pts[i]; if (k === 'exp') p.exponentialRampToValueAtTime(Math.max(1e-4, v), t); else p.linearRampToValueAtTime(v, t); } };
  const send = (node, wet = 0.3, pan = 0) => { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(bus); if (wet) { const w = g(wet); p.connect(w); w.connect(verb); } };
  const noise = (t, dur) => { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random() * 2); s.stop(t + dur + 0.1); return s; };

  function init() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { return false; }
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    out = g(0); out.connect(comp); comp.connect(ac.destination);
    muffle = ac.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 9000; muffle.Q.value = 0.3; muffle.connect(out);
    bus = g(0.9); bus.connect(muffle);
    // une grande cuve : réverbération longue et sombre
    const sr = ac.sampleRate, len = Math.floor(sr * 3.6), ir = ac.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) { const dd = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / sr, n = Math.random() * 2 - 1; lp += (n - lp) * (0.3 - 0.22 * Math.min(1, t / 3.6)); dd[i] = lp * Math.pow(1 - t / 3.6, 2.4) * (t < 0.015 ? t / 0.015 : 1); } }
    verb = ac.createConvolver(); verb.buffer = ir; const vg = g(0.5); verb.connect(vg); vg.connect(muffle);
    noiseBuf = ac.createBuffer(1, sr * 3, sr); { const dd = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < dd.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; dd[i] = (b0 + b1 + b2 + w * 0.1) * 1.6; } }
    // le grondement de l’eau, qui respire lentement
    const rb = ac.createBufferSource(); rb.buffer = noiseBuf; rb.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.5;
    const lfo = ac.createOscillator(), lg = g(110); lfo.frequency.value = 0.09; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const rv = g(0.055); rb.connect(lp); lp.connect(rv); rv.connect(bus); rb.start();
    // la nappe : ré, la, mi, fa dièse, très bas, chaque note ondule à son rythme
    pad = g(0); pad.connect(bus); const pw = g(0.7); pad.connect(pw); pw.connect(verb);
    [[146.83, 0.05, 0.11], [220, 0.035, 0.07], [329.63, 0.022, 0.13], [369.99, 0.016, 0.05], [73.42, 0.05, 0.03]].forEach(([f, a, r], k) => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (k - 2) * 3;
      const v = g(a), tr = ac.createOscillator(), tg = g(a * 0.6); tr.frequency.value = r; tr.connect(tg); tg.connect(v.gain); tr.start();
      o.connect(v); v.connect(pad); o.start();
    });
    // le souffle de la remontée (silencieux tant qu’on ne charge pas)
    const rs = ac.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
    const rbp = ac.createBiquadFilter(); rbp.type = 'bandpass'; rbp.Q.value = 1.1; rbp.frequency.value = 300;
    const rg = g(0), ro = ac.createOscillator(), rog = g(0); ro.type = 'sine'; ro.frequency.value = 110;
    rs.connect(rbp); rbp.connect(rg); rg.connect(bus); ro.connect(rog); rog.connect(bus); rs.start(); ro.start();
    riser = { rbp, rg, ro, rog };
    document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });
    return true;
  }

  // une goutte : la note monte très vite (c’est la bulle d’air qui se referme), puis s’éteint
  function drop(pan = 0, vol = 1) {
    if (!ac || muted) return; const t = now() + 0.01, f = 520 + Math.random() * 520;
    const o = ac.createOscillator(); o.type = 'sine'; env(o.frequency, [[t, f], [t + 0.012, f * 0.82], [t + 0.075, f * 2.3, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.003, 0.3 * vol], [t + 0.05, 0.16 * vol], [t + 0.24, 0.0001, 'exp']]);
    o.connect(v); send(v, 0.7, pan); o.start(t); o.stop(t + 0.3);
    const n = noise(t, 0.03), hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 1.2;
    const vn = g(0); env(vn.gain, [[t, 0.07 * vol], [t + 0.025, 0.0001, 'exp']]); n.connect(hp); hp.connect(vn); send(vn, 0.4, pan);
  }
  // des bulles : de petites notes courtes qui montent, en grappe
  function bubbles(n = 8, spread = 0.6, vol = 1, pan = 0) {
    if (!ac || muted) return;
    for (let i = 0; i < n; i++) {
      const t = now() + 0.01 + Math.random() * spread, f = 260 + Math.random() * 900, d = 0.035 + Math.random() * 0.07;
      const o = ac.createOscillator(); o.type = 'sine'; env(o.frequency, [[t, f], [t + d, f * (1.35 + Math.random() * 0.5), 'exp']]);
      const v = g(0); env(v.gain, [[t, 0], [t + 0.004, (0.05 + Math.random() * 0.07) * vol], [t + d + 0.03, 0.0001, 'exp']]);
      o.connect(v); send(v, 0.5, pan + (Math.random() - 0.5) * 0.6); o.start(t); o.stop(t + d + 0.06);
    }
  }
  // le plongeon : l’éclaboussure qui se referme, un coup grave, puis les bulles
  function plunge() {
    if (!ac) return; const t = now() + 0.02;
    const a = noise(t, 1.9), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; env(lp.frequency, [[t, 6500], [t + 0.25, 2400, 'exp'], [t + 1.8, 180, 'exp']]);
    const va = g(0); env(va.gain, [[t, 0], [t + 0.03, 0.75], [t + 0.5, 0.3], [t + 1.9, 0.0001, 'exp']]); a.connect(lp); lp.connect(va); send(va, 0.35);
    const o = ac.createOscillator(); o.type = 'sine'; env(o.frequency, [[t, 105], [t + 0.9, 34, 'exp']]);
    const vo = g(0); env(vo.gain, [[t, 0], [t + 0.01, 0.9], [t + 1.5, 0.0001, 'exp']]); o.connect(vo); send(vo, 0.1); o.start(t); o.stop(t + 1.6);
    setTimeout(() => bubbles(26, 2.2, 1.1), 250);
    env(muffle.frequency, [[t, muffle.frequency.value], [t + 0.5, 1500, 'exp'], [t + 4, 2600, 'exp']]);
    env(pad.gain, [[t, pad.gain.value], [t + 5, 0.45]]);
  }
  function grab() {
    if (!ac || muted) return; const t = now();
    const o = ac.createOscillator(); o.type = 'sine'; env(o.frequency, [[t, 170], [t + 0.18, 96, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + 0.01, 0.22], [t + 0.3, 0.0001, 'exp']]); o.connect(v); send(v, 0.4); o.start(t); o.stop(t + 0.35);
  }
  function release(power = 1) {
    if (!ac || muted) return; const t = now(), dd = 0.7;
    const a = noise(t, dd), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9; env(bp.frequency, [[t, 420], [t + dd * 0.4, 1100, 'exp'], [t + dd, 300, 'exp']]);
    const v = g(0); env(v.gain, [[t, 0], [t + dd * 0.3, 0.22 * power], [t + dd, 0.0001, 'exp']]); a.connect(bp); bp.connect(v); send(v, 0.4);
    bubbles(5, 0.5, 0.7);
  }
  // la fleur respire : un accord clair, très doux, et quelques bulles
  function breathe() {
    if (!ac || muted) return; const t = now();
    [587.33, 880, 1108.73].forEach((f, k) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const v = g(0); env(v.gain, [[t, 0], [t + 0.35 + k * 0.08, 0.1 / (k + 1)], [t + 2.4, 0.0001, "exp"]]); o.connect(v); send(v, 0.9, (k - 1) * 0.3); o.start(t); o.stop(t + 2.5); });
    bubbles(12, 0.9, 0.9);
  }
  // la remontée : p de 0 à 1 pendant le chargement
  function rise(p) {
    if (!ac || !riser) return; const t = now();
    riser.rbp.frequency.setTargetAtTime(300 + p * p * 4200, t, 0.08); riser.rg.gain.setTargetAtTime(muted ? 0 : p * 0.5, t, 0.08);
    riser.ro.frequency.setTargetAtTime(110 + p * 330, t, 0.08); riser.rog.gain.setTargetAtTime(muted ? 0 : p * 0.07, t, 0.08);
  }
  function surface() {            // on perce la surface : tout s’ouvre d’un coup
    if (!ac || muted) return; const t = now();
    env(muffle.frequency, [[t, muffle.frequency.value], [t + 0.25, 12000, 'exp']]);
    const a = noise(t, 0.9), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const v = g(0); env(v.gain, [[t, 0], [t + 0.03, 0.5], [t + 0.9, 0.0001, 'exp']]); a.connect(hp); hp.connect(v); send(v, 0.5);
  }
  return {
    start() { if (!init()) return false; if (ac.state === 'suspended') ac.resume(); env(out.gain, [[now(), out.gain.value], [now() + 0.5, muted ? 0 : 1]]); return true; },
    setMuted(m) { muted = m; if (ac) env(out.gain, [[now(), out.gain.value], [now() + 0.35, m ? 0 : 1]]); },
    get ready() { return !!ac; }, get muted() { return muted; },
    drop, bubbles, plunge, grab, release, breathe, rise, surface,
  };
}
