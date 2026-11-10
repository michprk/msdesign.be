/* ==========================================================================
   M&S Design — « Sous la surface » : une fleur vivante, sous l’eau.
   On arrive juste sous la surface (les gouttes tombent, on voit leurs ronds
   d’en dessous), on plonge, et au fond une fleur de lotus bleue s’ouvre.
   Elle est modélisée ici (pétales, étamines, tige, feuilles), sa tige est
   une chaîne physique : on peut l’attraper, la tirer jusqu’au sable, la
   pousser avec la souris ; l’eau la freine et elle revient toute seule.
   Autour : sable ridé, caustiques, rayons de lumière, herbiers, bulles,
   particules, profondeur de champ. Aucun modèle, aucune image.
   Si l’on continue à descendre la molette, on remonte vers la lumière et
   la page de l’équipe se charge.
   ========================================================================== */
import * as THREE from '../assets/vendor/three.module.min.js';
import { createDiveSound } from './dive-sound.js';

const d = document.documentElement, Q = new URLSearchParams(location.search);
const REC = Q.has('rec'), AT = Q.has('at');                  // rec : vidéo d’aperçu ; at : captures sans écran d’entrée
let reduced = Q.get('motion') === 'reduce';
try { if (localStorage.getItem('ms_motion') === 'reduce') reduced = true; } catch (e) { /* rien */ }
const small = !REC && (Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4);
const coarse = matchMedia('(hover: none)').matches;
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const TAU = Math.PI * 2, V3 = THREE.Vector3;
let seed = 20261110; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rr = (a, b) => a + (b - a) * rnd();
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); }
const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;

const SURF = 11;                                              // hauteur de la surface de l’eau
function gH(x, z) {                                           // le fond : plat autour de la fleur, dunes plus loin
  const r = Math.hypot(x, z);
  return (fbm(x * 0.09 + 5, z * 0.09) - 0.5) * 1.5 * smooth(2.5, 9, r) + (noise(x * 0.35, z * 0.35) - 0.5) * 0.1 + smooth(14, 40, r) * 2.4 * fbm(x * 0.03, z * 0.03 + 9);
}

/* ---------- rendu ---------- */
const canvas = $('.dv__gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { d.classList.add('dv-nogl'); throw e; }
const DPR = REC ? 1 : Math.min(devicePixelRatio || 1, small ? 1.25 : 1.6);
let PR = DPR; renderer.setPixelRatio(PR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const FOG = new THREE.Color('#0f6590'), DEEP = new THREE.Color('#06293f'), TOP = new THREE.Color('#bff0ff');
scene.fog = new THREE.FogExp2(FOG, 0.052);
const camera = new THREE.PerspectiveCamera(38, 1, 0.2, 220);
const AXIS = new V3(0.15, -0.88, 0.44).normalize();            // le sens des rayons du soleil (il est derrière la fleur : pétales à contre-jour)
const U = { time: { value: 0 }, push: { value: new V3(0, 0, 0) }, current: { value: new THREE.Vector2(0.34, 0.1) } };

const sun = new THREE.DirectionalLight('#e9fbff', 2.3);
sun.position.copy(AXIS).multiplyScalar(-22); sun.castShadow = true;
sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 44 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
scene.add(sun, sun.target, new THREE.HemisphereLight('#8fdcff', '#0b3a55', 1.25));
const fill = new THREE.DirectionalLight('#7fc8ff', 0.55); fill.position.set(4, 3, 9); scene.add(fill);

/* ---------- l’eau dans les matières : caustiques, lumière qui traverse les pétales, courant dans les herbes ---------- */
const GLSL_CAU = `
  vec2 dvH(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
  float dvV(vec2 p, float t){ vec2 i = floor(p), f = fract(p); float m = 1.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = dvH(i + g); o = 0.5 + 0.45 * sin(t + 6.2831 * o); m = min(m, length(g + o - f)); }
    return m; }
  float dvCaustic(vec2 p, float t){ p += 0.2 * vec2(sin(p.y * 1.3 + t * 0.7), cos(p.x * 1.1 - t * 0.6));
    float a = dvV(p, t * 0.9), b = dvV(p * 1.63 + 7.3, t * 1.25 + 2.0);
    float c = pow(a, 2.2) * 1.5 + pow(b, 2.6) * 1.1; return c * c * 1.5; }`;
const CAU_APPLY = `
  { vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
    float cz = dvCaustic(vWp.xz * 0.55 + vWp.y * 0.14, uTime * 0.85);
    outgoingLight += diffuseColor.rgb * cz * uCauK * smoothstep(-0.3, 0.7, nW.y) * vec3(0.72, 1.0, 1.06);
    #if NUM_DIR_LIGHTS > 0
      float back = clamp(dot(-normal, directionalLights[0].direction), 0.0, 1.0);
      outgoingLight += diffuseColor.rgb * directionalLights[0].color * back * uTrans;
    #endif
  }`;
const SWAY_PROJECT = `
  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
    { float hh = uv.y, sy = length(instanceMatrix[1].xyz); vec3 ip = instanceMatrix[3].xyz; float ph = ip.x * 0.6 + ip.z * 0.8;
      float sw = sin(uTime * 0.9 + ph) * 0.6 + sin(uTime * 0.47 + ph * 1.7) * 0.4;
      vec2 pd = ip.xz - uPush.xy; float pl = length(pd) + 1e-4; float pk = uPush.z * exp(-pl * pl * 0.3);
      vec2 off = (uCurrent * (0.3 + sw * 0.7) + (pd / pl) * pk) * hh * hh * sy;
      mvPosition.xz += off; mvPosition.y -= dot(off, off) * 0.14 / max(sy, 0.2); }
  #endif
  vWp = (modelMatrix * mvPosition).xyz;
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`;
function water(mat, { cau = 1, trans = 0, sway = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; sh.uniforms.uCauK = { value: cau }; sh.uniforms.uTrans = { value: trans };
    if (sway) { sh.uniforms.uPush = U.push; sh.uniforms.uCurrent = U.current; }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\n' + (sway ? 'uniform float uTime; uniform vec3 uPush; uniform vec2 uCurrent;\n' : ''))
      .replace('#include <project_vertex>', sway ? SWAY_PROJECT : '#include <project_vertex>\n  { vec4 wp = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n    wp = instanceMatrix * wp;\n  #endif\n  vWp = (modelMatrix * wp).xyz; }');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform float uTime, uCauK, uTrans;\n' + GLSL_CAU)
      .replace('#include <opaque_fragment>', CAU_APPLY + '\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'dv' + (sway ? 's' : 'n');
  return mat;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ---------- le fond de l’eau, la surface vue d’en dessous ---------- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { cTop: { value: TOP }, cMid: { value: FOG }, cDeep: { value: DEEP }, uAxis: { value: AXIS } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 cTop, cMid, cDeep, uAxis; varying vec3 vDir;
    void main(){ vec3 dd = normalize(vDir); float h = dd.y;
      vec3 c = mix(cMid, cDeep, smoothstep(0.05, -0.55, h)); c = mix(c, cTop * 0.9, smoothstep(0.0, 0.95, h) * 0.75);
      c += vec3(0.5, 0.85, 1.0) * pow(max(dot(dd, -uAxis), 0.0), 5.0) * 0.55;
      gl_FragColor = vec4(c, 1.0); }`,
}));
sky.frustumCulled = false; sky.renderOrder = -2; scene.add(sky);
const DROPS = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0));
const surface = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), new THREE.ShaderMaterial({
  side: THREE.DoubleSide, fog: false,
  uniforms: { uTime: U.time, uDrops: { value: DROPS }, uFog: { value: FOG } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float uTime; uniform vec4 uDrops[6]; uniform vec3 uFog; varying vec3 vW;
    float hgt(vec2 p){ float v = sin(p.x * 0.8 + uTime * 0.9) * 0.5 + sin(p.y * 1.1 - uTime * 0.7) * 0.4 + sin((p.x + p.y) * 1.9 + uTime * 1.4) * 0.2 + sin((p.x - p.y) * 3.1 - uTime * 1.9) * 0.1;
      for (int i = 0; i < 6; i++) { vec4 dr = uDrops[i]; float t = uTime - dr.z; if (t > 0.0 && t < 7.0) { float r = length(p - dr.xy); v += dr.w * sin(r * 7.0 - t * 10.0) * exp(-t * 0.65) * smoothstep(t * 1.7 + 0.3, t * 1.7 - 0.7, r) * 1.8; } }
      return v; }
    void main(){ vec2 p = vW.xz; float e = 0.06;
      vec2 gr = vec2(hgt(p + vec2(e, 0.0)) - hgt(p - vec2(e, 0.0)), hgt(p + vec2(0.0, e)) - hgt(p - vec2(0.0, e))) / (2.0 * e);
      vec3 V = normalize(vW - cameraPosition);
      float c = V.y + dot(gr, V.xz) * 0.2;                                  // l’angle avec la verticale, bousculé par les vagues
      float win = smoothstep(0.58, 0.74, c);                                // la « fenêtre de Snell » : le ciel n’est visible que juste au-dessus
      vec3 skyC = vec3(0.6, 0.9, 1.0) * 2.4 + vec3(1.0, 0.97, 0.9) * pow(max(1.0 - length(gr - vec2(0.5, 0.3)) * 0.55, 0.0), 6.0) * 5.0;
      vec3 refl = uFog * (0.55 + 0.4 * (gr.x + gr.y));
      vec3 col = mix(refl, skyC, win);
      float dist = length(vW - cameraPosition); float f = 1.0 - exp(-dist * dist * 0.0008);
      col = mix(col, uFog * 1.5, f * (1.0 - win * 0.55));
      gl_FragColor = vec4(col, 1.0); }`,
}));
surface.rotation.x = Math.PI / 2; surface.position.y = SURF; surface.renderOrder = -1; scene.add(surface);

/* ---------- les rayons de lumière ---------- */
{
  const N = small ? 12 : 20, plane = new THREE.PlaneGeometry(1, 1, 1, 6), geo = new THREE.InstancedBufferGeometry();
  geo.index = plane.index; geo.setAttribute('position', plane.attributes.position); geo.setAttribute('uv', plane.attributes.uv);
  const base = new Float32Array(N * 3), parm = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { base.set([rr(-11, 11), SURF + 0.5, rr(-15, 2)], i * 3); parm.set([rr(1.0, 3.2), rr(13, 19), rr(0, 20), rr(0.07, 0.2)], i * 4); }
  geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); geo.setAttribute('aParm', new THREE.InstancedBufferAttribute(parm, 4)); geo.instanceCount = N;
  const rays = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: U.time, uAxis: { value: AXIS } },
    vertexShader: `attribute vec3 aBase; attribute vec4 aParm; uniform vec3 uAxis; varying vec2 vUv; varying vec4 vP; varying float vFade;
      void main(){ vUv = uv; vP = aParm; vec3 mid = aBase + uAxis * aParm.y * 0.5;
        vec3 side = normalize(cross(uAxis, normalize(cameraPosition - mid))); float t = 1.0 - uv.y;
        vec3 p = aBase + uAxis * aParm.y * t + side * (uv.x - 0.5) * aParm.x * (0.5 + t * 1.2);
        vec4 mv = viewMatrix * vec4(p, 1.0); vFade = smoothstep(1.5, 7.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec4 vP; varying float vFade;
      void main(){ float x = abs(vUv.x - 0.5) * 2.0; float a = pow(max(1.0 - x, 0.0), 2.2);
        a *= smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.93, vUv.y);
        a *= (0.55 + 0.45 * sin(uTime * 0.55 + vP.z)) * (0.65 + 0.35 * sin(uTime * 1.6 + vP.z * 3.1 + vUv.y * 4.0));
        gl_FragColor = vec4(vec3(0.5, 0.86, 1.0) * a * vP.w * vFade, 1.0); }`,
  }));
  rays.frustumCulled = false; rays.renderOrder = 5; scene.add(rays);
}

