/* ==========================================================================
   M&S Design — « La tempête » : des milliers de pétales bleus en 3D.
   Ils dessinent une fleur, le & de M&S, un écran, une planète en orbite,
   puis « Vous ? ». Un cran de molette = un tourbillon (tous dans le même sens)
   vers la forme suivante. La souris est le vent, un clic une bourrasque.
   ========================================================================== */
import * as THREE from '../assets/vendor/three.module.min.js';

const d = document.documentElement;
let reduced = /[?&]motion=reduce/.test(location.search);
try { if (localStorage.getItem('ms_motion') === 'reduce') reduced = true; } catch (e) { /* rien */ }
const REC = /[?&]rec=1/.test(location.search);                    // outil : enregistre la vidéo d’aperçu de l’accueil
const small = !REC && (Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4);
const N = small ? 6000 : 12000;
const CH = 5, DUR = 2.1;
const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
let seed = 1234567; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/* ---------- rendu ---------- */
const canvas = $('.xp__gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 13);
scene.add(new THREE.HemisphereLight(0xf6f3ff, 0x8f8a80, 1.15));
const sun = new THREE.DirectionalLight(0xfff6ea, 2.1);
sun.position.set(-5, 6, 9); sun.castShadow = true;
sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, near: 1, far: 30 });
sun.shadow.radius = 7; sun.shadow.blurSamples = 16; sun.shadow.bias = -0.0005;
scene.add(sun);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
wall.position.z = -3.2; wall.receiveShadow = true; scene.add(wall);

/* ---------- un pétale : petit, creusé, un peu tordu ---------- */
function petalGeo() {
  const g = new THREE.PlaneGeometry(1, 1, 5, 7), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + 0.5;                                  // y : 0 (base) → 1 (bout)
    const w = Math.pow(Math.sin(Math.PI * Math.min(1, y * 0.92 + 0.04)), 0.8) * (0.55 + 0.45 * y);
    p.setXYZ(i, x * w * 0.7, y - 0.5, 0.18 * (x * x * 4) * y + 0.12 * y * y);
  }
  g.computeVertexNormals();
  return g;
}
const mat = new THREE.MeshStandardMaterial({ roughness: 0.52, metalness: 0, side: THREE.DoubleSide });
const petals = new THREE.InstancedMesh(petalGeo(), mat, N);
petals.castShadow = true; petals.frustumCulled = false;
petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(petals);
const PAL = ['#155eef', '#1d4fd8', '#2f6bff', '#4f83ff', '#0f3cbf', '#6f95ff', '#2a5ae8'], CREAM = '#f3ecdc';
const col = new THREE.Color();
for (let i = 0; i < N; i++) { col.set(rnd() < 0.08 ? CREAM : PAL[Math.floor(rnd() * PAL.length)]); col.offsetHSL(0, 0, (rnd() - 0.5) * 0.06); petals.setColorAt(i, col); }

