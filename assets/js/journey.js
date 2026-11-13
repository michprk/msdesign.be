/* ==========================================================================
   M&S Design — L’équipe : un voyage en 3D dans un Japon d’hiver.
   On avance sur le côté, comme en voiture : un cran de molette = un trajet.
   La caméra accélère (flou de vitesse selon la profondeur), puis s’arrête net
   devant un lieu : le torii, le grand cerisier (Mamoudou), la pagode (Michal),
   le pont sur l’étang gelé (Adam), la maison de thé (contact).
   Les grands éléments (torii, lanternes, pont, pagode, maison de thé, rochers) sont modélisés dans Blender
   (assets/models/japon.bin, scripts dans _msdesign-src/blender/jp_*.py) ; le reste est construit ici.
   ========================================================================== */
import * as THREE from '../vendor/three.module.min.js';
import { createSound } from './journey-sound.js';

const d = document.documentElement;
const Q = new URLSearchParams(location.search);
let reduced = /[?&]motion=reduce/.test(location.search);
try { if (localStorage.getItem('ms_motion') === 'reduce') reduced = true; } catch (e) { /* rien */ }
const small = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
let seed = 20261108; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rr = (a, b) => a + (b - a) * rnd();
let seed2 = 4242; const rnd2 = () => { seed2 = (seed2 * 16807) % 2147483647; return seed2 / 2147483647; };
const rr2 = (a, b) => a + (b - a) * rnd2();
const TAU = Math.PI * 2;
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;

/* ---------- les modèles faits dans Blender : on lance le téléchargement tout de suite, le compteur avance déjà ---------- */
let preLoad = 0;
const preTimer = setInterval(() => {
  preLoad = Math.min(42, preLoad + 0.8 + Math.random() * 1.6);
  const el = $('[data-load]'), g = $('[data-gate]'); if (el) el.textContent = String(Math.round(preLoad)).padStart(3, '0'); if (g) g.style.setProperty('--p', (preLoad / 100).toFixed(3));
}, 60);
// format compact : par pièce, positions sur 16 bits dans sa boîte englobante, normales sur 8 bits, (occlusion, ciel) sur 8 bits, index sur 16 bits
async function loadModels() {
  try {
    const base = new URL('../models/', import.meta.url), ver = new URL(import.meta.url).search || '?v=1', get = (f, k) => fetch(new URL(f + ver, base)).then((r) => { if (!r.ok) throw new Error(f); return r[k](); });
    const [j, buf] = await Promise.all([get('japon.json', 'json'), get('japon.bin', 'arrayBuffer')]), out = {};
    for (const [key, p] of Object.entries(j.parts)) {
      const [model, rest] = key.split(':'), mat = rest.split('#')[0];
      const q = new Int16Array(buf, p.p, p.n * 3), nq = new Int8Array(buf, p.nr, p.n * 3), a = new Uint8Array(buf, p.a, p.n * 2);
      const pos = new Float32Array(p.n * 3), nor = new Float32Array(p.n * 3), uv = new Float32Array(p.n * 2);
      for (let i = 0; i < p.n; i++) {
        for (let k = 0; k < 3; k++) { pos[i * 3 + k] = p.c[k] + (q[i * 3 + k] / 32767) * p.h[k]; nor[i * 3 + k] = nq[i * 3 + k] / 127; }
        uv[i * 2] = (a[i * 2] / 255) * 1.6; uv[i * 2 + 1] = a[i * 2 + 1] / 255;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, p.i, p.ic), 1));
      (out[model] = out[model] || []).push({ mat, geo: g });
    }
    return ['Torii', 'Toro', 'Chochin', 'Pont', 'Pagode', 'PagodeQ', 'Maison', 'Rocher1'].every((k) => out[k]) ? out : null;
  } catch (e) { return null; }                                  // sans les modèles, le décor dessiné par le code prend le relais
}
const modelsP = loadModels();

/* ---------- le parcours ---------- */
const STOPS = [0, 60, 120, 180, 240];
const SUBJ = STOPS.map((x) => x + 7);                       // le sujet de chaque arrêt, un peu à droite (le texte est à gauche)

/* ---------- le relief ---------- */
const POND = { x: 188.5, z: -11, rx: 8.6, rz: 12 };
const pondE = (x, z) => Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
function groundH(x, z) {
  let h = (fbm(x * 0.05 + 3, z * 0.05) - 0.5) * 0.9 + (noise(x * 0.17, z * 0.17) - 0.5) * 0.25;
  h *= lerp(0.25, 1, smooth(-2, -12, z));                                  // plat près du chemin
  h += smooth(-26, -95, z) * (6 + 14 * fbm(x * 0.018, 4.2));               // les collines derrière
  h += 2.4 * Math.exp(-((x - 128) ** 2 + (z + 24) ** 2) / 55);             // la butte de la pagode
  h = lerp(-0.42, h, smooth(0.9, 1.18, pondE(x, z)));                     // l’étang, allongé vers nous (le reflet du pont tombe dessus)
  return h;
}

/* ---------- rendu ---------- */
const canvas = $('.jr__gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.6);
let PR = DPR; renderer.setPixelRatio(PR);                     // PR baisse tout seul si l’appareil peine
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.97;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;                       // les ombres ne se recalculent que quand la caméra a avancé
const scene = new THREE.Scene();
const world = new THREE.Group(); scene.add(world);
const HORIZON = new THREE.Color('#f0dee6');
scene.fog = new THREE.Fog(HORIZON, 28, 250);
const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 1200);

/* ciel : bleu froid en haut, rose pâle à l’horizon, un soleil bas et voilé */
const SUN_DIR = new THREE.Vector3(-0.8, 0.32, -0.42).normalize();
const skyMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#8ea8d6') }, mid: { value: new THREE.Color('#d9d3e6') }, hor: { value: HORIZON.clone() }, sunDir: { value: SUN_DIR }, sunCol: { value: new THREE.Color('#ffd6b0') }, tPano: { value: null }, uPano: { value: 0 }, A: { value: new THREE.Vector4(-1.3, 1.3, -0.06, 0.44) } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 top, mid, hor, sunDir, sunCol; uniform sampler2D tPano; uniform float uPano; uniform vec4 A; varying vec3 vDir;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float fb(vec2 p){ return vn(p) * 0.5 + vn(p * 2.03) * 0.28 + vn(p * 4.1) * 0.14 + vn(p * 8.3) * 0.08; }
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h)); c = mix(c, top, smoothstep(0.16, 0.7, h)); c = mix(c, hor, smoothstep(0.0, -0.1, h));
      float s = max(dot(d, sunDir), 0.0); c += sunCol * (pow(s, 900.0) * 2.0 + pow(s, 14.0) * 0.28 + pow(s, 3.0) * 0.06);
      if (h > 0.0) { vec2 p = d.xz / (h + 0.12) * 1.4; float cl = smoothstep(0.52, 0.86, fb(p * 0.6 + vec2(3.0, 1.0))) * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.25, 0.6, h));
        c = mix(c, mix(vec3(0.98, 0.9, 0.93), vec3(1.0, 0.92, 0.86), s), cl * 0.55); }
      if (uPano > 0.5) { float az = atan(d.x, -d.z), el = asin(clamp(d.y, -1.0, 1.0)); vec2 pu = vec2((az - A.x) / (A.y - A.x), (el - A.z) / (A.w - A.z));
        if (pu.x > 0.0 && pu.x < 1.0 && pu.y > 0.0 && pu.y < 1.0) { vec3 m = texture2D(tPano, pu).rgb * 2.0; float k = smoothstep(1.0, 0.9, pu.y) * smoothstep(0.0, 0.03, pu.x) * smoothstep(1.0, 0.97, pu.x); c = mix(c, m, k); } }
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 20), skyMat);
sky.renderOrder = -1; sky.frustumCulled = false;
scene.add(sky);
{
  const env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();
}
const sun = new THREE.DirectionalLight('#ffdcb8', 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 34, bottom: -34, near: 1, far: 220 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cdd8ff', '#f3e3ea', 1.05); scene.add(hemi);

/* ---------- géométries : un lot par matière et par tronçon (pour ne dessiner que ce qui est à l’écran) ---------- */
const SNOW = new THREE.Color('#f5f6fb');
const chunkOf = (x) => Math.floor((x + 30) / 60);
const batches = new Map();
function batch(kind, x) { const k = kind + ':' + chunkOf(x); if (!batches.has(k)) batches.set(k, { kind, parts: [] }); return batches.get(k); }
const _c = new THREE.Color();
function colored(geo, m, color, snow = 0, opt = {}) {
  let g = geo.clone(); if (m) g.applyMatrix4(m);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (g.index) g = g.toNonIndexed();
  const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3), base = new THREE.Color(color);
  const bk = opt.baked && g.attributes.uv ? g.attributes.uv : null, aoK = opt.aoK === undefined ? 1 : opt.aoK;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    let s = 0;
    if (snow) s = smooth(0.38, 0.74, n.getY(i) + (noise(px * 3.1 + pz, py * 3.1) - 0.5) * 0.35) * snow;
    if (bk && s) s *= smooth(0.12, 0.7, bk.getY(i));           // la neige ne se pose que là où le ciel est visible (pas sous les avant-toits)
    if (opt.hs) s = Math.max(s, smooth(opt.hs[0], opt.hs[1], py + (noise(px * 0.2, pz * 0.2) - 0.5) * opt.hs[2]));
    _c.copy(base);
    if (opt.vary) _c.offsetHSL(0, 0, (hash2(px * 13, pz * 13) - 0.5) * opt.vary);
    _c.lerp(SNOW, s);
    if (bk) _c.multiplyScalar(opt.glow ? bk.getX(i) : lerp(1, 0.4 + 0.6 * smooth(0.0, 0.9, bk.getX(i)), aoK * (1 - 0.5 * s)));   // ombres de contact cuites dans Blender
    if (opt.mul) _c.multiplyScalar(opt.mul);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  return { p: p.array, n: n.array, c: col };
}
function add(kind, geo, m, color, snow = 0, x = 0, opt = {}) { batch(kind, x).parts.push(colored(geo, m, color, snow, opt)); }
function geoOf(parts) {                                         // plusieurs pièces colorées → une seule géométrie
  let n = 0; parts.forEach((q) => { n += q.p.length; });
  const P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n); let o = 0;
  parts.forEach((q) => { P.set(q.p, o); N.set(q.n, o); C.set(q.c, o); o += q.p.length; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.computeBoundingSphere(); return g;
}
function grain(mat, k) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrain = { value: k };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform float uGrain;
      float jrH3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float jrN3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(jrH3(i), jrH3(i + vec3(1, 0, 0)), f.x), mix(jrH3(i + vec3(0, 1, 0)), jrH3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(jrH3(i + vec3(0, 0, 1)), jrH3(i + vec3(1, 0, 1)), f.x), mix(jrH3(i + vec3(0, 1, 1)), jrH3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float jrG = jrN3(vWP * 5.0) * 0.45 + jrN3(vWP * 21.0) * 0.3 + jrN3(vec3(vWP.x * 3.0, vWP.y * 44.0, vWP.z * 3.0)) * 0.25;      // taches, grain fin, fil du bois
      { float snowy = smoothstep(0.6, 0.88, dot(diffuseColor.rgb, vec3(0.3333)));
        diffuseColor.rgb *= mix(1.0 - uGrain * 0.5 + uGrain * jrG, 0.975 + 0.05 * jrG, snowy); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n      roughnessFactor = clamp(roughnessFactor + (jrG - 0.5) * uGrain * 0.8, 0.06, 1.0);');
  };
  return mat;
}
const MATS = {
  solid: grain(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }), 0.42),
  gloss: grain(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, envMapIntensity: 0.7 }), 0.2),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
};
function buildBatches() {
  batches.forEach((b) => {
    let n = 0; b.parts.forEach((q) => { n += q.p.length; });
    const P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n); let o = 0;
    b.parts.forEach((q) => { P.set(q.p, o); N.set(q.n, o); C.set(q.c, o); o += q.p.length; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, MATS[b.kind]);
    mesh.castShadow = b.kind !== 'glow'; mesh.receiveShadow = b.kind !== 'glow';
    world.add(mesh);
  });
}
const E = new THREE.Euler(), QT = new THREE.Quaternion();
const mx = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => { E.set(rx, ry, rz); QT.setFromEuler(E); return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), QT, new THREE.Vector3(sx, sy, sz)); };
const BOX = new THREE.BoxGeometry(1, 1, 1);
const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);

