/* ==========================================================================
   M&S Design — le ruban bleu
   Un ruban de satin en 3D (Three.js) dans la section « Le studio » : bleu sur une face,
   orange au revers. Il arrive par la gauche, plonge derrière la vidéo, en ressort par le bas,
   en fait le tour, repasse devant par le haut, puis file sous le bouton et repart en vague.
   Il vrille par moments (on voit alors le revers orange), se dessine quand la section arrive,
   se rembobine quand on remonte la page, ondule doucement, s’écarte de la souris
   et frémit au défilement. Purement décoratif.
   Options : path (tracé sur mesure, en px), color, back (couleur du revers), trigger (hauteur d’écran où il se dessine).
   ========================================================================== */
import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Écran large (vidéo à gauche, texte à droite).
   Chaque point : [x, y, z] en px depuis le coin haut gauche de la section.
   z < 0 : le ruban passe derrière la vidéo ; z > 0 : devant. */
function widePath(rel, W) {
  const c = rel('.reel__link'), b = rel('.btn--dot');
  if (!c || !b) return null;
  const { x, y, w, h } = c, X = x + w, Y = y + h;
  const by = b.y + b.h * 0.55;
  const gauche = Math.min(w * 0.08, x * 0.75);                                  // marge à gauche de la vidéo
  return [
    [-90, y - h * 0.62, 0],                     // arrive par la gauche
    [x + w * 0.18, y - h * 0.5, 0],
    [x + w * 0.5, y - h * 0.24, -6],
    [x + w * 0.6, y + h * 0.45, -40],           // plonge derrière la vidéo
    [x + w * 0.44, Y + h * 0.16, -30],          // ressort par le bas
    [x - gauche * 0.2, Y + h * 0.06, 0],
    [x - gauche, y + h * 0.4, 12],              // remonte sur la gauche
    [x + w * 0.06, y - h * 0.04, 30],           // repasse devant, le long du bord haut
    [x + w * 0.62, y - h * 0.09, 30],
    [X + w * 0.06, y + h * 0.08, 20],
    [b.x - 20, by + h * 0.02, 0],               // file sous le bouton
    [b.x + b.w * 0.8, by + h * 0.04, 0],
    [b.x + b.w * 1.8, by + h * 0.34, 0],        // vague
    [W - (W - b.x) * 0.25, by + h * 0.1, 0],
    [W + 90, by + h * 0.22, 0],                 // sort à droite
  ];
}

/* Écran étroit (texte au-dessus, vidéo en dessous) : le ruban arrive par la droite entre le bouton
   et la vidéo, plonge derrière elle, ressort en bas, remonte à droite, repasse devant par le haut
   et sort à gauche. */
function stackedPath(rel, W) {
  const c = rel('.reel__link'), b = rel('.btn--dot');
  if (!c || !b) return null;
  const { x, y, w, h } = c, X = x + w, Y = y + h;
  const gy = b.y + b.h + (y - b.y - b.h) * 0.5;                                 // entre le bouton et la vidéo
  const marge = Math.min(w * 0.06, (W - X) * 0.7);
  return [
    [W + 60, gy - 12, 0],
    [x + w * 0.72, gy + 4, 0],
    [x + w * 0.46, y + h * 0.4, -40],           // derrière la vidéo
    [x + w * 0.62, Y + h * 0.2, -30],           // ressort par le bas
    [X + marge * 0.3, Y - h * 0.02, 0],
    [X + marge, y + h * 0.42, 12],              // remonte à droite
    [X - w * 0.12, y - h * 0.07, 30],           // repasse devant, le long du bord haut
    [x + w * 0.22, y - h * 0.1, 30],
    [x - Math.min(w * 0.06, x * 0.7), y + h * 0.5, 10],
    [x + w * 0.12, Y + h * 0.28, 0],
    [-60, Y + h * 0.16, 0],                      // sort à gauche
  ];
}

/* Le tracé de la section « M&S Studio » de l’accueil */
function studioPath({ rel, W }) {
  const b = rel('.btn--dot'), c = rel('.reel__link');
  const stacked = b && c && c.y > b.y + b.h;                                  // texte au-dessus de la vidéo
  const pts = stacked ? stackedPath(rel, W) : widePath(rel, W);
  const width = stacked ? clamp(W * 0.036, 12, 17) : clamp(W * 0.02, 15, 30);
  return pts ? { width, pts } : null;
}