/* ---------- les formes : échantillonnées dans un dessin ---------- */
function sample(draw, w, h, size, depth = 0.5) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.strokeStyle = '#fff';
  draw(x, w, h);
  const data = x.getImageData(0, 0, w, h).data, pts = [];
  for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) if (data[(j * w + i) * 4] > 128) pts.push(i, j);
  const out = new Float32Array(N * 3), k = size / w;
  for (let n = 0; n < N; n++) {
    const m = Math.floor(rnd() * (pts.length / 2)) * 2;
    out[n * 3] = (pts[m] + rnd() * 2 - w / 2) * k; out[n * 3 + 1] = -(pts[m + 1] + rnd() * 2 - h / 2) * k; out[n * 3 + 2] = (rnd() - 0.5) * depth;
  }
  return out;
}
let F = [], OX = 0, OY = 0, PS = 1;
function buildForms(fit, narrow = false) {
  const S = 9 * fit;
  const flower = sample((x, w, h) => {
    for (let k = 0; k < 5; k++) { x.save(); x.translate(w / 2, h / 2); x.rotate(k * Math.PI * 2 / 5 + 0.2); x.beginPath(); x.ellipse(0, -h * 0.25, w * 0.15, h * 0.24, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(w / 2, h / 2, w * 0.05, 0, Math.PI * 2); x.fill();
  }, 420, 420, S * 0.86, 0.9);
  const amp = sample((x, w, h) => { x.font = `400 ${h * 0.95}px "Fraunces", Georgia, serif`; x.textAlign = 'center'; x.fillText('&', w / 2, h * 0.83); }, 420, 420, S * 0.82, 0.5);
  const screen = sample((x, w, h) => {
    x.lineWidth = w * 0.03; x.beginPath(); x.roundRect(w * 0.05, h * 0.14, w * 0.9, h * 0.72, w * 0.04); x.stroke();
    x.fillRect(w * 0.05, h * 0.14, w * 0.9, h * 0.07);
    x.fillRect(w * 0.12, h * 0.3, w * 0.42, h * 0.07); x.fillRect(w * 0.12, h * 0.41, w * 0.3, h * 0.04); x.fillRect(w * 0.12, h * 0.5, w * 0.16, h * 0.06);
    x.fillRect(w * 0.6, h * 0.29, w * 0.28, h * 0.3);
    [0, 1, 2].forEach((k) => x.fillRect(w * (0.12 + k * 0.26), h * 0.66, w * 0.22, h * 0.12));
  }, 520, 380, S * 1.02, 0.4);
  // la planète et son anneau : formes de base, tournées à chaque image
  const orbit = new Float32Array(N * 3), inRing = new Uint8Array(N), NS = Math.ceil(N * 3 / 5);
  for (let n = 0, s = 0; n < N; n++) {
    if (n % 5 < 3) { const y = 1 - 2 * ((s + 0.5) / NS), r = Math.sqrt(1 - y * y), a = s * 2.399963; s++; orbit[n * 3] = Math.cos(a) * r * 1.85 * fit; orbit[n * 3 + 1] = y * 1.85 * fit; orbit[n * 3 + 2] = Math.sin(a) * r * 1.85 * fit; }
    else { inRing[n] = 1; const a = rnd() * Math.PI * 2, r = (2.7 + rnd() * 0.9) * fit; orbit[n * 3] = Math.cos(a) * r; orbit[n * 3 + 1] = (rnd() - 0.5) * 0.12; orbit[n * 3 + 2] = Math.sin(a) * r; }
  }
  const you = narrow
    ? sample((x, w, h) => { x.font = `italic 400 ${h * 0.92}px "Fraunces", Georgia, serif`; x.textAlign = "center"; x.fillText("?", w / 2, h * 0.8); }, 420, 440, S * 0.7, 0.4)
    : sample((x, w, h) => { x.font = `italic 400 ${h * 0.62}px "Fraunces", Georgia, serif`; x.textAlign = 'center'; x.fillText('Vous ?', w / 2, h * 0.66); }, 640, 300, S * 1.05, 0.5);
  F = [flower, amp, screen, { base: orbit, ring: inRing }, you];
}

/* ---------- état des pétales ---------- */
const P = new Float32Array(N * 3), V = new Float32Array(N * 3), FROM = new Float32Array(N * 3), T0 = new Float32Array(N), DELAY = new Float32Array(N);
const ROT = new Float32Array(N * 3), BASE = new Float32Array(N * 3), SPIN = new Float32Array(N * 3), SC = new Float32Array(N), TURN = new Float32Array(N);
for (let i = 0; i < N; i++) {
  P[i * 3] = (rnd() - 0.5) * 22; P[i * 3 + 1] = (rnd() - 0.5) * 14; P[i * 3 + 2] = (rnd() - 0.5) * 6 + 2;
  BASE[i * 3] = (rnd() - 0.5) * 1.2; BASE[i * 3 + 1] = (rnd() - 0.5) * 1.2; BASE[i * 3 + 2] = rnd() * Math.PI * 2;
  SPIN[i * 3] = (rnd() - 0.5) * 6; SPIN[i * 3 + 1] = (rnd() - 0.5) * 6; SPIN[i * 3 + 2] = (rnd() - 0.5) * 3;
  SC[i] = (small ? 0.2 : 0.16) * (0.75 + rnd() * 0.55); DELAY[i] = rnd() * 0.55; TURN[i] = 0.85 + rnd() * 0.4;
}
let chapter = 0, now = 0, orbitT = 0;
const tgt = new Float32Array(3);
function target(i, out) {
  const f = F[chapter];
  if (f.base) {                                                                 // la planète tourne, l’anneau aussi (plus vite, incliné)
    const b = f.base, x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
    if (f.ring[i]) { const a = orbitT * 0.45, c = Math.cos(a), s = Math.sin(a), rx = x * c - z * s, rz = x * s + z * c, tilt = 0.42; out[0] = rx; out[1] = y * Math.cos(tilt) - rz * Math.sin(tilt); out[2] = y * Math.sin(tilt) + rz * Math.cos(tilt); }
    else { const a = orbitT * 0.2, c = Math.cos(a), s = Math.sin(a); out[0] = x * c - z * s; out[1] = y; out[2] = x * s + z * c; }
  } else { out[0] = f[i * 3]; out[1] = f[i * 3 + 1]; out[2] = f[i * 3 + 2]; }
  out[0] += OX; out[1] += OY;
  out[0] += Math.sin(now * 0.7 + i * 0.37) * 0.025; out[1] += Math.cos(now * 0.6 + i * 0.53) * 0.025;
}
function goTo(c, at = now, force = false) {
  if (c === chapter && !force) return;
  chapter = c;
  for (let i = 0; i < N * 3; i++) FROM[i] = P[i];
  for (let i = 0; i < N; i++) T0[i] = at + DELAY[i];
  ui(c); whoosh();
}

/* ---------- le vent : la souris, le doigt, les clics ---------- */
const wind = { x: 0, y: 0, vx: 0, vy: 0, on: false, t: 0 };
let gust = null;
const toWorld = (cx, cy) => { const r = canvas.getBoundingClientRect(), nx = ((cx - r.left) / r.width) * 2 - 1, ny = -((cy - r.top) / r.height) * 2 + 1, h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z; return [nx * h * camera.aspect, ny * h]; };
addEventListener('pointermove', (e) => {
  const [x, y] = toWorld(e.clientX, e.clientY), dt = Math.max(0.008, (performance.now() - wind.t) / 1000);
  if (wind.on) { wind.vx += ((x - wind.x) / dt - wind.vx) * 0.5; wind.vy += ((y - wind.y) / dt - wind.vy) * 0.5; }
  wind.x = x; wind.y = y; wind.on = true; wind.t = performance.now();
}, { passive: true });
addEventListener('pointerdown', (e) => { const [x, y] = toWorld(e.clientX, e.clientY); gust = { x, y, t: now }; puff(); });
document.addEventListener('pointerleave', () => { wind.on = false; });

/* ---------- la boucle ---------- */
const arr = petals.instanceMatrix.array;
let last = 0;
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.04, last ? (ms - last) / 1000 : 1 / 60); last = ms; now += dt; orbitT += dt;
  wind.vx *= Math.pow(0.04, dt); wind.vy *= Math.pow(0.04, dt);
  const R = 1.6, gR = gust ? (now - gust.t) * 9 : 0, gOn = gust && now - gust.t < 1.2;
  for (let i = 0; i < N; i++) {
    const j = i * 3;
    target(i, tgt);
    let s = (now - T0[i]) / DUR, spinK = 0.25;
    if (s < 1 && !reduced) {
      // le tourbillon : on tourne d’un tour autour de l’axe de la caméra, tous dans le même sens
      s = ease(clamp(s));
      const fx = FROM[j], fy = FROM[j + 1], fz = FROM[j + 2];
      const a0 = Math.atan2(fy, fx), r0 = Math.hypot(fx, fy), a1 = Math.atan2(tgt[1], tgt[0]), r1 = Math.hypot(tgt[0], tgt[1]);
      let da = a1 - a0; while (da < 0) da += Math.PI * 2; da += Math.PI * 2 * TURN[i];
      const a = a0 + da * s, r = r0 + (r1 - r0) * s + Math.sin(Math.PI * s) * (1.3 + DELAY[i] * 2);
      const x = Math.cos(a) * r, y = Math.sin(a) * r, z = fz + (tgt[2] - fz) * s + Math.sin(Math.PI * s) * (1.6 + DELAY[i] * 3);
      V[j] = (x - P[j]) / dt; V[j + 1] = (y - P[j + 1]) / dt; V[j + 2] = (z - P[j + 2]) / dt;
      P[j] = x; P[j + 1] = y; P[j + 2] = z; spinK = 1 + 2.5 * Math.sin(Math.PI * s);
    } else {
      // ressort vers sa place, avec le vent de la souris et la bourrasque du clic
      let ax = (tgt[0] - P[j]) * 9 - V[j] * 3.4, ay = (tgt[1] - P[j + 1]) * 9 - V[j + 1] * 3.4, az = (tgt[2] - P[j + 2]) * 9 - V[j + 2] * 3.4;
      if (wind.on) {
        const dx = P[j] - wind.x, dy = P[j + 1] - wind.y, dd = Math.hypot(dx, dy);
        if (dd < R) { const f = (1 - dd / R) ** 2; ax += (wind.vx * 2.2 + (dx / (dd + 1e-4)) * 14) * f; ay += (wind.vy * 2.2 + (dy / (dd + 1e-4)) * 14) * f; az += 18 * f; }
      }
      if (gOn) { const dx = P[j] - gust.x, dy = P[j + 1] - gust.y, dd = Math.hypot(dx, dy), band = Math.exp(-((dd - gR) ** 2) * 1.5); ax += (dx / (dd + 1e-3)) * 90 * band; ay += (dy / (dd + 1e-3)) * 90 * band; az += 70 * band; }
      V[j] += ax * dt; V[j + 1] += ay * dt; V[j + 2] += az * dt;
      P[j] += V[j] * dt; P[j + 1] += V[j + 1] * dt; P[j + 2] += V[j + 2] * dt;
      spinK = 0.25 + Math.min(3, Math.hypot(V[j], V[j + 1], V[j + 2]) * 0.6);
    }
    ROT[j] += SPIN[j] * dt * spinK * 0.35; ROT[j + 1] += SPIN[j + 1] * dt * spinK * 0.35; ROT[j + 2] += SPIN[j + 2] * dt * spinK * 0.2;
    // matrice : rotation (Euler XYZ → quaternion) × échelle + position, écrite à la main (rapide)
    const ex = (BASE[j] + Math.sin(ROT[j]) * 0.9) * 0.5, ey = (BASE[j + 1] + Math.sin(ROT[j + 1]) * 0.9) * 0.5, ez = (BASE[j + 2] + ROT[j + 2]) * 0.5;
    const c1 = Math.cos(ex), s1 = Math.sin(ex), c2 = Math.cos(ey), s2 = Math.sin(ey), c3 = Math.cos(ez), s3 = Math.sin(ez);
    const qx = s1 * c2 * c3 + c1 * s2 * s3, qy = c1 * s2 * c3 - s1 * c2 * s3, qz = c1 * c2 * s3 + s1 * s2 * c3, qw = c1 * c2 * c3 - s1 * s2 * s3;
    const sc = SC[i] * PS, x2 = qx + qx, y2 = qy + qy, z2 = qz + qz, xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
    const o = i * 16;
    arr[o] = (1 - (yy + zz)) * sc; arr[o + 1] = (xy + wz) * sc; arr[o + 2] = (xz - wy) * sc; arr[o + 3] = 0;
    arr[o + 4] = (xy - wz) * sc; arr[o + 5] = (1 - (xx + zz)) * sc; arr[o + 6] = (yz + wx) * sc; arr[o + 7] = 0;
    arr[o + 8] = (xz + wy) * sc; arr[o + 9] = (yz - wx) * sc; arr[o + 10] = (1 - (xx + yy)) * sc; arr[o + 11] = 0;
    arr[o + 12] = P[j]; arr[o + 13] = P[j + 1]; arr[o + 14] = P[j + 2]; arr[o + 15] = 1;
  }
  petals.instanceMatrix.needsUpdate = true;
  // la caméra suit doucement la souris
  const px = wind.on ? wind.x * 0.05 : 0, py = wind.on ? wind.y * 0.04 : 0;
  camera.position.x += (px - camera.position.x) * 0.04; camera.position.y += (py - camera.position.y) * 0.04; camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

/* ---------- mise en page ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, visW = visH * camera.aspect;
  const wide = camera.aspect > 1.15;
  const fit = wide ? Math.min(0.92, (visW * 0.66) / 9.6, (visH * 0.8) / 8.4) : Math.min(1, (visW * 0.94) / 9.6, (visH * 0.5) / 8.4);
  OX = wide ? visW * 0.14 : 0; OY = wide ? visH * 0.035 : visH * 0.16;
  if (REC) { OX = 0; OY = 0; }
  PS = clamp(fit / 0.82, 0.36, 1) / (small ? 1.25 : 1);              // pétales à l’échelle de la forme (sinon, sur téléphone, on ne lit plus rien)
  wall.position.z = wide ? -3.2 : -1.4;
  buildForms(fit, !wide);
}

/* ---------- chapitres : molette (un cran = un chapitre), flèches, glisser, points ---------- */
const items = $$('[data-ch]'), dots = $$('[data-go]'), num = $('[data-num]');
function ui(c) {
  items.forEach((el, k) => el.classList.toggle('is-on', k === c));
  dots.forEach((b, k) => b.setAttribute('aria-current', k === c ? 'step' : 'false'));
  if (num) num.textContent = String(c + 1).padStart(2, '0');
  d.classList.toggle('xp-last', c === CH - 1);
}
let lock = 0;
const step = (dir) => { const t = performance.now(); if (t < lock) return; const c = clamp(chapter + dir, 0, CH - 1); if (c === chapter) return; lock = t + 1300; goTo(c); };
addEventListener('wheel', (e) => { e.preventDefault(); if (Math.abs(e.deltaY) > 4) step(e.deltaY > 0 ? 1 : -1); }, { passive: false });
addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); } if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); } });
let ty = null;
addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', (e) => { if (ty === null) return; const dy = ty - e.changedTouches[0].clientY; if (Math.abs(dy) > 40) step(dy > 0 ? 1 : -1); ty = null; }, { passive: true });
dots.forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); goTo(+b.dataset.go); }));