/* ---------- le sable ---------- */
{
  const g = new THREE.PlaneGeometry(130, 130, small ? 120 : 190, small ? 120 : 190); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#bfae86'), b = new THREE.Color('#8f7f5c'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, gH(x, z)); c.copy(a).lerp(b, fbm(x * 0.22, z * 0.22) * 0.9 + smooth(3, 0.4, Math.hypot(x, z)) * 0.25); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const T = 256, per = 8, pn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), h = (i, j) => hash2(((i % per) + per) % per, ((j % per) + per) % per); return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); };
  const nrm = canvasTex(T, T, (x) => {                          // les rides du sable (motif qui se répète sans raccord)
    const Hh = new Float32Array(T * T);
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const u = i / T, v = j / T, w = pn(u * per, v * per); Hh[j * T + i] = Math.sin((u * 5 + v * 1 + w * 0.9) * TAU) * 0.5 + pn(u * per * 4 % per, v * per * 4 % per) * 0.25; }
    const im = x.createImageData(T, T);
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const dx = Hh[j * T + ((i + 1) % T)] - Hh[j * T + ((i + T - 1) % T)], dy = Hh[((j + 1) % T) * T + i] - Hh[((j + T - 1) % T) * T + i], o = (j * T + i) * 4; im.data[o] = 128 + dx * 150; im.data[o + 1] = 128 + dy * 150; im.data[o + 2] = 255; im.data[o + 3] = 255; }
    x.putImageData(im, 0, 0);
  }, false);
  nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(46, 46);
  const sand = new THREE.Mesh(g, water(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, normalMap: nrm, normalScale: new THREE.Vector2(0.9, 0.9) }), { cau: 0.85 }));
  sand.receiveShadow = true; scene.add(sand);
}

/* ---------- rochers, galets ---------- */
function boulder(res = 26, s0 = 0) {
  const g = new THREE.SphereGeometry(1, res, Math.round(res * 0.65)), p = g.attributes.position, col = new Float32Array(p.count * 3);
  const rock = new THREE.Color('#6d6a62'), algae = new THREE.Color('#3f6b4a'), sandC = new THREE.Color('#bfae86'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.72 + 0.4 * noise(x * 1.4 + s0, y * 1.4 + z * 1.1) + 0.16 * noise(x * 4 + z * 3 + s0, y * 4);
    p.setXYZ(i, x * k, y * k * 0.72, z * k);
    c.copy(rock).multiplyScalar(0.8 + 0.4 * noise(x * 5 + s0, z * 5 + y * 3)).lerp(algae, smooth(0.1, 0.8, y) * (0.3 + 0.5 * noise(x * 3, z * 3 + s0))).lerp(sandC, smooth(-0.35, -0.75, y) * 0.8);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
{
  const mat = water(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { cau: 1.1 });
  [[-4.4, -3.6, 1.6], [5.0, -5.2, 2.0], [-7.2, -9.5, 2.9], [6.6, -11.5, 3.3], [2.9, -1.9, 0.62], [-2.5, 1.3, 0.42], [9.4, -3.2, 1.5], [-10.5, -4, 1.9], [0.8, -8.5, 1.3]].forEach(([x, z, s], i) => {
    const m = new THREE.Mesh(boulder(28, i * 7.3), mat); m.position.set(x, gH(x, z) + s * 0.22, z); m.scale.setScalar(s); m.rotation.y = rr(0, 6); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  });
  const n = small ? 90 : 170, peb = new THREE.InstancedMesh(boulder(10, 3.1), mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) { const a = rnd() * TAU, r = 0.6 + Math.pow(rnd(), 0.7) * 11, x = Math.cos(a) * r, z = Math.sin(a) * r - 2, s = rr(0.04, 0.17); e.set(rr(0, 1), rr(0, 6), rr(0, 1)); q.setFromEuler(e); m4.compose(new V3(x, gH(x, z) + s * 0.25, z), q, new V3(s * rr(0.9, 1.5), s * 0.7, s)); peb.setMatrixAt(i, m4); }
  peb.castShadow = true; peb.receiveShadow = true; scene.add(peb);
}

/* ---------- les herbiers (et les feuilles de la fleur) : des rubans qui suivent le courant ---------- */
{
  const g = new THREE.PlaneGeometry(0.09, 1, 1, 9); g.translate(0, 0.5, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - 0.8 * Math.pow(y, 1.6))); p.setZ(i, 0.22 * y * y); }
  g.computeVertexNormals();
  const spots = [];
  const clumps = small ? 46 : 80;
  for (let c = 0; c < clumps; c++) {
    const a = rnd() * TAU, r = 2.2 + Math.pow(rnd(), 0.8) * 17, cx = Math.cos(a) * r, cz = Math.sin(a) * r - 3;
    if ((cz > 0.6 && Math.abs(cx) < 4.2) || cz > 4.5) continue;                     // rien entre la caméra et la fleur
    const far = Math.hypot(cx, cz) > 9, nb = 7 + Math.floor(rnd() * 10);
    for (let k = 0; k < nb; k++) spots.push([cx + rr(-0.7, 0.7), cz + rr(-0.7, 0.7), rr(0.5, 1.7) * (far ? 1.9 : 1), rr(0.8, 1.7), 1]);
  }
  const mat = water(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.62 }), { cau: 0.9, trans: 0.55, sway: true });
  const im = new THREE.InstancedMesh(g, mat, spots.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), c = new THREE.Color();
  const PAL = ['#2f8a4f', '#3fa35d', '#226f47', '#5cab52', '#2a7d5c', '#4c9a3e'];
  spots.forEach(([x, z, h, w, kind], i) => { q.setFromAxisAngle(up, rr(0, TAU)); m4.compose(new V3(x, gH(x, z) - 0.05, z), q, new V3(w, h, 1)); im.setMatrixAt(i, m4); c.set(PAL[Math.floor(rnd() * PAL.length)]).multiplyScalar(kind ? rr(0.7, 1.05) : rr(0.9, 1.15)); im.setColorAt(i, c); });
  im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
}

