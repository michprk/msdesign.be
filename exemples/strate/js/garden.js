/* Strate — le jardin en 3D.
   Un jardin de ville bruxellois découpé net comme une coupe de géomètre : on y entre par la pelouse,
   on descend dans le sol (terre, limon, argile, sable, nappe), puis on remonte voir ses étages s'écarter.
   Three.js r160, tout est généré par le code : aucun modèle, aucune photo. */
import * as THREE from '../../../assets/vendor/three.module.min.js';

const TAU = Math.PI * 2;
const W = 12, D = 14, DEPTH = 6, TURF = 0.1;          // bloc : 12 m de large, 14 m de long, 6 m de sol
const TREE = { x: 1.65, z: -7.1 };                     // l'amélanchier, dans l'axe de l'arche
const BOUNDS = [                                       // limites des couches (profondeur en m selon x)
  (x) => 0.32 + 0.025 * Math.sin(x * 2.1) + 0.02 * Math.sin(x * 5.3 + 1),
  (x) => 1.35 + 0.1 * Math.sin(x * 0.55 + 0.6) + 0.04 * Math.sin(x * 1.9),
  (x) => 2.55 + 0.16 * Math.sin(x * 0.42 + 2.1) + 0.05 * Math.sin(x * 1.3),
  (x) => 4.15 + 0.08 * Math.sin(x * 0.7 + 0.3),
];

/* ---------- hasard reproductible, bruit, petites fonctions ---------- */
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(x, y, z) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440670441); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), l = (a, b, t) => a + (b - a) * t, c = (a, b, d) => hash(xi + a, yi + b, zi + d);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.55 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.15;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const range = (rand, [a, b]) => a + (b - a) * rand();

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const _Z = new THREE.Vector3(0, 0, 1);
function setInst(mesh, i, x, y, z, rx, ry, rz, sx, sy, sz) { _p.set(x, y, z); _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')); _s.set(sx, sy, sz); mesh.setMatrixAt(i, _m.compose(_p, _q, _s)); }
function setCard(mesh, i, pos, n, roll, s) { _q.setFromUnitVectors(_Z, n); _q2.setFromAxisAngle(n, roll); _q.premultiply(_q2); _s.set(s, s, s); mesh.setMatrixAt(i, _m.compose(pos, _q, _s)); }
function finish(mesh, count) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false; return mesh; }