/* ---------- le son : un souffle très discret à chaque tourbillon, une bouffée au clic ---------- */
let ac = null, master = null, muted = false;
try { muted = localStorage.getItem('ms_xp_sound') === 'off'; } catch (e) { /* rien */ }
const soundBtn = $('[data-sound]');
const label = () => { if (soundBtn) soundBtn.textContent = muted ? 'Activer le son' : 'Couper le son'; };
label();
function audio() {
  if (ac || muted) return ac;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.22; master.connect(ac.destination); } catch (e) { ac = null; }
  return ac;
}
['pointerdown', 'keydown', 'touchend', 'wheel'].forEach((ev) => addEventListener(ev, () => { if (!muted) audio(); if (ac && ac.state === 'suspended') ac.resume(); }, { passive: true }));
function noiseBurst(dur, f0, f1, peak) {
  if (!ac || muted) return;
  const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
}
function whoosh() { noiseBurst(2.0, 300, 2400, 0.35); }
function puff() { audio(); noiseBurst(0.9, 1800, 400, 0.3); }
if (soundBtn) soundBtn.addEventListener('click', (e) => { e.stopPropagation(); muted = !muted; try { localStorage.setItem('ms_xp_sound', muted ? 'off' : 'on'); } catch (er) { /* rien */ } if (muted && master) master.gain.value = 0; if (!muted) { audio(); if (master) master.gain.value = 0.22; } label(); });

