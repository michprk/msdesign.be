/* ==========================================================================
   M&S Design — l’équipe en fleur (Three.js)
   Une grande fleur bleue à trois pétales, un par personne : le prénom et le
   métier sont imprimés sur le pétale. Elle s’ouvre quand la section arrive et
   se referme quand on remonte ; au survol, le pétale se soulève et la fiche
   correspondante s’allume en dessous. La ficelle bleue fait une orbite autour.
   ========================================================================== */
import * as THREE from '../vendor/three.module.min.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noise2(seed) {
  const r = rng(seed), P = new Float32Array(512); for (let i = 0; i < 512; i++) P[i] = r();
  const h = (i, j) => P[((i * 73856093) ^ (j * 19349663)) & 511];
  return (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(h(i, j), h(i + 1, j), u), lerp(h(i, j + 1), h(i + 1, j + 1), u), v); };
}

/* ---------- la forme d’un pétale : u le long (0 = cœur), v en travers ---------- */
const P = { r0: 0.1, len: 1.55, width: 0.98, tube: 0.22, cup: 0.1, curl: 0.12, wave: 0.03, pleat: 0.018 };
const halfWidth = (u) => {
  let hw = P.width * (0.16 + 0.84 * Math.pow(Math.sin(Math.min(u / 0.6, 1) * Math.PI / 2), 1.15));
  if (u > 0.76) hw *= Math.pow(Math.max(0, 1 - Math.pow((u - 0.76) / 0.24, 2.2)), 0.45);
  return hw;
};
function petalGeometry(seed) {
  const NU = 80, NV = 48, pos = new Float32Array((NU + 1) * (NV + 1) * 3), uv = new Float32Array((NU + 1) * (NV + 1) * 2), idx = [];
  const nz = noise2(seed), ph = seed * 1.7;
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, hw = halfWidth(u);
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV) * 2 - 1, k = i * (NV + 1) + j;
      let Z = -P.tube * Math.pow(1 - u, 3) + P.cup * (v * hw) * (v * hw) - P.curl * Math.pow(smooth(0.62, 1, u), 2);
      Z += P.wave * Math.sin(u * 8 + v * 2.2 + ph) * v * v * u;
      Z += P.pleat * Math.sin(v * Math.PI * 3.5 + ph) * smooth(0.15, 0.6, u) * (1 - 0.6 * u);
      Z += (nz(u * 4, v * 3) - 0.5) * 0.025 * u;
      pos[k * 3] = P.r0 + u * P.len; pos[k * 3 + 1] = v * hw; pos[k * 3 + 2] = Z;
      uv[k * 2] = u; uv[k * 2 + 1] = j / NV;
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* ---------- la peau du pétale : bleu profond, étoile claire au cœur, veines, et le texte ---------- */
function petalTexture({ seed, angle, name, suit }, aniso) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), n = noise2(seed), n2 = noise2(seed + 7), im = x.createImageData(S, S), d = im.data;
  const C0 = [238, 242, 255], C1 = [22, 78, 232], C2 = [86, 126, 250];
  for (let j = 0; j < S; j++) {
    const v = (1 - j / (S - 1)) * 2 - 1;
    for (let i = 0; i < S; i++) {
      const u = i / (S - 1);
      const reach = 0.08 + 0.1 * Math.pow(Math.max(0, 1 - Math.abs(v) * 1.15), 2.2);
      const star = 1 - smooth(reach - 0.012, reach + 0.024, u + (n(u * 30, v * 18) - 0.5) * 0.012);
      const halo = smooth(reach, reach + 0.05, u) * (1 - smooth(reach + 0.07, 0.42, u));
      const edge = smooth(0.66, 1, Math.max(Math.abs(v), u * 0.92));
      const m = (n(u * 9, v * 5) - 0.5) * 0.07 + (n2(u * 40, v * 22) - 0.5) * 0.03;
      const o = (j * S + i) * 4;
      for (let k = 0; k < 3; k++) {
        let cc = C1[k] + (C2[k] - C1[k]) * edge * 0.6;
        cc = cc * (0.95 + 0.06 * smooth(0.12, 0.55, u)) * (1 - 0.22 * halo);
        cc = cc + (C0[k] - cc) * star;
        d[o + k] = clamp(cc * (1 + m), 0, 255);
      }
      d[o + 3] = 255;
    }
  }
  x.putImageData(im, 0, 0);
  const r = rng(seed + 3);
  for (let k = 0; k < 40; k++) {                                       // veines fines
    const t = (k + 0.5) / 40 * 2 - 1, v0 = t * 0.16, v1 = t * 0.97 + (r() - 0.5) * 0.04, len = 0.8 + r() * 0.18 - Math.abs(t) * 0.12;
    x.strokeStyle = `rgba(10,30,120,${0.16 + r() * 0.08})`; x.lineWidth = Math.abs(t) < 0.06 ? 2.4 : 1.1 + r(); x.beginPath();
    for (let s = 0; s <= 30; s++) { const u = 0.1 + (len - 0.1) * s / 30, e = Math.pow((u - 0.1) / 0.9, 0.8), vv = v0 + (v1 - v0) * e; const X = u * (S - 1), Y = (1 - (vv + 1) / 2) * (S - 1); if (s) x.lineTo(X, Y); else x.moveTo(X, Y); }
    x.stroke();
  }
  // le texte, posé droit à l’écran : on dessine en unités réelles du pétale, puis on tourne de l’angle du pétale
  const uc = 0.6, pxU = (S - 1) / P.len, pxV = (S - 1) / (2 * halfWidth(uc));
  x.save();
  x.setTransform(pxU, 0, 0, -pxV, uc * (S - 1), S / 2);           // repère : x le long du pétale, y en travers (vers le haut)
  x.rotate(-angle);                                                // annule la rotation du pétale autour du cœur
  x.scale(1, -1);                                                  // retour à un texte « y vers le bas »
  x.fillStyle = 'rgba(251,249,244,0.97)'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const unit = 0.0016;                                             // 1 px de police = 0,0016 unité de pétale
  x.save(); x.scale(unit, unit);
  let fs = 220; x.font = `400 ${fs}px "Fraunces", Georgia, serif`;
  while (x.measureText(name).width * unit > 1.25 && fs > 120) { fs -= 8; x.font = `400 ${fs}px "Fraunces", Georgia, serif`; }
  x.fillText(name, 0, 30);
  x.font = '600 52px "Instrument Sans", Arial, sans-serif'; if ('letterSpacing' in x) x.letterSpacing = '9px';
  let fs2 = 52; while (x.measureText(suit).width * unit > 1.3 && fs2 > 34) { fs2 -= 2; x.font = `600 ${fs2}px "Instrument Sans", Arial, sans-serif`; }
  x.globalAlpha = 0.86; x.fillText(suit, 4, 130);
  x.restore(); x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}
function centerTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#071548'); g.addColorStop(0.25, '#123a9c'); g.addColorStop(0.45, '#7d9cf0'); g.addColorStop(0.62, '#eef2ff'); g.addColorStop(1, '#e9eeff');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function studioEnv(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0xe2ded6 })));
  const box = (w, h, X, Y, Z, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(X, Y, Z); m.lookAt(0, 0, 0); s.add(m); };
  box(14, 10, -9, 9, 8, 0xffffff); box(6, 12, 12, 2, 6, 0xa0a0a0); box(30, 6, 0, -12, 0, 0x6b6660);
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, 0.03).texture; pm.dispose(); return t;
}

export async function createBloom(host, { people = [], reduced = false, trigger = 0.72, onHover = () => {} } = {}) {
  try { await Promise.all(['400 200px "Fraunces"', '600 50px "Instrument Sans"'].map((f) => document.fonts.load(f))); } catch (e) { /* polices système */ }
  const canvas = document.createElement('canvas'); canvas.className = 'bloom__gl';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
  host.appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene(); scene.environment = studioEnv(renderer);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 60);
  const key = new THREE.DirectionalLight(0xfff6ea, 2.3); key.position.set(-4.5, 3.6, 4.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 16; key.shadow.blurSamples = 24; key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
  scene.add(key, new THREE.HemisphereLight(0xf3f0ff, 0x8a8070, 0.95));
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.18 }));
  catcher.position.z = -0.9; catcher.receiveShadow = true; scene.add(catcher);

  /* ---------- la fleur ---------- */
  const flower = new THREE.Group(); scene.add(flower);
  const ANG = [Math.PI * 7 / 6, Math.PI / 2, Math.PI * 11 / 6];       // en bas à gauche, en haut, en bas à droite
  const petals = people.map((p, i) => {
    const pivot = new THREE.Group(); pivot.rotation.z = ANG[i];
    const mat = new THREE.MeshPhysicalMaterial({ map: petalTexture({ seed: 11 + i * 5, angle: ANG[i], name: p.name, suit: p.suit }, aniso), roughness: 0.56, sheen: 0.5, sheenColor: new THREE.Color(0xbfd0ff), sheenRoughness: 0.45, side: THREE.DoubleSide, envMapIntensity: 0.5 });
    const mesh = new THREE.Mesh(petalGeometry(11 + i * 5), mat); mesh.castShadow = true; mesh.receiveShadow = true;
    pivot.add(mesh); flower.add(pivot);
    return { pivot, mesh, lift: 0 };
  });
  const center = new THREE.Mesh(new THREE.CircleGeometry(0.2, 64), new THREE.MeshStandardMaterial({ map: centerTexture(), roughness: 0.7 }));
  center.position.z = -0.17; flower.add(center);
  // étamines crème au cœur
  const stamMat = new THREE.MeshStandardMaterial({ color: 0xf1e7cf, roughness: 0.6 }), filMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ff, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.3, len = 0.42 + (i % 2) * 0.08;
    const dir = new THREE.Vector3(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 1).normalize();
    const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, len, 8), filMat);
    fil.position.copy(dir.clone().multiplyScalar(len / 2)).add(new THREE.Vector3(0, 0, -0.15));
    fil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); fil.castShadow = true; flower.add(fil);
    const anther = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), stamMat);
    anther.position.copy(dir.clone().multiplyScalar(len)).add(new THREE.Vector3(0, 0, -0.15)); anther.scale.set(1, 0.7, 1); anther.castShadow = true; flower.add(anther);
  }

  /* ---------- la ficelle bleue en orbite ---------- */
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x1d5cf5, roughness: 0.36 });
  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), ribMat); ribbon.castShadow = true; scene.add(ribbon);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), ribMat); scene.add(cap);
  let ring = null, ribR = 0.045;

  let W = 1, H = 1;
  function layout() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    const narrow = W / H < 1;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const need = narrow ? Math.max(2.9 / (t * camera.aspect), 2.4 / t) : Math.max(2.25 / t, 3.4 / (t * camera.aspect));
    camera.position.set(0, 0.25, need); camera.lookAt(0, 0.28, 0); camera.updateProjectionMatrix();
    // une orbite fermée, inclinée : elle passe derrière le pétale du haut et devant le bas de la fleur
    const rx = narrow ? 2.05 : 2.8, ry = narrow ? 1.75 : 1.62, rz = 0.95, cy = 0.3;
    const pts = [];
    for (let k = 0; k < 48; k++) { const a = Math.PI * 0.85 + (k / 48) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rx, cy - Math.sin(a) * ry, Math.sin(a) * rz + 0.12)); }
    ring = new THREE.CatmullRomCurve3(pts, true, 'centripetal'); ribR = narrow ? 0.04 : 0.045;
  }

  let prog = reduced ? 1 : 0, visible = false, raf = 0, last = 0, time = 0, hover = -1, focus = -1, ribKey = '';
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(-9, -9), tilt = { x: 0, y: 0 };
  function pose(dt) {
    const k = ease(clamp(prog / 0.75));
    flower.rotation.z = (1 - k) * -0.9;
    flower.scale.setScalar(lerp(0.55, 1, k));
    tilt.x += ((ndc.y > -5 ? ndc.y : 0) * 0.12 - tilt.x) * Math.min(1, dt * 3);
    tilt.y += ((ndc.x > -5 ? ndc.x : 0) * 0.16 - tilt.y) * Math.min(1, dt * 3);
    flower.rotation.x = -tilt.x + (reduced ? 0 : Math.sin(time * 0.5) * 0.02);
    flower.rotation.y = tilt.y + (reduced ? 0 : Math.sin(time * 0.4 + 1) * 0.025);
    const active = hover >= 0 ? hover : focus;
    petals.forEach((p, i) => {
      const open = ease(clamp((prog * 1.25 - i * 0.08) / 0.85));
      p.lift += ((active === i ? 1 : 0) - p.lift) * Math.min(1, dt * 8);
      const breathe = reduced ? 0 : Math.sin(time * 0.9 + i * 2.1) * 0.025;
      p.mesh.rotation.y = -(lerp(1.35, 0.12, open) + breathe + p.lift * 0.22);   // fermé : pétale dressé vers nous ; ouvert : presque à plat
      p.mesh.scale.setScalar(1 + p.lift * 0.04);
    });
  }
  function poseRibbon() {
    const dr = reduced ? 1 : clamp((prog - 0.4) / 0.6);
    const key2 = dr.toFixed(3) + '|' + (reduced ? 0 : Math.floor(time * 30));
    if (key2 === ribKey) return; ribKey = key2;
    ribbon.visible = dr > 0.002; cap.visible = false;
    if (!ribbon.visible) return;
    const N = 90, pts = [];
    for (let i = 0; i < N + (dr >= 0.999 ? 0 : 1); i++) { const u = i / N, p = ring.getPointAt(u % 1); if (!reduced) { p.x += Math.sin(time * 0.6 + u * Math.PI * 4) * 0.025; p.y += Math.cos(time * 0.5 + u * Math.PI * 6) * 0.03; } pts.push(p); }
    const TS = 300, RS = 12, geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, dr >= 0.999), TS, ribR, RS, dr >= 0.999), segs = Math.floor(TS * ease(dr));
    geo.setDrawRange(0, segs * RS * 6); ribbon.geometry.dispose(); ribbon.geometry = geo;
    cap.visible = dr < 0.999; if (cap.visible) { cap.position.copy(geo.parameters.path.getPointAt(segs / TS)); cap.scale.setScalar(ribR); }
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60); last = now; time += dt;
    if (!reduced) {
      const target = host.getBoundingClientRect().top < window.innerHeight * trigger ? 1 : 0;
      prog = target > prog ? Math.min(1, prog + dt / 2.6) : Math.max(0, prog - dt / 1.6);
    }
    ray.setFromCamera(ndc, camera);
    const hits = prog > 0.8 ? ray.intersectObjects(petals.map((p) => p.mesh), false) : [];
    const h = hits.length ? petals.findIndex((p) => p.mesh === hits[0].object) : -1;
    if (h !== hover) { hover = h; onHover(h); canvas.style.cursor = h >= 0 ? 'pointer' : ''; }
    pose(dt); poseRibbon();
    renderer.render(scene, camera);
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  const still = () => { pose(1 / 60); poseRibbon(); renderer.render(scene, camera); };
  layout(); still();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { layout(); ribKey = ''; if (reduced || !raf) still(); }) : null;
  if (ro) ro.observe(host);
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    visible = e.isIntersecting;
    if (!visible && !reduced && e.boundingClientRect.top > 0) prog = 0;              // repartie sous l’écran : la fleur se referme
    if (visible && !reduced) kick();
  }), { threshold: [0, 0.2] });
  io.observe(host);
  host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); if (reduced) kick(); });
  host.addEventListener('pointerleave', () => { ndc.set(-9, -9); });
  return { renderer, camera, layout, setFocus(i) { focus = i; if (reduced) still(); else kick(); }, setProgress(p) { prog = p; still(); }, get progress() { return prog; } };
}