/* tube effilé le long d’une courbe (branches, cordes, rambardes) */
function taperTube(points, r0, r1, radial = 7, segs = 0) {
  const curve = new THREE.CatmullRomCurve3(points);
  segs = segs || Math.max(3, points.length * 3);
  const fr = curve.computeFrenetFrames(segs, false), pos = [], nor = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), r = lerp(r0, r1, t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const nx = fr.normals[i].x * c + fr.binormals[i].x * s, ny = fr.normals[i].y * c + fr.binormals[i].y * s, nz = fr.normals[i].z * c + fr.binormals[i].z * s;
      pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r); nor.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}

/* ---------- textures dessinées ---------- */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// un bouquet de fleurs de cerisier : cinq pétales échancrés, cœur rose foncé
const blossomTex = canvasTex(256, 256, (x, w) => {
  const flower = (cx, cy, r, rot) => {
    for (let k = 0; k < 5; k++) {
      x.save(); x.translate(cx, cy); x.rotate(rot + (k * Math.PI * 2) / 5);
      const g = x.createLinearGradient(0, 0, 0, -r); g.addColorStop(0, '#e2789c'); g.addColorStop(0.35, '#f7b9cc'); g.addColorStop(1, '#fff0f4');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 0);
      x.bezierCurveTo(-r * 0.62, -r * 0.3, -r * 0.55, -r * 0.98, -r * 0.14, -r); x.lineTo(0, -r * 0.84); x.lineTo(r * 0.14, -r);
      x.bezierCurveTo(r * 0.55, -r * 0.98, r * 0.62, -r * 0.3, 0, 0); x.fill(); x.restore();
    }
    x.fillStyle = '#c94d76'; x.beginPath(); x.arc(cx, cy, r * 0.16, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ffd36e'; for (let k = 0; k < 7; k++) { const a = k * 0.9 + rot; x.beginPath(); x.arc(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3, r * 0.045, 0, Math.PI * 2); x.fill(); }
  };
  [[70, 72, 44, 0.2], [150, 60, 40, 1.1], [190, 140, 46, 0.6], [100, 160, 48, 2.0], [60, 205, 30, 0.9], [175, 212, 32, 1.7], [128, 112, 36, 2.6]].forEach(([a, b, r, t]) => flower(a, b, r, t));
  x.fillStyle = '#ec8aaa'; [[30, 120], [222, 90], [140, 236]].forEach(([a, b]) => { x.beginPath(); x.ellipse(a, b, 9, 13, 0.6, 0, Math.PI * 2); x.fill(); });
  void w;
});
const glowTex = canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
function glow(x, y, z, size, color = '#ffb46b', op = 0.85) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: op }));
  s.position.set(x, y, z); s.scale.setScalar(size); world.add(s); return s;
}

/* ---------- les cerisiers ---------- */
const BLOOM = []; const SAKURA_SPOTS = [];
const BARK = '#3b2d2b';
function sakura(x, z, s = 1, depthMax = 3, lean = 0) {
  const y0 = groundH(x, z) - 0.15; SAKURA_SPOTS.push([x, z, s]);
  const branch = (p, dir, len, r, depth) => {
    const pts = [p.clone()], q = p.clone(), dv = dir.clone();
    for (let k = 0; k < 3; k++) {
      dv.add(new THREE.Vector3(rr(-0.35, 0.35), rr(-0.18, 0.28) + (depth > 1 ? 0.05 : 0.12), rr(-0.35, 0.35))).normalize();
      q.addScaledVector(dv, len / 3); pts.push(q.clone());
    }
    add('solid', taperTube(pts, r, r * 0.6, depth < 2 ? 9 : 6, depth < 2 ? 10 : 6), null, BARK, depth < 2 ? 0.55 : 0.9, x, { vary: 0.06 });
    if (depth >= depthMax || r < 0.03 * s) {
      const n = Math.round((depthMax >= 4 ? 34 : 24) * (small ? 0.6 : 1));
      for (let k = 0; k < n; k++) {
        const t = rnd() ** 0.6, a = pts[Math.min(3, Math.floor(t * 3) + 1)];
        BLOOM.push({ x: a.x + rr(-1, 1) * 0.75 * s, y: a.y + rr(-0.45, 0.85) * 0.6 * s, z: a.z + rr(-1, 1) * 0.75 * s, size: rr(0.42, 0.7) * Math.sqrt(s), cx: x });
      }
      return;
    }
    const kids = depth === 0 ? 3 : rnd() < 0.55 ? 2 : 3;
    for (let c = 0; c < kids; c++) {
      const from = pts[c === 0 ? 3 : 2 + Math.floor(rnd() * 2)];
      const out = new THREE.Vector3(Math.cos(c * 2.1 + rnd()), 0, Math.sin(c * 2.1 + rnd()));
      const nd = dir.clone().multiplyScalar(0.55).add(out.multiplyScalar(rr(0.55, 0.95))).add(new THREE.Vector3(0, rr(0.05, 0.35), 0)).normalize();
      branch(from, nd, len * rr(0.66, 0.8), r * 0.62, depth + 1);
    }
  };
  branch(new THREE.Vector3(x, y0, z), new THREE.Vector3(lean, 1, rr(-0.15, 0.15)).normalize(), 2.3 * s, 0.26 * s, 0);
}

/* ---------- les pins noirs (coussins de neige) ---------- */
const PAD = (() => { const g = new THREE.SphereGeometry(1, 16, 9); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (noise(p.getX(i) * 3 + 5, p.getZ(i) * 3) - 0.5) * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
const NEEDLE = [];
function tufts(cx, cy, cz, ax, ay, az, x0) {                  // des touffes d’aiguilles sur le dessus et les côtés d’un coussin
  const n = small ? 5 : 11;
  for (let k = 0; k < n; k++) {
    const a = rnd2() * TAU, el = Math.acos(1 - rnd2() * 1.12), sx = Math.sin(el) * Math.cos(a), sy = Math.cos(el), sz = Math.sin(el) * Math.sin(a);
    NEEDLE.push({ x: cx + sx * ax * 0.98, y: cy + sy * ay * 1.05 + 0.04, z: cz + sz * az * 0.98, size: rr2(0.62, 0.95) * (ax + az) * 0.42, cx: x0 });
  }
}
function pine(x, z, s = 1) {
  const y0 = groundH(x, z) - 0.1, lean = rr(-0.5, 0.5);
  const pts = [new THREE.Vector3(x, y0, z), new THREE.Vector3(x + lean * 0.4 * s, y0 + 1.6 * s, z), new THREE.Vector3(x + lean * 1.1 * s, y0 + 3.2 * s, z + rr(-0.3, 0.3)), new THREE.Vector3(x + lean * 0.8 * s, y0 + 4.6 * s, z)];
  add('solid', taperTube(pts, 0.24 * s, 0.07 * s, 8, 10), null, '#3a302c', 0.5, x, { vary: 0.05 });
  const curve = new THREE.CatmullRomCurve3(pts);
  const pads = 4 + Math.floor(rnd() * 3);
  for (let k = 0; k < pads; k++) {
    const t = 0.35 + (k / pads) * 0.68, a = curve.getPointAt(Math.min(1, t)), side = k % 2 ? 1 : -1, reach = (1.6 - t) * 1.3 * s;
    const end = a.clone().add(new THREE.Vector3(side * reach, rr(0.1, 0.5) * s, rr(-0.6, 0.6) * s));
    add('solid', taperTube([a, a.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.25 * s, 0)), end], 0.07 * s, 0.03 * s, 5, 5), null, '#3a302c', 0.6, x);
    const ps = (1.15 - t * 0.45) * s;
    for (let c = 0; c < 3; c++) {
      const px = end.x + rr(-0.5, 0.5) * ps, py = end.y + rr(-0.05, 0.12) * ps, pz = end.z + rr(-0.4, 0.4) * ps, ro = rr(0, 3), ax = ps * rr(0.7, 1.0), ay = ps * rr(0.3, 0.4), az = ps * rr(0.6, 0.85);
      add('solid', PAD, mx(px, py, pz, 0, ro, 0, ax, ay, az), '#2c4737', 1, x, { vary: 0.08 }); tufts(px, py, pz, ax, ay, az, x);
    }
  }
  add('solid', PAD, mx(pts[3].x, pts[3].y + 0.2 * s, pts[3].z, 0, rr(0, 3), 0, 0.9 * s, 0.4 * s, 0.8 * s), '#2c4737', 1, x, { vary: 0.08 });
  tufts(pts[3].x, pts[3].y + 0.2 * s, pts[3].z, 0.9 * s, 0.4 * s, 0.8 * s, x);
}

/* ---------- pierres, lanternes de pierre, lanternes de papier ---------- */
const ROCK = (() => {
  const g = new THREE.SphereGeometry(1, 24, 15), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.74 + 0.4 * noise(x * 1.5 + 9, y * 1.5 + z * 1.2) + 0.14 * noise(x * 4.2 + z * 3, y * 4.2 + 2); p.setXYZ(i, x * k, y * k * 0.7, z * k); }
  g.computeVertexNormals(); return g;
})();
const STONE = '#8d8984';
function rock(x, z, s = 1) {
  const ry = rr(0, 6), sx = s * rr(0.8, 1.3), sy = s * rr(0.6, 0.9);                     // (mêmes tirages qu’avant : le décor ne bouge pas)
  if (JP) { addModel('Rocher' + (1 + Math.floor(hash2(x * 7.3, z * 3.1) * 3)), mx(x, groundH(x, z) - 0.03 * s, z, 0, ry, 0, sx * 0.95, sy * 1.3, s * 0.95), x, { pierre: ['solid', '#77736f', 1, { vary: 0.1 }] }); return; }
  add('solid', ROCK, mx(x, groundH(x, z) + 0.15 * s, z, 0, ry, 0, sx, sy, s), '#77736f', 1, x, { vary: 0.1 });
}
function toro(x, z, s = 1, lit = true) {
  const y = groundH(x, z);
  if (JP) {                                                    // la lanterne de pierre modélisée (kasuga-dōrō), tournée un peu différemment à chaque fois
    const k = s * 0.92; addModel('Toro', mx(x, y - 0.02, z, 0, 0.3 + hash2(x * 3.7, z * 9.1) * 1.05, 0, k), x);
    if (lit) FLICKER.push({ s: glow(x, y + 1.5 * k, z + 0.05, 1.8 * s, '#ffa860', 0.55), o: 0.55, ph: x * 1.7 + z });
    return;
  }
  add('solid', cyl(0.42, 0.5, 0.22, 6), mx(x, y + 0.11 * s, z, 0, 0.3, 0, s), STONE, 1, x);
  add('solid', cyl(0.13, 0.16, 0.9, 10), mx(x, y + 0.67 * s, z, 0, 0, 0, s), STONE, 1, x);
  add('solid', cyl(0.42, 0.3, 0.18, 6), mx(x, y + 1.2 * s, z, 0, 0.3, 0, s), STONE, 1, x);
  add('solid', BOX, mx(x, y + 1.5 * s, z, 0, 0.3, 0, 0.44 * s, 0.4 * s, 0.44 * s), STONE, 0.6, x);
  if (lit) {
    add('glow', BOX, mx(x, y + 1.5 * s, z, 0, 0.3, 0, 0.3 * s, 0.26 * s, 0.47 * s), '#ffc77a', 0, x, { mul: 2.4 });
    add('glow', BOX, mx(x, y + 1.5 * s, z, 0, 0.3, 0, 0.47 * s, 0.26 * s, 0.3 * s), '#ffc77a', 0, x, { mul: 2.4 });
    glow(x, y + 1.5 * s, z + 0.05, 1.8 * s, '#ffa860', 0.55);
  }
  add('solid', cyl(0.07, 0.66, 0.34, 6), mx(x, y + 1.88 * s, z, 0, 0.3, 0, s), STONE, 1, x);
  add('solid', new THREE.SphereGeometry(0.11, 10, 8), mx(x, y + 2.1 * s, z, 0, 0, 0, s), STONE, 1, x);
}
function paperLanterns(x0, x1, z, h, n, color = '#ff5b3a') {
  const y0 = groundH(x0, z), y1 = groundH(x1, z);
  [x0, x1].forEach((px, k) => add('solid', cyl(0.08, 0.1, h + 0.4, 8), mx(px, (k ? y1 : y0) + (h + 0.4) / 2, z, 0, 0, 0), '#3a2b25', 1, px));
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(lerp(x0, x1, t), lerp(y0, y1, t) + h + 0.3 - Math.sin(t * Math.PI) * 0.55, z)); }
  add('solid', taperTube(pts, 0.018, 0.018, 4, 24), null, '#2a2222', 0, x0);
  const curve = new THREE.CatmullRomCurve3(pts);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = curve.getPointAt(t), cy = p.y - 0.55, col = i % 3 === 1 ? '#ffd9a2' : color;
    if (JP) { hang(p.x, cy, p.z, i * 1.7, 1, col, col === color ? '#ff6a3a' : '#ffbe70', 2.4, 0.75); continue; }
    else {
      add('solid', cyl(0.004, 0.004, 0.3, 3), mx(p.x, p.y - 0.15, p.z), '#2a2222', 0, p.x);
      add('glow', new THREE.SphereGeometry(0.27, 16, 12), mx(p.x, cy, p.z, 0, 0, 0, 1, 1.3, 1), col, 0, p.x, { mul: 2.6 });
      add('solid', cyl(0.17, 0.17, 0.07, 12), mx(p.x, cy + 0.36, p.z), '#1d1717', 1, p.x);
      add('solid', cyl(0.17, 0.17, 0.07, 12), mx(p.x, cy - 0.36, p.z), '#1d1717', 0, p.x);
    }
    glow(p.x, cy, p.z + 0.1, 2.4, col === color ? '#ff6a3a' : '#ffbe70', 0.75);
  }
}

