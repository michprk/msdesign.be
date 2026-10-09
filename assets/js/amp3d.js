/* ==========================================================================
   M&S Design — le « & » du logo, en volume, au centre du héros
   Le tracé du logo (amp.js) est extrudé, adouci, légèrement tordu, puis
   habillé d’un motif organique orange et lilas, brillant comme une
   céramique émaillée. Il flotte, suit la souris et tourne en défilant.
   createAmp3D(container) → { resize, snapshot, pause, resume }
   ========================================================================== */
import * as THREE from '../vendor/three.module.min.js?v=afd2890d03';
import { AMP } from './amp.js?v=afd2890d03';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const out3 = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* ---------- Le tracé : points du logo, adoucis (Chaikin) ---------- */
function outline() {
  const nums = AMP.d.match(/-?[\d.]+/g).map(Number);
  let pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  for (let k = 0; k < 3; k++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = next;
  }
  const s = 2 / AMP.h;                       // 2 unités de haut
  return pts.map(([x, y]) => new THREE.Vector2((x - AMP.w / 2) * s, (AMP.h / 2 - y) * s));
}

/* ---------- Normales lissées (reflets continus sur les arrondis) ---------- */
function smooth(geo, angle) {
  const pos = geo.attributes.position, n = pos.count;
  const cos = Math.cos(angle);
  const face = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    c.sub(b); a.sub(b); c.cross(a);
    for (let k = 0; k < 3; k++) face.set([c.x, c.y, c.z], (i + k) * 3);
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const key = Math.round(pos.getX(i) * 1e4) + '|' + Math.round(pos.getY(i) * 1e4) + '|' + Math.round(pos.getZ(i) * 1e4);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(i);
  }
  const out = new Float32Array(n * 3);
  const u = new THREE.Vector3(), v = new THREE.Vector3();
  for (const list of groups.values()) {
    for (const i of list) {
      u.set(face[i * 3], face[i * 3 + 1], face[i * 3 + 2]).normalize();
      let sx = 0, sy = 0, sz = 0;
      for (const j of list) {
        v.set(face[j * 3], face[j * 3 + 1], face[j * 3 + 2]);
        const l = v.length() || 1;
        if ((u.x * v.x + u.y * v.y + u.z * v.z) / l >= cos) { sx += v.x; sy += v.y; sz += v.z; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      out[i * 3] = sx / l; out[i * 3 + 1] = sy / l; out[i * 3 + 2] = sz / l;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

/* ---------- Le volume : extrusion arrondie, torsion douce ---------- */
function ampGeometry() {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(outline()), {
    depth: 0.34, bevelEnabled: true, bevelThickness: 0.11, bevelSize: 0.022, bevelSegments: 10, curveSegments: 1, steps: 1
  });
  geo.center();
  const p = geo.attributes.position;
  // le motif est projeté de face : il court sur la tranche comme sur la céramique
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);       // taches étirées en biais
    uv[i * 2] = (x * 0.88 - y * 0.47) * 0.95 + p.getZ(i) * 0.3;
    uv[i * 2 + 1] = (x * 0.47 + y * 0.88) * 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y * 0.34;                                  // torsion autour de l’axe vertical
    const X = x * Math.cos(t) - z * Math.sin(t);
    const Z = x * Math.sin(t) + z * Math.cos(t) - y * y * 0.07;
    p.setXYZ(i, X, y, Z);
  }
  smooth(geo, Math.PI / 3.4);
  return geo;
}

/* ---------- Le motif : taches organiques lilas sur fond orange ---------- */
function patternTexture(maxAniso) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  // bruit de valeur, périodique (le motif se répète sans couture)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grid = (n) => Array.from({ length: n * n }, rnd);
  const octaves = [[9, 1], [18, 0.5], [36, 0.2]].map(([n, w]) => ({ n, w, g: grid(n) }));
  const sm = (t) => t * t * (3 - 2 * t);
  const noise = (u, v) => {
    let s = 0, tot = 0;
    for (const o of octaves) {
      const fx = u * o.n, fy = v * o.n;
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const at = (a, b) => o.g[((b % o.n + o.n) % o.n) * o.n + ((a % o.n + o.n) % o.n)];
      const top = lerp(at(ix, iy), at(ix + 1, iy), tx), bot = lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx);
      s += lerp(top, bot, ty) * o.w; tot += o.w;
    }
    return s / tot;
  };
  const im = x.createImageData(S, S);
  const A = [240, 98, 34], B = [214, 150, 238], E = [214, 74, 26];
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const u = i / S, v = j / S;
      const n = noise(u, v);
      const k = clamp((n - 0.565) / 0.02, 0, 1);         // bord net mais doux
      const r = clamp((0.565 - n) / 0.03, 0, 1);         // liseré orange plus soutenu autour des taches
      const edge = (1 - k) * (1 - r);
      const o = (j * S + i) * 4;
      for (let ch = 0; ch < 3; ch++) im.data[o + ch] = Math.round(lerp(lerp(A[ch], E[ch], edge * 0.6), B[ch], k));
      im.data[o + 3] = 255;
    }
  }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
}