export function createRibbon(host, { reduced = false, grid = null, lenis = () => null, path = studioPath, color = 0x1d5cf5, back = 0xd2570f, trigger = 0.62, light = null } = {}) {
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
  scene.add(new THREE.HemisphereLight(0xf2f5ff, light || 0x1736b8, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-0.45, 0.75, 1);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb6ff, 0.9);
  rim.position.set(0.6, -0.8, 0.4);
  scene.add(rim);

  /* Le satin : bleu devant, orange au revers. Les morceaux « derrière » (z < 0) disparaissent
     là où ils croisent la vidéo (rectangle aux coins arrondis), comme s’ils passaient dessous. */
  const card = { value: new THREE.Vector4(0, 0, 0, 0) }, cardR = { value: 14 };
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22, sheen: 0.5, sheenRoughness: 0.4, sheenColor: 0xc9d8ff, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBack = { value: new THREE.Color(back) };
    sh.uniforms.uCard = card; sh.uniforms.uCardR = cardR;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLayer;\nvarying float vLayer;\nvarying vec2 vXY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayer = aLayer;\nvXY = transformed.xy;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBack;\nuniform vec4 uCard;\nuniform float uCardR;\nvarying float vLayer;\nvarying vec2 vXY;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        if (vLayer < 0.0 && uCard.z > 0.0) {
          vec2 q = abs(vec2(vXY.x, -vXY.y) - (uCard.xy + uCard.zw * 0.5)) - uCard.zw * 0.5 + uCardR;
          if (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uCardR < 0.0) discard;
        }
        vec4 diffuseColor = vec4( gl_FrontFacing ? diffuse : uBack, opacity );`);
  };

  // la géométrie du ruban : deux sommets par tranche, recalculés à chaque image
  const SEG = 320;
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(new Float32Array((SEG + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const aNor = new THREE.BufferAttribute(new Float32Array((SEG + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const aLay = new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('normal', aNor); geo.setAttribute('aLayer', aLay);
  const index = new Uint16Array(SEG * 6);
  for (let i = 0; i < SEG; i++) { const a = i * 2; index.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6); }
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const N = 110;
  const rest = Array.from({ length: N }, () => new THREE.Vector3());
  const off = Array.from({ length: N }, () => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  const pts = Array.from({ length: N }, () => new THREE.Vector3());
  let W = 1, H = 1, width = 20, ready = false, draw = reduced ? 1 : 0, prog = draw, visible = false, raf = 0, last = 0, time = 0;
  const pointer = { x: -1e4, y: -1e4, active: false };
  let lastScroll = window.scrollY, scrollKick = 0;

  // position d’un élément dans la section, sans tenir compte des animations d’apparition (transform)
  const rel = (sel) => {
    const el = host.querySelector(sel);
    if (!el || !el.offsetParent) return null;
    let x = 0, y = 0, e = el;
    while (e && e !== host) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return e === host ? { x, y, w: el.offsetWidth, h: el.offsetHeight } : null;
  };

  function layout() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H; camera.updateProjectionMatrix();
    const P = path({ rel, W, H });
    ready = !!P;
    if (!P) return;
    width = P.width;
    const c = rel('.reel__link');
    card.value.set(c ? c.x : 0, c ? c.y : 0, c ? c.w : 0, c ? c.h : 0);
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
    for (let i = 1; i < N - 1; i++) {                                         // le ruban transmet le mouvement
      const a = off[i - 1], b = off[i + 1], o = off[i];
      o.vx += ((a.x + b.x) * 0.5 - o.x) * 0.3 * k; o.vy += ((a.y + b.y) * 0.5 - o.y) * 0.3 * k;
    }
    const damp = Math.pow(0.86, k);
    for (let i = 0; i < N; i++) { const o = off[i]; o.vx *= damp; o.vy *= damp; o.x += o.vx * k; o.y += o.vy * k; }
  }

  /* La vrille : trois tours complets à des endroits choisis (le revers orange apparaît au milieu du tour),
     plus un léger roulis qui bouge avec le temps, pour que le satin accroche la lumière. */
  const twist = (s) => Math.PI * 2 * (smooth(0.07, 0.17, s) + smooth(0.43, 0.52, s) + smooth(0.8, 0.9, s)) + Math.sin(time * 0.7 + s * 9) * 0.32;

  const T = new THREE.Vector3(), S0 = new THREE.Vector3(), U0 = new THREE.Vector3(), side = new THREE.Vector3(), nrm = new THREE.Vector3(), tmp = new THREE.Vector3();
  function build() {
    if (!ready) return;
    for (let i = 0; i < N; i++) pts[i].set(rest[i].x + off[i].x, rest[i].y + off[i].y, rest[i].z);
    const sp = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getSpacedPoints(SEG);
    const P = aPos.array, Nn = aNor.array, Ly = aLay.array, hw = width / 2;
    for (let i = 0; i <= SEG; i++) {
      const p = sp[i];
      T.subVectors(sp[Math.min(SEG, i + 1)], sp[Math.max(0, i - 1)]).normalize();
      S0.set(T.y, -T.x, 0).normalize();                                       // largeur du ruban, à plat face à nous
      U0.crossVectors(S0, T).normalize();                                     // la face bleue regarde vers nous
      const th = twist(i / SEG), c = Math.cos(th), s = Math.sin(th);
      side.copy(S0).multiplyScalar(c).addScaledVector(U0, s);
      nrm.copy(U0).multiplyScalar(c).addScaledVector(S0, -s);
      const j = i * 6;
      P[j] = p.x + side.x * hw; P[j + 1] = p.y + side.y * hw; P[j + 2] = p.z + side.z * hw;
      P[j + 3] = p.x - side.x * hw; P[j + 4] = p.y - side.y * hw; P[j + 5] = p.z - side.z * hw;
      tmp.copy(nrm).addScaledVector(side, 0.75).normalize();                  // le satin est un peu bombé : la lumière glisse en travers
      Nn[j] = tmp.x; Nn[j + 1] = tmp.y; Nn[j + 2] = tmp.z;
      tmp.copy(nrm).addScaledVector(side, -0.75).normalize();
      Nn[j + 3] = tmp.x; Nn[j + 4] = tmp.y; Nn[j + 5] = tmp.z;
      Ly[i * 2] = Ly[i * 2 + 1] = p.z;
    }
    aPos.needsUpdate = aNor.needsUpdate = aLay.needsUpdate = true;
    geo.setDrawRange(0, Math.floor(SEG * draw) * 6);
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60); last = now;
    // se dessine quand la section est montée assez haut, se rembobine quand on redescend la page vers le haut
    if (!reduced) {
      const target = host.getBoundingClientRect().top < window.innerHeight * trigger ? 1 : 0;
      prog = target > prog ? Math.min(1, prog + dt / 2.6) : Math.max(0, prog - dt / 1.6);
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
  return { renderer, layout, setDraw(v) { draw = prog = v; still(); }, stats: () => ({ draw, ready, maxOff: Math.max(...off.map((o) => Math.hypot(o.x, o.y))).toFixed(1), visible }) };
}