/* ---------- toits japonais : bords relevés aux coins, pente creusée ---------- */
function roofGeo(bottom, top, h, lift = 0.4) {
  const g = new THREE.CylinderGeometry(top, bottom, h, 64, 6, false), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = clamp((y + h / 2) / h), r = Math.hypot(x, z);
    if (r > 1e-4) {
      const a = Math.atan2(z, x), lin = top + (bottom - top) * (1 - t), want = top + (bottom - top) * Math.pow(1 - t, 1.9);
      const k = (want / Math.max(lin, 1e-4)) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      x *= k; z *= k;
      const corner = clamp((1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) - 1) / 0.4142);
      y += lift * corner * corner * Math.pow(1 - t, 3);
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- les grands lieux ---------- */
const RED = '#c2412d', DARK = '#2b211e', WOOD = '#4a3429';
// chaque pièce d’un modèle porte le nom de sa matière : [lot, couleur, neige, options]
const PM = {
  rouge: ['gloss', RED, 0.55], noir: ['solid', DARK, 0.9], pierre: ['solid', STONE, 1, { vary: 0.07 }], paille: ['solid', '#cbb07a', 0.45, { vary: 0.1 }],
  papier: ['solid', '#f6f6f0', 0], or: ['gloss', '#c9973c', 0.15], bronze: ['gloss', '#8a6f3e', 0.45], neige: ['solid', '#f6f7fb', 0, { aoK: 0.4 }],
  bois: ['solid', WOOD, 0.9], bois_clair: ['solid', '#8a6a48', 0.8, { vary: 0.08 }], plancher: ['solid', WOOD, 0.8, { vary: 0.07 }], platre: ['solid', '#efe5d3', 0.25],
  porte: ['gloss', '#7a2a1e', 0], vert: ['solid', '#3f6b54', 0], tuile: ['solid', '#2f2a2a', 1], chaume: ['solid', '#6a5a46', 1, { vary: 0.08 }],
  glace: ['gloss', '#cfe6f5', 0, { aoK: 0.3 }], lumiere: ['glow', '#ffc77a', 0, { mul: 2.4, glow: true }],
};
function addModel(name, m, x, over = {}) {
  for (const part of JP[name]) { const [kind, color, snow, opt] = over[part.mat] || PM[part.mat] || PM.pierre; add(kind, part.geo, m, color, snow, x, { ...(opt || {}), baked: true }); }
}
const SWAY = [], FLICKER = [];
function hang(x, y, z, ry, s, col, glowCol, glowSize, glowOp) { // une lanterne de papier suspendue à son fil : elle se balance doucement au vent
  const grp = new THREE.Group(), by = {}; grp.position.set(x, y + 0.56 * s, z);
  for (const part of JP.Chochin) {
    const [kind, color, snow, opt] = part.mat === 'lumiere' ? ['glow', col, 0, { mul: 2.6, glow: true }] : PM[part.mat];
    (by[kind] = by[kind] || []).push(colored(part.geo, mx(0, -0.56 * s, 0, 0, ry, 0, s), color, snow, { ...(opt || {}), baked: true }));
  }
  for (const kind in by) { const m = new THREE.Mesh(geoOf(by[kind]), MATS[kind]); m.castShadow = kind !== 'glow'; grp.add(m); }
  const sp = glow(0, 0, 0, glowSize, glowCol, glowOp); sp.position.set(0, -0.56 * s, 0.1); grp.add(sp);
  world.add(grp); SWAY.push({ grp, ph: x * 0.37 + z * 0.11 });
}
function torii(x, z, s = 1) {
  if (JP) { addModel('Torii', mx(x, Math.min(groundH(x - 2.6 * s, z), groundH(x + 2.6 * s, z)), z, 0, 0, 0, s), x); return; }
  const y = groundH(x, z), H = 6.2 * s, half = 2.6 * s;
  [-1, 1].forEach((k) => {
    add('gloss', cyl(0.3 * s, 0.36 * s, H, 20), mx(x + k * half, y + H / 2, z), RED, 0.4, x);
    add('solid', cyl(0.4 * s, 0.4 * s, 0.5 * s, 20), mx(x + k * half, y + 0.25 * s, z), DARK, 0.9, x);
  });
  add('gloss', BOX, mx(x, y + H * 0.74, z, 0, 0, 0, half * 2 + 1.4 * s, 0.38 * s, 0.32 * s), RED, 0.7, x);   // nuki
  add('gloss', BOX, mx(x, y + H * 0.86, z, 0, 0, 0, 0.32 * s, H * 0.18, 0.24 * s), RED, 0.5, x);           // gakuzuka
  const beam = (yy, hh, dd, len, col, snow, up) => {
    const g = new THREE.BoxGeometry(len, hh, dd, 30, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (len / 2); p.setY(i, p.getY(i) + up * Math.pow(Math.abs(u), 3)); }
    g.computeVertexNormals();
    add(col === RED ? 'gloss' : 'solid', g, mx(x, y + yy, z), col, snow, x);
  };
  beam(H + 0.05 * s, 0.42 * s, 0.6 * s, half * 2 + 3.2 * s, RED, 0, 0.45 * s);          // shimaki
  beam(H + 0.42 * s, 0.34 * s, 0.75 * s, half * 2 + 3.8 * s, DARK, 1, 0.62 * s);        // kasagi, noir, sous la neige
  beam(H + 0.66 * s, 0.14 * s, 0.7 * s, half * 2 + 3.5 * s, '#f6f7fb', 0, 0.62 * s);     // la neige posée dessus
  // la corde de paille (shimenawa) et ses papiers blancs pliés en zigzag
  const ropeY = y + H * 0.665, rp = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; rp.push(new THREE.Vector3(x - half + t * half * 2, ropeY - Math.sin(t * Math.PI) * 0.42 * s, z + 0.36 * s)); }
  add('solid', taperTube(rp, 0.085 * s, 0.085 * s, 8, 36), null, '#cbb07a', 0.45, x, { vary: 0.1 });
  [0.2, 0.4, 0.6, 0.8].forEach((t) => {
    const px = x - half + t * half * 2, py = ropeY - Math.sin(t * Math.PI) * 0.42 * s;
    for (let j = 0; j < 3; j++) add('solid', BOX, mx(px + (j % 2 ? 0.07 : -0.07) * s, py - (0.2 + j * 0.2) * s, z + 0.38 * s, 0, 0, j % 2 ? -0.55 : 0.55, 0.2 * s, 0.2 * s, 0.012), '#f6f6f0', 0, x);
  });
}
function pagoda(x, z) {
  if (JP) {                                                    // la pagode modélisée : un socle et une flèche, plus un quart répété quatre fois
    const S = 0.84, y0 = groundH(x, z + 3.1);
    addModel('Pagode', mx(x, y0, z, 0, 0, 0, S), x);
    for (let q = 0; q < 4; q++) addModel('PagodeQ', mx(x, y0, z, 0, (q * Math.PI) / 2, 0, S), x);
    return;
  }
  const y = groundH(x, z);
  add('solid', BOX, mx(x, y + 0.35, z, 0, 0, 0, 7.4, 1.0, 7.4), '#7d7873', 1, x);                     // socle de pierre
  for (let k = 0; k < 4; k++) add('solid', BOX, mx(x, y - 0.1 + k * 0.2, z + 4.3 + (3 - k) * 0.45, 0, 0, 0, 3, 0.2, 0.45), '#8a8580', 1, x);   // marches
  let yy = y + 0.85;
  for (let i = 0; i < 5; i++) {
    const w = 3.5 - i * 0.42, bh = i === 0 ? 1.55 : 0.95;
    add('gloss', BOX, mx(x, yy + bh / 2, z, 0, 0, 0, w, bh, w), RED, 0, x);
    add('gloss', BOX, mx(x, yy + bh * 0.45, z + w / 2 + 0.012, 0, 0, 0, w * 0.34, bh * 0.66, 0.03), '#8e2f22', 0, x);
    [-1, 1].forEach((k) => add('solid', BOX, mx(x + k * (w / 2 - 0.06), yy + bh / 2, z + w / 2 + 0.02, 0, 0, 0, 0.1, bh, 0.06), '#5a2a1f', 0, x));
    add('solid', BOX, mx(x, yy + bh + 0.06, z, 0, 0, 0, w + 0.5, 0.12, w + 0.5), '#3a2a24', 0.3, x);       // la corniche
    [-1, 1].forEach((k) => {                                                       // panneaux de plâtre et croisillons, de part et d’autre de la porte
      add('solid', BOX, mx(x + k * w * 0.31, yy + bh * 0.5, z + w / 2 + 0.012, 0, 0, 0, w * 0.2, bh * 0.52, 0.03), '#efe5d3', 0, x);
      add('solid', BOX, mx(x + k * w * 0.31, yy + bh * 0.5, z + w / 2 + 0.03, 0, 0, 0, 0.03, bh * 0.52, 0.02), '#5a2a1f', 0, x);
      add('solid', BOX, mx(x + k * w * 0.31, yy + bh * 0.5, z + w / 2 + 0.03, 0, 0, 0, w * 0.2, 0.03, 0.02), '#5a2a1f', 0, x);
      add('solid', BOX, mx(x + k * (w / 2 + 0.012), yy + bh * 0.5, z, 0, 0, 0, 0.03, bh * 0.52, w * 0.5), '#efe5d3', 0, x);
    });
    if (i > 0) {                                                                   // le balcon : une rambarde laquée
      const rwid = w + 0.42, ry = yy + 0.3;
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([ax, az]) => add('gloss', BOX, mx(x + ax * rwid / 2, ry, z + az * rwid / 2, 0, 0, 0, ax ? 0.05 : rwid, 0.05, az ? 0.05 : rwid), RED, 0.6, x));
      [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [1, 0], [-1, 0]].forEach(([sx, sz]) => add('gloss', BOX, mx(x + sx * rwid / 2, ry - 0.14, z + sz * rwid / 2, 0, 0, 0, 0.06, 0.34, 0.06), RED, 0.5, x));
    }
    yy += bh;
    const rw = w * 0.5 + 1.55, rh = 0.62, rtop = w * 0.3;
    add('solid', roofGeo(rw, rtop, rh, 0.55), mx(x, yy + rh / 2, z), '#2f2a2a', 1, x);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {                   // les arêtes du toit, et une clochette à chaque coin
      const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8, want = rtop + (rw - rtop) * Math.pow(1 - t, 1.9); pts.push(new THREE.Vector3(x + sx * want, yy + t * rh + 0.55 * Math.pow(1 - t, 3) + 0.03, z + sz * want)); }
      add('solid', taperTube(pts, 0.085, 0.05, 6, 16), null, '#262222', 1, x);
      add('solid', cyl(0.007, 0.007, 0.22, 4), mx(pts[0].x, pts[0].y - 0.13, pts[0].z), '#2a2222', 0, x);
      add('gloss', new THREE.SphereGeometry(0.075, 10, 8), mx(pts[0].x, pts[0].y - 0.27, pts[0].z, 0, 0, 0, 1, 1.25, 1), '#c9973c', 0, x);
    });
    yy += rh * 0.5;
  }
  add('solid', cyl(0.06, 0.09, 3.6, 8), mx(x, yy + 1.8, z), '#6b5a3a', 0, x);
  for (let k = 0; k < 9; k++) add('solid', new THREE.TorusGeometry(0.2 - k * 0.006, 0.04, 6, 16), mx(x, yy + 0.6 + k * 0.28, z, Math.PI / 2), '#7b6640', 0, x);
  add('solid', new THREE.SphereGeometry(0.14, 10, 8), mx(x, yy + 3.65, z), '#9a7c40', 0, x);
}
function bridge(x, z) {
  if (JP) { addModel('Pont', mx(x, -0.25, z), x); return; }
  const L = 17.4, W = 2.4, H = 2.7, y = -0.25;
  const arch = (u) => H * (1 - u * u);
  const deck = new THREE.BoxGeometry(L, 0.28, W, 40, 1, 1), p = deck.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + arch(p.getX(i) / (L / 2)));
  deck.computeVertexNormals();
  add('solid', deck, mx(x, y, z), WOOD, 1, x);
  [-1, 1].forEach((side) => {
    const top = [];
    for (let k = 0; k <= 8; k++) {
      const u = -1 + (k / 8) * 2, px = x + u * (L / 2) * 0.96, py = y + arch(u * 0.96) + 0.1;
      add('gloss', cyl(0.07, 0.07, 1.0, 8), mx(px, py + 0.5, z + side * (W / 2 - 0.1)), RED, 0.5, x);
      if (k === 0 || k === 8) { add('gloss', cyl(0.11, 0.11, 1.1, 10), mx(px, py + 0.55, z + side * (W / 2 - 0.1)), RED, 0.5, x); add('solid', new THREE.SphereGeometry(0.15, 10, 8), mx(px, py + 1.2, z + side * (W / 2 - 0.1), 0, 0, 0, 1, 1.4, 1), '#b88a3a', 0.6, x); }
      top.push(new THREE.Vector3(px, py + 1.0, z + side * (W / 2 - 0.1)));
    }
    add('gloss', taperTube(top, 0.07, 0.07, 6, 40), null, RED, 0.9, x);
    const mid = top.map((v) => v.clone().add(new THREE.Vector3(0, -0.45, 0)));
    add('gloss', taperTube(mid, 0.045, 0.045, 5, 40), null, RED, 0.6, x);
  });

}
const shojiTex = canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = '#ffe1b0'; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, w * 0.6); g.addColorStop(0, 'rgba(255,190,110,0.5)'); g.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#3a2a22';
  for (let i = 0; i <= 8; i++) x.fillRect((i * w) / 8 - 3, 0, 6, h);
  for (let j = 0; j <= 4; j++) x.fillRect(0, (j * h) / 4 - 2, w, 4);
  for (let i = 0; i < 16; i++) x.fillRect((i * w) / 16 - 1, 0, 2, h);
});
function teahouse(x, z) {
  if (JP) {                                                    // la maison de thé modélisée, une lanterne de papier sous l’avant-toit
    const y0 = Math.min(groundH(x - 4.5, z + 3), groundH(x + 4.5, z + 3), groundH(x - 4.5, z - 3), groundH(x + 4.5, z - 3), groundH(x, z + 4.3));
    addModel('Maison', mx(x, y0, z), x, { lumiere: ['glow', '#ffdcae', 0, { mul: 1.9, glow: true }] });
    hang(x + 5.3, y0 + 2.08, z + 3.95, 0.4, 0.95, '#ffd9a2', '#ffbe70', 2.2, 0.7);
    glow(x, y0 + 1.9, z + 3.6, 9, '#ffb56a', 0.35);
    toro(x - 7.4, z + 3.2, 0.9); toro(x + 6.7, z + 4.4, 0.9);
    return;
  }
  const y = groundH(x, z), W = 9, D = 6, H = 2.6;
  add('solid', BOX, mx(x, y + 0.3, z, 0, 0, 0, W + 1.2, 0.6, D + 1.2), '#77726c', 1, x);
  add('solid', BOX, mx(x, y + 0.62, z + D / 2 + 0.45, 0, 0, 0, W + 0.6, 0.12, 0.9), WOOD, 1, x);            // engawa
  add('solid', BOX, mx(x, y + 0.6 + H / 2, z - 0.1, 0, 0, 0, W, H, D - 0.2), '#4b3a30', 0, x);
  for (let k = -2; k <= 2; k++) add('solid', BOX, mx(x + k * (W / 4), y + 0.6 + H / 2, z + D / 2 - 0.1, 0, 0, 0, 0.18, H, 0.18), DARK, 0, x);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, H - 0.3), new THREE.MeshBasicMaterial({ map: shojiTex, color: new THREE.Color(1.9, 1.75, 1.55) }));
  front.position.set(x, y + 0.6 + H / 2, z + D / 2 - 0.18); world.add(front);
  const rf = roofGeo(D * 0.5 + 1.4, 0.45, 1.9, 0.35); rf.scale(1.55, 1, 1);
  add('solid', rf, mx(x, y + 0.6 + H + 0.85, z), '#2e2a29', 1, x);
  glow(x, y + 1.9, z + D / 2 + 0.6, 9, '#ffb56a', 0.35);
  [-1, 1].forEach((k) => toro(x + k * 6.4, z + 4.2, 0.9));
}
function fence(x0, x1, z) {
  for (let x = x0; x < x1; x += 2.1) {
    const y = groundH(x, z);
    add('solid', cyl(0.06, 0.07, 1.15, 7), mx(x, y + 0.55, z), '#5a4634', 0.9, x0);
  }
  [0.45, 0.9].forEach((hh) => {
    const pts = []; for (let x = x0; x <= x1; x += 3) pts.push(new THREE.Vector3(x, groundH(x, z) + hh, z + 0.02));
    if (pts.length > 1) add('solid', taperTube(pts, 0.045, 0.045, 6, pts.length * 3), null, '#c3ab72', 0.85, x0);
  });
}