/* ---------- le plan du jardin ---------- */
const pathCurve = new THREE.CatmullRomCurve3([[-0.55, -0.45], [-0.12, -3.4], [0.85, -6.4], [0.5, -9.4], [-0.1, -12.1]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
function makeSlabs(rand) {
  const L = pathCurve.getLength(), out = [];
  for (let s = 0.4; s < L - 0.25; s += 0.8) {
    const p = pathCurve.getPointAt(s / L), t = pathCurve.getTangentAt(s / L);
    out.push({ x: p.x + (rand() - 0.5) * 0.06, z: p.z + (rand() - 0.5) * 0.06, a: Math.atan2(t.x, t.z) + (rand() - 0.5) * 0.09, w: 0.92 + rand() * 0.12, d: 0.46 + rand() * 0.07 });
  }
  return out;
}
function onSlab(slabs, x, z, m = 0.03) {
  for (const s of slabs) {
    const dx = x - s.x, dz = z - s.z, c = Math.cos(s.a), sn = Math.sin(s.a);
    if (Math.abs(dx * c - dz * sn) < s.w / 2 + m && Math.abs(dx * sn + dz * c) < s.d / 2 + m) return true;
  }
  return false;
}
const BALLS = [{ x: -0.95, z: -4.45, r: 0.44 }, { x: -1.5, z: -4.0, r: 0.3 }, { x: -1.25, z: -5.05, r: 0.24 }, { x: 1.7, z: -10.2, r: 0.46 }, { x: 2.2, z: -10.6, r: 0.3 }, { x: -1.35, z: -9.3, r: 0.4 }, { x: -1.8, z: -9.7, r: 0.26 }];
const SHRUBS = [{ x: -4.6, z: -11.7, r: 1.05, h: 1.35 }, { x: 4.6, z: -11.9, r: 1.15, h: 1.5 }, { x: 4.8, z: -5.6, r: 0.85, h: 1.1 }, { x: -4.7, z: -6.4, r: 0.75, h: 0.95 }];
const inBorderL = (x, z) => x < -1.85 + 0.3 * Math.sin(z * 0.7) && z > -12.55;
const inBorderR = (x, z) => x > 2.05 + 0.28 * Math.sin(z * 0.6 + 1) && z > -12.55;
const inFront = (x, z) => z > -0.95 + 0.15 * Math.sin(x * 1.3);
const inBack = (x, z) => z < -11.9;
const isBorder = (x, z) => inBorderL(x, z) || inBorderR(x, z) || inFront(x, z) || inBack(x, z);
const nearCam = (x, z) => Math.hypot(x + 0.25, z + 0.3) < 2.2;
function blocked(slabs, x, z) {
  if (onSlab(slabs, x, z)) return true;
  if (Math.hypot(x - TREE.x, z - TREE.z) < 0.28) return true;
  for (const b of BALLS) if (Math.hypot(x - b.x, z - b.z) < b.r * 0.85) return true;
  for (const b of SHRUBS) if (Math.hypot(x - b.x, z - b.z) < b.r * 0.92) return true;
  return false;
}

/* ---------- textures peintes dans un canvas ---------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function blob(c, x, y, r, col, a = 1, k = 7, rand) {
  c.globalAlpha = a; c.fillStyle = col; c.beginPath();
  for (let i = 0; i <= k; i++) { const an = (i / k) * TAU, rr = r * (0.7 + 0.5 * rand()); const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * 0.8; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath(); c.fill(); c.globalAlpha = 1;
}

/* la coupe du sol : couleurs d'affiche, détails de terrain */
function paintStrata(rand, ppm) {
  const cv = canvas(Math.round(W * ppm), Math.round(DEPTH * ppm)), c = cv.getContext('2d');
  const X = (m) => (m + W / 2) * ppm, Y = (d) => d * ppm;
  const edge = (f, from, to, step = 0.05) => { const pts = []; for (let x = from; from < to ? x <= to + 1e-6 : x >= to - 1e-6; x += from < to ? step : -step) pts.push([X(x), Y(f(x))]); return pts; };
  const layers = [
    { top: () => 0, bot: BOUNDS[0], col: '#262518' },
    { top: BOUNDS[0], bot: BOUNDS[1], col: '#5c5a35' },
    { top: BOUNDS[1], bot: BOUNDS[2], col: '#cf722f' },
    { top: BOUNDS[2], bot: BOUNDS[3], col: '#e2c993' },
    { top: BOUNDS[3], bot: () => DEPTH, col: '#2f4db3' },
  ];
  const clipTo = (L) => { c.beginPath(); const a = edge(L.top, -W / 2 - 0.1, W / 2 + 0.1), b = edge(L.bot, W / 2 + 0.1, -W / 2 - 0.1); a.concat(b).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const area = (L, fn) => { c.save(); clipTo(L); c.clip(); fn(); c.restore(); };
  const dots = (n, x0, x1, d0, d1, cols, r0, r1, a = 1) => { for (let i = 0; i < n; i++) { c.globalAlpha = a; c.fillStyle = pick(rand, cols); c.beginPath(); c.arc(X(lerp(x0, x1, rand())), Y(lerp(d0, d1, rand())), lerp(r0, r1, rand()), 0, TAU); c.fill(); } c.globalAlpha = 1; };
  layers.forEach((L) => { c.fillStyle = L.col; clipTo(L); c.fill(); });

  // terre végétale : grumeaux, éclats de briques (remblai), petits points clairs
  area(layers[0], () => {
    const g = c.createLinearGradient(0, 0, 0, Y(0.36)); g.addColorStop(0, '#1d1c12'); g.addColorStop(1, '#2c2a1b'); c.fillStyle = g; c.fillRect(0, 0, cv.width, Y(0.4));
    dots(9000, -6, 6, 0, 0.4, ['#38331f', '#15140c', '#463f2a', '#2f2b1c'], 0.6, 1.8);
    for (let i = 0; i < 26; i++) { const x = X(lerp(-6, 6, rand())), y = Y(lerp(0.1, 0.34, rand())), s = lerp(2, 5, rand()); c.fillStyle = pick(rand, ['#a8502f', '#b9623b', '#8f3f25']); c.save(); c.translate(x, y); c.rotate(rand() * TAU); c.fillRect(-s, -s * 0.45, s * 2, s * 0.9); c.restore(); }
    dots(500, -6, 6, 0.02, 0.38, ['#d9cfb4', '#bfb291'], 0.5, 1.1, 0.7);
  });
  // limon : marbrures, cailloux, silex
  area(layers[1], () => {
    const g = c.createLinearGradient(0, Y(0.3), 0, Y(1.5)); g.addColorStop(0, '#514f2e'); g.addColorStop(1, '#6a6539'); c.fillStyle = g; c.fillRect(0, Y(0.2), cv.width, Y(1.4));
    for (let i = 0; i < 140; i++) blob(c, X(lerp(-6, 6, rand())), Y(lerp(0.35, 1.5, rand())), lerp(6, 26, rand()), pick(rand, ['#706a40', '#4c4a2b', '#615d36']), 0.35, 8, rand);
    dots(6000, -6, 6, 0.3, 1.55, ['#47452a', '#77703f', '#3e3c25'], 0.5, 1.4, 0.8);
    for (let i = 0; i < 80; i++) { const x = X(lerp(-6, 6, rand())), y = Y(lerp(0.42, 1.45, rand())), r = lerp(3, 11, rand()); c.fillStyle = pick(rand, ['#a49a82', '#8a826e', '#c2b8a0', '#7d7562']); c.beginPath(); c.ellipse(x, y, r, r * lerp(0.55, 0.85, rand()), rand() * 3, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,240,0.35)'; c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.3, r * 0.35, r * 0.2, 0, 0, TAU); c.fill(); }
    for (let i = 0; i < 12; i++) { const x = X(lerp(-6, 6, rand())), y = Y(lerp(0.6, 1.4, rand())); blob(c, x, y, lerp(7, 15, rand()), '#d8d2c2', 1, 9, rand); blob(c, x, y, lerp(5, 11, rand()), '#2f2c26', 1, 9, rand); }
  });
  // argile : stries horizontales, taches grises (gley), points de manganèse
  area(layers[2], () => {
    for (let i = 0; i < 420; i++) { const y = Y(lerp(1.2, 2.8, rand())), x0 = X(lerp(-6.2, 6, rand())), len = lerp(30, 260, rand()); c.strokeStyle = pick(rand, ['#bf6428', '#db8440', '#c86c2c', '#e08e4a']); c.globalAlpha = lerp(0.35, 0.8, rand()); c.lineWidth = lerp(0.8, 2.2, rand()); c.beginPath(); c.moveTo(x0, y); c.bezierCurveTo(x0 + len * 0.33, y + lerp(-3, 3, rand()), x0 + len * 0.66, y + lerp(-3, 3, rand()), x0 + len, y + lerp(-2, 2, rand())); c.stroke(); }
    c.globalAlpha = 1;
    for (let i = 0; i < 46; i++) blob(c, X(lerp(-6, 6, rand())), Y(lerp(1.5, 2.6, rand())), lerp(6, 22, rand()), pick(rand, ['#8f9cb0', '#7d8ca3']), 0.42, 9, rand);
    dots(260, -6, 6, 1.4, 2.7, ['#5a2f1c', '#6b3a22'], 0.8, 2, 0.9);
  });
  // sable : pointillés, litage oblique, petites nummulites
  area(layers[3], () => {
    dots(14000, -6, 6, 2.3, 4.3, ['#cdb27a', '#f0dfb4', '#b89a62', '#d8c08a'], 0.5, 1.25);
    c.strokeStyle = 'rgba(176,146,92,0.45)'; c.lineWidth = 1;
    for (let k = 0; k < 9; k++) { const x0 = X(lerp(-6, 5, rand())), y0 = Y(lerp(2.8, 3.9, rand())); for (let j = 0; j < 7; j++) { c.beginPath(); c.moveTo(x0 + j * 9, y0); c.lineTo(x0 + j * 9 + 70, y0 + 26); c.stroke(); } }
    for (let i = 0; i < 70; i++) { const x = X(lerp(-6, 6, rand())), y = Y(lerp(2.8, 4.1, rand())), r = lerp(1.8, 3.4, rand()); c.fillStyle = '#fbf3df'; c.beginPath(); c.ellipse(x, y, r, r * 0.55, rand() * 3, 0, TAU); c.fill(); c.strokeStyle = 'rgba(150,120,70,0.6)'; c.stroke(); }
  });
  // nappe : dégradé cobalt, frange capillaire, ondes claires
  area(layers[4], () => {
    const g = c.createLinearGradient(0, Y(4.0), 0, Y(DEPTH)); g.addColorStop(0, '#3a5bd8'); g.addColorStop(0.45, '#2f4db3'); g.addColorStop(1, '#1f2f78'); c.fillStyle = g; c.fillRect(0, Y(3.9), cv.width, Y(2.2));
    dots(1800, -6, 6, 4.0, 4.5, ['#d8c08a', '#cdb27a', '#9fb0e8'], 0.5, 1.2, 0.8);
    c.lineWidth = 1.4;
    for (let k = 0; k < 26; k++) { const y = Y(lerp(4.45, 5.9, rand())); c.strokeStyle = `rgba(150,178,255,${lerp(0.18, 0.5, rand())})`; c.beginPath(); for (let x = -6; x <= 6.01; x += 0.08) { const yy = y + Math.sin(x * 3.1 + k) * 2.2; x === -6 ? c.moveTo(X(x), yy) : c.lineTo(X(x), yy); } c.stroke(); }
  });
  // un trait fin à chaque changement de couche, comme sur une coupe dessinée
  c.lineWidth = 1.6; c.strokeStyle = 'rgba(20,18,10,0.28)';
  BOUNDS.forEach((f) => { c.beginPath(); edge(f, -W / 2, W / 2).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); });
  return cv;
}

/* les racines : G = distance parcourue (inversée), B = masque. Le shader les fait pousser. */
function paintRoots(rand, ppm) {
  const cv = canvas(Math.round(W * ppm), Math.round(DEPTH * ppm)), c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'lighten'; c.lineCap = 'round';
  const MAXD = 4.4, X = (m) => (m + W / 2) * ppm, Y = (d) => d * ppm;
  const seg = (x0, d0, x1, d1, w, dist) => { const g = Math.round(255 * (1 - clamp(dist / MAXD))); c.strokeStyle = `rgb(0,${g},255)`; c.lineWidth = Math.max(0.9, w * ppm); c.beginPath(); c.moveTo(X(x0), Y(d0)); c.lineTo(X(x1), Y(d1)); c.stroke(); };
  const root = (x, d, a, len, w, dist, lvl, grav, step = 0.03) => {
    let t = 0;
    while (t < len) {
      a += (rand() - 0.5) * 0.32; a *= 1 - grav;
      let nx = x + Math.sin(a) * step, nd = d + Math.cos(a) * step;
      if (nd < 0.03) { nd = 0.03; a *= 0.5; }
      if (nd > 4.05) break;                                  // les racines s'arrêtent au-dessus de la nappe
      const ww = w * (1 - (t / len) * 0.85);
      seg(x, d, nx, nd, ww, dist + t);
      if (lvl < 4 && rand() < 0.055) root(nx, nd, a + (rand() < 0.5 ? -1 : 1) * lerp(0.45, 1.1, rand()), (len - t) * lerp(0.3, 0.6, rand()), ww * 0.62, dist + t, lvl + 1, grav * 1.2, step);
      x = nx; d = nd; t += step;
    }
  };
  // chevelu des graminées et de la pelouse
  for (let x = -6; x < 6; x += 0.03) for (let k = 0; k < 2; k++) root(x + rand() * 0.02, 0.02, (rand() - 0.5) * 0.9, lerp(0.07, 0.26, rand()), 0.0035, rand() * 0.05, 3, 0.04, 0.012);
  // vivaces et graminées de prairie : certaines descendent loin
  for (let x = -5.9; x < 5.9; x += lerp(0.18, 0.34, rand())) for (let k = 0; k < 4; k++) root(x, 0.04, (rand() - 0.5) * 1.1, rand() < 0.25 ? lerp(1.2, 2.1, rand()) : lerp(0.3, 0.9, rand()), lerp(0.006, 0.012, rand()), 0.15 + rand() * 0.2, 2, 0.045);
  // l'amélanchier : grandes racines traçantes et quelques pivots
  [-1.35, -1.05, -0.62, -0.2, 0.25, 0.7, 1.1, 1.38].forEach((a, i) => root(TREE.x + (rand() - 0.5) * 0.1, 0.06, a, lerp(2.2, 3.4, rand()), i % 3 === 0 ? 0.07 : 0.05, 0.35, 0, a > -0.4 && a < 0.4 ? 0.02 : 0.006));
  return cv;
}

/* la pelouse vue de dessus (fond sous les brins d'herbe) */
function paintGround(rand) {
  const w = 768, h = Math.round((768 * D) / W), cv = canvas(w, h), c = cv.getContext('2d'), img = c.createImageData(w, h), d = img.data;
  const lawn = [[0x4c, 0x6e, 0x2f], [0x5e, 0x80, 0x37]], mulch = [[0x3d, 0x34, 0x24], [0x52, 0x45, 0x2c]];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i / w - 0.5) * W, z = (j / h) * D - D, n = fbm(x * 1.3, z * 1.3, 0.5), n2 = noise3(x * 9, z * 9, 3);
    const b = isBorder(x, z), A = b ? mulch : lawn, t = clamp(n * 1.2 - 0.1 + (n2 - 0.5) * 0.3);
    let r = lerp(A[0][0], A[1][0], t), g = lerp(A[0][1], A[1][1], t), bl = lerp(A[0][2], A[1][2], t);
    if (b && n2 > 0.55) { r = lerp(r, 0x3c, 0.6); g = lerp(g, 0x50, 0.6); bl = lerp(bl, 0x24, 0.6); }
    let ao = 1;
    for (const s of BALLS) ao = Math.min(ao, smooth(s.r * 0.6, s.r * 1.5, Math.hypot(x - s.x, z - s.z)) * 0.45 + 0.55);
    ao = Math.min(ao, smooth(-13.1, -12.2, z) * 0.5 + 0.5);
    const k = (j * w + i) * 4; d[k] = r * ao; d[k + 1] = g * ao; d[k + 2] = bl * ao; d[k + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return cv;
}

/* brique de Bruxelles + vigne vierge en automne */
function paintBrick(rand) {
  const cv = canvas(1024, 160), c = cv.getContext('2d'), bw = 30, bh = 8, j = 2.2;
  c.fillStyle = '#cbbfa6'; c.fillRect(0, 0, cv.width, cv.height);
  for (let row = 0; row * (bh + j) < cv.height; row++) for (let x = -((row % 2) * (bw + j)) / 2; x < cv.width; x += bw + j) {
    c.fillStyle = pick(rand, ['#a9502f', '#b8613a', '#94442b', '#c07048', '#9e4a30', '#b35634']); c.fillRect(x, row * (bh + j), bw, bh);
    c.fillStyle = `rgba(0,0,0,${rand() * 0.12})`; c.fillRect(x, row * (bh + j) + bh * 0.6, bw, bh * 0.4);
  }
  for (let k = 0; k < 9; k++) {
    const cx = rand() * cv.width, cy = lerp(10, 150, rand()), rad = lerp(30, 90, rand());
    for (let i = 0; i < 260; i++) { const an = rand() * TAU, rr = Math.sqrt(rand()) * rad, x = cx + Math.cos(an) * rr * 1.4, y = cy + Math.sin(an) * rr * 0.7; c.fillStyle = pick(rand, ['#a8321e', '#c4482a', '#d4612b', '#8e2b1c', '#e07b32', '#5e6a2c']); c.beginPath(); c.ellipse(x, y, lerp(2, 4.5, rand()), lerp(1.8, 3.6, rand()), rand() * 3, 0, TAU); c.fill(); }
  }
  return cv;
}

/* pierre bleue (petit granit) avec ses petits fossiles blancs */
function paintStone(rand) {
  const cv = canvas(256, 128), c = cv.getContext('2d');
  c.fillStyle = '#5b6470'; c.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 2600; i++) { c.fillStyle = pick(rand, ['#4e5662', '#66707c', '#545c68', '#717a85']); c.fillRect(rand() * 256, rand() * 128, 1.5, 1.5); }
  for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(235,236,232,${lerp(0.4, 0.9, rand())})`; c.beginPath(); c.arc(rand() * 256, rand() * 128, lerp(0.6, 1.7, rand()), 0, TAU); c.fill(); }
  return cv;
}

/* ---------- géométries ---------- */
function bladeGeometry(segs = 5) {
  const g = new THREE.PlaneGeometry(1, 1, 1, segs); g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * Math.pow(1 - y, 0.85)); p.setZ(i, y * y * 0.16); }
  g.computeVertexNormals(); return g;
}
function leafGeometry(w = 0.55, fold = 0.1, centred = false) {
  const pts = [[0, 0], [w * 0.5, 0.3], [w * 0.42, 0.62], [0, 1], [-w * 0.42, 0.62], [-w * 0.5, 0.3]];
  const pos = [0, 0.45, fold], idx = [];
  pts.forEach(([x, y]) => pos.push(x, y, Math.abs(x) * -fold * 0.6));
  for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  if (centred) g.translate(0, -0.5, 0);
  g.computeVertexNormals(); return g;
}
function tubeGeometry(segs, radial = 6) {
  const pos = [], nor = [], idx = [], t = new THREE.Vector3(), a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (const s of segs) {
    t.subVectors(s.b, s.a).normalize(); tmp.set(Math.abs(t.y) < 0.9 ? 0 : 1, Math.abs(t.y) < 0.9 ? 1 : 0, 0);
    a1.crossVectors(t, tmp).normalize(); a2.crossVectors(t, a1).normalize();
    const base = pos.length / 3;
    for (let ring = 0; ring < 2; ring++) {
      const cc = ring ? s.b : s.a, r = ring ? s.rb : s.ra;
      for (let k = 0; k < radial; k++) { const an = (k / radial) * TAU, cx = Math.cos(an), sy = Math.sin(an), nx = a1.x * cx + a2.x * sy, ny = a1.y * cx + a2.y * sy, nz = a1.z * cx + a2.z * sy; pos.push(cc.x + nx * r, cc.y + ny * r, cc.z + nz * r); nor.push(nx, ny, nz); }
    }
    for (let k = 0; k < radial; k++) { const k2 = (k + 1) % radial, a = base + k, b = base + k2, c = base + radial + k, d = base + radial + k2; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
function lumpy(geo, amp, freq, seed) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm(v.x * freq + seed, v.y * freq, v.z * freq) - 0.5; v.multiplyScalar(1 + n * amp); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals(); return geo;
}

/* ---------- le vent, partagé par toute la végétation ---------- */
const U = { uTime: { value: 0 }, uWind: { value: 1 }, uMouse: { value: new THREE.Vector3(99, 0, 99) }, uMousePow: { value: 0 } };
function windify(mat, { blade = false, stiff = 1, lift = 0.1 } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U); sh.uniforms.uStiff = { value: stiff };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime, uWind, uStiff, uMousePow; uniform vec3 uMouse; varying float vGY; varying float vLY;
vec3 windAt(vec3 gp) {
  float h = max(gp.y, 0.0);
  float ph = uTime * 1.25 + gp.x * 0.45 + gp.z * 0.32;
  float gust = 0.55 + 0.45 * sin(uTime * 0.37 + gp.x * 0.08 + gp.z * 0.05);
  float s = (sin(ph) * 0.6 + sin(ph * 2.3 + gp.z) * 0.25 + 0.35) * gust * uWind;
  vec3 o = vec3(0.85, 0.0, 0.35) * s * pow(h, 1.2) * 0.14 / uStiff;
  vec2 d = gp.xz - uMouse.xz; float md = length(d);
  float m = smoothstep(1.0, 0.0, md) * uMousePow;
  o.xz += (d / max(md, 0.001)) * m * pow(h, 1.1) * 0.9 / uStiff;
  o.y -= (abs(o.x) + abs(o.z)) * 0.4;
  return o;
}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    mat4 im = mat4(1.0);
    #ifdef USE_INSTANCING
      im = instanceMatrix;
    #endif
    vec3 gp = (im * vec4(transformed, 1.0)).xyz;
    transformed += inverse(mat3(im)) * windAt(gp);
    vGY = gp.y; vLY = position.y;
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGY; varying float vLY;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb *= mix(0.4, 1.0, smoothstep(0.0, 0.22, vGY));
  ${blade ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.22, 1.14, 0.8), smoothstep(0.5, 1.0, vLY));' : ''}`)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(mix(normal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz, 0.55));')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * ${lift.toFixed(3)};`);
  };
  return mat;
}

