/* ==========================================================================
   M&S Design — « Un prix sur mesure » en 3D (section Tarifs)
   Un site se construit sous vos yeux, en cinq temps : votre métier (le cadre
   et l’épingle), les pages (trois étages qui se posent), le design (la page
   d’accueil prend sa couleur, la ficelle bleue s’enroule), les fonctions
   (réservation, boutique, langues, automatisation) puis le devis : tout se
   resserre, une feuille glisse et le tampon « Prix fixe » s’y pose.
   Tout est une fonction du temps : on peut sauter à une étape ou rejouer.
   ========================================================================== */
import * as THREE from '../vendor/three.module.min.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x * x;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const backOut = (x) => { const c1 = 1.45, c3 = c1 + 1; return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const bounce = (x) => {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};

export const STEPS = [0, 2.2, 4.6, 7.0, 9.3];          // début de chaque étape (s)
export const END = 12.2;

/* ---------- géométries ---------- */
function rrect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const geoCache = new Map();
function slab(w, d, t, r, pivotLeft = false) {                 // dalle arrondie, posée sur y = 0
  const key = [w, d, t, r, pivotLeft].join('|');
  if (geoCache.has(key)) return geoCache.get(key);
  const b = Math.min(0.06, t * 0.32);
  const g = new THREE.ExtrudeGeometry(rrect(w - 2 * b, d - 2 * b, Math.max(0.01, r - b)), { depth: Math.max(0.001, t - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); g.translate(pivotLeft ? w / 2 : 0, b, 0);
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export async function createDevis3D(host, { reduced = false, onStep = () => {}, onReady = () => {}, onEnd = () => {}, still = false } = {}) {
  try { await Promise.all([document.fonts.load('600 64px "Instrument Sans"'), document.fonts.load('400 64px "Fraunces"')]); } catch (e) { /* polices système */ }
  const canvas = document.createElement('canvas');
  canvas.className = 'devis__gl';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: still });
  } catch (e) { return null; }
  host.appendChild(canvas);
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(still ? 1 : Math.min(window.devicePixelRatio || 1, small ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 1, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd5e6, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(-11, 24, 13); sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
  sun.shadow.radius = 9; sun.shadow.blurSamples = 20; sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe7ff, 0.7); fill.position.set(14, 8, 10); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  /* ---------- matières ---------- */
  const C = { cream: 0xfbf9f4, white: 0xffffff, line: 0xe2dccf, blue: 0x1d5cf5, blueL: 0xc3d3ff, sage: 0xd5e2cf, ink: 0x23262e, tan: 0xf0ebe1 };
  const mStd = (color, rough = 0.62) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const mBlue = () => new THREE.MeshPhysicalMaterial({ color: C.blue, roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.3 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };

  /* ---------- 1. le cadre (votre métier) ---------- */
  const base = new THREE.Group(); scene.add(base);
  base.add(mesh(slab(15.2, 10.2, 0.5, 0.7), mStd(C.white, 0.5)));
  base.add(mesh(slab(15.2, 0.9, 0.06, 0.2), mStd(C.tan), 0, 0.5, -4.6));
  const dots = [0, 1, 2].map((i) => { const d = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 20), mStd([0xe9a39b, 0xeccb83, 0xa8cf9f][i], 0.5), -6.6 + i * 0.55, 0.6, -4.6); base.add(d); return d; });
  const pin = new THREE.Group(); scene.add(pin);
  {
    const blue = mBlue();
    const head = mesh(new THREE.SphereGeometry(1.0, 40, 28), blue, 0, 2.55, 0);
    const pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20; pts.push(new THREE.Vector2(0.9 * Math.pow(k, 0.85), 0.12 + k * 2.3)); }
    const tip = mesh(new THREE.LatheGeometry(pts, 32), blue);
    const eye = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 32), mStd(C.white, 0.4), 0, 2.6, 0.95);
    eye.rotation.x = Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ color: 0x1d5cf5, transparent: true, opacity: 0.14, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02;
    pin.add(tip, head, eye, disc); pin.userData.disc = disc;
  }
  pin.position.set(-10.4, 0, 3.4); pin.scale.setScalar(1.15); pin.rotation.y = 0.62;

  /* ---------- 2. les pages : trois étages ---------- */
  const layers = [];
  const bars = [];                                       // les lignes de texte qui s’écrivent
  function layer(kind, i) {
    const g = new THREE.Group(), mats = [];
    const own = (m) => { mats.push(m); return m; };
    g.add(mesh(slab(13.6, 8.8, 0.2, 0.55), own(mStd(C.cream, 0.55))));
    const top = 0.2;
    const bar = (w, x, z, color = C.line, h = 0.34) => { const m = mesh(slab(w, h, 0.05, h / 2, true), own(mStd(color, 0.7)), x, top, z); m.userData.i = i; g.add(m); bars.push(m); return m; };
    const tile = (w, d, x, z, color) => { const m = mesh(slab(w, d, 0.08, 0.22), own(mStd(color, 0.66)), x, top, z); g.add(m); return m; };
    if (kind === 'home') {
      g.userData.hero = mesh(slab(12.4, 3.5, 0.12, 0.32), own(mStd(C.tan, 0.5)), 0, top, -2.2); g.add(g.userData.hero);
      g.userData.heroBars = [bar(5.6, -5.6, -2.9, C.white, 0.42), bar(3.6, -5.6, -2.2, C.white, 0.42), bar(2.2, -5.6, -1.3, C.white, 0.5)];
      g.userData.heroBars.forEach((b) => { b.position.y = top + 0.12; });
      g.userData.tiles = [tile(3.8, 2.4, -4.2, 1.35, C.sage), tile(3.8, 2.4, 0, 1.35, C.blueL), tile(3.8, 2.4, 4.2, 1.35, C.sage)];
      bar(3.2, -6.1, 3.3); bar(2.4, -1.9, 3.3); bar(3.0, 2.3, 3.3);
    } else if (kind === 'gallery') {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) tile(3.7, 2.6, -4.2 + c * 4.2, -2.3 + r * 3.0, C.tan);
      bar(4.0, -6.1, 3.5); bar(2.6, -1.6, 3.5);
    } else {
      bar(7.6, -6.1, -2.8, C.tan, 0.7); bar(7.6, -6.1, -1.6, C.tan, 0.7); bar(7.6, -6.1, -0.4, C.tan, 0.7);
      g.add(mesh(slab(3.0, 0.9, 0.12, 0.45), own(mBlue()), -4.6, top, 1.1));
      bar(4.6, 2.2, -2.8); bar(3.4, 2.2, -2.0); bar(3.9, 2.2, -1.2);
    }
    g.userData.mats = mats;
    scene.add(g);
    return g;
  }
  layers.push(layer('form', 0), layer('gallery', 1), layer('home', 2));
  const home = layers[2];
  const heroFrom = new THREE.Color(C.tan), heroTo = new THREE.Color(C.blue), tileFinal = home.userData.tiles.map((m) => m.material.color.clone());

  /* ---------- 3. la ficelle bleue qui s’enroule ---------- */
  const ribbonMat = mBlue();
  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), ribbonMat);
  ribbon.castShadow = true; scene.add(ribbon);
  let ribbonKey = '';
  function setRibbon(h, draw) {
    const key = h.toFixed(2) + '|' + draw.toFixed(3);
    if (key === ribbonKey) return; ribbonKey = key;
    ribbon.visible = draw > 0.002;
    if (!ribbon.visible) return;
    const pts = [];
    for (let k = 0; k <= 48; k++) {
      const u = k / 48, a = -2.3 + u * Math.PI * 2 * 1.45;
      pts.push(new THREE.Vector3(Math.cos(a) * (9.2 + u * 0.8), 0.35 + u * (h + 1.4) + Math.sin(a * 1.5) * 0.45, Math.sin(a) * (6.6 + u * 0.6)));
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, 0.3, 14, false);
    geo.setDrawRange(0, Math.floor(320 * draw) * 14 * 6);
    ribbon.geometry.dispose(); ribbon.geometry = geo;
  }

  /* ---------- 4. les fonctions ---------- */
  const icons = [];
  function icon(group, float, land, size = 1.35) { group.userData = { float: new THREE.Vector3(...float), land: new THREE.Vector3(...land), size }; group.scale.setScalar(0.001); scene.add(group); icons.push(group); return group; }
  {
    const cal = new THREE.Group();                                   // réservation : un petit agenda
    cal.add(mesh(slab(2.2, 2.2, 0.55, 0.38), mStd(C.white, 0.45)));
    cal.add(mesh(slab(2.2, 0.62, 0.08, 0.3), mBlue(), 0, 0.55, -0.79));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cal.add(mesh(slab(0.34, 0.3, 0.06, 0.1), (r === 1 && c === 2) ? mBlue() : mStd(C.line), -0.55 + c * 0.55, 0.55, -0.1 + r * 0.45));
    icon(cal, [-8.2, 7.0, 2.2], [-4.6, 0, 2.6]);
    const bag = new THREE.Group();                                   // boutique : un sac
    bag.add(mesh(slab(1.9, 1.3, 1.9, 0.3), mStd(C.blueL, 0.55)));
    const handle = mesh(new THREE.TorusGeometry(0.5, 0.09, 12, 32, Math.PI), mStd(C.ink, 0.4), 0, 1.9, 0);
    bag.add(handle);
    icon(bag, [7.9, 7.8, -1.8], [4.8, 0, -2.4]);
    const toggle = new THREE.Group();                                // automatisation : un interrupteur
    const track = mesh(slab(2.6, 1.2, 0.4, 0.6), mStd(C.line, 0.5)); toggle.add(track);
    const knob = mesh(new THREE.SphereGeometry(0.46, 28, 18), mStd(C.white, 0.35), -0.62, 0.62, 0); toggle.add(knob);
    toggle.userData.track = track; toggle.userData.knob = knob;
    icon(toggle, [7.2, 5.6, 4.6], [3.6, 0, 3.0]);
    const langs = ['FR', 'NL', 'EN'].map((txt, j) => {                // langues : trois pastilles
      const tex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#171717'; x.font = '600 70px "Instrument Sans", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 4); });
      const g = new THREE.Group();
      g.add(mesh(slab(1.7, 0.85, 0.3, 0.42), mStd(C.white, 0.45)));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
      face.rotation.x = -Math.PI / 2; face.position.y = 0.305; g.add(face);
      return icon(g, [-3.2 + j * 3.0, 8.4 - j * 0.15, -5.6], [-2.2 + j * 2.4, 0, -0.2], 1.45);
    });
    void langs;
  }

  /* ---------- 5. le devis et le tampon ---------- */
  const paper = new THREE.Group(); scene.add(paper);
  paper.add(mesh(slab(5.8, 7.8, 0.07, 0.18), mStd(C.white, 0.75)));
  paper.add(mesh(slab(2.4, 0.5, 0.03, 0.12, true), mBlue(), -2.3, 0.07, -3.0));
  [[-2.3, -1.9, 3.4], [-2.3, -1.3, 2.6], [-2.3, -0.7, 3.0], [-2.3, -0.1, 2.2], [-2.3, 0.5, 2.8]].forEach(([x, z, w]) => paper.add(mesh(slab(w, 0.24, 0.03, 0.12, true), mStd(C.line, 0.8), x, 0.07, z)));
  paper.add(mesh(slab(4.6, 0.04, 0.03, 0.02, true), mStd(C.ink, 0.6), -2.3, 0.07, 1.25));
  paper.add(mesh(slab(1.6, 0.36, 0.03, 0.16, true), mStd(C.ink, 0.6), 0.7, 0.07, 1.8));
  const sealTex = canvasTex(512, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.translate(w / 2, h / 2);
    x.strokeStyle = '#1d5cf5'; x.fillStyle = '#1d5cf5';
    x.lineWidth = 14; x.beginPath(); x.arc(0, 0, 236, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 168, 0, Math.PI * 2); x.stroke();
    x.font = '600 44px "Instrument Sans", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const text = 'PRIX FIXE · DEVIS GRATUIT · ', n = text.length;
    for (let i = 0; i < n; i++) { x.save(); x.rotate((i / n) * Math.PI * 2); x.fillText(text[i], 0, -202); x.restore(); }
    x.font = '400 120px "Fraunces", Georgia, serif'; x.fillText('M&S', 0, 8);
  });
  const sealMat = new THREE.MeshBasicMaterial({ map: sealTex, transparent: true, opacity: 0, depthWrite: false });
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), sealMat);
  seal.rotation.set(-Math.PI / 2, 0, 0.32); seal.position.set(-1.05, 0.105, 2.55); paper.add(seal);
  const stamp = new THREE.Group(); scene.add(stamp);
  stamp.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.32, 40), mBlue(), 0, 0.16, 0));
  stamp.add(mesh(new THREE.CylinderGeometry(0.42, 0.62, 1.4, 28), mStd(C.ink, 0.45), 0, 1.0, 0));
  stamp.add(mesh(new THREE.SphereGeometry(0.62, 28, 18), mStd(C.ink, 0.45), 0, 1.95, 0));
  const PAPER = { x: 11.2, z: 4.6, ry: -0.3, s: 1.3 };
  paper.scale.setScalar(PAPER.s); stamp.scale.setScalar(PAPER.s);

  /* ---------- la pose à l’instant t ---------- */
  const v3 = new THREE.Vector3();
  function setOpacity(g, o) { g.userData.mats.forEach((m) => { m.transparent = o < 0.999; m.opacity = o; m.depthWrite = o > 0.5; }); }
  function pose(t, now) {
    // 1. le cadre et l’épingle
    const b = backOut(seg(t, 0, 0.9));
    base.scale.set(Math.max(0.001, b), Math.max(0.001, b), Math.max(0.001, b));
    dots.forEach((d, i) => d.scale.setScalar(Math.max(0.001, backOut(seg(t, 0.55 + i * 0.12, 0.95 + i * 0.12)))));
    const pd = seg(t, 0.9, 1.9);
    pin.visible = t > 0.9;
    pin.position.y = 9 * (1 - bounce(pd));
    pin.userData.disc.material.opacity = 0.14 * pd;
    // 2. les pages
    const press = easeInOut(seg(t, 9.4, 10.4));
    const gap = lerp(1.75, 0.34, press);
    layers.forEach((g, i) => {
      const a = easeOut(seg(t, 2.3 + i * 0.45, 3.5 + i * 0.45));
      g.visible = a > 0.001;
      g.position.y = 0.54 + gap * i + (1 - a) * 6;
      g.scale.setScalar(0.94 + 0.06 * a);
      setOpacity(g, a);
    });
    bars.forEach((m, k) => { const s = easeOut(seg(t, 3.0 + m.userData.i * 0.4 + (k % 4) * 0.12, 3.8 + m.userData.i * 0.4 + (k % 4) * 0.12)); m.scale.x = Math.max(0.001, s); });
    // 3. le design
    const hc = easeInOut(seg(t, 4.7, 5.4));
    home.userData.hero.material.color.lerpColors(heroFrom, heroTo, hc);
    home.userData.tiles.forEach((m, j) => { const s = backOut(seg(t, 5.0 + j * 0.15, 5.65 + j * 0.15)); m.scale.set(Math.max(0.001, s), 1, Math.max(0.001, s)); m.material.color.copy(tileFinal[j]); });
    const stackTop = 0.54 + gap * 2 + 0.25;
    setRibbon(stackTop + 0.4, easeInOut(seg(t, 5.2, 6.9)));
    // 4. les fonctions
    icons.forEach((g, j) => {
      const s = backOut(seg(t, 7.1 + j * 0.28, 7.75 + j * 0.28));
      const m = easeInOut(seg(t, 9.7 + j * 0.08, 10.6 + j * 0.08));
      const bob = Math.sin(now * 1.3 + j * 1.7) * 0.22 * (1 - m);
      const f = g.userData.float, l = g.userData.land;
      v3.set(lerp(f.x, l.x, m), lerp(f.y, stackTop + 0.02, m) + Math.sin(m * Math.PI) * 0.8, lerp(f.z, l.z, m));
      g.position.set(v3.x, v3.y + bob, v3.z);
      g.rotation.y = (1 - m) * Math.sin(now * 0.6 + j) * 0.25 + (1 - s) * 1.2;
      g.scale.setScalar(Math.max(0.001, s * lerp(g.userData.size, 1.05, m)));
      g.visible = s > 0.002;
      if (g.userData.knob) {
        const on = easeInOut(seg(t, 8.35, 8.8));
        g.userData.knob.position.x = lerp(-0.62, 0.62, on);
        g.userData.track.material.color.setHex(C.line).lerp(new THREE.Color(C.blue), on);
      }
    });
    // 5. le devis et le tampon
    const p = easeOut(seg(t, 9.8, 10.7));
    paper.visible = p > 0.001;
    paper.position.set(lerp(PAPER.x + 9, PAPER.x, p), 0, lerp(PAPER.z + 6, PAPER.z, p));
    paper.rotation.y = PAPER.ry + (1 - p) * 0.5;
    const down = easeIn(seg(t, 10.6, 11.0)), up = easeOut(seg(t, 11.15, 11.75));
    const ox = -1.05 * PAPER.s, oz = 2.55 * PAPER.s, cr = Math.cos(PAPER.ry), sr = Math.sin(PAPER.ry);
    const sx = PAPER.x + ox * cr + oz * sr, sz = PAPER.z - ox * sr + oz * cr;
    stamp.visible = t > 10.4 && up < 0.999;
    stamp.position.set(sx, lerp(lerp(9, 0.08, down), 9, up), sz);
    const squash = t > 10.95 && t < 11.2 ? 1 - Math.sin(seg(t, 10.95, 11.2) * Math.PI) * 0.12 : 1;
    stamp.scale.set(PAPER.s, PAPER.s * squash, PAPER.s);
    stamp.rotation.y = 0.32;
    sealMat.opacity = easeOut(seg(t, 10.98, 11.15)) * 0.92;
  }

  /* ---------- caméra ---------- */
  const target = new THREE.Vector3(), T0 = new THREE.Vector3(0.2, 1.8, 1.0), T1 = new THREE.Vector3(4.2, 1.0, 3.4);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let W = 1, H = 1;
  function resize() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  function placeCamera(t, now) {
    pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
    const az = THREE.MathUtils.degToRad(lerp(46, 30, easeInOut(seg(t, 0, END))) + Math.sin(now * 0.25) * 2.5 + pointer.x * 4);
    const pol = THREE.MathUtils.degToRad(54 + pointer.y * 3);
    const close = easeInOut(seg(t, 9.6, 11.4));
    target.copy(T0).lerp(T1, close);
    const R = lerp(11.9, 12.9, close), half = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(half) * camera.aspect);
    const dist = R / Math.sin(Math.min(half, hHalf)) * 0.92;
    camera.position.set(target.x + dist * Math.sin(pol) * Math.sin(az), target.y + dist * Math.cos(pol), target.z + dist * Math.sin(pol) * Math.cos(az));
    camera.lookAt(target);
  }

  /* ---------- lecture ---------- */
  let t = reduced ? END : 0, playing = false, visible = false, raf = 0, last = 0, step = -1;
  const t0 = performance.now();
  function notify() { let s = 0; STEPS.forEach((v, i) => { if (t >= v) s = i; }); if (t >= END - 0.01) s = STEPS.length - 1; if (s !== step) { step = s; onStep(s, t); } }
  function frame(nowMs) {
    raf = 0;
    const now = (nowMs - t0) / 1000, dt = Math.min(0.05, last ? (nowMs - last) / 1000 : 1 / 60); last = nowMs;
    if (playing) { t = Math.min(END, t + dt); if (t >= END) { playing = false; onEnd(); } }
    renderer.shadowMap.autoUpdate = playing;
    if (playing) renderer.shadowMap.needsUpdate = true;
    pose(t, now); placeCamera(t, now); notify();
    renderer.render(scene, camera);
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  function renderAt(time, now = 0) { t = time; pose(t, now); placeCamera(t, now); renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera); notify(); }

  resize();
  renderAt(t);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { resize(); if (!raf) renderAt(t); }) : null;
  if (ro) ro.observe(host);
  host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(); pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1; });
  host.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });
  onReady();
  return {
    canvas, renderer, renderAt,
    play(from = 0) { if (reduced) { renderAt(END); return; } t = from; playing = true; renderer.shadowMap.needsUpdate = true; kick(); },
    jump(i) { this.play(STEPS[i] || 0); },
    setVisible(v) { visible = v; if (v && !reduced) kick(); },
    get time() { return t; }, get playing() { return playing; },
  };
}