/* ---------- Un studio photo pour les reflets ---------- */
function studioEnv(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 30, 40), new THREE.MeshBasicMaterial({ color: 0x9a9893, side: THREE.BackSide })));
  const panel = (w, h, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(14, 10, 6, [-12, 9, 10]);     // grande boîte à lumière, en haut à gauche
  panel(6, 14, 3, [14, 2, 6]);        // bande verticale à droite
  panel(20, 3, 4, [0, 14, -4]);       // plafond
  panel(10, 6, 1.4, [0, -6, 14]);     // réflecteur en bas
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.02, 0.1, 100);
  pm.dispose();
  return rt.texture;
}

export async function createAmp3D(container, options) {
  const opts = Object.assign({ still: false }, options);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.still });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'amp3d';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 7);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2d0, 0.9);
  rim.position.set(5, -2, -3);
  scene.add(rim);

  const mat = new THREE.MeshPhysicalMaterial({
    map: patternTexture(renderer.capabilities.getMaxAnisotropy()),
    roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.18,
    sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffd7c4), envMapIntensity: 0.95
  });
  const amp = new THREE.Mesh(ampGeometry(), mat);
  const holder = new THREE.Group();
  holder.add(amp);
  scene.add(holder);

  /* ----- Cadrage : où se pose le & dans le héros ----- */
  let VW = 1, VH = 1;
  const place = { x: 0, y: 0, s: 1 };
  function frame() {
    const aspect = VW / VH;
    const s = container.dataset;
    const portrait = aspect < 0.9 || VW <= 700;
    const fx = Number(s.fx || (portrait ? 0.62 : 0.6));
    const fy = Number(s.fy || (portrait ? 0.56 : 0.47));
    const fh = Number(s.fh || (portrait ? 0.3 : 0.6));
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    place.s = (fh * 2 * halfH) / 2.1;
    place.x = (fx - 0.5) * 2 * halfH * aspect;
    place.y = -(fy - 0.5) * 2 * halfH;
  }
  function resize() {
    const r = container.getBoundingClientRect();
    VW = Math.max(1, r.width); VH = Math.max(1, r.height);
    renderer.setSize(VW, VH, false);
    camera.aspect = VW / VH;
    camera.updateProjectionMatrix();
    frame();
    dirty = true;
  }

  /* ----- Mouvement : arrivée, flottement, souris, défilement ----- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const t0 = performance.now();
  let scrollK = 0, dirty = true, running = false, visible = true;
  const reduced = document.documentElement.classList.contains('reduced');
  function pose(now) {
    const t = (now - t0) / 1000;
    const intro = opts.still || reduced ? 1 : out3(t / 1.9);
    const idle = opts.still || reduced ? 0 : t;
    holder.position.set(place.x, place.y + Math.sin(idle * 0.9) * 0.05 * place.s + scrollK * 0.9, 0);
    holder.scale.setScalar(place.s * lerp(0.72, 1, intro) * (1 - scrollK * 0.12));
    holder.rotation.set(
      -0.12 + pointer.y * 0.22 + Math.sin(idle * 0.6) * 0.04,
      -0.42 + (1 - intro) * -2.2 + pointer.x * 0.42 + Math.sin(idle * 0.45) * 0.1 + scrollK * 1.1,
      0.1 + scrollK * 0.35
    );
  }
  function render(now) {
    pose(now || performance.now());
    renderer.render(scene, camera);
  }
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    if (!visible && !dirty) return;
    dirty = false;
    render(now);
  }
  function start() { if (!running && !opts.still) { running = true; requestAnimationFrame(loop); } }
  function stop() { running = false; }

  if (!opts.still) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer.tx = clamp(e.clientX / window.innerWidth * 2 - 1, -1, 1);
      pointer.ty = clamp(e.clientY / window.innerHeight * 2 - 1, -1, 1);
    }, { passive: true });
    window.addEventListener('scroll', () => { scrollK = clamp(window.scrollY / Math.max(1, VH), 0, 1); dirty = true; }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) { dirty = true; start(); } else stop(); }).observe(container);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(container);
  else window.addEventListener('resize', resize);
  resize();
  render();
  start();

  return {
    canvas,
    resize,
    pause: stop,
    resume: start,
    snapshot() { render(); return canvas.toDataURL('image/png'); },
    _debug: { THREE, scene, camera, renderer, amp, holder, place }
  };
}
