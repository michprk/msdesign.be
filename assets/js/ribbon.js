/* ==========================================================================
   M&S Design — la ficelle bleue
   Un tube 3D (Three.js) qui serpente derrière la section « Le studio ».
   Il se dessine quand la section arrive, se rembobine quand on remonte la page,
   ondule doucement, s’écarte de la souris et frémit au défilement. Purement décoratif.
   Options : path (tracé sur mesure, en px), color, trigger (hauteur d’écran où il se dessine).
   ========================================================================== */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Le tracé, en unités de la grille (0 → 1 = largeur et hauteur de la grille de la section).
   x < 0 ou > 1 : dans les marges ; le premier et le dernier point sortent de l’écran.
   z : profondeur, pour que la boucle passe vraiment devant puis derrière elle-même. */
const PATH_WIDE = [
  [-0.2, 0.8, 0], [-0.03, 0.5, 0], [0.0, 0.2, 0], [0.1, 0.0, 0], [0.25, -0.1, 0], [0.4, -0.08, 0], [0.49, 0.06, 0],
  [0.51, 0.3, 0], [0.515, 0.55, 0], [0.56, 0.8, 0], [0.7, 0.93, 0], [0.86, 0.9, 30], [0.94, 0.78, 30], [0.92, 0.67, 20],
  [0.84, 0.69, -20], [0.83, 0.87, -30], [0.92, 1.01, -20], [1.02, 1.01, 0], [1.1, 1.08, 0], [1.3, 1.2, 0],
];
/* Écran étroit (texte au-dessus, vidéo en dessous) : la boucle se pose à droite du bouton,
   puis la ficelle file derrière la vidéo et ressort en bas à gauche. Tracé calé sur les éléments. */
function stackedPath(rel, W) {
  const t = rel('.manifeste__text'), b = rel('.btn--dot'), c = rel('.reel__link'), g = rel('[data-ribbon-grid]');
  if (!t || !b || !c || !g) return null;
  const R = g.x + g.w, free = R - (b.x + b.w), by = b.y + b.h / 2;
  const lr = Math.max(18, Math.min(free * 0.2, 70, (by - (t.y + t.h)) * 0.85, (c.y - by) * 0.6));
  const lx = b.x + b.w + free * 0.58;
  return [
    [W + 80, by - lr * 0.5, 0], [lx + lr * 2.2, by - lr * 0.15, 0], [lx + lr * 1.2, by + lr * 0.9, 0],
    [lx - lr * 0.2, by + lr * 1.0, 20], [lx - lr * 1.0, by + lr * 0.1, 20], [lx - lr * 0.1, by - lr * 0.95, -20],
    [lx + lr * 0.9, by - lr * 0.1, -20], [lx + lr * 0.4, by + lr * 1.45, 0], [c.x + c.w * 0.5, c.y + c.h * 0.5, 0],
    [c.x + c.w * 0.14, c.y + c.h + 36, 0], [-80, c.y + c.h + 14, 0],
  ];
}

/* Le tracé de la section « M&S Studio » de l’accueil */
function studioPath({ rel, W, gx, gy, gw, gh }) {
  const b = rel('.btn--dot'), c = rel('.reel__link');
  const stacked = b && c && c.y > b.y + b.h;                                  // texte au-dessus de la vidéo
  const S = stacked ? stackedPath(rel, W) : null;
  const radius = stacked ? clamp(W * 0.018, 6.5, 9) : clamp(W * 0.0082, 6.5, 12.5);
  if (S) return { radius, pts: S };
  return { radius, pts: PATH_WIDE.map(([u, v, z], i) => {
    let x = gx + u * gw;
    if (i === 0 || i === PATH_WIDE.length - 1) x = u < 0 ? -radius * 6 : W + radius * 6;      // les bouts sortent de l’écran
    return [x, gy + v * gh, z];
  }) };
}