/* ---------- le décor : les cinq arrêts, puis ce qu’il y a entre ---------- */
const JP = await modelsP;
clearInterval(preTimer);
// 0 · l’entrée
torii(SUBJ[0], -11, 1);
[[SUBJ[0] - 4.2, -8.5], [SUBJ[0] + 4.2, -8.5], [SUBJ[0] - 2.4, -18], [SUBJ[0] + 2.4, -18], [SUBJ[0] - 2.2, -27], [SUBJ[0] + 2.2, -27]].forEach(([a, b]) => toro(a, b, 0.95));
sakura(SUBJ[0] - 8.5, -15, 1.25, 4, 0.2); sakura(SUBJ[0] + 9, -16, 1.35, 4, -0.2); pine(SUBJ[0] + 14, -10, 1.1);
// 1 · Mamoudou : le grand cerisier et ses lanternes rouges
sakura(SUBJ[1] + 1, -14, 2.0, 4, -0.1);
paperLanterns(SUBJ[1] - 6, SUBJ[1] + 7, -6.5, 2.4, 6);
toro(SUBJ[1] - 3.2, -12, 1); toro(SUBJ[1] + 8, -11, 0.9);
rock(SUBJ[1] - 3, -8, 0.8); rock(SUBJ[1] + 4, -9, 0.6); rock(SUBJ[1] + 10, -13, 1.1);
// 2 · Michal : la pagode sur sa butte
pagoda(SUBJ[2] + 1, -24);
toro(SUBJ[2] - 3, -14, 1); toro(SUBJ[2] + 5, -14, 1);
pine(SUBJ[2] - 8, -21, 1.25); pine(SUBJ[2] + 10, -22, 1.15); sakura(SUBJ[2] + 13, -31, 1.4, 4);
// 3 · Adam : le pont sur l’étang gelé
bridge(SUBJ[3] + 1.5, -13);
sakura(SUBJ[3] + 8, -21, 1.6, 4, -0.35); sakura(SUBJ[3] - 9, -20, 1.2, 3, 0.3);
toro(SUBJ[3] - 11, -4, 0.9); toro(SUBJ[3] + 11.5, -5, 0.9); rock(SUBJ[3] - 10.5, -0.5, 0.7); rock(SUBJ[3] + 9.5, -23, 1);
const ICE_Y = -0.3;
const iceTex = canvasTex(512, 512, (x, w) => {
  const im = x.createImageData(w, w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) { const n = fbm(i * 0.02, j * 0.02), m = fbm(i * 0.11 + 9, j * 0.11); const o = (j * w + i) * 4; im.data[o] = 255 * n; im.data[o + 1] = 255 * m; im.data[o + 2] = 128; im.data[o + 3] = 255; }
  x.putImageData(im, 0, 0);
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.2;                  // fissures fines dans la glace
  for (let k = 0; k < 26; k++) { let px = rnd() * w, py = rnd() * w, a = rnd() * 6.3; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 9; s++) { a += rr(-0.6, 0.6); px += Math.cos(a) * 14; py += Math.sin(a) * 14; x.lineTo(px, py); } x.stroke(); }
}, false);
iceTex.wrapS = iceTex.wrapT = THREE.RepeatWrapping;
const reflRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const ice = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.ShaderMaterial({
  uniforms: { tRefl: { value: reflRT.texture }, tIce: { value: iceTex }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tRefl, tIce; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec4 f = texture2D(tIce, vUv * 2.2);
      vec2 suv = gl_FragCoord.xy / uRes + vec2((f.r - 0.5) * 0.006, (f.g - 0.5) * 0.004);
      vec3 refl = texture2D(tRefl, suv).rgb;
      vec3 base = vec3(0.55, 0.66, 0.8);
      vec3 c = mix(base, refl * vec3(0.86, 0.92, 1.0), 0.72) * (0.92 + f.g * 0.16);
      c += vec3(0.9) * step(0.99, f.b) * 0.0;
      float r = length(vUv - 0.5) * 2.0;
      c = mix(c, vec3(0.9, 0.92, 0.97), smoothstep(0.8, 1.0, r) * 0.9);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
}));
ice.rotation.x = -Math.PI / 2; ice.position.set(POND.x, ICE_Y, POND.z); ice.scale.set(POND.rx * 1.06, POND.rz * 1.06, 1); scene.add(ice);
// 4 · la maison de thé
teahouse(SUBJ[4] + 1, -15);
sakura(SUBJ[4] - 9, -17, 1.4, 4, 0.2); pine(SUBJ[4] + 12, -14, 1.2);