/* ---------- départ ---------- */
const title = $('[data-count-title]');
if (title) title.textContent = N >= 12000 ? 'Douze mille pétales.' : 'Six mille pétales.';
await Promise.all(["400 200px \"Fraunces\"", "italic 400 200px \"Fraunces\"", "italic 700 200px \"Fraunces\""].map((f) => document.fonts.load(f))).catch(() => {});
resize();
addEventListener('resize', () => { resize(); });
goTo(0, 0.25, true);
d.classList.add('xp-ready');
if (REC) record(); else requestAnimationFrame(frame);

/* ---------- outil : la vidéo d’aperçu (10 s en boucle : fleur → coup de vent → & → fleur), image par image ---------- */
async function record() {
  window.requestAnimationFrame = () => 0;                       // c’est nous qui faisons avancer le temps
  const { Muxer, ArrayBufferTarget } = await import('/_msdesign-src/video/vendor/mp4-muxer.mjs');
  const W = 1280, H = 720, FPS = 30, T = 10, PRE = 3.2;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const x = out.getContext('2d');
  const bg = x.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, W * 0.72);
  bg.addColorStop(0, '#fbf8f2'); bg.addColorStop(0.55, '#f5f1e9'); bg.addColorStop(1, '#ebe5d9');
  const save = (p, b) => fetch('/__save?path=' + encodeURIComponent(p), { method: 'POST', body: b });
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
  let err = null; const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { err = e; } });
  enc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 1800000, framerate: FPS, latencyMode: 'quality', avc: { format: 'avc' } });
  const r = canvas.getBoundingClientRect(), wx = (u) => r.left + u * r.width, wy = (v) => r.top + v * r.height;
  let ms = 0;
  for (let f = 0; f < PRE * FPS; f++) { ms += 1000 / FPS; frame(ms); }      // la fleur se forme avant l’enregistrement
  const t0 = now;
  for (let f = 0; f < T * FPS; f++) {
    const t = f / FPS;
    if (t >= 0.35 && t < 1.05) dispatchEvent(new PointerEvent('pointermove', { clientX: wx(0.3 + (t - 0.35) * 0.62), clientY: wy(0.52 + Math.sin(t * 5) * 0.05) }));
    if (Math.abs(t - 1.1) < 0.5 / FPS) document.dispatchEvent(new PointerEvent('pointerleave'));
    if (Math.abs(t - 1.8) < 0.5 / FPS) goTo(1, t0 + t);
    if (Math.abs(t - 5.6) < 0.5 / FPS) goTo(0, t0 + t);
    ms += 1000 / FPS; frame(ms);
    x.fillStyle = bg; x.fillRect(0, 0, W, H); x.drawImage(canvas, 0, 0, W, H);
    if (f === 0) await save('assets/img/tempete-poster.webp', await new Promise((res) => out.toBlob(res, 'image/webp', 0.84)));
    const vf = new VideoFrame(out, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    enc.encode(vf, { keyFrame: f % 60 === 0 }); vf.close();
    while (enc.encodeQueueSize > 6) await new Promise((res) => setTimeout(res, 5));
    if (err) throw err;
    if (f % 30 === 0) document.title = 'frame ' + f;
  }
  await enc.flush(); muxer.finalize();
  await save('assets/video/tempete.mp4', new Blob([muxer.target.buffer], { type: 'video/mp4' }));
  document.title = 'done ' + (muxer.target.buffer.byteLength / 1e6).toFixed(2) + ' MB';
}
window.__xp = { goTo, get chapter() { return chapter; }, N };