/* ---------- construction de la scène ---------- */
export function createGarden({ canvas: cvs, labels = {}, low = false }) {
  const rand = mulberry(20111106);
  const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene();
  const FOG = new THREE.Color('#e2e8e4');
  scene.fog = new THREE.Fog(FOG, 9, 42);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 120);
  const tex = (cv, srgb = true) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = maxAniso; return t; };

  // lumière d'automne, basse, venant du fond à gauche : contre-jour sur l'herbe
  scene.add(new THREE.HemisphereLight('#eef3f6', '#6b6a45', 1.65));
  const sun = new THREE.DirectionalLight('#ffe6c6', 2.5);
  sun.position.set(-10, 10, 2); sun.target.position.set(0, 0, -6); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 13, bottom: -13, near: 1, far: 44 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035; sun.shadow.radius = 3;

  // les cinq étages, qui s'écarteront au troisième chapitre
  const L = [0, 1, 2, 3, 4].map(() => { const g = new THREE.Group(); scene.add(g); return g; });
  const LIFT = [0, 1.15, 2.45, 3.85, 5.45];
  const slabs = makeSlabs(rand);

  /* étage 0 : le bloc de sol coupé net, et les murs mitoyens */
  const ppm = low ? 150 : 256;
  const strataCv = paintStrata(rand, ppm), strata = tex(strataCv), roots = tex(paintRoots(rand, ppm), false);
  strata.repeat.set(1, (DEPTH - TURF) / DEPTH); roots.repeat.copy(strata.repeat);
  const G = { uGrow: { value: 0 }, uWater: { value: 0 } };
  const faceMat = new THREE.MeshBasicMaterial({ map: strata, toneMapped: false });
  faceMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uRoots: { value: roots }, uGrow: G.uGrow, uWater: G.uWater, uTime: U.uTime });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uRoots; uniform float uGrow, uWater, uTime;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec4 rt = texture2D(uRoots, vMapUv);
  float rd = 1.0 - rt.g / max(rt.b, 0.004);
  float show = rt.b * smoothstep(uGrow + 0.004, uGrow - 0.035, rd);
  float tip = rt.b * smoothstep(0.045, 0.0, abs(rd - uGrow)) * step(0.002, uGrow) * step(uGrow, 0.995);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.88, 0.74), show * 0.9);
  diffuseColor.rgb += vec3(1.0, 0.72, 0.38) * tip * 0.7;
  float dep = (1.0 - vMapUv.y) * ${DEPTH.toFixed(1)};
  float wat = smoothstep(4.2, 4.5, dep);
  float rip = sin(dep * 34.0 - uTime * 1.1 + sin(vMapUv.x * 38.0 + uTime * 0.45) * 0.9);
  diffuseColor.rgb += vec3(0.25, 0.35, 0.6) * wat * smoothstep(0.82, 1.0, rip) * (0.25 + 0.5 * uWater);`);
  };
  const sideMat = new THREE.MeshBasicMaterial({ map: strata, toneMapped: false });
  const topSoil = new THREE.MeshBasicMaterial({ color: '#2b291c', toneMapped: false });
  const bottom = new THREE.MeshBasicMaterial({ color: '#1f2f78', toneMapped: false });
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, DEPTH - TURF, D), [sideMat, sideMat, topSoil, bottom, faceMat, sideMat]);
  block.position.set(0, -TURF - (DEPTH - TURF) / 2, -D / 2); L[0].add(block);

  const brick = tex(paintBrick(rand)); brick.wrapS = THREE.RepeatWrapping; brick.repeat.set(1.25, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.92 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#59616b', roughness: 0.6 });
  const walls = new THREE.Group(); L[0].add(walls);
  [-1, 1].forEach((sgn) => {
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.05, D), wallMat); wl.position.set(sgn * (W / 2 + 0.12), 1.025, -D / 2); wl.castShadow = wl.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, D), capMat); cap.position.set(sgn * (W / 2 + 0.12), 2.085, -D / 2); cap.castShadow = true;
    walls.add(wl, cap);
  });

  /* étage 1 : la pelouse et les couvre-sols, sur leur plaque de terre */
  const ground = tex(paintGround(rand));
  const turfTex = strata.clone(); turfTex.repeat.set(1, TURF / DEPTH); turfTex.offset.set(0, 1 - TURF / DEPTH); turfTex.needsUpdate = true;
  const turfSide = new THREE.MeshBasicMaterial({ map: turfTex, toneMapped: false });
  const lawnTop = new THREE.MeshStandardMaterial({ map: ground, roughness: 1 });
  const turf = new THREE.Mesh(new THREE.BoxGeometry(W, TURF, D), [turfSide, turfSide, lawnTop, turfSide, turfSide, turfSide]);
  turf.position.set(0, -TURF / 2, -D / 2); turf.receiveShadow = true; L[1].add(turf);

  const stoneTex = tex(paintStone(rand));
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.72 });
  const shape = new THREE.Shape(); { const w = 0.5, d = 0.5, r = 0.035; shape.moveTo(-w + r, -d); shape.lineTo(w - r, -d); shape.quadraticCurveTo(w, -d, w, -d + r); shape.lineTo(w, d - r); shape.quadraticCurveTo(w, d, w - r, d); shape.lineTo(-w + r, d); shape.quadraticCurveTo(-w, d, -w, d - r); shape.lineTo(-w, -d + r); shape.quadraticCurveTo(-w, -d, -w + r, -d); }
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
  slabGeo.rotateX(-Math.PI / 2);
  { const sp = slabGeo.attributes.position, uv = slabGeo.attributes.uv; for (let i = 0; i < sp.count; i++) uv.setXY(i, sp.getX(i) + 0.5, sp.getZ(i) * 0.5 + 0.5); }
  const slabMesh = new THREE.InstancedMesh(slabGeo, stoneMat, slabs.length);
  slabs.forEach((s, i) => setInst(slabMesh, i, s.x, 0.0, s.z, 0, s.a, 0, s.w, 1, s.d));
  finish(slabMesh, slabs.length); slabMesh.receiveShadow = true; slabMesh.castShadow = true; L[1].add(slabMesh);

  // l'herbe : un seul maillage instancié, pelouse au centre, prairie sur les bords
  const nGrass = low ? 26000 : 72000;
  const grassMat = windify(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.82, color: '#ffffff' }), { blade: true, lift: 0.14 });
  const grass = new THREE.InstancedMesh(bladeGeometry(5), grassMat, nGrass); grass.receiveShadow = true;
  const LAWN = ['#5b7f34', '#6a8c3a', '#527530', '#77963f', '#628536'], MEADOW = ['#4a6a2e', '#5f7a34', '#77803e', '#8a8446', '#557033', '#6a7a3a'];
  let gi = 0;
  for (let tries = 0; gi < nGrass && tries < nGrass * 5; tries++) {
    const x = lerp(-5.92, 5.92, rand()), z = lerp(-12.75, -0.015, rand());
    if (rand() > lerp(0.3, 1, smooth(-13, -4.8, z)) + (z > -1.2 ? 0.4 : 0)) continue;
    if (blocked(slabs, x, z)) continue;
    const b = isBorder(x, z), straw = b && rand() < 0.12;
    const h = b ? range(rand, inFront(x, z) ? [0.14, 0.36] : [0.16, 0.44]) : range(rand, [0.07, 0.13]);
    const w = b ? range(rand, [0.024, 0.045]) : range(rand, [0.02, 0.03]);
    setInst(grass, gi, x, 0, z, (rand() - 0.5) * 0.35, rand() * TAU, 0, w, h, h);
    grass.setColorAt(gi, _c.set(straw ? pick(rand, ['#a8945a', '#b29c62', '#9a8650']) : pick(rand, b ? MEADOW : LAWN)).offsetHSL(0, 0, (rand() - 0.5) * 0.05));
    gi++;
  }
  finish(grass, gi); L[1].add(grass);

  // géraniums vivaces : petits coussins à fleurs bleu-violet (couvre-sol)
  const dotGeo = new THREE.IcosahedronGeometry(1, 0);
  const flowerMat = windify(new THREE.MeshStandardMaterial({ roughness: 0.6, color: '#ffffff' }), { lift: 0.16 });
  const borderPoint = () => { for (let k = 0; k < 40; k++) { const r = rand(); let x, z; if (r < 0.38) { x = lerp(-5.8, -3.2, rand()); z = lerp(-12.4, -0.4, rand()); } else if (r < 0.76) { x = lerp(3.45, 5.8, rand()); z = lerp(-12.4, -0.4, rand()); } else { x = lerp(-5.8, 5.8, rand()); z = lerp(-0.9, -0.08, rand()); } if (isBorder(x, z) && !blocked(slabs, x, z)) return [x, z]; } return [-5, -5]; };
  const drift = (n, rad, fn) => { let left = n; while (left > 0) { const [cx, cz] = borderPoint(), k = Math.min(left, 4 + Math.floor(rand() * 9)); for (let i = 0; i < k; i++) { const an = rand() * TAU, rr = Math.sqrt(rand()) * rad, x = cx + Math.cos(an) * rr, z = cz + Math.sin(an) * rr; if (!isBorder(x, z) || blocked(slabs, x, z) || nearCam(x, z)) continue; fn(x, z); } left -= k; } };
  const gera = new THREE.InstancedMesh(dotGeo, flowerMat, low ? 380 : 700); let ge = 0;
  drift(low ? 380 : 700, 0.45, (x, z) => { if (ge >= gera.count) return; const s = range(rand, [0.011, 0.016]); setInst(gera, ge, x, range(rand, [0.18, 0.3]), z, 0, 0, 0, s, s, s); gera.setColorAt(ge++, _c.set(pick(rand, ['#6b5fcf', '#5a62c8', '#7a6ad6']))); });
  finish(gera, ge); L[1].add(gera);

  /* étage 2 : vivaces et graminées */
  const stemGeo = new THREE.CylinderGeometry(0.0035, 0.005, 1, 3, 4, true); stemGeo.translate(0, 0.5, 0);
  const stemMat = windify(new THREE.MeshStandardMaterial({ roughness: 0.8, color: '#ffffff' }), { lift: 0.1 });
  const spikeGeo = (() => { const g = new THREE.CylinderGeometry(0.002, 0.0085, 1, 7, 10); g.translate(0, 0.5, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 + 0.22 * Math.sin(y * 46); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
  const globeGeo = lumpy(new THREE.IcosahedronGeometry(1, 2), 0.35, 4.5, 2);
  const umbelGeo = (() => { const g = new THREE.SphereGeometry(1, 12, 5, 0, TAU, 0, Math.PI * 0.42); g.scale(1, 0.38, 1); return g; })();
  const SPEC = [
    { key: 'salvia', n: low ? 190 : 340, h: [0.42, 0.62], geo: spikeGeo, hs: [0.11, 0.18], col: ['#4b4fae', '#5a52b8', '#3f4aa0', '#6a5ec4'], stem: '#3f5a2a', rad: 0.55 },
    { key: 'echinops', n: low ? 60 : 96, h: [0.78, 1.08], geo: globeGeo, hs: [0.022, 0.032], col: ['#6f8fd6', '#7d98d8', '#5f7fc8'], stem: '#66704a', rad: 0.6 },
    { key: 'achillea', n: low ? 70 : 130, h: [0.48, 0.7], geo: umbelGeo, hs: [0.028, 0.042], col: ['#e27a2c', '#d8692a', '#eb9440', '#c95a26'], stem: '#5a6a35', rad: 0.5 },
    { key: 'kniphofia', n: low ? 60 : 110, h: [0.72, 1.0], geo: spikeGeo, hs: [0.13, 0.2], col: ['#e8792a', '#ef8f2f', '#dd6526', '#f2a33c'], stem: '#5c6e36', rad: 0.45, wide: 2.1 },
  ];
  const totalStems = SPEC.reduce((a, s) => a + s.n, 0);
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, totalStems); let si = 0;
  SPEC.forEach((sp) => {
    const heads = new THREE.InstancedMesh(sp.geo, flowerMat, sp.n); let hi = 0;
    drift(sp.n, sp.rad, (x, z) => {
      if (hi >= sp.n || si >= totalStems) return;
      const h = range(rand, sp.h), s = range(rand, sp.hs), lean = (rand() - 0.5) * 0.12;
      setInst(stems, si, x, 0, z, lean, 0, 0, 1, h, 1); stems.setColorAt(si++, _c.set(sp.stem).offsetHSL(0, 0, (rand() - 0.5) * 0.06));
      const hx = x, hz = z + Math.sin(lean) * h, hy = Math.cos(lean) * h;
      if (sp.key === 'salvia' || sp.key === 'kniphofia') setInst(heads, hi, hx, hy - 0.01, hz, lean, rand() * TAU, 0, sp.wide || 1, s, sp.wide || 1);
      else if (sp.key === 'umbel' || sp.key === 'achillea') setInst(heads, hi, hx, hy, hz, lean, 0, 0, s, s, s);
      else setInst(heads, hi, hx, hy + s * 0.6, hz, 0, rand() * TAU, 0, s, s, s);
      heads.setColorAt(hi++, _c.set(pick(rand, sp.col)));
    });
    finish(heads, hi); heads.castShadow = true; L[2].add(heads);
  });
  finish(stems, si); L[2].add(stems);

  // Calamagrostis 'Karl Foerster' : touffes droites couleur paille, quelques-unes devant la coupe
  const calMat = windify(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85, color: '#ffffff' }), { blade: true, stiff: 1.8, lift: 0.16 });
  const nCl = low ? 22 : 34, perCl = low ? 26 : 40;
  const cal = new THREE.InstancedMesh(bladeGeometry(6), calMat, nCl * perCl); let ci = 0;
  for (let k = 0; k < nCl; k++) {
    const [cx, cz] = k < 5 ? [[-5.2, -3.4, 2.6, 4.1, 5.4][k], lerp(-0.7, -0.35, rand())] : borderPoint();
    if (blocked(slabs, cx, cz) || nearCam(cx, cz)) continue;
    for (let i = 0; i < perCl; i++) {
      const an = rand() * TAU, rr = Math.sqrt(rand()) * 0.13, h = range(rand, [1.05, 1.5]), out = 0.04 + rr * 0.9;
      setInst(cal, ci, cx + Math.cos(an) * rr, 0, cz + Math.sin(an) * rr, -Math.cos(an) * out * 0 + out, an + Math.PI / 2, 0, range(rand, [0.012, 0.02]), h, h * 0.3);
      cal.setColorAt(ci++, _c.set(pick(rand, ['#c8b07a', '#b89f68', '#d6c08c', '#a99560'])));
    }
  }
  finish(cal, ci); cal.castShadow = true; L[2].add(cal);

  /* étage 3 : les arbustes — boules de buis, viornes, haie d'ifs */
  const cardGeo = leafGeometry(0.62, 0.12, true);
  const cardMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.78, color: '#ffffff' });
  cardMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.08;'); };
  const coreMat = new THREE.MeshStandardMaterial({ color: '#284526', roughness: 1 });
  const shrubCards = [];
  const n = new THREE.Vector3(), pos = new THREE.Vector3();
  BALLS.forEach((b, k) => {
    const core = new THREE.Mesh(lumpy(new THREE.IcosahedronGeometry(b.r * 0.94, 4), 0.12, 2.4, k * 3.1), coreMat); core.position.set(b.x, b.r * 0.82, b.z); core.castShadow = core.receiveShadow = true; L[3].add(core);
    const cnt = Math.round((low ? 900 : 1700) * b.r * b.r * 4);
    for (let i = 0; i < cnt; i++) {
      n.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1); if (n.lengthSq() > 1 || n.lengthSq() < 0.01) { i--; continue; } n.normalize();
      const rr = b.r * (1 + (fbm(n.x * 2.4 + k, n.y * 2.4, n.z * 2.4) - 0.5) * 0.14);
      pos.set(b.x + n.x * rr, b.r * 0.82 + n.y * rr, b.z + n.z * rr); if (pos.y < 0.02) continue;
      shrubCards.push({ p: pos.clone(), n: n.clone(), s: range(rand, [0.032, 0.046]), col: pick(rand, ['#3d5f2a', '#4a6e31', '#355427', '#577a36', '#43662e']), ao: 0.55 + 0.45 * (n.y + 1) / 2 });
    }
  });
  SHRUBS.forEach((b, k) => {
    const core = new THREE.Mesh(lumpy(new THREE.IcosahedronGeometry(1, 4), 0.2, 1.6, k * 7.7), coreMat); core.scale.set(b.r, b.h, b.r); core.position.set(b.x, 0, b.z); core.castShadow = core.receiveShadow = true; L[3].add(core);
    const cnt = Math.round((low ? 1100 : 2200) * b.r);
    for (let i = 0; i < cnt; i++) {
      n.set(rand() * 2 - 1, rand(), rand() * 2 - 1); if (n.lengthSq() > 1 || n.lengthSq() < 0.01) { i--; continue; } n.normalize();
      const rr = 1 + (fbm(n.x * 1.8 + k, n.y * 1.8, n.z * 1.8) - 0.5) * 0.24;
      pos.set(b.x + n.x * b.r * rr, n.y * b.h * rr, b.z + n.z * b.r * rr);
      shrubCards.push({ p: pos.clone(), n: n.clone(), s: range(rand, [0.06, 0.09]), col: rand() < 0.08 ? pick(rand, ['#8a4a2a', '#a35a2c']) : pick(rand, ['#3c5a2c', '#4b6a33', '#5d7a38', '#35522a']), ao: 0.5 + 0.5 * n.y });
    }
  });
  // la haie d'ifs du fond
  const HZ = -13.35, HH = 2.3, HT = 1.0;
  { const core = new THREE.Mesh(new THREE.BoxGeometry(W - 0.05, HH, HT), coreMat); core.position.set(0, HH / 2, HZ); core.castShadow = core.receiveShadow = true; L[3].add(core); }
  const hedgeN = low ? 3800 : 7000;
  for (let i = 0; i < hedgeN; i++) {
    const r = rand(); let face;
    if (r < 0.66) { pos.set(lerp(-5.95, 5.95, rand()), lerp(0.05, HH, rand()), HZ + HT / 2); face = n.set(0, 0, 1); }
    else if (r < 0.92) { pos.set(lerp(-5.95, 5.95, rand()), HH, lerp(HZ - HT / 2, HZ + HT / 2, rand())); face = n.set(0, 1, 0); }
    else { const sgn = rand() < 0.5 ? -1 : 1; pos.set(sgn * 5.97, lerp(0.05, HH, rand()), lerp(HZ - HT / 2, HZ + HT / 2, rand())); face = n.set(sgn, 0, 0); }
    const bump = (fbm(pos.x * 1.2, pos.y * 1.2, pos.z) - 0.5) * 0.16; pos.addScaledVector(face, 0.03 + bump);
    const jit = new THREE.Vector3(face.x + (rand() - 0.5) * 0.9, face.y + (rand() - 0.5) * 0.9, face.z + (rand() - 0.5) * 0.9).normalize();
    shrubCards.push({ p: pos.clone(), n: jit, s: range(rand, [0.05, 0.075]), col: pick(rand, ['#2c4a2c', '#365635', '#28442a', '#3d5e38', '#31502f']), ao: 0.7 + 0.3 * (pos.y / HH) });
  }
  const cards = new THREE.InstancedMesh(cardGeo, cardMat, shrubCards.length);
  shrubCards.forEach((c, i) => { setCard(cards, i, c.p, c.n, rand() * TAU, c.s); cards.setColorAt(i, _c.set(c.col).multiplyScalar(c.ao)); });
  finish(cards, shrubCards.length); cards.castShadow = true; cards.receiveShadow = true; L[3].add(cards);

  /* étage 4 : l'amélanchier en couleurs d'automne */
  const tree = new THREE.Group(); tree.position.set(TREE.x, 0, TREE.z); L[4].add(tree);
  const tsegs = [], spots = [];
  const grow = (p, d, len, r, depth) => {
    const nSt = Math.max(2, Math.round(len / 0.22)), step = len / nSt; let cur = p.clone(); const dir = d.clone();
    for (let i = 0; i < nSt; i++) {
      dir.x += (rand() - 0.5) * 0.22; dir.z += (rand() - 0.5) * 0.22; dir.y += 0.035; dir.normalize();
      const next = cur.clone().addScaledVector(dir, step), r0 = r * (1 - (0.55 * i) / nSt), r1 = r * (1 - (0.55 * (i + 1)) / nSt);
      tsegs.push({ a: cur, b: next, ra: r0, rb: r1 });
      if (depth < 3 && i >= 1 && rand() < (depth === 0 ? 0.36 : 0.48)) {
        const side = new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).normalize();
        grow(next, dir.clone().multiplyScalar(0.55).addScaledVector(side, 0.75).add(new THREE.Vector3(0, 0.22, 0)).normalize(), len * lerp(0.42, 0.62, rand()), r1 * 0.62, depth + 1);
      }
      if (depth >= 1 && i / nSt > 0.3) spots.push(next.clone());
      cur = next;
    }
    if (depth < 3) for (let k = 0; k < 2; k++) { const side = new THREE.Vector3(rand() - 0.5, 0.2, rand() - 0.5).normalize(); grow(cur, dir.clone().addScaledVector(side, 0.6).normalize(), len * 0.45, r * 0.42, depth + 1); }
    else spots.push(cur.clone());
  };
  for (let k = 0; k < 5; k++) {
    const an = (k / 5) * TAU + rand() * 0.6, lean = 0.2 + rand() * 0.18;
    grow(new THREE.Vector3(Math.cos(an) * 0.08, -0.05, Math.sin(an) * 0.08), new THREE.Vector3(Math.cos(an) * lean, 1, Math.sin(an) * lean).normalize(), 2.3 + rand() * 0.8, 0.055 + rand() * 0.02, 0);
  }
  const bark = new THREE.Mesh(tubeGeometry(tsegs, 6), new THREE.MeshStandardMaterial({ color: '#8d8a7e', roughness: 0.88, side: THREE.DoubleSide }));
  bark.castShadow = true; bark.receiveShadow = true; tree.add(bark);
  const leafGeo = leafGeometry(0.58, 0.12);
  const leafMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, color: '#ffffff' });
  leafMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
    vec3 ip = instanceMatrix[3].xyz;
    transformed.z += sin(uTime * 3.2 + ip.x * 7.0 + ip.y * 5.0 + ip.z * 3.0) * 0.22 * position.y;
  #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.2;');
  };
  const AUT = ['#e2702a', '#d4552a', '#e99a35', '#c8432a', '#efb04a', '#e0802e', '#8d8f3a'];
  const maxLeaves = low ? 4200 : 9600, nl = Math.min(maxLeaves, spots.length * 3);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, nl);
  for (let i = 0; i < nl; i++) {
    const sp = spots[Math.floor(rand() * spots.length)];
    pos.set(sp.x + (rand() - 0.5) * 0.28, sp.y + (rand() - 0.5) * 0.22, sp.z + (rand() - 0.5) * 0.28);
    n.set(rand() - 0.5, rand() * 0.8 + 0.2, rand() - 0.5).normalize();
    setCard(leaves, i, pos, n, rand() * TAU, range(rand, [0.055, 0.085]));
    leaves.setColorAt(i, _c.set(pick(rand, AUT)).offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.06));
  }
  finish(leaves, nl); leaves.castShadow = true; tree.add(leaves);

  // quelques feuilles qui tombent, toutes portées par le même vent
  const nFall = low ? 26 : 46, fall = new THREE.InstancedMesh(leafGeometry(0.58, 0.14, true), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, color: '#ffffff' }), nFall);
  const falling = Array.from({ length: nFall }, (_, i) => ({ t: rand() * 9, life: lerp(7, 11, rand()), x0: TREE.x + (rand() - 0.5) * 2.6, z0: TREE.z + (rand() - 0.5) * 2.4, y0: lerp(2.2, 4.2, rand()), ph: rand() * TAU, s: range(rand, [0.06, 0.085]) }));
  falling.forEach((f, i) => fall.setColorAt(i, _c.set(pick(rand, AUT))));
  finish(fall, nFall); L[4].add(fall);

  /* l'eau qui s'infiltre (deuxième chapitre) */
  const nDrops = low ? 110 : 190, dropPos = new Float32Array(nDrops * 3), dropA = new Float32Array(nDrops);
  const drops = Array.from({ length: nDrops }, () => ({ x: lerp(-4.5, 6, rand()), d: rand() * 4.6, v: 0, a: 0 }));
  const dropGeo = new THREE.BufferGeometry(); dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3)); dropGeo.setAttribute('alpha', new THREE.BufferAttribute(dropA, 1));
  const dropMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uSize: { value: 18 }, uOp: { value: 0 } },
    vertexShader: 'attribute float alpha; varying float va; uniform float uSize; void main(){ va = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uSize * (6.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float va; uniform float uOp; void main(){ vec2 q = gl_PointCoord - 0.5; q.x *= 2.6; float r = length(q); float a = smoothstep(0.5, 0.15, r) * va * uOp; vec3 c = mix(vec3(0.62,0.74,1.0), vec3(0.95,0.98,1.0), smoothstep(0.3,0.0,r)); gl_FragColor = vec4(c, a); }',
  });
  const dropPts = new THREE.Points(dropGeo, dropMat); dropPts.frustumCulled = false; L[0].add(dropPts);

  /* cadres fins autour de chaque étage écarté, comme sur une axonométrie */
  const frameMat = new THREE.LineBasicMaterial({ color: '#f4f1e8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const frameGeo = new THREE.BufferGeometry().setFromPoints([[-W / 2, -D], [W / 2, -D], [W / 2, 0], [-W / 2, 0], [-W / 2, -D]].map(([x, z]) => new THREE.Vector3(x, 0.004, z)));
  L.forEach((g, i) => { if (i) g.add(new THREE.Line(frameGeo, frameMat)); });

  scene.traverse((o) => { if (o.isMesh && o !== block) o.receiveShadow = o.receiveShadow || false; });

  /* ---------- caméra : quatre arrêts, des courbes de Bézier entre eux ---------- */
  const V = (a) => new THREE.Vector3(...a);
  const KEYS = [
    { pos: V([-0.25, 1.3, -0.3]), tgt: V([0.7, 1.05, -8.5]), fov: 54 },
    { pos: V([0.6, -1.45, 5.6]), tgt: V([0.6, -1.45, 0]), fov: 40 },
    { pos: V([0.6, -3.1, 5.6]), tgt: V([0.6, -3.1, 0]), fov: 40 },
    { pos: V([20.5, 14.2, 18.2]), tgt: V([0.3, 1.0, -6.9]), fov: 38 },
  ];
  const CTRL = [
    { pos: [V([-0.1, 0.5, 0.6]), V([0.6, 0.0, 3.5])], tgt: [V([0.6, 0.45, -7.0]), V([0.7, -0.4, -3.0])] },
    { pos: [V([0.6, -2.0, 5.6]), V([0.6, -2.6, 5.6])], tgt: [V([0.6, -2.0, 0]), V([0.6, -2.6, 0])] },
    { pos: [V([1.5, -1.0, 11.5]), V([10.5, 5.5, 18.0])], tgt: [V([0.6, -2.0, -1.0]), V([0.4, 0.5, -5.0])] },
  ];
  const bez = (out, a, b, c, d, t) => { const u = 1 - t; return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t); };
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), right = new THREE.Vector3(), upv = new THREE.Vector3();

  /* ---------- état ---------- */
  let progress = 0, shift = { x: 0, y: 0 }, pointer = { x: 0, y: 0, tx: 0, ty: 0 }, mouseLive = 0, growStart = null, size = { w: 1, h: 1 }, shadowDirty = true, lastLift = -1;
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  const clock = new THREE.Clock();
  const labelEls = { strata: labels.strata || [], layers: labels.layers || [], ruler: labels.ruler || null };

  function resize() {
    const w = cvs.clientWidth || innerWidth, h = cvs.clientHeight || innerHeight; size = { w, h };
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.5 : 1.75)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function applyCamera(p) {
    const seg = Math.min(2, Math.floor(p)); let t = clamp(p - seg); t = t * t * (3 - 2 * t);
    const A = KEYS[seg], B = KEYS[seg + 1], C = CTRL[seg];
    bez(camPos, A.pos, C.pos[0], C.pos[1], B.pos, t); bez(camTgt, A.tgt, C.tgt[0], C.tgt[1], B.tgt, t);
    camera.fov = lerp(A.fov, B.fov, t);
    // écran étroit (téléphone) : on recule pour garder le cadre
    const aspect = size.w / size.h;
    if (aspect < 1) {
      const want = p < 1 ? smooth(0.6, 1, p) * 0.35 : p <= 2 ? 0.35 : lerp(0.35, 1, smooth(2.2, 3, p));
      camPos.sub(camTgt).multiplyScalar(lerp(1, Math.min(2.2, 1.25 / aspect), want)).add(camTgt);
    }
    // petite parallaxe à la souris, surtout au jardin
    pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
    const par = p < 1 ? 1 - smooth(0, 0.6, p) : p > 2.6 ? smooth(2.6, 3, p) * 2.2 : 0.25;
    right.subVectors(camTgt, camPos).cross(camera.up).normalize(); upv.copy(camera.up);
    camPos.addScaledVector(right, pointer.x * 0.14 * par).addScaledVector(upv, pointer.y * 0.07 * par);
    camera.position.copy(camPos); camera.lookAt(camTgt);
    camera.updateProjectionMatrix();
    // décentrage optique : au départ, le jardin se cadre dans l'arche
    const open = smooth(0, 0.5, p), e = camera.projectionMatrix.elements;
    const k3 = smooth(2.2, 3, p), narrow = size.w / size.h < 0.9;
    e[8] = -shift.x * (1 - open) + (narrow ? 0 : 0.2 * k3); e[9] = -shift.y * (1 - open) + (narrow ? -0.24 * k3 : -0.08 * k3);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
  }

  function applyLayers(p, time) {
    let moved = false;
    L.forEach((g, i) => { const k = smooth(2.25 + i * 0.07, 2.88 + i * 0.03, p), y = LIFT[i] * k; if (Math.abs(g.position.y - y) > 1e-4) { g.position.y = y; moved = true; } });
    const ex = smooth(2.3, 2.9, p);
    walls.scale.y = Math.max(0.001, 1 - ex); walls.visible = ex < 0.999;
    frameMat.opacity = ex * 0.26;
    scene.fog.near = lerp(9, 80, smooth(2, 2.8, p)); scene.fog.far = lerp(42, 200, smooth(2, 2.8, p));
    if (moved || Math.abs(ex - lastLift) > 1e-4) shadowDirty = true; lastLift = ex;
    // l'eau : visible autour du deuxième chapitre
    dropMat.uniforms.uOp.value = smooth(1.35, 1.85, p) * (1 - smooth(2.3, 2.6, p));
    G.uWater.value = smooth(1.4, 2, p);
    // les racines poussent une fois, quand on arrive dans le sol
    if (growStart === null && p > 0.82) growStart = time;
    if (growStart !== null) G.uGrow.value = clamp((time - growStart) / 3.2) ** 0.85;
  }

  function stepDrops(dt) {
    if (dropMat.uniforms.uOp.value <= 0.001) return;
    for (let i = 0; i < nDrops; i++) {
      const q = drops[i], x = q.x;
      const b0 = BOUNDS[0](x), b1 = BOUNDS[1](x), b2 = BOUNDS[2](x), b3 = BOUNDS[3](x);
      const speed = q.d < b0 ? 0.34 : q.d < b1 ? 0.22 : q.d < b2 ? 0.07 : q.d < b3 ? 0.46 : 0.2;
      q.d += speed * dt; if (q.d > b1 && q.d < b2) q.x += Math.sin(q.d * 9 + i) * 0.04 * dt;
      q.a = smooth(0, 0.12, q.d) * (1 - smooth(b3, b3 + 0.35, q.d));
      if (q.d > b3 + 0.4) { q.d = 0.02; q.x = lerp(-4.5, 6, Math.random()); }
      dropPos[i * 3] = q.x; dropPos[i * 3 + 1] = -q.d; dropPos[i * 3 + 2] = 0.02; dropA[i] = q.a;
    }
    dropGeo.attributes.position.needsUpdate = true; dropGeo.attributes.alpha.needsUpdate = true;
  }

  function stepFall(dt) {
    for (let i = 0; i < nFall; i++) {
      const f = falling[i]; f.t += dt; if (f.t > f.life) { f.t = 0; f.x0 = TREE.x + (Math.random() - 0.5) * 2.6; f.z0 = TREE.z + (Math.random() - 0.5) * 2.4; }
      const k = f.t / f.life, y = f.y0 * (1 - k) + 0.01, drift = f.t * 0.32;
      const x = f.x0 + drift * 0.85 + Math.sin(f.t * 1.3 + f.ph) * 0.18, z = f.z0 + drift * 0.35 + Math.cos(f.t * 1.1 + f.ph) * 0.12;
      const s = f.s * (k > 0.9 ? 1 - smooth(0.9, 1, k) : 1);
      setInst(fall, i, x, Math.max(0.01, y), z, Math.sin(f.t * 1.7 + f.ph) * 1.2 + 0.4, f.t * 0.9 + f.ph, Math.cos(f.t * 1.3) * 0.8, s, s, s);
    }
    fall.instanceMatrix.needsUpdate = true;
  }

  const tmpV = new THREE.Vector3();
  function project(x, y, z, out) { tmpV.set(x, y, z).project(camera); out.x = (tmpV.x * 0.5 + 0.5) * size.w; out.y = (-tmpV.y * 0.5 + 0.5) * size.h; out.z = tmpV.z; return out; }
  const pt = { x: 0, y: 0, z: 0 }, pt2 = { x: 0, y: 0, z: 0 };
  function placeLabels(p) {
    const so = smooth(0.7, 0.95, p) * (1 - smooth(2.15, 2.4, p));
    const narrow = size.w / size.h < 0.9;
    const ax = narrow ? camTgt.x - camPos.distanceTo(camTgt) * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect * 0.7 : 0.35; // abscisse de la règle
    labelEls.strata.forEach((el) => {
      const dTop = +el.dataset.top, dBot = +el.dataset.bot, mid = (dTop + Math.min(dBot, dTop + 1.6)) / 2;
      project(ax, -mid, 0.02, pt); el.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`; el.style.opacity = so.toFixed(3);
    });
    if (labelEls.ruler) {
      project(ax, 0, 0.02, pt); project(ax, -1, 0.02, pt2);
      labelEls.ruler.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
      labelEls.ruler.style.setProperty('--m', `${(pt2.y - pt.y).toFixed(2)}px`); labelEls.ruler.style.opacity = so.toFixed(3);
    }
    const lo = smooth(2.75, 2.97, p);
    labelEls.layers.forEach((el, i) => {
      const yy = L[i].position.y + (i === 0 ? -1.4 : i === 1 ? 0.05 : i === 2 ? 0.55 : i === 3 ? 0.9 : 2.2);
      project(-W / 2 - 0.2, yy, -0.2, pt);
      el.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`; el.style.opacity = narrow ? '0' : lo.toFixed(3);
    });
  }

  function render() {
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    U.uTime.value = time;
    // la main qui passe dans l'herbe
    mouseLive = Math.max(0, mouseLive - dt * 0.6);
    U.uMousePow.value += (Math.min(1, mouseLive) * (1 - smooth(0.05, 0.35, progress)) - U.uMousePow.value) * 0.08;
    applyLayers(progress, time); applyCamera(progress);
    if (U.uMousePow.value > 0.01) { ndc.set(pointer.tx, pointer.ty); ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hit)) U.uMouse.value.set(hit.x, 0, hit.z); }
    stepDrops(dt); stepFall(dt); placeLabels(progress);
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    renderer.render(scene, camera);
  }

  resize();
  return {
    renderer, scene, camera,
    resize, render,
    setProgress(p) { progress = clamp(p, 0, 3); },
    setShift(x, y) { shift = { x, y }; },
    setPointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; mouseLive = Math.min(1.6, mouseLive + 0.35); },
    growNow() { growStart = clock.elapsedTime - 9; },
    still(w, h, p = 0) {                                       // image fixe (repli sans WebGL, vignettes)
      const prev = progress; progress = p; renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h;
      size = { w, h }; shadowDirty = true; clock.getDelta(); render(); progress = prev; return cvs;
    },
  };
}