// des pierres plates qui mènent à chaque lieu, et des buissons ronds sous la neige
const STEP = (() => {                                          // une pierre plate aux bords usés
  const g = new THREE.SphereGeometry(1, 22, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 0.4 * (0.84 + noise(a * 1.6 + 3, 1) * 0.34); p.setXYZ(i, x * k, Math.sign(y) * Math.pow(Math.abs(y), 0.42) * 0.075 + (noise(x * 4, z * 4) - 0.5) * 0.02, z * k); }
  g.computeVertexNormals(); return g;
})();
SUBJ.forEach((sx, i) => {
  const tz = [-10, -9, -15, -5, -10][i];
  for (let k = 0; k < 8; k++) {
    const t = k / 7, z = lerp(4.6, tz, t), x = sx - 5 + 5 * t + Math.sin(t * 3 + i) * 1.2;
    if (pondE(x, z) < 1.12) continue;
    add('solid', STEP, mx(x, groundH(x, z) + 0.015, z, rr(-0.04, 0.04), rr(0, 3), rr(-0.04, 0.04), rr(0.75, 1.05), 0.8, rr(0.7, 0.95)), '#7a7570', 0.42, x, { vary: 0.1 });
  }
});
for (let x = -50; x < 300; x += rr(3.5, 7.5)) {
  const z = rr(-7.5, -0.8); if (SUBJ.some((s) => Math.abs(x - s) < 7) || pondE(x, z) < 1.25) continue;
  const s = rr(0.28, 0.55);
  add('solid', PAD, mx(x, groundH(x, z) + 0.18 * s, z, 0, rr(0, 3), 0, s * rr(1, 1.6), s * 0.75, s), '#3d5642', 1, x, { vary: 0.1 });
  if (rnd() < 0.4) add('solid', PAD, mx(x + 0.7 * s, groundH(x, z) + 0.12 * s, z + 0.3, 0, rr(0, 3), 0, s * 0.8, s * 0.6, s * 0.7), '#3d5642', 1, x, { vary: 0.1 });
}

// entre les arrêts : cerisiers, pins, rochers, lanternes, et au premier plan une clôture qui défile
const clear = (x, z) => SUBJ.some((s) => Math.abs(x - s) < 11 && z > -30);
for (let x = -60; x < 320; x += rr(4.5, 8)) {
  const z = rr(-52, -9);
  if (clear(x, z)) continue;
  if (rnd() < 0.58) sakura(x, z, rr(0.9, 1.35), 3, rr(-0.3, 0.3)); else pine(x, z, rr(0.9, 1.3));
  if (rnd() < 0.35) rock(x + rr(-3, 3), z + rr(2, 5), rr(0.5, 1.1));
}
for (let x = -60; x < 320; x += rr(10, 16)) { const z = rr(-62, -38); if (!clear(x, z)) pine(x, z, rr(1.2, 1.6)); }
STOPS.forEach((s, i) => {
  if (i < STOPS.length - 1) {
    fence(s + 13, s + 47, 1.4);
    toro(s + 30, -4, 0.85, true);
    sakura(s + rr(20, 26), rr(1.2, 2.2), rr(1.3, 1.6), 3, rr(-0.2, 0.2));        // tout près : il passe en flou
    sakura(s + rr(38, 44), rr(-1, 0.5), rr(1.1, 1.4), 3, rr(-0.2, 0.2));
  }
});
fence(-60, -13, 1.4);

/* ---------- les fleurs et les aiguilles (une instance = un petit bouquet) ---------- */
const needleTex = canvasTex(256, 256, (x, w, h) => {            // une touffe d’aiguilles vue de côté, la neige posée dessus
  const ox = w / 2, oy = h * 0.74;
  for (let k = 0; k < 150; k++) {
    const a = -Math.PI * (0.03 + 0.94 * rnd2()), L = w * (0.24 + 0.24 * rnd2()), g = 52 + Math.floor(rnd2() * 62);
    x.strokeStyle = `rgb(${Math.floor(g * 0.38)},${g},${Math.floor(g * 0.6)})`; x.lineWidth = 1.6 + rnd2() * 1.5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(ox + rr2(-9, 9), oy + rr2(-5, 5)); x.quadraticCurveTo(ox + Math.cos(a) * L * 0.5, oy + Math.sin(a) * L * 0.5 - 7, ox + Math.cos(a) * L, oy + Math.sin(a) * L); x.stroke();
  }
  for (let k = 0; k < 16; k++) { const a = Math.PI * (0.1 + 0.8 * rnd2()), L = w * (0.1 + 0.12 * rnd2()); x.strokeStyle = 'rgb(20,48,32)'; x.lineWidth = 2; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + Math.cos(a) * L, oy + Math.sin(a) * L); x.stroke(); }
  for (let k = 0; k < 26; k++) {                                // la neige : des paquets posés sur le haut de la touffe
    const a = -Math.PI * (0.2 + 0.6 * rnd2()), r = w * (0.2 + 0.2 * rnd2()), px = ox + Math.cos(a) * r, py = oy + Math.sin(a) * r;
    x.fillStyle = 'rgba(201,212,232,0.9)'; x.beginPath(); x.ellipse(px, py + 3, rr2(13, 23), rr2(6, 10), rr2(-0.4, 0.4), 0, TAU); x.fill();
    x.fillStyle = 'rgba(250,251,255,0.97)'; x.beginPath(); x.ellipse(px, py, rr2(12, 22), rr2(5, 9), rr2(-0.4, 0.4), 0, TAU); x.fill();
  }
});
function cards(list, tex, pal, { emissive = null, shadow = true, orient, rng } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: small ? 0.42 : 0.16, alphaToCoverage: !small, side: THREE.DoubleSide, roughness: 0.8 });
  if (emissive) { mat.emissive = new THREE.Color(emissive); mat.emissiveMap = tex; mat.emissiveIntensity = 0.32; }
  const depthMat = shadow ? new THREE.MeshDepthMaterial({ map: tex, alphaTest: 0.42, depthPacking: THREE.RGBADepthPacking }) : null;
  const PAL = pal.map((c) => new THREE.Color(c));
  const byChunk = new Map(); list.forEach((b) => { const k = chunkOf(b.cx); if (!byChunk.has(k)) byChunk.set(k, []); byChunk.get(k).push(b); });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  byChunk.forEach((l) => {
    const im = new THREE.InstancedMesh(geo, mat, l.length);
    l.forEach((b, i) => { orient(e); q.setFromEuler(e); m4.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.size, b.size, b.size)); im.setMatrixAt(i, m4); im.setColorAt(i, PAL[Math.floor(rng() * PAL.length)]); });
    im.castShadow = shadow; im.receiveShadow = true; if (depthMat) im.customDepthMaterial = depthMat;
    im.computeBoundingSphere(); world.add(im);
  });
}
cards(BLOOM, blossomTex, ['#ffffff', '#ffe6ee', '#ffd3df', '#ffc4d4', '#ffeef3'], { emissive: '#ffb7c9', orient: (e) => e.set(rr(0, 6.3), rr(0, 6.3), rr(0, 6.3)), rng: rnd });
cards(NEEDLE, needleTex, ['#ffffff', '#e6f2e4', '#d3e6d2', '#f2f7ee'], { shadow: false, orient: (e) => e.set(rr2(-0.45, 0.25), rr2(-1.05, 1.05), rr2(-0.5, 0.5), 'YXZ'), rng: rnd2 });

