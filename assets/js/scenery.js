/* ==========================================================================
   M&S Design — le décor du héros, peint dans le code (aucune photo achetée)
   paintRoom() : le studio flou derrière le MacBook — grande verrière aux
   montants noirs ouverte sur un jardin, moodboard épinglé, suspension,
   grande plante —, comme photographié à f/1.8 : flou, reflets ronds, grain.
   paintWood() : le plateau en chêne (planches collées, veinage, pores).
   Ces images sont produites une fois par l’outil _msdesign-src/assets-tool.html
   et enregistrées en WebP (assets/img/studio-*.webp, chene-*.webp).
   ========================================================================== */

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function makeNoise(seed) {
  const r = rng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const g = new Float32Array(256);
  for (let i = 0; i < 256; i++) g[i] = r() * 2 - 1;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const X = xi & 255, Y = yi & 255;
    const a = g[perm[X + perm[Y]]], b = g[perm[X + 1 + perm[Y]]];
    const c = g[perm[X + perm[Y + 1]]], d = g[perm[X + 1 + perm[Y + 1]]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/* ---------- Le studio, flou ---------- */
export function paintRoom(W, H, opts) {
  const o = Object.assign({ blur: 1, seed: 7 }, opts);
  const r = rng(o.seed);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const U = (u) => u * W, V = (v) => v * H;
  const blob = (u, v, rad, color, alpha) => {
    x.globalAlpha = alpha == null ? 1 : alpha;
    x.fillStyle = color;
    x.beginPath();
    x.arc(U(u), V(v), rad * W, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = 1;
  };
  const rect = (u, v, w, h, color) => { x.fillStyle = color; x.fillRect(U(u), V(v), w * W, h * H); };

  // mur en enduit chaud, plus sombre vers la gauche
  let g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#bfb49c');
  g.addColorStop(0.3, '#d6ccb6');
  g.addColorStop(0.46, '#e2dac8');
  g.addColorStop(1, '#ebe5d6');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(60,50,30,.16)');
  g.addColorStop(0.35, 'rgba(60,50,30,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  // verrière : ciel, arbres lointains, feuillage, feuilles au soleil
  const wx0 = 0.47, wx1 = 1.03, wy0 = -0.03, wy1 = 0.74;
  x.save();
  x.beginPath();
  x.rect(U(wx0), V(wy0), (wx1 - wx0) * W, (wy1 - wy0) * H);
  x.clip();
  g = x.createLinearGradient(0, V(wy0), 0, V(wy1));
  g.addColorStop(0, '#fbfbf6');
  g.addColorStop(0.45, '#eef0e2');
  g.addColorStop(1, '#c9cfa9');
  x.fillStyle = g;
  x.fillRect(U(wx0), V(wy0), (wx1 - wx0) * W, (wy1 - wy0) * H);
  for (let i = 0; i < 70; i++) {
    const u = wx0 + r() * (wx1 - wx0), v = 0.16 + r() * 0.42;
    blob(u, v, 0.03 + r() * 0.05, ['#a9b47e', '#97a268', '#b9c193', '#8b9860'][i % 4], 0.55 + r() * 0.35);
  }
  for (let i = 0; i < 120; i++) {
    const u = wx0 + r() * (wx1 - wx0), v = 0.34 + Math.pow(r(), 0.7) * 0.42;
    blob(u, v, 0.012 + r() * 0.03, ['#5f6e32', '#6f7f3c', '#4d5b28', '#7d8c47', '#56652c'][i % 5], 0.7 + r() * 0.3);
  }
  for (let i = 0; i < 90; i++) {
    const u = wx0 + r() * (wx1 - wx0), v = 0.12 + r() * 0.55;
    blob(u, v, 0.004 + r() * 0.011, ['#d6dc9c', '#e4e6b8', '#c8d283', '#f2f0d0'][i % 4], 0.6 + r() * 0.4);
  }
  // halo du soleil derrière les feuilles
  g = x.createRadialGradient(U(0.8), V(0.2), 0, U(0.8), V(0.2), W * 0.32);
  g.addColorStop(0, 'rgba(255,255,248,.85)');
  g.addColorStop(1, 'rgba(255,255,248,0)');
  x.fillStyle = g;
  x.fillRect(U(wx0), V(wy0), (wx1 - wx0) * W, (wy1 - wy0) * H);
  x.restore();
  // montants et traverses en acier noir
  const frame = '#2a2d24';
  [0.47, 0.605, 0.74, 0.875, 1.01].forEach((u) => rect(u - 0.0045, wy0, 0.009, wy1 - wy0, frame));
  [0.25, 0.5].forEach((v) => rect(wx0, v - 0.006, wx1 - wx0, 0.012, frame));
  rect(wx0 - 0.004, wy1 - 0.004, wx1 - wx0 + 0.01, 0.02, '#ece7da');
  g = x.createLinearGradient(0, V(wy1 + 0.016), 0, V(wy1 + 0.08));
  g.addColorStop(0, 'rgba(60,50,30,.28)');
  g.addColorStop(1, 'rgba(60,50,30,0)');
  x.fillStyle = g;
  x.fillRect(U(wx0), V(wy1 + 0.016), (wx1 - wx0) * W, 0.07 * H);

  // moodboard épinglé
  rect(0.045, 0.09, 0.25, 0.44, '#3d3a2f');
  rect(0.05, 0.1, 0.24, 0.42, '#cdbf9e');
  [
    [0.065, 0.125, 0.065, 0.12, '#5c6a35'], [0.145, 0.115, 0.06, 0.16, '#f5f0e3'], [0.22, 0.13, 0.055, 0.095, '#b4683f'],
    [0.07, 0.275, 0.085, 0.15, '#23261c'], [0.175, 0.29, 0.08, 0.11, '#d6a94b'], [0.07, 0.44, 0.05, 0.06, '#a3ab78'],
    [0.14, 0.42, 0.1, 0.085, '#ece4d1'], [0.25, 0.26, 0.03, 0.2, '#8a9a5b']
  ].forEach(([u, v, w, h, col]) => rect(u, v, w, h, col));
  rect(0.085, 0.31, 0.05, 0.012, '#ece4d1');
  rect(0.085, 0.335, 0.035, 0.008, '#ece4d1');
  rect(0.155, 0.15, 0.04, 0.006, '#3a3a30');
  rect(0.155, 0.17, 0.03, 0.006, '#3a3a30');

  // suspension et sa lumière chaude
  rect(0.372, -0.02, 0.002, 0.09, '#2a2a24');
  x.fillStyle = '#2f3226';
  x.beginPath();
  x.ellipse(U(0.373), V(0.085), 0.04 * W, 0.035 * H, 0, Math.PI, 0);
  x.fill();
  g = x.createRadialGradient(U(0.373), V(0.1), 0, U(0.373), V(0.1), W * 0.12);
  g.addColorStop(0, 'rgba(255,214,150,.75)');
  g.addColorStop(1, 'rgba(255,214,150,0)');
  x.fillStyle = g;
  x.fillRect(U(0.25), V(0.05), W * 0.25, H * 0.3);

  // étagère basse et objets
  rect(0, 0.6, 0.23, 0.016, '#8d6d4b');
  [[0.02, 0.5, 0.025, 0.1, '#e9e1cf'], [0.05, 0.53, 0.018, 0.07, '#5c6a35'], [0.07, 0.535, 0.016, 0.065, '#b4683f'], [0.088, 0.54, 0.014, 0.06, '#23261c'], [0.14, 0.52, 0.03, 0.08, '#f1ebdc']]
    .forEach(([u, v, w, h, col]) => rect(u, v, w, h, col));

  // grande plante d’intérieur : feuilles larges qui débordent sur la verrière
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const u = 0.43 + (r() - 0.5) * 0.13, v = 0.22 + r() * 0.42;
    x.save();
    x.translate(U(u), V(v));
    x.rotate(a);
    x.fillStyle = ['#3d4924', '#4c5a2b', '#5a6a33', '#34401f', '#6a7a3c'][i % 5];
    x.globalAlpha = 0.85 + r() * 0.15;
    x.beginPath();
    x.ellipse(0, 0, (0.022 + r() * 0.02) * W, (0.01 + r() * 0.008) * W, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  x.globalAlpha = 1;
  rect(0.425, 0.4, 0.004, 0.32, '#4a3d2a');
  rect(0.395, 0.66, 0.07, 0.09, '#e3dccb');

  // fond de pièce sous l’horizon : plateau et sol, chauds et sombres
  g = x.createLinearGradient(0, V(0.7), 0, H);
  g.addColorStop(0, 'rgba(176,146,110,0)');
  g.addColorStop(0.25, '#b49674');
  g.addColorStop(1, '#8e7151');
  x.fillStyle = g;
  x.fillRect(0, V(0.7), W, H * 0.3);

  // lumière de la verrière sur la pièce
  x.globalCompositeOperation = 'screen';
  g = x.createRadialGradient(U(0.8), V(0.32), 0, U(0.8), V(0.32), W * 0.62);
  g.addColorStop(0, 'rgba(255,250,236,.42)');
  g.addColorStop(1, 'rgba(255,250,236,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';

  // le flou de l’objectif
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const y = out.getContext('2d');
  const blur = Math.round(W * 0.011 * o.blur);
  y.fillStyle = '#d9d1bf';
  y.fillRect(0, 0, W, H);
  y.filter = 'blur(' + blur + 'px)';
  y.drawImage(c, -blur * 2, -blur * 2, W + blur * 4, H + blur * 4);
  y.filter = 'none';

  // reflets ronds (bokeh) dans les feuilles au soleil
  y.globalCompositeOperation = 'screen';
  for (let i = 0; i < 34; i++) {
    const u = 0.52 + r() * 0.5, v = 0.3 + r() * 0.42;
    const rad = (0.005 + Math.pow(r(), 2.5) * 0.013) * W;
    const a = 0.05 + r() * 0.11;
    const gg = y.createRadialGradient(U(u), V(v), 0, U(u), V(v), rad);
    gg.addColorStop(0, 'rgba(255,255,236,' + (a * 0.6).toFixed(3) + ')');
    gg.addColorStop(0.82, 'rgba(255,255,236,' + a.toFixed(3) + ')');
    gg.addColorStop(0.93, 'rgba(255,255,240,' + (a * 1.12).toFixed(3) + ')');
    gg.addColorStop(1, 'rgba(255,255,236,0)');
    y.fillStyle = gg;
    y.beginPath();
    y.arc(U(u), V(v), rad, 0, Math.PI * 2);
    y.fill();
  }
  y.globalCompositeOperation = 'source-over';

  // vignettage doux
  g = y.createRadialGradient(W * 0.55, H * 0.45, H * 0.3, W * 0.55, H * 0.45, W * 0.75);
  g.addColorStop(0, 'rgba(40,34,20,0)');
  g.addColorStop(1, 'rgba(40,34,20,.22)');
  y.fillStyle = g;
  y.fillRect(0, 0, W, H);

  // grain argentique
  const img = y.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 9;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  y.putImageData(img, 0, 0);
  return out;
}

/* ---------- Le plateau en chêne ---------- */
export function paintWood(W, H, opts) {
  const o = Object.assign({ seed: 11, planks: 3 }, opts);
  const n = makeNoise(o.seed);
  const n2 = makeNoise(o.seed + 5);
  const r = rng(o.seed + 9);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  const d = img.data;
  const ph = o.planks;
  const planks = Array.from({ length: ph }, () => ({ tone: (r() - 0.5) * 0.22, phase: r() * 100, freq: 0.42 + r() * 0.2, warp: 18 + r() * 22, seed: r() * 50 }));
  const light = [205, 165, 118], dark = [160, 118, 76];
  for (let py = 0; py < H; py++) {
    const pi = Math.min(ph - 1, Math.floor(py / H * ph));
    const P = planks[pi];
    const yy = py - pi * H / ph;
    for (let px = 0; px < W; px++) {
      const warp = n(px * 0.0018, yy * 0.012 + P.seed) * P.warp + n(px * 0.0005 + P.seed, yy * 0.003) * 46;
      const ring = (yy + warp) * P.freq + P.phase;
      const s1 = 0.5 + 0.5 * Math.sin(ring);
      const s2 = 0.5 + 0.5 * Math.sin(ring * 2.7 + warp * 0.3);
      const late = Math.pow(s1, 7) * 0.55 + Math.pow(s2, 12) * 0.22;
      const fl = n2(px * 0.07, py * 0.85);
      const fleck = fl > 0.45 ? (fl - 0.45) * 1.6 : 0;
      let tone = 0.5 + 0.5 * (n(px * 0.0011 + 40, py * 0.005) * 0.8 + n(px * 0.004, py * 0.02 + 9) * 0.25) + P.tone;
      tone = Math.min(1, Math.max(0, tone));
      const k = 1 - late * 0.32 - fleck * 0.28;
      const i = (py * W + px) * 4;
      d[i] = (light[0] + (dark[0] - light[0]) * tone) * k;
      d[i + 1] = (light[1] + (dark[1] - light[1]) * tone) * k;
      d[i + 2] = (light[2] + (dark[2] - light[2]) * tone) * k;
      d[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  // joints de collage entre les planches
  for (let i = 1; i < ph; i++) {
    const y = Math.round(i * H / ph);
    x.fillStyle = 'rgba(70,45,22,.38)';
    x.fillRect(0, y - 1, W, 2);
    x.fillStyle = 'rgba(255,240,220,.18)';
    x.fillRect(0, y + 1, W, 1);
  }
  return c;
}