/* ---------- les nénuphars, vus d’en dessous, et leurs tiges ---------- */
{
  const tex = canvasTex(256, 256, (x, w) => { x.fillStyle = '#2f7a3f'; x.fillRect(0, 0, w, w); x.strokeStyle = 'rgba(190,230,150,0.55)'; for (let k = 0; k < 22; k++) { const a = (k / 22) * TAU; x.lineWidth = 2.2; x.beginPath(); x.moveTo(w / 2, w / 2); x.lineTo(w / 2 + Math.cos(a) * w * 0.5, w / 2 + Math.sin(a) * w * 0.5); x.stroke(); } const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(220,245,170,0.35)'); g.addColorStop(1, 'rgba(10,60,30,0.35)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const padMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, color: new THREE.Color(1.5, 1.6, 1.3) });
  const stemMat = water(new THREE.MeshStandardMaterial({ color: '#7fa05a', roughness: 0.8 }), { cau: 0.5, trans: 0.3 });
  [[-3.2, -2.2, 1.25], [3.9, -3.4, 1.05], [-0.9, -5.6, 1.4], [5.9, -0.9, 0.9], [-6.2, -5.2, 1.3], [1.9, -8.2, 1.2], [-2.6, -9.6, 1.0], [7.4, -6.8, 1.3], [-8.2, -1.2, 1.0]].forEach(([x, z, s]) => {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(s, 40, 0.2, TAU - 0.4), padMat); pad.rotation.x = Math.PI / 2; pad.rotation.z = rr(0, 6); pad.position.set(x, SURF - 0.03, z); pad.renderOrder = 1; scene.add(pad);
    if (z > -3 && Math.abs(x) < 4.5) return;                                       // pas de tige devant la fleur
    const bx = x * 0.86 + rr(-0.6, 0.6), bz = z * 0.9 + rr(-0.8, 0.3);
    const pts = [new V3(bx, gH(bx, bz) - 0.1, bz), new V3(lerp(bx, x, 0.25) + rr(-0.5, 0.5), 3.5, lerp(bz, z, 0.3)), new V3(lerp(bx, x, 0.7), 7.6, lerp(bz, z, 0.75)), new V3(x, SURF - 0.05, z)];
    const st = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.024, 6), stemMat); scene.add(st);
  });
}

/* ---------- la fleur ---------- */
function tex2(kind) {
  return canvasTex(256, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, h, 0, 0);                                    // bas = base du pétale, haut = pointe
    if (kind === 'blue') { g.addColorStop(0, '#fbf3cf'); g.addColorStop(0.1, '#f1f4ff'); g.addColorStop(0.36, '#a9c0ff'); g.addColorStop(0.68, '#4671f3'); g.addColorStop(1, '#1b40c6'); }
    else { g.addColorStop(0, '#a6bd72'); g.addColorStop(0.5, '#4f8a4a'); g.addColorStop(1, '#2d6238'); }
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 30; k++) {                                                   // les veines
      const t = (k + 0.5) / 30; x.strokeStyle = kind === 'blue' ? `rgba(24,44,160,${0.07 + rnd() * 0.1})` : `rgba(20,60,30,${0.12 + rnd() * 0.1})`; x.lineWidth = Math.abs(t - 0.5) < 0.03 ? 2.4 : 0.8 + rnd() * 0.9;
      x.beginPath(); x.moveTo(t * w, h); for (let s = 1; s <= 12; s++) x.lineTo(t * w + Math.sin(s * 0.9 + k) * 1.2, h - (s / 12) * h * (0.86 + rnd() * 0.14)); x.stroke();
    }
    const e = x.createLinearGradient(0, 0, w, 0); e.addColorStop(0, 'rgba(10,20,90,0.22)'); e.addColorStop(0.16, 'rgba(10,20,90,0)'); e.addColorStop(0.84, 'rgba(10,20,90,0)'); e.addColorStop(1, 'rgba(10,20,90,0.22)'); x.fillStyle = e; x.fillRect(0, 0, w, h);
  });
}
const bumpTex = canvasTex(256, 512, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (let k = 0; k < 30; k++) { const t = (k + 0.5) / 30; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(t * w, h); x.lineTo(t * w, h * 0.08); x.stroke(); } }, false);
const petalMat = water(new THREE.MeshPhysicalMaterial({ map: tex2('blue'), bumpMap: bumpTex, bumpScale: 0.6, roughness: 0.5, sheen: 0.7, sheenColor: new THREE.Color('#cfdcff'), sheenRoughness: 0.4, side: THREE.DoubleSide }), { cau: 0.55, trans: 0.75 });
const sepalMat = water(new THREE.MeshPhysicalMaterial({ map: tex2('green'), bumpMap: bumpTex, bumpScale: 0.6, roughness: 0.6, side: THREE.DoubleSide }), { cau: 0.5, trans: 0.4 });
const stemMat = water(new THREE.MeshPhysicalMaterial({ color: '#4d8a4c', roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#c8f0b0') }), { cau: 0.7, trans: 0.2 });

function petalGeo(L, W, bow, cup, sd) {
  const NU = 22, NV = 10, n = (NU + 1) * (NV + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), flex = new Float32Array(n * 3), idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, hw = W * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.8) * (1 - 0.1 * u) + 0.014 * (1 - u);
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV) * 2 - 1, k = i * (NV + 1) + j;
      const z = bow * L * u * u - cup * hw * v * v + 0.014 * Math.sin(u * 9 + sd * 2 + v * 2.2) * v * u;      // creusé vers le cœur (−z), recourbé (+z)
      pos.set([v * hw, u * L, z], k * 3); uv.set([v * 0.5 + 0.5, u], k * 2); flex.set([0, -L * u * u * 0.28, L * u * u], k * 3);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.morphAttributes.position = [new THREE.BufferAttribute(flex, 3)]; g.morphTargetsRelative = true;
  return g;
}
function mergeGeos(list) {
  let n = 0; const parts = list.map(([geo, color]) => { const g = geo.index ? geo.toNonIndexed() : geo; n += g.attributes.position.count; return [g, new THREE.Color(color)]; });
  const Pp = new Float32Array(n * 3), Nn = new Float32Array(n * 3), Cc = new Float32Array(n * 3); let o = 0;
  parts.forEach(([g, c]) => { Pp.set(g.attributes.position.array, o * 3); Nn.set(g.attributes.normal.array, o * 3); for (let i = 0; i < g.attributes.position.count; i++) Cc.set([c.r, c.g, c.b], (o + i) * 3); o += g.attributes.position.count; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); return g;
}
const WHORLS = [
  { n: 4, L: 0.98, w: 0.3, o: 1.45, c: 0.2, bow: 0.1, cup: 0.5, r: 0.17, y: -0.03, off: 0.39, sep: true },
  { n: 9, L: 1.3, w: 0.33, o: 1.2, c: 0.16, bow: 0.16, cup: 0.42, r: 0.16, y: 0, off: 0 },
  { n: 9, L: 1.15, w: 0.31, o: 0.93, c: 0.12, bow: 0.07, cup: 0.5, r: 0.13, y: 0.02, off: 0.35 },
  { n: 7, L: 0.97, w: 0.27, o: 0.6, c: 0.09, bow: -0.04, cup: 0.6, r: 0.1, y: 0.04, off: 0.1 },
  { n: 5, L: 0.77, w: 0.22, o: 0.33, c: 0.06, bow: -0.12, cup: 0.7, r: 0.07, y: 0.05, off: 0.5 },
];
const WGEO = WHORLS.map((w, i) => petalGeo(w.L, w.w, w.bow, w.cup, i));
const STAM_GEO = (() => {
  const f = new THREE.CylinderGeometry(0.006, 0.011, 1, 6, 6); f.translate(0, 0.5, 0); const p = f.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.22 * p.getY(i) * p.getY(i)); f.computeVertexNormals();
  const a = new THREE.SphereGeometry(0.03, 8, 6); a.scale(1, 2.6, 1); a.translate(0, 1.02, 0.225);
  return mergeGeos([[f, '#f5dc6a'], [a, '#f6a32c']]);
})();
function makeBloom() {
  const grp = new THREE.Group(), pets = [];
  WHORLS.forEach((wh, wi) => {
    for (let k = 0; k < wh.n; k++) {
      const az = wh.off + (k / wh.n) * TAU + rr(-0.05, 0.05), pivot = new THREE.Group();
      pivot.position.set(Math.sin(az) * wh.r, wh.y, Math.cos(az) * wh.r); pivot.rotation.y = az;
      const m = new THREE.Mesh(WGEO[wi], wh.sep ? sepalMat : petalMat); m.castShadow = true; m.receiveShadow = true; m.rotation.z = rr(-0.07, 0.07); m.scale.setScalar(rr(0.94, 1.05));
      pivot.add(m); grp.add(pivot);
      pets.push({ m, az, o: wh.o + rr(-0.06, 0.06), c: wh.c, a: wh.c, v: 0, f: 0, wi, soft: wh.sep ? 0.45 : 1.05 - wi * 0.13, ph: rnd() * 6 });
    }
  });
  const rings = [[22, 0.85, 0.46, 0.07], [16, 0.55, 0.4, 0.05], [10, 0.25, 0.34, 0.03]], count = rings.reduce((s, r) => s + r[0], 0);
  const stam = new THREE.InstancedMesh(STAM_GEO, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: '#6a4300', emissiveIntensity: 0.55 }), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let i = 0;
  rings.forEach(([n, tilt, len, r]) => { for (let k = 0; k < n; k++) { const az = (k / n) * TAU + rr(-0.1, 0.1); e.set(tilt + rr(-0.08, 0.08), az, 0, 'YXZ'); q.setFromEuler(e); m4.compose(new V3(Math.sin(az) * r, 0.06, Math.cos(az) * r), q, new V3(1, len * rr(0.9, 1.1), 1)); stam.setMatrixAt(i++, m4); } });
  stam.castShadow = true; grp.add(stam);
  const pistil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), new THREE.MeshStandardMaterial({ color: '#f0c23a', roughness: 0.6, emissive: '#5a3a00', emissiveIntensity: 0.5 })); pistil.scale.y = 0.6; pistil.position.y = 0.06; grp.add(pistil);
  const cup = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12, 0, TAU, Math.PI * 0.45, Math.PI * 0.55), stemMat); cup.position.y = 0.06; cup.scale.set(1, 1.2, 1); cup.castShadow = true; grp.add(cup);
  return { grp, pets, stam };
}
function poseBloom(F, bloom, vl, dt, t) {
  for (const p of F.pets) {
    const b = smooth(p.wi * 0.1, 0.62 + p.wi * 0.09, bloom) + Math.max(0, bloom - 1) * 0.5;
    const push = vl.x * Math.sin(p.az) + vl.z * Math.cos(p.az);                     // la fleur avance vers ce pétale : l’eau le referme
    const tgt = lerp(p.c, p.o, b) - push * 0.17 * p.soft + vl.y * 0.1 * p.soft + Math.sin(t * 0.8 + p.ph) * 0.018 * b;
    p.v += ((tgt - p.a) * 40 - p.v * 7.5) * dt; p.a = clamp(p.a + p.v * dt, 0.03, 1.8);
    p.m.rotation.x = p.a;
    p.f += (clamp(-push * 0.2 + vl.y * 0.1, -0.45, 0.6) - p.f) * Math.min(1, dt * 6); p.m.morphTargetInfluences[0] = p.f;
  }
  const s = 0.42 + 0.58 * clamp(bloom); F.stam.scale.set(s, 0.62 + 0.38 * clamp(bloom), s);
}