export function createRibbon(host, { reduced = false, grid = null, lenis = () => null, path = studioPath, color = 0x1d5cf5, trigger = 0.62, light = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'ribbon__gl';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { return null; }
  host.appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -1000, 1000);
  camera.position.z = 500;
  scene.add(new THREE.HemisphereLight(0xf2f5ff, light || 0x1736b8, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-0.45, 0.75, 1);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb6ff, 0.9);
  rim.position.set(0.6, -0.8, 0.4);
  scene.add(rim);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.36, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
  scene.add(mesh, cap);

  const N = 110, TS = 260, RS = 14;
  const rest = Array.from({ length: N }, () => new THREE.Vector3());
  const off = Array.from({ length: N }, () => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  const pts = Array.from({ length: N }, () => new THREE.Vector3());
  let W = 1, H = 1, radius = 10, draw = reduced ? 1 : 0, prog = draw, visible = false, raf = 0, last = 0, time = 0;
  const pointer = { x: -1e4, y: -1e4, active: false };
  let lastScroll = window.scrollY, scrollKick = 0;

  function layout() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H; camera.updateProjectionMatrix();
    const g = (grid || host).getBoundingClientRect();
    const gx = g.left - r.left, gy = g.top - r.top, gw = g.width, gh = g.height;
    const rel = (sel) => { const el = host.querySelector(sel); if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.left - r.left, y: q.top - r.top, w: q.width, h: q.height }; };
    const P = path({ rel, W, H, gx, gy, gw, gh });
    radius = P.radius;
    const ctrl = P.pts.map(([x, y, z]) => new THREE.Vector3(x, -y, z));
    const spline = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    for (let i = 0; i < N; i++) rest[i].copy(spline.getPointAt(i / (N - 1)));
  }

  function step(dt) {
    time += dt;
    const k = dt * 60;
    const L = lenis();
    let v = L && typeof L.velocity === 'number' ? L.velocity : (window.scrollY - lastScroll) / Math.max(1, k);
    lastScroll = window.scrollY;
    scrollKick += (clamp(v, -60, 60) - scrollKick) * 0.2;
    const amp = Math.min(W, 1400) * 0.0055;
    const R = clamp(W * 0.12, 100, 190);
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1), o = off[i], p = rest[i];
      const tx = Math.sin(time * 0.55 + s * 7.0) * amp + Math.sin(time * 0.29 + s * 15.0) * amp * 0.45;
      const ty = Math.cos(time * 0.46 + s * 6.2) * amp + Math.cos(time * 0.33 + s * 11.0) * amp * 0.35;
      o.vx += (tx - o.x) * 0.012 * k; o.vy += (ty - o.y) * 0.012 * k;
      if (pointer.active) {
        const dx = p.x + o.x - pointer.x, dy = -(p.y + o.y) - pointer.y, d = Math.hypot(dx, dy);
        if (d < R && d > 0.001) { const f = (1 - d / R) ** 2 * 3.4 * k; o.vx += (dx / d) * f; o.vy -= (dy / d) * f; }
      }
      o.vy += scrollKick * 0.018 * Math.sin(s * Math.PI * 5 + time * 2.2) * k;
    }
    for (let i = 1; i < N - 1; i++) {                                         // la ficelle transmet le mouvement
      const a = off[i - 1], b = off[i + 1], o = off[i];
      o.vx += ((a.x + b.x) * 0.5 - o.x) * 0.3 * k; o.vy += ((a.y + b.y) * 0.5 - o.y) * 0.3 * k;
    }
    const damp = Math.pow(0.86, k);
    for (let i = 0; i < N; i++) { const o = off[i]; o.vx *= damp; o.vy *= damp; o.x += o.vx * k; o.y += o.vy * k; }
  }

  function build() {
    for (let i = 0; i < N; i++) pts[i].set(rest[i].x + off[i].x, rest[i].y + off[i].y, rest[i].z);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, TS, radius, RS, false);
    const seg = Math.floor(TS * draw);
    geo.setDrawRange(0, seg * RS * 6);
    mesh.geometry.dispose(); mesh.geometry = geo;
    cap.visible = draw > 0.002 && draw < 0.999;
    if (cap.visible) { cap.position.copy(curve.getPointAt(seg / TS)); cap.scale.setScalar(radius); }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60); last = now;
    // se dessine quand la section est montée assez haut, se rembobine quand on redescend la page vers le haut
    if (!reduced) {
      const target = host.getBoundingClientRect().top < window.innerHeight * trigger ? 1 : 0;
      prog = target > prog ? Math.min(1, prog + dt / 2.4) : Math.max(0, prog - dt / 1.6);
      draw = easeInOut(prog);
    }
    step(dt); build(); renderer.render(scene, camera);
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible && !reduced) { last = 0; raf = requestAnimationFrame(frame); } };
  const still = () => { build(); renderer.render(scene, camera); };

  layout();
  if (reduced) still();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { layout(); if (reduced) still(); }) : null;
  if (ro) { ro.observe(host); if (grid) ro.observe(grid); }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      visible = e.isIntersecting;
      if (!visible && !reduced && e.boundingClientRect.top > 0) { prog = 0; draw = 0; }        // repartie sous l’écran : on rembobine
      if (visible) kick();
    });
  }, { threshold: [0, 0.2, 0.4] });
  io.observe(host);
  window.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    pointer.active = e.pointerType === 'mouse' && pointer.y > -200 && pointer.y < r.height + 200;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; });
  return { renderer, layout, setDraw(v) { draw = prog = v; still(); }, stats: () => ({ draw, maxOff: Math.max(...off.map((o) => Math.hypot(o.x, o.y))).toFixed(1), visible }) };
}