/* ---------- le sol de neige (pétales tombés sous les cerisiers) ---------- */
{
  const g = new THREE.PlaneGeometry(560, 270, small ? 200 : 320, small ? 100 : 150); g.rotateX(-Math.PI / 2); g.translate(130, 0, -70);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const sn = new THREE.Color('#f6f6fb'), lav = new THREE.Color('#e4e5f1'), path = new THREE.Color('#dcdde6'), pink = new THREE.Color('#f7cfdb'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); p.setY(i, groundH(x, z));
    c.copy(sn).lerp(lav, noise(x * 0.3, z * 0.3) * 0.5);
    c.lerp(path, smooth(1.5, 0, Math.abs(z - 7.5) - 2.2) * 0.7);
    let pk = 0; for (const [sx, sz, ss] of SAKURA_SPOTS) { const dd = (x - sx) ** 2 + (z - sz) ** 2, R = 3.4 * ss; if (dd < R * R) pk = Math.max(pk, (1 - Math.sqrt(dd) / R) * noise(x * 2.3, z * 2.3)); }
    c.lerp(pink, clamp(pk * 1.3) * 0.85);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const nrm = canvasTex(256, 256, (x, w) => {                                  // grain de la neige : petites ondulations
    const H = new Float32Array(w * w); for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) H[j * w + i] = noise(i * 0.09, j * 0.09) * 0.6 + noise(i * 0.31 + 7, j * 0.31) * 0.4;
    const im = x.createImageData(w, w);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) { const dx = H[j * w + ((i + 1) % w)] - H[j * w + ((i + w - 1) % w)], dy = H[((j + 1) % w) * w + i] - H[((j + w - 1) % w) * w + i], o = (j * w + i) * 4; im.data[o] = 128 + dx * 160; im.data[o + 1] = 128 + dy * 160; im.data[o + 2] = 255; im.data[o + 3] = 255; }
    x.putImageData(im, 0, 0);
  }, false);
  nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(150, 72);
  const gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, normalMap: nrm, normalScale: new THREE.Vector2(0.55, 0.55) });
  gm.onBeforeCompile = (sh) => {                                    // paillettes : de minuscules cristaux qui scintillent quand on bouge
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nfloat jrH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }').replace('#include <dithering_fragment>', `#include <dithering_fragment>
      { vec2 cell = floor(vWP.xz * 24.0); float h = jrH(cell);
        float tw = fract(h * 91.7 + dot(cameraPosition.xz, vec2(0.31, 0.17)) * 0.7);
        float dist = length(vWP - cameraPosition);
        vec2 f = fract(vWP.xz * 24.0) - 0.5;
        float gl = step(0.9955, h) * smoothstep(0.8, 1.0, tw) * (1.0 - smoothstep(5.0, 24.0, dist)) * smoothstep(0.24, 0.0, length(f));
        gl_FragColor.rgb += vec3(2.8, 2.7, 2.6) * gl; }`);
  };
  const ground = new THREE.Mesh(g, gm);
  ground.receiveShadow = true; world.add(ground);
}

/* ---------- au loin : une vraie forêt de sapins enneigés, des bancs de brume ---------- */
{
  // quatre sapins dessinés branche par branche (tronc, branches tombantes, aiguilles, neige posée sur le dessus)
  const VAR = 4, TW = 256, TH = 512;
  const atlas = canvasTex(TW * VAR, TH, (x) => {
    for (let k = 0; k < VAR; k++) {
      const ox = k * TW, cx = ox + TW / 2, base = TH * 0.985, top = TH * (0.03 + rnd() * 0.05), H = base - top;
      x.strokeStyle = '#2a2320'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx, base); x.lineTo(cx, top + H * 0.05); x.stroke();
      const levels = 58;
      for (let i = 0; i < levels; i++) {
        const t = i / levels, y = base - H * 0.06 - t * H * 0.92, len = (TW * 0.47) * Math.pow(1 - t, 0.82) * (0.7 + rnd() * 0.45) + 5;
        for (const side of [-1, 1]) {
          const L = len * (0.8 + rnd() * 0.35), ex = cx + side * L, ey = y + L * (0.18 + rnd() * 0.12);
          const g = 30 + Math.floor(rnd() * 22), gg = 48 + Math.floor(rnd() * 26);
          x.strokeStyle = `rgb(${g * 0.55 | 0},${gg},${(g * 0.9) | 0})`; x.lineCap = 'round';
          x.lineWidth = 3.2 + (1 - t) * 3; x.beginPath(); x.moveTo(cx, y); x.quadraticCurveTo(cx + side * L * 0.5, y - L * 0.04, ex, ey); x.stroke();
          for (let s = 0; s < 14; s++) {                                       // aiguilles
            const u = 0.15 + (s / 14) * 0.85, px = cx + side * L * u, py = y + (ey - y) * u * u - L * 0.02 * Math.sin(u * 3);
            x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + side * rr(2, 6), py + rr(4, 11)); x.stroke();
          }
          x.strokeStyle = `rgba(${236 + rnd() * 16 | 0},${240 + rnd() * 12 | 0},250,${0.75 + rnd() * 0.25})`;            // la neige sur la branche
          x.lineWidth = 2 + (1 - t) * 3.2; x.beginPath();
          const s0 = 0.12 + rnd() * 0.15, s1 = 0.55 + rnd() * 0.4;
          for (let u = s0; u <= s1; u += 0.05) { const px = cx + side * L * u, py = y + (ey - y) * u * u - L * 0.02 * Math.sin(u * 3) - 2.4; if (u === s0) x.moveTo(px, py); else x.lineTo(px, py); }
          x.stroke();
        }
      }
      x.fillStyle = '#eef2f8'; x.beginPath(); x.ellipse(cx, top + 6, 5, 9, 0, 0, Math.PI * 2); x.fill();
    }
  });
  atlas.anisotropy = 4;
  const firMat = new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.5, side: THREE.DoubleSide });
  const quads = (k) => {
    const a = new THREE.PlaneGeometry(1, 2), b = new THREE.PlaneGeometry(1, 2); b.rotateY(Math.PI / 2);
    const g = new THREE.BufferGeometry(), pa = a.attributes.position.array, pb = b.attributes.position.array, ua = a.attributes.uv.array, ub = b.attributes.uv.array;
    const P = new Float32Array(pa.length + pb.length); P.set(pa); P.set(pb, pa.length);
    const U = new Float32Array(ua.length + ub.length); U.set(ua); U.set(ub, ua.length); for (let i = 0; i < U.length; i += 2) U[i] = (U[i] + k) / VAR;
    const ia = Array.from(a.index.array), ib = Array.from(b.index.array).map((v) => v + pa.length / 3);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex([...ia, ...ib]);
    g.translate(0, 1, 0); g.computeVertexNormals();
    return g;
  };
  const N = small ? 1400 : 3600, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const per = Math.ceil(N / VAR);
  for (let k = 0; k < VAR; k++) {
    const im = new THREE.InstancedMesh(quads(k), firMat, per);
    for (let i = 0; i < per; i++) {
      let x, z; do { x = rr(-160, 420); z = -46 - Math.pow(rnd(), 0.8) * 110; } while (SUBJ.some((s) => Math.abs(x - s) < 6 && z > -52));
      const s = rr(2.6, 5.2) * (1 + (-z - 46) / 160);
      q.setFromAxisAngle(up, rr(0, Math.PI));
      m4.compose(new THREE.Vector3(x, groundH(x, z) - 0.4, z), q, new THREE.Vector3(s * rr(0.85, 1.15), s, s * rr(0.85, 1.15)));
      im.setMatrixAt(i, m4);
    }
    im.computeBoundingSphere(); world.add(im);
  }
  // bancs de brume entre les collines
  const mistTex = canvasTex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0.9)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  [[-62, 7, 0.55], [-92, 12, 0.6], [-128, 18, 0.7], [-160, 26, 0.75]].forEach(([z, h, o]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(900, h), new THREE.MeshBasicMaterial({ map: mistTex, color: HORIZON, transparent: true, opacity: o, depthWrite: false, fog: false }));
    m.position.set(130, groundH(130, z) + h * 0.32, z); m.renderOrder = 1; world.add(m);
  });
}

/* ---------- les montagnes : un vrai relief calculé une fois au chargement (lancer de rayons sur un terrain),
   neige selon la pente et l’altitude, ombres portées du soleil, forêts en contrebas, brume selon la distance ---------- */
const PANO = { az: 1.3, el0: -0.06, el1: 0.44 };
const PW = Q.has('bakepano') ? 4096 : small ? 1536 : 3072, PH = Math.round(PW * 0.3125);
const panoRT = new THREE.WebGLRenderTarget(PW, PH, { generateMipmaps: false });
const panoMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { top: skyMat.uniforms.top, mid: skyMat.uniforms.mid, hor: skyMat.uniforms.hor, sunSky: skyMat.uniforms.sunCol, uSS: { value: 1 }, uRes: { value: new THREE.Vector2(PW, PH) }, sunDir: { value: SUN_DIR }, haze: { value: HORIZON.clone() }, sunCol: { value: new THREE.Color(1.0, 0.82, 0.66).multiplyScalar(2.1) }, A: { value: new THREE.Vector4(-PANO.az, PANO.az, PANO.el0, PANO.el1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `precision highp float;
    uniform vec3 sunDir, haze, sunCol, top, mid, hor, sunSky; uniform vec4 A; uniform int uSS; uniform vec2 uRes; varying vec2 vUv;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float fb(vec2 p){ return vn(p) * 0.5 + vn(p * 2.03) * 0.28 + vn(p * 4.1) * 0.14 + vn(p * 8.3) * 0.08; }
    vec3 skyCol(vec3 d){ float h = d.y;
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h)); c = mix(c, top, smoothstep(0.16, 0.7, h)); c = mix(c, hor, smoothstep(0.0, -0.1, h));
      float s = max(dot(d, sunDir), 0.0); c += sunSky * (pow(s, 900.0) * 2.0 + pow(s, 14.0) * 0.28 + pow(s, 3.0) * 0.06);
      if (h > 0.0) { vec2 p = d.xz / (h + 0.12) * 1.4; float cl = smoothstep(0.52, 0.86, fb(p * 0.6 + vec2(3.0, 1.0))) * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.25, 0.6, h));
        c = mix(c, mix(vec3(0.98, 0.9, 0.93), vec3(1.0, 0.92, 0.86), s), cl * 0.55); }
      return c; }
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
    const mat2 R = mat2(1.6, 1.2, -1.2, 1.6);
    float ridged(vec2 p, int oct){ float a = 0.5, s = 0.0, w = 1.0; for (int i = 0; i < 9; i++){ if (i >= oct) break; float n = 1.0 - abs(noise(p) * 2.0 - 1.0); n *= n; s += n * a * w; w = clamp(n * 1.7, 0.0, 1.0); p = R * p; a *= 0.5; } return s; }
    float fbm(vec2 p, int oct){ float a = 0.5, s = 0.0; for (int i = 0; i < 7; i++){ if (i >= oct) break; s += a * noise(p); p = R * p; a *= 0.5; } return s; }
    const vec2 FUJI = vec2(560.0, -3150.0);
    float smax(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0); return mix(b, a, h) + k * h * (1.0 - h); }
    float terr(vec2 xz, int oct){
      float d = -xz.y;
      float m = ridged(xz * 0.00105 + vec2(3.1, 7.7), oct) * 720.0 * smoothstep(300.0, 1700.0, d);
      m += fbm(xz * 0.0024 + 7.0, oct > 5 ? 5 : 3) * 170.0 * smoothstep(180.0, 800.0, d);
      float r = length(xz - FUJI), ang = atan(xz.y - FUJI.y, xz.x - FUJI.x);
      float f = min(1320.0 * pow(max(0.0, 1.0 - r / 2800.0), 1.8), 1250.0);
      f -= (noise(vec2(ang * 34.0, r * 0.0032)) * 0.7 + noise(vec2(ang * 90.0, r * 0.01)) * 0.3) * 55.0 * smoothstep(220.0, 1900.0, r) * (1.0 - smoothstep(2300.0, 2800.0, r));
      return smax(m, f, 120.0) - 90.0;
    }
    float softShadow(vec3 ro, vec3 rd){ float res = 1.0, t = 12.0; for (int i = 0; i < 30; i++){ vec3 p = ro + rd * t; float h = p.y - terr(p.xz, 4); res = min(res, 10.0 * h / t); if (res < 0.01 || p.y > 1500.0) break; t += clamp(h, 18.0, 300.0); } return clamp(res, 0.0, 1.0); }
    vec3 shade(vec2 uv){
      float az = mix(A.x, A.y, uv.x), el = mix(A.z, A.w, uv.y);
      vec3 d = vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
      vec3 ro = vec3(0.0, 25.0, 0.0);
      float t = 260.0, dy = 1e9; bool hit = false;
      for (int i = 0; i < 200; i++){ vec3 p = ro + d * t; dy = p.y - terr(p.xz, 4); if (dy < 0.0016 * t){ hit = true; break; } t += max(0.42 * dy, 0.003 * t); if (t > 11000.0) break; }
      if (!hit) return skyCol(d);
      vec3 p = ro + d * t;
      float e = 0.0012 * t;
      vec3 n = normalize(vec3(terr(p.xz - vec2(e, 0.0), 8) - terr(p.xz + vec2(e, 0.0), 8), 2.0 * e, terr(p.xz - vec2(0.0, e), 8) - terr(p.xz + vec2(0.0, e), 8)));
      float nz = noise(p.xz * 0.012), nz2 = noise(p.xz * 0.06);
      float snowLine = 120.0 + nz * 140.0;
      float snow = smoothstep(0.42, 0.72, n.y + (nz2 - 0.5) * 0.3) * smoothstep(snowLine - 60.0, snowLine + 60.0, p.y);
      snow = max(snow, smoothstep(0.8, 0.95, n.y) * 0.9);
      vec3 rock = mix(vec3(0.12, 0.12, 0.15), vec3(0.24, 0.23, 0.27), nz2);
      float forest = (1.0 - smoothstep(snowLine - 40.0, snowLine + 160.0, p.y)) * smoothstep(0.3, 0.55, n.y) * (0.6 + 0.4 * noise(p.xz * 0.03));
      vec3 alb = mix(rock, vec3(0.05, 0.085, 0.08), forest);
      alb = mix(alb, vec3(0.92, 0.94, 0.99), snow * (1.0 - forest * 0.55));
      float sh = softShadow(p + n * 3.0, sunDir);
      float dif = clamp(dot(n, sunDir), 0.0, 1.0) * sh;
      vec3 amb = vec3(0.5, 0.58, 0.78) * (0.5 + 0.5 * n.y);
      float back = clamp(dot(n, normalize(vec3(-sunDir.x, 0.0, -sunDir.z))), 0.0, 1.0);
      vec3 col = alb * (sunCol * dif + amb * 0.9 + vec3(0.25, 0.22, 0.25) * back * 0.35);
      float fa = 1.0 - exp(-t * 0.00022) * 0.97;
      vec3 fc = haze * 1.02 + sunCol * 0.12 * pow(max(dot(d, sunDir), 0.0), 6.0);
      col = mix(col, fc, fa);
      return col;
    }
    void main(){
      vec3 acc = vec3(0.0); float n = 0.0;
      for (int j = 0; j < 3; j++) { if (j >= uSS) break; for (int i = 0; i < 3; i++) { if (i >= uSS) break;
        vec2 o = (vec2(float(i), float(j)) + 0.5) / float(uSS) - 0.5; acc += shade(vUv + o / uRes); n += 1.0; } }
      gl_FragColor = vec4(acc / n * 0.5, 1.0);
    }`,
});
async function renderPano() {
  const qd = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), panoMat), sc = new THREE.Scene(); sc.add(qd);
  const bake = Q.has('bakepano'), cols = bake ? 64 : small ? 8 : 16, rows = bake ? 8 : 1, cw = Math.ceil(PW / cols), chh = Math.ceil(PH / rows);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  panoMat.uniforms.uSS.value = bake ? 3 : 1;
  renderer.setRenderTarget(panoRT); renderer.setClearColor(0x000000, 0); renderer.clear();
  panoRT.scissorTest = true;
  for (let s = 0; s < cols; s++) for (let r = 0; r < rows; r++) {
    panoRT.scissor.set(s * cw, r * chh, cw, chh);
    renderer.setRenderTarget(panoRT); renderer.render(sc, cam);
    if (bake) { renderer.readRenderTargetPixels(panoRT, s * cw, r * chh, 1, 1, new Uint8Array(4)); document.title = 'tuile ' + (s * rows + r) + '/' + cols * rows; }
    await new Promise((res) => setTimeout(res, 0));
  }
  panoRT.scissorTest = false; renderer.setRenderTarget(null);
  skyMat.uniforms.uPano.value = 1;
}
// le relief est préparé une fois pour toutes (outil : equipe.html?bakepano) et chargé comme une image : rien à calculer chez le visiteur
async function bakePano() {
  skyMat.uniforms.tPano.value = panoRT.texture; await renderPano();
  const px = new Uint8Array(PW * PH * 4); renderer.readRenderTargetPixels(panoRT, 0, 0, PW, PH, px);
  const c = document.createElement('canvas'); c.width = PW; c.height = PH; const x = c.getContext('2d'), im = x.createImageData(PW, PH);
  for (let j = 0; j < PH; j++) im.data.set(px.subarray((PH - 1 - j) * PW * 4, (PH - j) * PW * 4), j * PW * 4);
  x.putImageData(im, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.88));
  await fetch('/__save?path=' + encodeURIComponent('assets/img/equipe-montagnes.webp'), { method: 'POST', body: blob });
  document.title = 'baked ' + blob.size;
}
async function loadPano() {
  if (Q.has('bakepano')) return bakePano();
  try {
    const tex = await new THREE.TextureLoader().loadAsync('/msdesign.be/assets/img/equipe-montagnes.webp?v=2');
    tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
    skyMat.uniforms.tPano.value = tex; skyMat.uniforms.uPano.value = 1;
  } catch (e) { skyMat.uniforms.tPano.value = panoRT.texture; await renderPano(); }
}
buildBatches();

/* ---------- la neige et les pétales qui tombent ---------- */
const flakes = (() => {
  const n = small ? 2200 : 5000, pos = new Float32Array(n * 3), size = new Float32Array(n), sd = new Float32Array(n), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rnd() * 90; pos[i * 3 + 1] = rnd() * 16; pos[i * 3 + 2] = rr(-45, 7.5);
    const petal = rnd() < 0.14; size[i] = petal ? rr(0.07, 0.11) : rr(0.035, 0.07); sd[i] = rnd();
    const c = new THREE.Color(petal ? (rnd() < 0.5 ? '#f7a9c0' : '#ffc9d7') : '#ffffff'); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCamX: { value: 0 }, uScale: { value: 400 } },
    vertexShader: `attribute float aSize; attribute float aSeed; attribute vec3 aCol; uniform float uTime, uCamX, uScale; varying vec3 vCol; varying float vA;
      void main(){ vec3 p = position;
        p.y = mod(p.y - uTime * (0.55 + aSeed * 0.7), 16.0) - 0.5;
        p.x = uCamX - 40.0 + mod(p.x - uCamX + 40.0 + sin(uTime * 0.35 + aSeed * 40.0) * 0.8, 90.0);
        p.z += sin(uTime * 0.27 + aSeed * 23.0) * 0.7;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv;
        vCol = aCol; vA = smoothstep(70.0, 25.0, -mv.z) * smoothstep(0.4, 1.2, -mv.z); }`,
    fragmentShader: `varying vec3 vCol; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(c)); gl_FragColor = vec4(vCol, a * vA * 0.95);
      #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; world.add(pts);
  return m;
})();