// la tige : un tube dont on recalcule les points à chaque image
function makeTube(S, R) {
  const n = (S + 1) * (R + 1), idx = [], uv = new Float32Array(n * 2);
  for (let i = 0; i <= S; i++) for (let j = 0; j <= R; j++) uv.set([j / R, i / S], (i * (R + 1) + j) * 2);
  for (let i = 0; i < S; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  g.userData = { S, R }; return g;
}
const _p = new V3(), _q = new V3(), _t = new V3(), _n = new V3(), _b = new V3();
function updateTube(g, curve, r0, r1) {
  const { S, R } = g.userData, pos = g.attributes.position.array, nor = g.attributes.normal.array; _n.set(1, 0, 0.2);
  for (let i = 0; i <= S; i++) {
    const t = i / S; curve.getPoint(t, _p);
    if (t < 0.99) { curve.getPoint(t + 0.01, _q); _t.subVectors(_q, _p); } else { curve.getPoint(t - 0.01, _q); _t.subVectors(_p, _q); }
    _t.normalize(); _n.addScaledVector(_t, -_n.dot(_t)).normalize(); _b.crossVectors(_t, _n);
    const r = lerp(r0, r1, t);
    for (let j = 0; j <= R; j++) { const a = (j / R) * TAU, c = Math.cos(a), s = Math.sin(a), k = (i * (R + 1) + j) * 3, ox = _n.x * c + _b.x * s, oy = _n.y * c + _b.y * s, oz = _n.z * c + _b.z * s; pos[k] = _p.x + ox * r; pos[k + 1] = _p.y + oy * r; pos[k + 2] = _p.z + oz * r; nor[k] = ox; nor[k + 1] = oy; nor[k + 2] = oz; }
  }
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
}

const NN = 16, SL = 3.35, SEG = SL / (NN - 1), KS = 13;
const rest = [new V3(0, gH(0, 0) - 0.05, 0)];
for (let i = 1; i < NN; i++) { const t = i / (NN - 1); rest.push(rest[i - 1].clone().addScaledVector(new V3(0.14 * Math.sin(t * 2.6), 1 - 0.34 * t * t, 0.04 + 0.62 * t * t).normalize(), SEG)); }
const P = rest.map((v) => v.clone()), PP = rest.map((v) => v.clone());
const stemCurve = new THREE.CatmullRomCurve3(P), stemGeo = makeTube(44, 10);
const stem = new THREE.Mesh(stemGeo, stemMat); stem.castShadow = true; stem.receiveShadow = true; stem.frustumCulled = false; scene.add(stem);
const head = new THREE.Group(); scene.add(head);
const flower = makeBloom(); head.add(flower.grp);
const glowL = new THREE.PointLight('#ffd98a', 0.5, 2.6, 2); glowL.position.y = 0.3; head.add(glowL);
const hitProxy = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); hitProxy.position.y = 0.45; head.add(hitProxy);

const leaves = [];
{
  const geos = [petalGeo(2.3, 0.3, 0.2, 0.22, 3), petalGeo(1.7, 0.26, 0.26, 0.2, 5), petalGeo(1.15, 0.2, 0.3, 0.2, 7)];
  [[7, 0.5, 0, 0.1], [7, 0.85, 1, 0.55], [6, 1.15, 2, 0.2]].forEach(([n, open, gi, off]) => {
    for (let k = 0; k < n; k++) {
      const az = off + (k / n) * TAU + rr(-0.2, 0.2), pivot = new THREE.Group(); pivot.position.set(Math.sin(az) * 0.08, rest[0].y + 0.02, Math.cos(az) * 0.08); pivot.rotation.y = az;
      const m = new THREE.Mesh(geos[gi], sepalMat); m.castShadow = true; m.receiveShadow = true; m.scale.set(rr(0.85, 1.15), rr(0.8, 1.15), 1); m.rotation.z = rr(-0.15, 0.15);
      pivot.add(m); scene.add(pivot); leaves.push({ m, az, o: open + rr(-0.12, 0.12), ph: rnd() * 6, f: 0 });
    }
  });
}

