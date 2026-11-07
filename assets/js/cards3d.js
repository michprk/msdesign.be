/* ==========================================================================
   M&S Design — l’équipe en cartes à jouer (Three.js)
   Un dos de carte M&S, puis une carte par personne, lue dans le HTML de la
   page (.pcard) : on les distribue quand la section arrive, on les ramasse
   quand on remonte. Survol : la carte se soulève et suit la souris ; clic :
   elle se retourne. Une ficelle crème fait une orbite autour du jeu.
   ========================================================================== */
import * as THREE from '../vendor/three.module.min.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const BLUE = '#155eef', CREAM = '#f5f1e9', INK = '#171717';
const CW = 6.3, CH = 8.8, CR = 0.42;                          // proportions d’une vraie carte (63 × 88 mm)

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function faceGeo() {
  const g = new THREE.ShapeGeometry(rrShape(CW, CH, CR), 10);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / CW + 0.5, p.getY(i) / CH + 0.5);
  return g;
}
const rr = (x, X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
function tex(draw, w = 1024, h = 1430, aniso = 8) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}

/* ---------- le recto : lu dans le HTML ---------- */
function frontTexture(card, aniso) {
  const q = (s) => (card.querySelector(s) || {}).textContent || '';
  const suit = q('.pcard__suit').trim().toUpperCase(), rank = q('.pcard__corner b').trim(), name = q('.pcard__name').trim(), role = q('.pcard__role').trim();
  const items = Array.from(card.querySelectorAll('.pcard__list li')).map((li) => li.textContent.trim());
  return tex((x, w, h) => {
    x.fillStyle = '#fbf9f4'; x.fillRect(0, 0, w, h);
    const head = () => {
      x.fillStyle = INK; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      x.font = '600 40px "Instrument Sans", Arial, sans-serif';
      if ('letterSpacing' in x) x.letterSpacing = '5px';
      let fs = 40; while (x.measureText(suit).width > w - 330 && fs > 26) { fs -= 2; x.font = `600 ${fs}px "Instrument Sans", Arial, sans-serif`; }
      x.fillText(suit, 74, 128);
      if ('letterSpacing' in x) x.letterSpacing = '0px';
      x.textAlign = 'center'; x.font = '400 128px "Fraunces", Georgia, serif'; x.fillText(rank, w - 122, 158);
      x.fillStyle = BLUE; x.font = '400 84px "Fraunces", Georgia, serif'; x.fillText('&', w - 122, 252);
    };
    head();
    x.save(); x.translate(w, h); x.rotate(Math.PI); head(); x.restore();                    // en miroir, comme une vraie carte
    x.textAlign = 'left'; x.fillStyle = INK; x.font = '400 150px "Fraunces", Georgia, serif'; x.fillText(name, 70, 470);
    x.fillStyle = '#4a4741'; x.font = '500 40px "Instrument Sans", Arial, sans-serif'; x.fillText(role, 74, 540);
    items.forEach((it, i) => {
      const y = 650 + i * 92;
      x.fillStyle = INK; x.font = '400 38px "Instrument Sans", Arial, sans-serif'; x.fillText(it, 74, y);
      x.fillStyle = 'rgba(21,94,239,0.55)';
      for (let d = 76; d < w - 76; d += 16) { x.beginPath(); x.arc(d, y + 34, 2.6, 0, Math.PI * 2); x.fill(); }
    });
  }, 1024, 1430, aniso);
}
/* ---------- le verso : un dessin M&S (cadre, losanges, médaillon, &) ---------- */
function backTexture(aniso) {
  return tex((x, w, h) => {
    x.fillStyle = BLUE; x.fillRect(0, 0, w, h);
    x.strokeStyle = CREAM; x.fillStyle = CREAM; x.lineCap = 'round';
    x.lineWidth = 10; rr(x, 46, 46, w - 92, h - 92, 54); x.stroke();
    x.lineWidth = 3; rr(x, 76, 76, w - 152, h - 152, 34); x.stroke();
    // trame de losanges
    x.save(); rr(x, 96, 96, w - 192, h - 192, 26); x.clip();
    x.globalAlpha = 0.5; x.lineWidth = 2.4;
    for (let k = -h; k < w + h; k += 64) { x.beginPath(); x.moveTo(k, 96); x.lineTo(k + (h - 192), h - 96); x.stroke(); x.beginPath(); x.moveTo(k, h - 96); x.lineTo(k + (h - 192), 96); x.stroke(); }
    x.restore(); x.globalAlpha = 1;
    // médaillon central
    const cx = w / 2, cy = h / 2;
    x.fillStyle = BLUE; x.beginPath(); x.ellipse(cx, cy, 300, 360, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = CREAM; x.lineWidth = 8; x.beginPath(); x.ellipse(cx, cy, 300, 360, 0, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.ellipse(cx, cy, 262, 322, 0, 0, Math.PI * 2); x.stroke();
    [0, 1, 2, 3].forEach((i) => { const a = i * Math.PI / 2; x.beginPath(); x.arc(cx + Math.cos(a) * 300, cy + Math.sin(a) * 360, 16, 0, Math.PI * 2); x.fill(); });
    x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = '400 380px "Fraunces", Georgia, serif'; x.fillText('&', cx, cy + 128);
    const mark = () => { x.font = '600 34px "Instrument Sans", Arial, sans-serif'; if ('letterSpacing' in x) x.letterSpacing = '10px'; x.fillText('M&S', w / 2 + 5, 176); if ('letterSpacing' in x) x.letterSpacing = '0px'; };
    x.fillStyle = BLUE; x.fillRect(w / 2 - 120, 140, 240, 50); x.fillStyle = CREAM; mark();
    x.save(); x.translate(w, h); x.rotate(Math.PI); x.fillStyle = BLUE; x.fillRect(w / 2 - 120, 140, 240, 50); x.fillStyle = CREAM; mark(); x.restore();
  }, 1024, 1430, aniso);
}

export async function createDeck(host, { cards = [], reduced = false, trigger = 0.7 } = {}) {
  try { await Promise.all(['400 128px "Fraunces"', '400 40px "Instrument Sans"', '600 40px "Instrument Sans"'].map((f) => document.fonts.load(f))); } catch (e) { /* polices système */ }
  const canvas = document.createElement('canvas'); canvas.className = 'deck__gl';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
  host.appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa6ff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-8, 14, 22); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 20, bottom: -20, near: 1, far: 80 });
  sun.shadow.radius = 14; sun.shadow.blurSamples = 20; sun.shadow.bias = -0.0005;
  scene.add(sun);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), new THREE.ShadowMaterial({ opacity: 0.22 }));
  wall.position.z = -2.6; wall.receiveShadow = true; scene.add(wall);

  /* ---------- les cartes ---------- */
  const face = faceGeo();
  const edgeGeo = new THREE.ExtrudeGeometry(rrShape(CW, CH, CR), { depth: 0.05, bevelEnabled: false, curveSegments: 10 }); edgeGeo.translate(0, 0, -0.025);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.6 });
  const backMat = new THREE.MeshStandardMaterial({ map: backTexture(aniso), roughness: 0.42, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 });
  backMat.emissiveMap = backMat.map; backMat.emissiveIntensity = 0.35;
  const make = (frontMap) => {
    const g = new THREE.Group();
    const edge = new THREE.Mesh(edgeGeo, edgeMat); edge.castShadow = true; g.add(edge);
    const fm = frontMap ? new THREE.MeshStandardMaterial({ map: frontMap, roughness: 0.5, emissive: 0xffffff, emissiveMap: frontMap, emissiveIntensity: 0.38 }) : backMat;
    const f = new THREE.Mesh(face, fm); f.position.z = 0.027; g.add(f);
    const b = new THREE.Mesh(face, backMat); b.position.z = -0.027; b.rotation.y = Math.PI; g.add(b);
    g.userData = { flip: 0, flipT: 0, lift: 0, tilt: { x: 0, y: 0 } };
    scene.add(g);
    return g;
  };
  const deckCard = make(null);                                   // le dos du jeu, toujours visible
  const people = cards.map((el) => make(frontTexture(el, aniso)));
  const all = [deckCard, ...people];

  /* ---------- la ficelle crème en orbite ---------- */
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.38, emissive: 0xffffff, emissiveIntensity: 0.12 });
  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), ribbonMat); ribbon.castShadow = true; scene.add(ribbon);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), ribbonMat); scene.add(cap);

  /* ---------- mise en page selon la largeur ---------- */
  let L = null, W = 1, H = 1;
  function layout() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    const narrow = W / H < 1.15;
    const slots = narrow
      ? [[-3.55, 4.75, -6], [3.55, 4.95, 4], [-3.55, -4.85, 3], [3.55, -4.65, -4]]
      : [[-11.6, 0.1, -5], [-3.85, 0.35, 3], [3.85, -0.2, -2.5], [11.6, 0.25, 2.5]];
    const halfW = narrow ? 8.4 : 16.6, halfH = narrow ? 10.6 : 6.4;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(halfH / t, halfW / (t * camera.aspect)) + 2;
    camera.position.set(0, 0.4, dist); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    // l’orbite : passe devant en bas, derrière en haut, et sort de l’écran des deux côtés
    const rx = narrow ? 8.6 : 19.2, ry = narrow ? 11.6 : 6.2, rz = narrow ? 3.4 : 4.2;
    const pts = [];
    const edgeX = dist * t * camera.aspect + 4;
    // entrée et sortie par la gauche, derrière le jeu : la ficelle ne barre jamais une carte
    pts.push(new THREE.Vector3(-edgeX, narrow ? 12 : 8.2, -2.4));
    for (let k = 0; k <= 44; k++) { const a = Math.PI * 0.82 + (k / 44) * Math.PI * 2 * 1.04; pts.push(new THREE.Vector3(Math.cos(a) * rx, -Math.sin(a) * ry * 0.84 - 0.3, Math.sin(a) * rz + 0.6)); }
    pts.push(new THREE.Vector3(-edgeX, narrow ? -2 : -1.4, -2.4));
    L = { slots, deck: slots[0], ring: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), radius: narrow ? 0.17 : 0.2 };
  }

  /* ---------- animation : une fonction du temps et de la progression ---------- */
  let prog = reduced ? 1 : 0, visible = false, raf = 0, last = 0, time = 0, hover = -1, ribbonKey = '';
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(-9, -9);
  function poseCards(dt) {
    all.forEach((g, i) => {
      const s = L.slots[i], d = g.userData;
      const k = i === 0 ? out3(clamp(prog * 3)) : ease(clamp((prog * 1.35 - 0.12 - (i - 1) * 0.16) / 0.55));
      // départ : empilées sur le dos du jeu ; arrivée : à leur place, face visible
      const from = L.deck;
      const x = lerp(from[0] + i * 0.05, s[0], k), y = lerp(from[1] - i * 0.05, s[1], k), zLift = Math.sin(k * Math.PI) * 2.2;
      d.lift += ((hover === i && k > 0.98 ? 1 : 0) - d.lift) * Math.min(1, dt * 9);
      d.flipT += ((d.flip ? 1 : 0) - d.flipT) * Math.min(1, dt * 6);
      const bob = reduced ? 0 : Math.sin(time * 0.9 + i * 1.7) * 0.12 * k;
      g.position.set(x, y + bob + d.lift * 0.3, zLift + i * 0.06 + d.lift * 1.4);
      const face = i === 0 ? Math.PI : Math.PI * (1 - k);                       // les cartes se retournent en arrivant
      g.rotation.set(d.tilt.x * d.lift, face + Math.PI * d.flipT + d.tilt.y * d.lift, THREE.MathUtils.degToRad(s[2]) * k);
      g.scale.setScalar(1 + d.lift * 0.04);
    });
  }
  function poseRibbon() {
    const dr = reduced ? 1 : clamp((prog - 0.35) / 0.65);
    const key = dr.toFixed(3) + '|' + (reduced ? 0 : Math.floor(time * 30));
    if (key === ribbonKey) return; ribbonKey = key;
    ribbon.visible = dr > 0.002;
    if (!ribbon.visible) { cap.visible = false; return; }
    const N = 90, pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = L.ring.getPointAt(u);
      if (!reduced) { p.x += Math.sin(time * 0.6 + u * 9) * 0.18; p.y += Math.cos(time * 0.5 + u * 7) * 0.22; }
      pts.push(p);
    }
    const TS = 300, RS = 12, geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), TS, L.radius, RS, false);
    const segs = Math.floor(TS * ease(dr)); geo.setDrawRange(0, segs * RS * 6);
    ribbon.geometry.dispose(); ribbon.geometry = geo;
    cap.visible = dr < 0.999; if (cap.visible) { cap.position.copy(geo.parameters.path.getPointAt(segs / TS)); cap.scale.setScalar(L.radius); }
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60); last = now; time += dt;
    if (!reduced) {
      const target = host.getBoundingClientRect().top < window.innerHeight * trigger ? 1 : 0;
      prog = target > prog ? Math.min(1, prog + dt / 2.6) : Math.max(0, prog - dt / 1.6);
    }
    // survol
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(people.map((g) => g.children[1]), false);
    hover = hits.length ? people.findIndex((g) => g.children[1] === hits[0].object) + 1 : -1;
    if (hover > 0) { const g = all[hover], p = g.worldToLocal(hits[0].point.clone()); g.userData.tilt = { x: -(p.y / (CH / 2)) * 0.22, y: (p.x / (CW / 2)) * 0.28 }; }
    canvas.style.cursor = hover > 0 ? 'pointer' : '';
    poseCards(dt); poseRibbon();
    renderer.render(scene, camera);
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  const still = () => { poseCards(1 / 60); poseRibbon(); renderer.render(scene, camera); };

  layout(); still();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { layout(); ribbonKey = ''; if (reduced || !raf) still(); }) : null;
  if (ro) ro.observe(host);
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    visible = e.isIntersecting;
    if (!visible && !reduced && e.boundingClientRect.top > 0) prog = 0;              // repartie sous l’écran : on ramasse le jeu
    if (visible && !reduced) kick();
  }), { threshold: [0, 0.2] });
  io.observe(host);
  host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); if (reduced) kick(); });
  host.addEventListener('pointerleave', () => { ndc.set(-9, -9); });
  host.addEventListener('click', () => { if (hover > 0) { const d = all[hover].userData; d.flip = !d.flip; if (reduced) { d.flipT = d.flip ? 1 : 0; still(); } } });
  return { renderer, camera, layout, setProgress(p) { prog = p; still(); }, get progress() { return prog; } };
}