/* ---------- passe finale : flou de vitesse, halo lumineux, aberration chromatique, étalonnage, grain ---------- */
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 0 : 4, depthTexture: new THREE.DepthTexture(1, 1) });
const bA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), bB = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const FSV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const passMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); passMesh.frustumCulled = false;
const passScene = new THREE.Scene(); passScene.add(passMesh);
const brightMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false, toneMapped: false,
  uniforms: { tColor: { value: rt.texture }, uTexel: { value: new THREE.Vector2(1, 1) } },
  vertexShader: FSV,
  fragmentShader: `uniform sampler2D tColor; uniform vec2 uTexel; varying vec2 vUv;
    void main(){
      vec3 c = (texture2D(tColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + uTexel * vec2(1.0, -1.0)).rgb
              + texture2D(tColor, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + uTexel * vec2(1.0, 1.0)).rgb) * 0.25;
      float l = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c * smoothstep(1.3, 2.6, l), 1.0);
    }`,
});
const blurMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false, toneMapped: false,
  uniforms: { tColor: { value: null }, uDir: { value: new THREE.Vector2() } },
  vertexShader: FSV,
  fragmentShader: `uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tColor, vUv).rgb * 0.19648;
      c += (texture2D(tColor, vUv + uDir * 1.41176).rgb + texture2D(tColor, vUv - uDir * 1.41176).rgb) * 0.29691;
      c += (texture2D(tColor, vUv + uDir * 3.29412).rgb + texture2D(tColor, vUv - uDir * 3.29412).rgb) * 0.09447;
      c += (texture2D(tColor, vUv + uDir * 5.17647).rgb + texture2D(tColor, vUv - uDir * 5.17647).rgb) * 0.01038;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
function pass(mat, target) { passMesh.material = mat; renderer.setRenderTarget(target); renderer.render(passScene, postCam); }
// la mise au point : une copie floue de l’image, avec dans le canal alpha « à quel point ce pixel est trop près » ;
// comme ce canal est flouté lui aussi, le flou du premier plan déborde de sa silhouette, comme avec un vrai objectif
const dA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), dB = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const cocMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false, toneMapped: false,
  uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, cNear: { value: camera.near }, cFar: { value: camera.far }, uFocus: { value: 22 } },
  vertexShader: FSV,
  fragmentShader: `uniform sampler2D tColor, tDepth; uniform float cNear, cFar, uFocus; varying vec2 vUv;
    void main(){ float dz = texture2D(tDepth, vUv).x, dist = (cNear * cFar) / (cFar - dz * (cFar - cNear));
      gl_FragColor = vec4(texture2D(tColor, vUv).rgb, smoothstep(uFocus * 0.5, uFocus * 0.16, dist)); }`,
});
const blurMatA = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false, toneMapped: false,
  uniforms: { tColor: { value: null }, uDir: { value: new THREE.Vector2() } },
  vertexShader: FSV,
  fragmentShader: `uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tColor, vUv) * 0.19648;
      c += (texture2D(tColor, vUv + uDir * 1.41176) + texture2D(tColor, vUv - uDir * 1.41176)) * 0.29691;
      c += (texture2D(tColor, vUv + uDir * 3.29412) + texture2D(tColor, vUv - uDir * 3.29412)) * 0.09447;
      c += (texture2D(tColor, vUv + uDir * 5.17647) + texture2D(tColor, vUv - uDir * 5.17647)) * 0.01038;
      gl_FragColor = c; }`,
});
function renderSoft() {
  pass(cocMat, dA);
  const B = blurMatA.uniforms;
  B.tColor.value = dA.texture; B.uDir.value.set(1.2 / dA.width, 0); pass(blurMatA, dB);
  B.tColor.value = dB.texture; B.uDir.value.set(0, 1.2 / dA.height); pass(blurMatA, dA);
  B.tColor.value = dA.texture; B.uDir.value.set(2.4 / dA.width, 0); pass(blurMatA, dB);
  B.tColor.value = dB.texture; B.uDir.value.set(0, 2.4 / dA.height); pass(blurMatA, dA);
}
function renderBloom() {
  pass(brightMat, bA);
  const B = blurMat.uniforms;
  B.tColor.value = bA.texture; B.uDir.value.set(1 / bA.width, 0); pass(blurMat, bB);
  B.tColor.value = bB.texture; B.uDir.value.set(0, 1 / bA.height); pass(blurMat, bA);
  B.tColor.value = bA.texture; B.uDir.value.set(2.2 / bA.width, 0); pass(blurMat, bB);
  B.tColor.value = bB.texture; B.uDir.value.set(0, 2.2 / bA.height); pass(blurMat, bA);
}
const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  defines: { TAPS: small ? 5 : 10 },
  uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tBloom: { value: bA.texture }, tSoft: { value: dA.texture }, uFocus: { value: 22 }, uDof: { value: small ? 0 : 1 }, cNear: { value: camera.near }, cFar: { value: camera.far }, uSpeed: { value: 0 }, uTime: { value: 0 }, uCA: { value: 0.0008 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: FSV,
  fragmentShader: `uniform sampler2D tColor, tDepth, tBloom, tSoft; uniform float cNear, cFar, uSpeed, uTime, uCA, uFocus, uDof; uniform vec2 uRes; varying vec2 vUv;
    vec3 tap(vec2 o, vec2 ca){ return vec3(texture2D(tColor, o - ca).r, texture2D(tColor, o).g, texture2D(tColor, o + ca).b); }
    void main(){
      float dz = texture2D(tDepth, vUv).x;
      float dist = (cNear * cFar) / (cFar - dz * (cFar - cNear));
      float b = clamp(uSpeed / max(dist, 0.6), 0.0, 0.07);
      vec2 dir = vUv - 0.5; vec2 ca = dir * uCA * (0.4 + dot(dir, dir) * 3.0);
      vec3 c;
      if (b < 0.0004) c = tap(vUv, ca);
      else {
        float w = 0.0, jit = fract(sin(dot(vUv * uRes, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; c = vec3(0.0);
        for (int i = -TAPS; i <= TAPS; i++) { float k = (float(i) + jit) / float(TAPS), wt = 1.0 - abs(k) * 0.5; c += tap(vUv + vec2(k * b * 0.5, 0.0), ca) * wt; w += wt; }
        c /= w;
      }
      if (uDof > 0.0) { vec4 soft = texture2D(tSoft, vUv);
        float cn = max(smoothstep(uFocus * 0.5, uFocus * 0.16, dist), soft.a * 1.25), cf = smoothstep(uFocus * 3.0, uFocus * 11.0, dist) * 0.12;
        c = mix(c, soft.rgb, clamp(max(cn, cf), 0.0, 1.0) * uDof); }
      c += texture2D(tBloom, vUv).rgb * 0.8;
      vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.55;
      float n = fract(sin(dot(vUv * uRes + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453); c += (n - 0.5) * 0.012;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      { vec3 g = clamp(gl_FragColor.rgb, 0.0, 1.0); float L = dot(g, vec3(0.2126, 0.7152, 0.0722));
        g = mix(g, g * g * (3.0 - 2.0 * g), 0.22);                                     // un peu de contraste
        g += vec3(-0.012, -0.004, 0.022) * (1.0 - L) + vec3(0.022, 0.006, -0.012) * L;  // ombres froides, lumières chaudes
        gl_FragColor.rgb = g; }
      #include <colorspace_fragment>
    }`,
}));
const postScene = new THREE.Scene(); postScene.add(post);

/* ---------- caméra : le trajet ---------- */
const prof = (() => {                                           // accélération franche, croisière, freinage net
  const N = 400, v = new Float32Array(N + 1), p = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { const u = i / N; v[i] = smooth(0, 0.17, u) * (1 - smooth(0.78, 1, u)); }
  for (let i = 1; i <= N; i++) p[i] = p[i - 1] + (v[i] + v[i - 1]) / 2;
  const tot = p[N]; for (let i = 0; i <= N; i++) { p[i] /= tot; v[i] = (v[i] * N) / tot; }
  return (u) => { const f = clamp(u) * N, i = Math.min(N - 1, Math.floor(f)), t = f - i; return [lerp(p[i], p[i + 1], t), lerp(v[i], v[i + 1], t)]; };
})();
let bounceT = -9, forceV = null, stop = 0, camX = -45, vel = 0, acc = 0, trip = null, now = 0, pitch = 0, narrow = false, fovBase = 42, camZ = 8, offX = 0;
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
function goTo(i, instant = false) {
  i = clamp(i, 0, STOPS.length - 1) | 0;
  if (trip && trip.to === STOPS[i]) return;
  setActive(-1);
  if (instant || reduced) { camX = STOPS[i]; stop = i; trip = null; fadeFlash(); setTimeout(() => setActive(i), reduced ? 250 : 0); updateRoute(); return; }
  const dist = Math.abs(STOPS[i] - camX);
  trip = { from: camX, to: STOPS[i], t0: now, dur: 2.0 + 1.25 * Math.min(3, dist / 60), target: i, shown: false };
  d.classList.add('jr-moving'); sound.whoosh(trip.dur);
}
function fadeFlash() { const f = $('.jr__flash'); if (!f) return; f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on'); }

/* ---------- l’interface : textes des arrêts, route, son ---------- */
const stopsEl = $$('[data-stop]'), routeBtns = $$('[data-go]'), marker = $('.route__marker'), fillEl = $('.route__fill');
$$('[data-letters]').forEach((el) => {
  const txt = el.textContent.trim(); el.setAttribute('aria-label', txt); el.textContent = '';
  [...txt].forEach((ch, k) => { const s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true'); s.textContent = ch; s.style.setProperty('--i', k); el.appendChild(s); });
});
const ghost = $('.jr__ghost');
function setActive(i) {
  stopsEl.forEach((el, k) => {
    if (el.classList.contains('is-on') && k !== i) { el.classList.add('is-leaving'); setTimeout(() => el.classList.remove('is-leaving'), 900); }
    el.classList.toggle('is-on', k === i); el.setAttribute('aria-hidden', k === i ? 'false' : 'true');
  });
  routeBtns.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'step' : 'false'));
  if (i >= 0) { const at = $('[data-at]'); if (at) at.textContent = String(i + 1).padStart(2, '0'); }
  d.classList.toggle('jr-end', i === STOPS.length - 1);
  if (ghost) {                                                    // le prénom géant, en filigrane derrière le décor
    const nm = i >= 0 ? stopsEl[i].querySelector('[data-letters]') : null;
    ghost.classList.remove('is-on');
    if (nm) { ghost.textContent = nm.getAttribute('aria-label'); void ghost.offsetWidth; ghost.classList.add('is-on'); }
  }
}
function arrivalText(i) {
  const nm = stopsEl[i] && stopsEl[i].querySelector('[data-letters]');
  if (nm) sound.ticks(nm.querySelectorAll('.ch').length, 0.045, 0.1);
  sound.swish(0.42);
}
function updateRoute() { const k = clamp(camX / STOPS[STOPS.length - 1]); if (marker) marker.style.setProperty('--k', k.toFixed(4)); if (fillEl) fillEl.style.setProperty('--k', k.toFixed(4)); }

let lock = 0;
const step = (dir) => { if (!entered) return; const t = performance.now(); if (t < lock) return; const target = (trip ? trip.target : stop) + dir; if (target < 0 || target >= STOPS.length) return; lock = t + 900; goTo(target); };
addEventListener('wheel', (e) => { e.preventDefault(); const dlt = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX; if (Math.abs(dlt) > 4) step(dlt > 0 ? 1 : -1); }, { passive: false });
addEventListener('keydown', (e) => {
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); step(1); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); step(-1); }
});
let tx0 = null, ty0 = null;
addEventListener('touchstart', (e) => { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', (e) => { if (tx0 === null) return; const dx = tx0 - e.changedTouches[0].clientX, dy = ty0 - e.changedTouches[0].clientY, dl = Math.abs(dx) > Math.abs(dy) ? dx : dy; if (Math.abs(dl) > 40) step(dl > 0 ? 1 : -1); tx0 = null; }, { passive: true });
routeBtns.forEach((b) => b.addEventListener('click', () => goTo(+b.dataset.go)));
$$('[data-next]').forEach((b) => b.addEventListener('click', () => step(1)));
addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

// le son : musique douce (koto, nappe), vent, et les effets de motion design (journey-sound.js)
const sound = createSound();
let muted = false, entered = false;
let fromDive = null;                                             // '1' : on arrive de « Sous la surface » avec le son, '0' : sans
try { fromDive = sessionStorage.getItem('ms_from_dive'); sessionStorage.removeItem('ms_from_dive'); } catch (e) { /* rien */ }
if (Q.has('at')) fromDive = null;
try { muted = localStorage.getItem('ms_jr_sound') === 'off'; } catch (e) { /* rien */ }
const soundBtn = $('[data-sound]');
const label = () => { if (soundBtn) soundBtn.textContent = muted ? 'Activer le son' : 'Couper le son'; };
label();
if (soundBtn) soundBtn.addEventListener('click', () => {
  muted = !muted; try { localStorage.setItem('ms_jr_sound', muted ? 'off' : 'on'); } catch (e) { /* rien */ }
  sound.setMuted(muted); if (!muted) sound.start(); label();
});
$$('a, button').forEach((el) => { el.addEventListener('pointerenter', () => sound.hover()); el.addEventListener('click', () => sound.click()); });

/* ---------- l’écran d’entrée : chargement, puis « avec ou sans le son » ---------- */
const gate = $('[data-gate]'), loadEl = $('[data-load]'), gateActions = $('[data-gate-actions]');
let loadTarget = preLoad, loadShown = preLoad, gateReady = false;
function setLoad(p) { loadTarget = Math.max(loadTarget, p); }
function tickLoad() {
  loadShown += (loadTarget - loadShown) * 0.1; if (loadTarget - loadShown < 0.5) loadShown = loadTarget;
  if (loadEl) loadEl.textContent = String(Math.round(loadShown)).padStart(3, '0');
  if (gate) gate.style.setProperty('--p', (loadShown / 100).toFixed(3));
  if (loadShown >= 100 && !gateReady) {
    gateReady = true; d.classList.add('jr-loaded');
    if (fromDive !== null) enter(fromDive === '1');
    else if (gateActions) { gateActions.hidden = false; const b = gateActions.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
  }
  if (!gateReady) requestAnimationFrame(tickLoad);
}
function enter(withSound) {
  if (entered || !gateReady) return; entered = true;
  muted = !withSound; try { localStorage.setItem('ms_jr_sound', muted ? 'off' : 'on'); } catch (e) { /* rien */ }
  sound.setMuted(muted);
  if (withSound) { sound.start(); if (fromDive === null) sound.enter(); else setTimeout(() => { if (sound.running) sound.enter(); }, 250); }
  label(); d.classList.add('jr-in');
  setTimeout(() => goTo(0), reduced ? 0 : fromDive !== null ? 350 : 900);
}
// si le navigateur a retenu le son (arrivée depuis la plongée, sans clic sur cette page), il démarre au premier geste
['pointerdown', 'keydown', 'touchend'].forEach((ev) => addEventListener(ev, () => { if (entered && !muted && !sound.running) sound.start(); }, { passive: true }));
$$('[data-enter]').forEach((b) => b.addEventListener('click', () => enter(b.dataset.enter === '1')));
addEventListener('keydown', (e) => { if (!entered && gateReady && e.key === 'Enter') { e.preventDefault(); enter(true); } });

/* ---------- mise en page ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(PR); renderer.setSize(w, h, false);
  const W = Math.floor(w * PR), H = Math.floor(h * PR);
  rt.setSize(W, H); reflRT.setSize(Math.floor(W * 0.5), Math.floor(H * 0.5));
  bA.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2)); bB.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2)); brightMat.uniforms.uTexel.value.set(1 / W, 1 / H);
  dA.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1)); dB.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1));
  ice.material.uniforms.uRes.value.set(W, H);
  narrow = w / h < 0.95;
  fovBase = narrow ? 58 : 42; camZ = narrow ? 14 : 8; offX = narrow ? 6.5 : 0;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  flakes.uniforms.uScale.value = (h * PR * 0.5) / Math.tan(THREE.MathUtils.degToRad(fovBase / 2));
  post.material.uniforms.uRes.value.set(W, H);
}
addEventListener('resize', resize);

const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), ICE_Y);
const hemiSky = hemi.color.clone(), hemiGround = hemi.groundColor.clone();
function renderReflection() {
  world.scale.y = -1; world.position.y = 2 * ICE_Y; sky.scale.y = -1; ice.visible = false;
  const si = sun.intensity; sun.intensity = 0; hemi.color.copy(hemiGround); hemi.groundColor.copy(hemiSky); hemi.intensity = 1.25;
  const nu = renderer.shadowMap.needsUpdate; renderer.shadowMap.needsUpdate = false;  // le reflet ne recalcule pas les ombres
  renderer.clippingPlanes = [clip];
  renderer.setRenderTarget(reflRT); renderer.render(scene, camera);
  renderer.clippingPlanes = []; renderer.shadowMap.needsUpdate = nu;
  world.scale.y = 1; world.position.y = 0; sky.scale.y = 1; ice.visible = true;
  sun.intensity = si; hemi.color.copy(hemiSky); hemi.groundColor.copy(hemiGround); hemi.intensity = 1.05;
}

/* ---------- la boucle ---------- */
const look = new THREE.Vector3();
let last = 0, frames = 0, shadowKey = null, fAcc = 0, fN = 0, focus = 24;
const FOCUS = [19, 22, 30, 21, 23];                              // distance du sujet de chaque arrêt
function adapt(dt) {                                              // qualité automatique : on baisse la résolution si l’appareil peine
  fAcc += dt; fN++; if (fAcc < 2.5) return;
  const fps = fN / fAcc; fAcc = 0; fN = 0;
  if (fps < 42 && PR > DPR * 0.5 + 0.01) { PR = Math.max(DPR * 0.5, PR * 0.82); resize(); }
  else if (fps > 57 && PR < DPR - 0.01) { PR = Math.min(DPR, PR * 1.12); resize(); }
}
function frame(ms) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = 0; return; }
  const dt = Math.min(0.05, last ? (ms - last) / 1000 : 1 / 60); last = ms; now += dt; frames++;
  let v = forceV === null ? 0 : forceV;
  if (trip) {
    const u = (now - trip.t0) / trip.dur, [pp, vv] = prof(u);
    camX = lerp(trip.from, trip.to, pp); v = ((trip.to - trip.from) * vv) / trip.dur;
    if (!trip.shown && u > 0.84) { trip.shown = true; d.classList.remove('jr-moving'); setActive(trip.target); arrivalText(trip.target); }
    if (u >= 1) { stop = trip.target; camX = trip.to; trip = null; v = 0; sound.arrive(); bounceT = now; }
  }
  const a = (v - vel) / Math.max(dt, 1e-3); vel = v; acc += (a - acc) * Math.min(1, dt * 6);
  pitch += ((-acc * 0.0011) - pitch) * Math.min(1, dt * 5);
  mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
  const sp = Math.abs(vel), spN = clamp(sp / 40);
  const bt = now - bounceT, bounce = bt < 2 ? Math.exp(-bt * 5) * Math.sin(bt * 16) : 0;
  const cx = camX + offX + mouse.x * 0.8 * (1 - spN), cy = 2.3 + Math.sin(now * 0.6) * 0.04 - mouse.y * 0.35 * (1 - spN) - bounce * 0.07;
  camera.position.set(cx, cy + groundH(cx, camZ), camZ);
  camera.fov = fovBase + 9 * spN; camera.updateProjectionMatrix();
  look.set(cx + 2.2 + vel * 0.16, cy + 0.65 - (narrow ? 2.4 : 0) + pitch * 6 - bounce * 0.25, -14);
  camera.lookAt(look);
  camera.rotateZ(-vel * 0.0009);
  sky.position.copy(camera.position);
  // l’ombre suit la caméra, calée sur la grille des texels (pas de scintillement)
  const tg = Math.round((camX + offX + 6) / 0.5) * 0.5;
  if (tg !== shadowKey) { shadowKey = tg; sun.target.position.set(tg, 0, -14); sun.position.set(tg, 0, -14).addScaledVector(SUN_DIR, 110); sun.target.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true; }
  flakes.uniforms.uTime.value = now; flakes.uniforms.uCamX.value = cx;
  if (!reduced) for (const L of SWAY) { L.grp.rotation.z = Math.sin(now * 1.05 + L.ph) * 0.05 + Math.sin(now * 0.37 + L.ph * 0.3) * 0.035; L.grp.rotation.x = Math.cos(now * 0.8 + L.ph) * 0.028; }
  for (const f of FLICKER) f.s.material.opacity = f.o * (0.84 + 0.16 * noise(now * 3.3 + f.ph, f.ph * 0.7) + 0.06 * Math.sin(now * 17 + f.ph));
  const U = post.material.uniforms;
  U.uSpeed.value = reduced ? 0 : (sp * 0.02) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect); U.uTime.value = now;
  U.uCA.value = reduced ? 0.0008 : 0.0008 + spN * 0.0045;
  focus += ((trip ? 30 : FOCUS[stop] + camZ - 8) - focus) * Math.min(1, dt * 2.2); U.uFocus.value = focus; cocMat.uniforms.uFocus.value = focus;
  if (Math.abs(cx - POND.x) < 55) renderReflection();
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderBloom(); if (!small) renderSoft();
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  updateRoute(); adapt(dt);
  if (frames === 4) setLoad(100);
}

/* ---------- départ : l’écran d’entrée, puis on arrive en roulant jusqu’au torii ---------- */
resize();
setLoad(58); requestAnimationFrame(tickLoad);
const hold = Q.has('at') ? +Q.get('at') : null;
loadPano().catch((e) => console.warn('[jr] pano', e)).then(() => {
  setLoad(86);
  requestAnimationFrame(frame);
  d.classList.add('jr-ready');
  if (hold !== null) { loadTarget = loadShown = 100; gateReady = true; entered = true; d.classList.add('jr-loaded', 'jr-in'); goTo(hold, true); }   // captures et liens directs : sans écran d’entrée
});

window.__jr = { goTo, enter, get models() { return !!JP; }, get x() { return camX; }, get frames() { return frames; }, pose(x, v = null) { camX = x; trip = null; forceV = v; }, trip: () => !!trip };