// deux boutons encore fermés, pour la compagnie
const buds = [[-1.55, -1.0, 2.1, 0.5], [1.7, -1.6, 1.5, 0.42]].map(([x, z, h, s], k) => {
  const root = new THREE.Group(); root.position.set(x, gH(x, z) - 0.05, z); scene.add(root);
  const pts = [new V3(0, 0, 0), new V3(0.1 * (k ? -1 : 1), h * 0.5, 0.05), new V3(0.26 * (k ? -1 : 1), h, 0.1)], g = makeTube(20, 8);
  updateTube(g, new THREE.CatmullRomCurve3(pts), 0.05, 0.03); const st = new THREE.Mesh(g, stemMat); st.castShadow = true; root.add(st);
  const F = makeBloom(); F.grp.position.copy(pts[2]); F.grp.rotation.z = (k ? 1 : -1) * 0.22; F.grp.scale.setScalar(s); root.add(F.grp);
  poseBloom(F, 0, new V3(), 1, 0); for (const p of F.pets) { p.a = p.c; p.m.rotation.x = p.c; }
  return { root, ph: k * 2.1 };
});

/* ---------- particules en suspension, bulles ---------- */
const motes = (() => {
  const n = small ? 700 : 1500, pos = new Float32Array(n * 3), sd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([rr(0, 24), rr(0, 24), rr(0, 24)], i * 3); sd[i] = rnd(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: { uTime: U.time, uScale: { value: 500 }, uCam: { value: new V3() } },
    vertexShader: `attribute float aSeed; uniform float uTime, uScale; uniform vec3 uCam; varying float vA;
      void main(){ vec3 p = position; p.y += uTime * (0.03 + aSeed * 0.05); p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.4 + uTime * 0.06; p.z += cos(uTime * 0.17 + aSeed * 17.0) * 0.4;
        p = uCam + mod(p - uCam + 12.0, 24.0) - 12.0;
        vec4 mv = viewMatrix * vec4(p, 1.0); float dz = -mv.z;
        gl_PointSize = (0.018 + aSeed * 0.04) * uScale / max(dz, 0.3);
        vA = smoothstep(0.3, 1.6, dz) * smoothstep(15.0, 6.0, dz) * (0.3 + 0.7 * fract(aSeed * 7.3));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying float vA; void main(){ float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vec3(0.82, 0.96, 1.0) * 1.3, a * vA * 0.7); }',
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts); return m;
})();
const NB = small ? 220 : 380;
const bub = { pos: new Float32Array(NB * 3), size: new Float32Array(NB), vy: new Float32Array(NB), sd: new Float32Array(NB), next: 0 };
const bubMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: true, fog: false, uniforms: { uScale: { value: 500 } },
  vertexShader: `attribute float aSize; uniform float uScale; varying float vA;
    void main(){ vec4 mv = viewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(-mv.z, 0.3); vA = step(0.0005, aSize) * smoothstep(0.25, 0.9, -mv.z); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA;
    void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0 || vA < 0.01) discard;
      float rim = smoothstep(0.5, 1.0, r), spec = smoothstep(0.26, 0.0, length(c - vec2(-0.17, -0.2)));
      gl_FragColor = vec4(mix(vec3(0.5, 0.8, 0.95), vec3(0.95, 1.0, 1.0), rim) * (0.6 + rim * 0.9) + spec * 2.2, (0.1 + rim * 0.75 + spec) * vA); }`,
});
const bubGeo = new THREE.BufferGeometry(); bubGeo.setAttribute('position', new THREE.BufferAttribute(bub.pos, 3)); bubGeo.setAttribute('aSize', new THREE.BufferAttribute(bub.size, 1));
const bubPts = new THREE.Points(bubGeo, bubMat); bubPts.frustumCulled = false; bubPts.renderOrder = 4; scene.add(bubPts);
function emit(n, x, y, z, spread = 0.2, smax = 0.09) {
  for (let k = 0; k < n; k++) { const i = bub.next; bub.next = (bub.next + 1) % NB; const s = 0.018 + Math.pow(Math.random(), 2.2) * smax; bub.pos.set([x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread], i * 3); bub.size[i] = s; bub.vy[i] = 0.5 + s * 16 + Math.random() * 0.4; bub.sd[i] = Math.random() * 20; }
}
function stepBubbles(dt, t) {
  for (let i = 0; i < NB; i++) { if (bub.size[i] <= 0) continue; const k = i * 3; bub.pos[k + 1] += bub.vy[i] * dt; bub.pos[k] += Math.sin(t * 3.1 + bub.sd[i]) * 0.25 * dt; bub.pos[k + 2] += Math.cos(t * 2.7 + bub.sd[i]) * 0.25 * dt; if (bub.pos[k + 1] > SURF - 0.05) bub.size[i] = 0; }
  bubGeo.attributes.position.needsUpdate = true; bubGeo.attributes.aSize.needsUpdate = true;
}

/* ---------- passe finale : profondeur de champ, halo, ondulation de l’eau, étalonnage ---------- */
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 0 : 4, depthTexture: new THREE.DepthTexture(1, 1) });
const hA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), hB = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const FSV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), passMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), passScene = new THREE.Scene(); passMesh.frustumCulled = false; passScene.add(passMesh);
const blurMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false, toneMapped: false, uniforms: { tColor: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: FSV,
  fragmentShader: `uniform sampler2D tColor; uniform vec2 uDir; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tColor, vUv).rgb * 0.19648;
      c += (texture2D(tColor, vUv + uDir * 1.41176).rgb + texture2D(tColor, vUv - uDir * 1.41176).rgb) * 0.29691;
      c += (texture2D(tColor, vUv + uDir * 3.29412).rgb + texture2D(tColor, vUv - uDir * 3.29412).rgb) * 0.09447;
      c += (texture2D(tColor, vUv + uDir * 5.17647).rgb + texture2D(tColor, vUv - uDir * 5.17647).rgb) * 0.01038;
      gl_FragColor = vec4(c, 1.0); }`,
});
const finalMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tSoft: { value: hB.texture }, cNear: { value: camera.near }, cFar: { value: camera.far }, uFocus: { value: 8 }, uDof: { value: 1 }, uTime: U.time, uLift: { value: 0 }, uFade: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: FSV,
  fragmentShader: `uniform sampler2D tColor, tDepth, tSoft; uniform float cNear, cFar, uFocus, uDof, uTime, uLift, uFade; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec2 uv = vUv + vec2(sin(vUv.y * 17.0 + uTime * 1.3), cos(vUv.x * 15.0 + uTime * 1.1)) * 0.0011;      // l’eau fait onduler l’image
      float dz = texture2D(tDepth, uv).x, dist = (cNear * cFar) / (cFar - dz * (cFar - cNear));
      vec2 dir = uv - 0.5, ca = dir * (0.0012 + dot(dir, dir) * 0.006);
      vec3 sharp = vec3(texture2D(tColor, uv - ca).r, texture2D(tColor, uv).g, texture2D(tColor, uv + ca).b), soft = texture2D(tSoft, uv).rgb;
      float coc = max(smoothstep(uFocus * 1.3, uFocus * 3.2, dist), smoothstep(uFocus * 0.66, uFocus * 0.28, dist)) * uDof;
      vec3 c = mix(sharp, soft, coc);
      c += max(soft - 0.9, 0.0) * 0.5;
      c *= 1.0 - dot(dir, dir) * 0.85;
      c = mix(c, vec3(0.8, 0.96, 1.0) * 3.2, uLift);                                                   // la remontée vers la lumière
      float n = fract(sin(dot(vUv * uRes + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453); c += (n - 0.5) * 0.012;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      { vec3 g = clamp(gl_FragColor.rgb, 0.0, 1.0); g = mix(g, g * g * (3.0 - 2.0 * g), 0.28); g.r *= 0.965; g.b = min(1.0, g.b * 1.02 + 0.006); gl_FragColor.rgb = g * uFade; }
      #include <colorspace_fragment>
    }`,
});
function pass(mat, target) { passMesh.material = mat; renderer.setRenderTarget(target); renderer.render(passScene, postCam); }

/* ---------- l’état : phases, caméra, fleur, souris ---------- */
const sound = createDiveSound();
let muted = false; try { muted = localStorage.getItem('ms_dv_sound') === 'off'; } catch (e) { /* rien */ }
let phase = 'load', now = 0, diveT = 0, bloom = 0.06, bloomV = 0, frames = 0, narrow = false, nextDrop = 0.6, dropIx = 0, lastAmb = 0, liveT = 0;
const orbit = { az: 0, pol: 1.54, taz: 0, tpol: 1.54, R: 8.2 };
const CEN = new V3(0.15, 2.75, 0.5), GATE = { pos: new V3(0, 9.2, 7.6), tgt: new V3(0, 10.6, -6.5) };
const ptr = { on: false, ndc: new THREE.Vector2(9, 9), speed: 0, force: 0, t: 0, down: false, mode: null, sx: 0, sy: 0, st: 0, moved: 0, id: -1 };
const grab = { on: false, target: new V3(), plane: new THREE.Plane(), off: new V3() };
const ray = new THREE.Raycaster(), headPos = new V3().copy(P[NN - 1]), headPrev = headPos.clone(), headVel = new V3(), vLocal = new V3(), qInv = new THREE.Quaternion(), axisY = new V3(0, 1, 0), tmp = new V3(), tmp2 = new V3(), camPos = new V3(), camTgt = new V3(), livePos = new V3(), liveTgt = new V3();
let impulse = null;                                           // un clic dans l’eau : une onde qui pousse tout
const load = { p: 0, last: 0, hold: false, going: false };

function stepChain(h, t) {
  const damp = Math.pow(0.935, h * 60), sk = reduced ? 0.35 : 1;
  const ro = ray.ray.origin, rd = ray.ray.direction;
  for (let i = 1; i < NN; i++) {
    const w = i / (NN - 1), p = P[i], q = PP[i];
    const sx = w * w * (Math.sin(t * 0.7 + 1) * 0.26 + Math.sin(t * 1.31) * 0.1) * sk, sz = w * w * (Math.cos(t * 0.53) * 0.18 + Math.sin(t * 1.07 + 2) * 0.08) * sk;
    let ax = (rest[i].x + sx - p.x) * KS, ay = (rest[i].y - p.y) * KS, az = (rest[i].z + sz - p.z) * KS;
    if (ptr.on && !grab.on && ptr.force > 0.01) {             // la souris pousse l’eau : la fleur s’écarte et recule
      tmp.subVectors(p, ro); const pr = tmp.dot(rd);
      if (pr > 0) { tmp.addScaledVector(rd, -pr); const dist = tmp.length(), RP = 1.15; if (dist < RP) { const f = (1 - dist / RP) ** 2 * ptr.force * w / Math.max(dist, 0.05); ax += tmp.x * f * 0.8 + rd.x * f * dist * 1.1; ay += tmp.y * f * 0.8 + rd.y * f * dist * 1.1; az += tmp.z * f * 0.8 + rd.z * f * dist * 1.1; } }
    }
    if (impulse) { tmp.subVectors(p, impulse.at); const dist = tmp.length(), band = Math.exp(-((dist - (t - impulse.t) * 5) ** 2) * 1.2) * Math.exp(-(t - impulse.t) * 1.2); const f = band * 60 * w / Math.max(dist, 0.2); ax += tmp.x * f; ay += tmp.y * f * 0.4; az += tmp.z * f; }
    const vx = (p.x - q.x) * damp, vy = (p.y - q.y) * damp, vz = (p.z - q.z) * damp;
    q.copy(p); p.x += vx + ax * h * h; p.y += vy + ay * h * h; p.z += vz + az * h * h;
  }
  if (grab.on) {                                              // la main : la tête suit, sans dépasser la longueur de la tige
    tmp.subVectors(grab.target, P[0]); const len = tmp.length(); if (len > SL * 0.985) tmp.multiplyScalar((SL * 0.985) / len);
    tmp.add(P[0]); tmp.y = Math.max(tmp.y, gH(tmp.x, tmp.z) + 0.3); P[NN - 1].lerp(tmp, 0.45);
  }
  for (let k = 0; k < 8; k++) {
    for (let i = 1; i < NN; i++) {
      const a = P[i - 1], b = P[i]; tmp2.subVectors(b, a); const len = tmp2.length() || 1e-5, df = (len - SEG) / len;
      if (i === 1) b.addScaledVector(tmp2, -df); else if (grab.on && i === NN - 1) a.addScaledVector(tmp2, df); else { a.addScaledVector(tmp2, df * 0.5); b.addScaledVector(tmp2, -df * 0.5); }
    }
    for (let i = 1; i < NN - 1; i++) { tmp2.addVectors(P[i - 1], P[i + 1]).multiplyScalar(0.5); P[i].lerp(tmp2, 0.2); }
  }
  for (let i = 1; i < NN; i++) { const fl = gH(P[i].x, P[i].z) + 0.09; if (P[i].y < fl) P[i].y = fl; }
}

function drop(t) {
  const x = rr(-7.5, 7.5), z = phase === 'live' ? rr(-12, 0) : rr(-11, 3), k = dropIx++ % 6;
  DROPS[k].set(x, z, t, rr(0.45, 1)); sound.drop(clamp(x / 8, -0.9, 0.9), phase === 'live' ? 0.5 : 1);
  emit(3, x, SURF - 0.5, z, 0.3, 0.05);
}

function tick(dt) {
  now += dt; U.time.value = now; frames++;
  // les gouttes à la surface
  if (now > nextDrop && phase !== 'load') { drop(now); nextDrop = now + (phase === 'live' ? rr(1.4, 3.6) : rr(0.45, 1.3)); }
  // la plongée
  let k = 0;
  if (phase === 'dive') { diveT += dt; k = ease(clamp(diveT / (reduced ? 0.01 : 4.6))); if (diveT < 2.2) emit(4, camera.position.x + rr(-3, 3), camera.position.y - rr(0.5, 3), camera.position.z - rr(1, 6), 0.5, 0.12); if (k >= 1) { phase = 'live'; liveT = now; d.classList.add('dv-live'); } }
  else if (phase === 'live' || phase === 'leave') k = 1;
  if ((phase === "dive" && diveT > 3.7) || phase === "live" || phase === "leave") { bloomV += ((1 - bloom) * 5.5 - bloomV * 1.9) * dt; bloom = clamp(bloom + bloomV * dt, 0.04, 1.2); }
  // la souris : sa force retombe si elle ne bouge plus
  ptr.speed *= Math.pow(0.02, dt); ptr.force = ptr.on ? 20 * (0.16 + Math.min(1.5, ptr.speed * 0.45)) : 0;
  if (ptr.on) { ray.setFromCamera(ptr.ndc, camera); const t0 = (1.3 - ray.ray.origin.y) / (ray.ray.direction.y || 1e-5); if (t0 > 0 && t0 < 40) { tmp.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t0); U.push.value.set(tmp.x, tmp.z, Math.min(1.3, 0.12 + ptr.speed * 0.4)); } }
  else U.push.value.z *= Math.pow(0.05, dt);
  if (impulse && now - impulse.t > 3) impulse = null;
  // la tige
  const steps = Math.min(3, Math.max(1, Math.ceil(dt * 60))), h = dt / steps;
  for (let s = 0; s < steps; s++) stepChain(h, now);
  updateTube(stemGeo, stemCurve, 0.085, 0.05);
  headPrev.copy(headPos); headPos.copy(P[NN - 1]);
  tmp.subVectors(headPos, headPrev).multiplyScalar(1 / Math.max(dt, 1e-3)); headVel.lerp(tmp, Math.min(1, dt * 10));
  head.position.copy(headPos);
  tmp.subVectors(P[NN - 1], P[NN - 3]).normalize(); head.quaternion.setFromUnitVectors(axisY, tmp);
  qInv.copy(head.quaternion).invert(); vLocal.copy(headVel).applyQuaternion(qInv);
  poseBloom(flower, bloom, vLocal, dt, now);
  glowL.intensity = 0.12 + 0.38 * clamp(bloom);
  for (const l of leaves) {                                  // les feuilles suivent le courant, et s’écartent quand on agite l’eau près d’elles
    const push = U.push.value.z * Math.exp(-((U.push.value.x - Math.sin(l.az) * 1.2) ** 2 + (U.push.value.y - Math.cos(l.az) * 1.2) ** 2) * 0.25);
    l.f += (push - l.f) * Math.min(1, dt * 4);
    l.m.rotation.x = l.o + Math.sin(now * 0.7 + l.ph) * 0.05 + Math.sin(now * 0.31 + l.ph * 2) * 0.03 + l.f * 0.22; l.m.morphTargetInfluences[0] = 0.1 + Math.sin(now * 0.5 + l.ph) * 0.06 + l.f * 0.2;
  }
  buds.forEach((b) => { b.root.rotation.z = Math.sin(now * 0.6 + b.ph) * 0.05; b.root.rotation.x = Math.cos(now * 0.47 + b.ph) * 0.04; });
  // les bulles : quelques-unes montent du sable, d’autres s’échappent de la fleur quand elle bouge vite
  if (now - lastAmb > 0.22) { lastAmb = now; const x = rr(-7, 7), z = rr(-10, 2); emit(1, x, gH(x, z) + 0.1, z, 0.1, 0.06); }
  if (headVel.length() > 2.2 && Math.random() < 0.5) emit(1, headPos.x, headPos.y + 0.3, headPos.z, 0.7, 0.05);
  stepBubbles(dt, now);
  // le chargement vers l’équipe : on remonte
  if (phase === 'live') {
    if (load.hold) { load.p = Math.min(1, load.p + dt / 2.4); load.last = performance.now(); }
    else if (performance.now() - load.last > 420) load.p = Math.max(0, load.p - dt * 0.8);
    if (load.p >= 1) leave();
  }
  const lift = load.p * load.p;
  // la caméra
  orbit.az += (orbit.taz - orbit.az) * Math.min(1, dt * 5); orbit.pol += (orbit.tpol - orbit.pol) * Math.min(1, dt * 5);
  const R = orbit.R * (narrow ? 1.28 : 1);
  livePos.set(CEN.x + R * Math.sin(orbit.pol) * Math.sin(orbit.az), CEN.y + R * Math.cos(orbit.pol), CEN.z + R * Math.sin(orbit.pol) * Math.cos(orbit.az)); livePos.y = Math.max(livePos.y, 0.55);
  liveTgt.copy(CEN).lerp(headPos, 0.3); if (narrow) liveTgt.y -= 1.25;
  camPos.copy(GATE.pos).lerp(livePos, k); camPos.z += Math.sin(Math.PI * k) * 2.2; camTgt.copy(GATE.tgt).lerp(liveTgt, Math.pow(k, 0.8));
  const fl = reduced ? 0 : 1; camPos.x += Math.sin(now * 0.31) * 0.14 * fl; camPos.y += Math.sin(now * 0.43) * 0.09 * fl + lift * 4.6; camTgt.y += lift * 8.5;
  camera.position.copy(camPos); camera.fov = (narrow ? 54 : 38) + lift * 8; camera.updateProjectionMatrix(); camera.lookAt(camTgt);
  sky.position.copy(camera.position); motes.uniforms.uCam.value.copy(camera.position);
  const F = finalMat.uniforms; F.uFocus.value += ((k > 0.6 ? camera.position.distanceTo(headPos) : 13) - F.uFocus.value) * Math.min(1, dt * 4); F.uDof.value = small ? 0.75 : 1; F.uLift.value = Math.pow(load.p, 4) * 0.7;
  if (phase === 'live' || phase === 'leave') { sound.rise(load.p); ring(load.p); }
}
function render() {
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  const B = blurMat.uniforms;
  B.tColor.value = rt.texture; B.uDir.value.set(1 / hA.width, 0); pass(blurMat, hA);
  B.tColor.value = hA.texture; B.uDir.value.set(0, 1 / hA.height); pass(blurMat, hB);
  B.tColor.value = hB.texture; B.uDir.value.set(1.8 / hA.width, 0); pass(blurMat, hA);
  B.tColor.value = hA.texture; B.uDir.value.set(0, 1.8 / hA.height); pass(blurMat, hB);
  pass(finalMat, null);
}
let last = 0, fAcc = 0, fN = 0;
function frame(ms) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = 0; return; }
  const dt = Math.min(0.05, last ? (ms - last) / 1000 : 1 / 60); last = ms;
  tick(dt); render();
  fAcc += dt; fN++;                                            // qualité automatique
  if (fAcc > 2.5) { const fps = fN / fAcc; fAcc = 0; fN = 0; if (fps < 40 && PR > DPR * 0.5 + 0.01) { PR = Math.max(DPR * 0.5, PR * 0.82); resize(); } else if (fps > 57 && PR < DPR - 0.01) { PR = Math.min(DPR, PR * 1.12); resize(); } }
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setPixelRatio(PR); renderer.setSize(w, h, false);
  const W = Math.floor(w * PR), H = Math.floor(h * PR); rt.setSize(W, H); hA.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1)); hB.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1));
  narrow = w / h < 0.9; camera.aspect = w / h; camera.updateProjectionMatrix();
  const sc = (H * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); motes.uniforms.uScale.value = sc; bubMat.uniforms.uScale.value = sc; finalMat.uniforms.uRes.value.set(W, H);
}
addEventListener('resize', resize);

/* ---------- les gestes ---------- */
const setNdc = (e) => { const r = canvas.getBoundingClientRect(); ptr.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
function touched() { if (!d.classList.contains('dv-touched')) d.classList.add('dv-touched'); }
function grabStart() { grab.on = true; camera.getWorldDirection(tmp); grab.plane.setFromNormalAndCoplanarPoint(tmp, headPos); grab.target.copy(headPos); grab.off.set(0, 0, 0); if (ray.ray.intersectPlane(grab.plane, tmp2)) grab.off.subVectors(headPos, tmp2); sound.grab(); emit(6, headPos.x, headPos.y + 0.3, headPos.z, 0.8, 0.05); touched(); }
function grabEnd() { if (!grab.on) return; grab.on = false; sound.release(clamp(headPos.distanceTo(rest[NN - 1]) / 2.5, 0.3, 1.2)); emit(10, headPos.x, headPos.y + 0.3, headPos.z, 0.9, 0.06); }
function breathe() { bloomV -= 3.4; sound.breathe(); emit(26, headPos.x, headPos.y + 0.5, headPos.z, 0.9, 0.1); touched(); }
canvas.addEventListener('pointerdown', (e) => {
  if (phase !== 'live') return;
  try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* rien */ }
  setNdc(e); ray.setFromCamera(ptr.ndc, camera); ptr.on = true; ptr.down = true; ptr.id = e.pointerId; ptr.sx = e.clientX; ptr.sy = e.clientY; ptr.st = performance.now(); ptr.moved = 0;
  ptr.mode = ray.intersectObject(hitProxy).length ? 'grab' : 'orbit';
  if (ptr.mode === 'grab') { grabStart(); canvas.style.cursor = 'grabbing'; }
});
canvas.addEventListener('pointermove', (e) => {
  const px = ptr.ndc.x, py = ptr.ndc.y; setNdc(e); const t = performance.now(), dt = Math.max(8, t - ptr.t) / 1000; ptr.t = t;
  ptr.speed += (Math.hypot(ptr.ndc.x - px, ptr.ndc.y - py) / dt - ptr.speed) * 0.4; ptr.on = e.pointerType === 'mouse' || ptr.down;
  if (phase !== 'live') return;
  ray.setFromCamera(ptr.ndc, camera);
  if (ptr.down) {
    ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy));
    if (ptr.mode === 'grab') { if (ray.ray.intersectPlane(grab.plane, tmp2)) grab.target.copy(tmp2).add(grab.off); }
    else { orbit.taz = clamp(orbit.taz - e.movementX * 0.005, -1.25, 1.25); orbit.tpol = clamp(orbit.tpol - e.movementY * 0.004, 1.02, 1.72); if (ptr.moved > 8) touched(); }
  } else canvas.style.cursor = ray.intersectObject(hitProxy).length ? 'grab' : '';
});
function pointerUp(e) {
  if (!ptr.down || (e.pointerId !== undefined && e.pointerId !== ptr.id)) return; ptr.down = false;
  const click = ptr.moved < 7 && performance.now() - ptr.st < 400;
  if (ptr.mode === 'grab') { grabEnd(); canvas.style.cursor = 'grab'; if (click) breathe(); }
  else if (click && phase === 'live') { const t0 = ray.ray.direction.dot(tmp.subVectors(headPos, ray.ray.origin)); tmp.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t0); impulse = { at: tmp.clone(), t: now }; U.push.value.z = 1.4; emit(14, tmp.x, tmp.y, tmp.z, 0.5, 0.08); sound.bubbles(7, 0.4, 0.9, clamp(ptr.ndc.x, -1, 1)); touched(); }
  if (e.pointerType && e.pointerType !== 'mouse') ptr.on = false;
}
canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('pointerleave', () => { if (!ptr.down) ptr.on = false; });
addEventListener('keydown', (e) => {
  if (phase !== 'live') { if (phase === 'gate' && e.key === 'Enter') { e.preventDefault(); enter(true); } return; }
  const kx = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (kx) { for (let i = 1; i < NN; i++) PP[i].x -= kx * 0.09 * (i / NN); touched(); e.preventDefault(); }
  if (e.key === ' ') { breathe(); e.preventDefault(); }
  if (['ArrowDown', 'PageDown'].includes(e.key)) { pushLoad(0.08); e.preventDefault(); }
});

/* ---------- le chargement vers l’équipe (molette, ou cercle maintenu) ---------- */
const ringBtn = $('[data-ring]'), ringFill = $('[data-ring-fill]'), ringPct = $('[data-ring-pct]'), CIRC = 2 * Math.PI * 54;
function ring(p) { if (!ringFill) return; ringFill.style.strokeDashoffset = (CIRC * (1 - p)).toFixed(1); ringPct.textContent = p > 0.01 ? Math.round(p * 100) + ' %' : 'L’équipe'; d.classList.toggle('dv-loading', p > 0.01); }
function pushLoad(a) { if (phase !== 'live' || load.going || now - liveT < 1.2) return; load.p = Math.min(1, load.p + a); load.last = performance.now(); }
addEventListener('wheel', (e) => { e.preventDefault(); if (e.deltaY > 0) pushLoad(Math.min(e.deltaY, 160) / 1150); }, { passive: false });
if (ringBtn) {
  ringBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); load.hold = true; sound.start(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => ringBtn.addEventListener(ev, () => { load.hold = false; }));
  ringBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); load.p = 1; } });
}
function leave() {
  if (load.going) return; load.going = true; phase = 'leave'; load.p = 1; ring(1); sound.surface();
  try { sessionStorage.setItem('ms_from_dive', muted ? '0' : '1'); } catch (e) { /* rien */ }
  d.classList.add('dv-go');
  setTimeout(() => { location.href = '/msdesign.be/equipe.html'; }, reduced ? 50 : 1000);
}
addEventListener('pageshow', (e) => { if (e.persisted) { load.going = false; load.p = 0; phase = 'live'; d.classList.remove('dv-go'); ring(0); } });

/* ---------- l’écran d’entrée, le son ---------- */
const soundBtn = $('[data-sound]');
const label = () => { if (soundBtn) soundBtn.textContent = muted ? 'Activer le son' : 'Couper le son'; };
label();
if (soundBtn) soundBtn.addEventListener('click', () => { muted = !muted; try { localStorage.setItem('ms_dv_sound', muted ? 'off' : 'on'); } catch (e) { /* rien */ } sound.setMuted(muted); if (!muted) sound.start(); label(); });
function enter(withSound) {
  if (phase !== 'gate') return;
  muted = !withSound; try { localStorage.setItem('ms_dv_sound', muted ? 'off' : 'on'); } catch (e) { /* rien */ }
  sound.setMuted(muted); if (withSound) { sound.start(); sound.plunge(); }
  label(); phase = 'dive'; diveT = 0; d.classList.add('dv-in');
}
$$('[data-enter]').forEach((b) => b.addEventListener('click', () => enter(b.dataset.enter === '1')));
if (coarse) { const hint = $('[data-hint]'); if (hint) hint.textContent = 'Maintenez le cercle pour rencontrer l’équipe'; }

/* ---------- départ ---------- */
resize();
for (let i = 0; i < 40; i++) { const x = rr(-7, 7), z = rr(-10, 2); emit(1, x, rr(0.5, SURF - 1), z, 0.1, 0.06); }
if (REC) record();
else {
  if (AT) { phase = 'live'; liveT = -9; bloom = 1; d.classList.add('dv-in', 'dv-live', 'dv-touched'); }
  tick(1 / 60); render();
  d.classList.add('dv-ready');
  const loadEl = $('[data-load]'), gate = $('[data-gate]'); let lp = 0;
  const count = () => { lp = Math.min(100, lp + 3 + Math.random() * 5); if (loadEl) loadEl.textContent = String(Math.round(lp)).padStart(3, '0'); if (gate) gate.style.setProperty('--p', (lp / 100).toFixed(3)); if (lp < 100) setTimeout(count, 34); else { d.classList.add('dv-loaded'); if (phase === 'load') phase = 'gate'; const a = $('[data-gate-actions]'); if (a) { a.hidden = false; const b = a.querySelector('button'); if (b && !AT) b.focus({ preventScroll: true }); } } };
  count();
  requestAnimationFrame(frame);
}
window.__dv = {
  get phase() { return phase; }, get frames() { return frames; }, get load() { return load.p; }, get bloom() { return bloom; }, enter, breathe,
  head: () => headPos.toArray().map((v) => +v.toFixed(2)),
  headScreen: () => { tmp.copy(headPos); tmp.y += 0.4; tmp.project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (tmp.x * 0.5 + 0.5) * r.width, r.top + (-tmp.y * 0.5 + 0.5) * r.height]; },
};

/* ---------- outil : la vidéo d’aperçu de l’accueil (10 s en boucle : on attrape la fleur, on la tire vers le sable, on la lâche) ---------- */
async function record() {
  const { Muxer, ArrayBufferTarget } = await import('/_msdesign-src/video/vendor/mp4-muxer.mjs');
  const W = 1280, H = 720, FPS = 30, T = 10, X = 0.9, NX = Math.round(X * FPS), NT = Math.round(T * FPS);
  const out = document.createElement('canvas'); out.width = W; out.height = H; const x = out.getContext('2d', { willReadFrequently: true });
  const save = (p, b) => fetch('/__save?path=' + encodeURIComponent(p), { method: 'POST', body: b });
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
  let err = null; const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { err = e; } });
  enc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 2200000, framerate: FPS, latencyMode: 'quality', avc: { format: 'avc' } });
  phase = 'live'; liveT = -9; bloom = 1; Math.random = rnd;
  for (let f = 0; f < 5 * FPS; f++) tick(1 / FPS);                       // la scène s’installe
  const home = rest[NN - 1].clone(), low = new V3(-1.9, 0.75, 0.9), shot = (f) => {
    const t = f / FPS;
    if (t >= 1.2 && t < 4.4) { if (!grab.on) { grab.on = true; emit(6, headPos.x, headPos.y + 0.3, headPos.z, 0.8, 0.05); } const u = ease(clamp((t - 1.2) / 2.2)); grab.target.copy(home).lerp(low, u); grab.target.x += Math.sin(t * 2.2) * 0.25 * u; }
    else if (grab.on) { grab.on = false; emit(18, headPos.x, headPos.y + 0.3, headPos.z, 0.9, 0.08); }
    if (Math.abs(t - 7.2) < 0.5 / FPS) { bloomV -= 3.2; emit(26, headPos.x, headPos.y + 0.5, headPos.z, 0.9, 0.1); }
    tick(1 / FPS); render(); x.drawImage(canvas, 0, 0, W, H); return x.getImageData(0, 0, W, H);
  };
  const headFrames = []; for (let f = 0; f < NX; f++) headFrames.push(shot(f));
  let o = 0;
  for (let f = NX; f < NT + NX; f++) {
    const im = shot(f);
    if (f >= NT) { const w = (f - NT + 0.5) / NX, s = w * w * (3 - 2 * w), a = im.data, b = headFrames[f - NT].data; for (let i = 0; i < a.length; i += 4) { a[i] += (b[i] - a[i]) * s; a[i + 1] += (b[i + 1] - a[i + 1]) * s; a[i + 2] += (b[i + 2] - a[i + 2]) * s; } }
    x.putImageData(im, 0, 0);
    if (o === 0) await save('assets/img/plongee-poster.webp', await new Promise((r) => out.toBlob(r, 'image/webp', 0.82)));
    const vf = new VideoFrame(out, { timestamp: Math.round(o * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); enc.encode(vf, { keyFrame: o % 60 === 0 }); vf.close(); o++;
    while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 5));
    if (err) throw err; if (f % 30 === 0) document.title = 'frame ' + f;
  }
  await enc.flush(); muxer.finalize();
  await save('assets/video/plongee.mp4', new Blob([muxer.target.buffer], { type: 'video/mp4' }));
  document.title = 'done ' + (muxer.target.buffer.byteLength / 1e6).toFixed(2) + ' MB';
}
