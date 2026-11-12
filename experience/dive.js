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
const AT = Q.has('at');                                       // at : captures sans écran d’entrée
let reduced = Q.get('motion') === 'reduce';
try { if (localStorage.getItem('ms_motion') === 'reduce') reduced = true; } catch (e) { /* rien */ }
const small = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
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

/* ---------- le chargement : le modèle 3D de la fleur (fait dans Blender), et le compteur de l’écran d’entrée ---------- */
const boot = { p: 0, cap: 34, done: null }, loadEl = $('[data-load]'), gateEl = $('[data-gate]');
(function count() {                                           // le compteur avance au rythme du dessin (≈ 3,5 s), et attend le modèle
  boot.p = Math.min(boot.cap, boot.p + 0.55 + Math.random() * 1.1);
  if (loadEl) loadEl.textContent = String(Math.round(boot.p)).padStart(3, '0');
  if (gateEl) gateEl.style.setProperty('--p', (boot.p / 100).toFixed(3));
  if (boot.p < 100) setTimeout(count, 34); else if (boot.done) boot.done();
})();
async function loadModel() {                                  // format maison : sommets entrelacés (position, normale, uv) + index, décrits par lotus.json
  try {
    const base = new URL('models/', import.meta.url), get = (f, k) => fetch(new URL(f + '?v=31', base)).then((r) => { if (!r.ok) throw new Error(f); return r[k](); });
    const [j, buf] = await Promise.all([get('lotus.json', 'json'), get('lotus.bin', 'arrayBuffer')]), out = {};
    for (const [name, p] of Object.entries(j.parts)) {
      const n = p.vertexCount, f = new Float32Array(buf, p.vertexOffset, n * 8), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { pos[i * 3] = f[i * 8]; pos[i * 3 + 1] = f[i * 8 + 1]; pos[i * 3 + 2] = f[i * 8 + 2]; nor[i * 3] = f[i * 8 + 3]; nor[i * 3 + 1] = f[i * 8 + 4]; nor[i * 3 + 2] = f[i * 8 + 5]; uv[i * 2] = f[i * 8 + 6]; uv[i * 2 + 1] = f[i * 8 + 7]; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(new THREE.BufferAttribute(p.index32 ? new Uint32Array(buf, p.indexOffset, p.indexCount) : new Uint16Array(buf, p.indexOffset, p.indexCount), 1)); g.computeBoundingSphere(); out[name] = g;
    }
    out._meta = j;
    return out.Petale && out.Coeur && out.Feuille ? out : null;
  } catch (e) { return null; }                                // sans le modèle, la fleur est dessinée par le code
}
const modelP = loadModel();

const SURF = 11;                                              // hauteur de la surface de l’eau
function gH(x, z) {                                           // le fond : plat autour de la fleur, dunes plus loin
  const r = Math.hypot(x, z);
  return (fbm(x * 0.09 + 5, z * 0.09) - 0.5) * 1.5 * smooth(2.5, 9, r) + (noise(x * 0.35, z * 0.35) - 0.5) * 0.1 + smooth(14, 40, r) * 2.4 * fbm(x * 0.03, z * 0.03 + 9);
}

/* ---------- rendu ---------- */
const canvas = $('.dv__gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { d.classList.add('dv-nogl'); throw e; }
const DPR = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.6);
let PR = DPR; renderer.setPixelRatio(PR);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const FOG = new THREE.Color('#0f6590'), DEEP = new THREE.Color('#06293f'), TOP = new THREE.Color('#bff0ff');
const PAL_D = [FOG.clone(), DEEP.clone(), TOP.clone()], PAL_N = [new THREE.Color('#052238'), new THREE.Color('#020c17'), new THREE.Color('#1d4a70')];   // le jour, la nuit
scene.fog = new THREE.FogExp2(FOG, 0.052);
const camera = new THREE.PerspectiveCamera(38, 1, 0.2, 220);
const AXIS = new V3(0.15, -0.88, 0.44).normalize();            // le sens des rayons du soleil (il est derrière la fleur : pétales à contre-jour)
const U = { time: { value: 0 }, push: { value: new V3(0, 0, 0) }, current: { value: new THREE.Vector2(0.34, 0.1) }, day: { value: 1 }, night: { value: 0 }, env: { value: 1 } };   // env : 0 = le noir de l’entrée, 1 = l’eau

const sun = new THREE.DirectionalLight('#e9fbff', 2.3);
sun.position.copy(AXIS).multiplyScalar(-22); sun.castShadow = true;
sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 44 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
const hemi = new THREE.HemisphereLight('#8fdcff', '#0b3a55', 1.25); scene.add(sun, sun.target, hemi);
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
    outgoingLight += diffuseColor.rgb * cz * uCauK * (0.12 + 0.88 * uDay) * smoothstep(-0.3, 0.7, nW.y) * vec3(0.72, 1.0, 1.06);
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
function water(mat, { cau = 1, trans = 0, sway = false, vtx = null } = {}) {   // vtx : une déformation en plus (la nage des carpes)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; sh.uniforms.uDay = U.day; sh.uniforms.uCauK = { value: cau }; sh.uniforms.uTrans = { value: trans };
    if (sway) { sh.uniforms.uPush = U.push; sh.uniforms.uCurrent = U.current; }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\n' + (sway ? 'uniform float uTime; uniform vec3 uPush; uniform vec2 uCurrent;\n' : ''))
      .replace('#include <project_vertex>', sway ? SWAY_PROJECT : '#include <project_vertex>\n  { vec4 wp = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n    wp = instanceMatrix * wp;\n  #endif\n  vWp = (modelMatrix * wp).xyz; }');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform float uTime, uCauK, uTrans, uDay;\n' + GLSL_CAU)
      .replace('#include <opaque_fragment>', CAU_APPLY + '\n#include <opaque_fragment>');
    if (vtx) { Object.assign(sh.uniforms, vtx.uniforms); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + vtx.decl).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vtx.code); }
  };
  mat.customProgramCacheKey = () => 'dv' + (sway ? 's' : 'n') + (vtx ? vtx.key : '');
  return mat;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ---------- le fond de l’eau, la surface vue d’en dessous ---------- */
const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { cTop: { value: TOP }, cMid: { value: FOG }, cDeep: { value: DEEP }, uAxis: { value: AXIS }, uNight: U.night, uEnv: U.env },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 cTop, cMid, cDeep, uAxis; uniform float uNight, uEnv; varying vec3 vDir;
    void main(){ vec3 dd = normalize(vDir); float h = dd.y;
      vec3 c = mix(cMid, cDeep, smoothstep(0.05, -0.55, h)); c = mix(c, cTop * 0.9, smoothstep(0.0, 0.95, h) * 0.75);
      c += vec3(0.5, 0.85, 1.0) * pow(max(dot(dd, -uAxis), 0.0), 5.0) * 0.55 * (1.0 - 0.85 * uNight);
      gl_FragColor = vec4(mix(vec3(0.0015, 0.0024, 0.004), c, uEnv), 1.0); }`,
}));
sky.frustumCulled = false; sky.renderOrder = -2; scene.add(sky);
const DROPS = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0));
const surface = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), new THREE.ShaderMaterial({
  side: THREE.DoubleSide, fog: false,
  uniforms: { uTime: U.time, uDrops: { value: DROPS }, uFog: { value: FOG }, uNight: U.night, uEnv: U.env },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float uTime, uNight, uEnv; uniform vec4 uDrops[6]; uniform vec3 uFog; varying vec3 vW;
    float hgt(vec2 p){ float v = sin(p.x * 0.8 + uTime * 0.9) * 0.5 + sin(p.y * 1.1 - uTime * 0.7) * 0.4 + sin((p.x + p.y) * 1.9 + uTime * 1.4) * 0.2 + sin((p.x - p.y) * 3.1 - uTime * 1.9) * 0.1;
      for (int i = 0; i < 6; i++) { vec4 dr = uDrops[i]; float t = uTime - dr.z; if (t > 0.0 && t < 7.0) { float r = length(p - dr.xy); v += dr.w * sin(r * 7.0 - t * 10.0) * exp(-t * 0.65) * smoothstep(t * 1.7 + 0.3, t * 1.7 - 0.7, r) * 1.8; } }
      return v; }
    void main(){ vec2 p = vW.xz; float e = 0.06;
      vec2 gr = vec2(hgt(p + vec2(e, 0.0)) - hgt(p - vec2(e, 0.0)), hgt(p + vec2(0.0, e)) - hgt(p - vec2(0.0, e))) / (2.0 * e);
      vec3 V = normalize(vW - cameraPosition);
      float c = V.y + dot(gr, V.xz) * 0.2;                                  // l’angle avec la verticale, bousculé par les vagues
      float win = smoothstep(0.58, 0.74, c);                                // la « fenêtre de Snell » : le ciel n’est visible que juste au-dessus
      vec3 skyC = vec3(0.6, 0.9, 1.0) * 2.4 + vec3(1.0, 0.97, 0.9) * pow(max(1.0 - length(gr - vec2(0.5, 0.3)) * 0.55, 0.0), 6.0) * 5.0;
      vec3 refl = uFog * clamp(0.55 + 0.4 * (gr.x + gr.y), 0.2, 1.4);
      vec3 col = mix(refl, skyC * (1.0 - 0.9 * uNight), win);
      float dist = length(vW - cameraPosition); float f = 1.0 - exp(-dist * dist * 0.0008);
      col = mix(col, uFog * 1.5, f * (1.0 - win * 0.55));
      gl_FragColor = vec4(mix(vec3(0.0015, 0.0024, 0.004), col, uEnv), 1.0); }`,
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
    uniforms: { uTime: U.time, uAxis: { value: AXIS }, uNight: U.night, uEnv: U.env },
    vertexShader: `attribute vec3 aBase; attribute vec4 aParm; uniform vec3 uAxis; varying vec2 vUv; varying vec4 vP; varying float vFade;
      void main(){ vUv = uv; vP = aParm; vec3 mid = aBase + uAxis * aParm.y * 0.5;
        vec3 side = normalize(cross(uAxis, normalize(cameraPosition - mid))); float t = 1.0 - uv.y;
        vec3 p = aBase + uAxis * aParm.y * t + side * (uv.x - 0.5) * aParm.x * (0.5 + t * 1.2);
        vec4 mv = viewMatrix * vec4(p, 1.0); vFade = smoothstep(1.5, 7.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uNight, uEnv; varying vec2 vUv; varying vec4 vP; varying float vFade;
      void main(){ float x = abs(vUv.x - 0.5) * 2.0; float a = pow(max(1.0 - x, 0.0), 2.2);
        a *= smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.93, vUv.y);
        a *= (0.55 + 0.45 * sin(uTime * 0.55 + vP.z)) * (0.65 + 0.35 * sin(uTime * 1.6 + vP.z * 3.1 + vUv.y * 4.0));
        gl_FragColor = vec4(vec3(0.5, 0.86, 1.0) * a * vP.w * vFade * (1.0 - 0.92 * uNight) * uEnv, 1.0); }`,
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
  const C = {                                                                         // [couleur, position] de la base à la pointe, puis la teinte des veines
    blue: [['#fbf3cf', 0], ['#f1f4ff', 0.1], ['#a9c0ff', 0.36], ['#4671f3', 0.68], ['#1b40c6', 1], '24,44,160'],
    rose: [['#fff2d6', 0], ['#fdeef0', 0.12], ['#f8c6d6', 0.4], ['#ec86a8', 0.74], ['#cf4a7a', 1], '150,30,80'],
    blanc: [['#fbefc0', 0], ['#fffaf2', 0.14], ['#fbf8ff', 0.5], ['#e9eeff', 0.86], ['#ccd7ff', 1], '100,110,170'],
    green: [['#a6bd72', 0], ['#4f8a4a', 0.5], ['#2d6238', 1], '20,60,30'],
  }[kind];
  return canvasTex(256, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, h, 0, 0);                                    // bas = base du pétale, haut = pointe
    C.slice(0, -1).forEach(([c, s]) => g.addColorStop(s, c));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const vein = C[C.length - 1];
    for (let k = 0; k < 30; k++) {                                                   // les veines
      const t = (k + 0.5) / 30; x.strokeStyle = `rgba(${vein},${kind === 'green' ? 0.12 + rnd() * 0.1 : 0.06 + rnd() * 0.1})`; x.lineWidth = Math.abs(t - 0.5) < 0.03 ? 2.4 : 0.8 + rnd() * 0.9;
      x.beginPath(); x.moveTo(t * w, h); for (let s = 1; s <= 12; s++) x.lineTo(t * w + Math.sin(s * 0.9 + k) * 1.2, h - (s / 12) * h * (0.86 + rnd() * 0.14)); x.stroke();
    }
    const e = x.createLinearGradient(0, 0, w, 0), ec = `rgba(${vein},0.2)`, e0 = `rgba(${vein},0)`; e.addColorStop(0, ec); e.addColorStop(0.16, e0); e.addColorStop(0.84, e0); e.addColorStop(1, ec); x.fillStyle = e; x.fillRect(0, 0, w, h);
  });
}
const bumpTex = canvasTex(256, 512, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (let k = 0; k < 30; k++) { const t = (k + 0.5) / 30; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(t * w, h); x.lineTo(t * w, h * 0.08); x.stroke(); } }, false);

// le modèle de la fleur (Blender) : on attend qu’il soit arrivé ; s’il manque, on garde la fleur dessinée par le code
const MODEL = await modelP;
const SIDE = MODEL ? THREE.FrontSide : THREE.DoubleSide;        // les pièces du modèle ont une épaisseur : une seule face suffit
const petalMats = {};
function petalMatOf(kind) {
  if (!petalMats[kind]) {
    const map = tex2(kind);                                       // la nuit, le pétale s’allume de ses propres couleurs (emissiveMap)
    petalMats[kind] = water(new THREE.MeshPhysicalMaterial({ map, bumpMap: bumpTex, bumpScale: 0.6, roughness: 0.55, sheen: 0.35, sheenColor: new THREE.Color(kind === 'rose' ? '#ffd8e6' : '#cfdcff'), sheenRoughness: 0.5, side: SIDE, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0 }), { cau: 0.5, trans: 0.62 });
  }
  return petalMats[kind];
}
const sepalMat = water(new THREE.MeshPhysicalMaterial({ map: tex2('green'), bumpMap: bumpTex, bumpScale: 0.6, roughness: 0.6, side: SIDE }), { cau: 0.5, trans: 0.4 });
const stemMat = water(new THREE.MeshPhysicalMaterial({ color: '#4d8a4c', roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#c8f0b0') }), { cau: 0.7, trans: 0.2 });
const stamMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: '#6a4300', emissiveIntensity: 0.55 });
const podMat = water(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, emissive: '#d8ff8c', emissiveIntensity: 0 }), { cau: 0.5, trans: 0.3 });

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
// le pétale du modèle : longueur 1 le long de y ; on lui ajoute la même « flexion » que les pétales dessinés (l’eau le plie)
function withFlex(g) {
  const p = g.attributes.position, f = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); f[i * 3 + 1] = -0.28 * y * y; f[i * 3 + 2] = y * y; }
  g.morphAttributes.position = [new THREE.BufferAttribute(f, 3)]; g.morphTargetsRelative = true; g.computeBoundingSphere(); return g;
}
// le réceptacle du lotus : un cône vert, le dessus plat jaune clair, les graines un peu plus foncées
function podColors(g) {
  const p = g.attributes.position, nr = g.attributes.normal, col = new Float32Array(p.count * 3), low = new THREE.Color('#5d8a45'), side = new THREE.Color('#9dba5e'), top = new THREE.Color('#e6dd88'), seed = new THREE.Color('#b8a646'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); c.copy(low).lerp(side, smooth(-0.13, 0.05, y)).lerp(top, smooth(0.45, 0.85, nr.getY(i)) * smooth(0.05, 0.08, y)).lerp(seed, smooth(0.088, 0.097, y)); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const PGEO = MODEL ? (() => { const lo = withFlex(MODEL.PetaleBas || MODEL.Petale); return { lo, hi: small ? lo : withFlex(MODEL.Petale) }; })() : null;
const POD = MODEL ? (() => { const lo = podColors(MODEL.CoeurBas || MODEL.Coeur); return { lo, hi: small ? lo : podColors(MODEL.Coeur) }; })() : null;
const WHORLS = [                                                // la fleur dessinée par le code (si le modèle n’arrive pas)
  { n: 4, L: 0.98, w: 0.3, o: 1.45, c: 0.2, bow: 0.1, cup: 0.5, r: 0.17, y: -0.03, off: 0.39, sep: true },
  { n: 9, L: 1.3, w: 0.33, o: 1.2, c: 0.16, bow: 0.16, cup: 0.42, r: 0.16, y: 0, off: 0 },
  { n: 9, L: 1.15, w: 0.31, o: 0.93, c: 0.12, bow: 0.07, cup: 0.5, r: 0.13, y: 0.02, off: 0.35 },
  { n: 7, L: 0.97, w: 0.27, o: 0.6, c: 0.09, bow: -0.04, cup: 0.6, r: 0.1, y: 0.04, off: 0.1 },
  { n: 5, L: 0.77, w: 0.22, o: 0.33, c: 0.06, bow: -0.12, cup: 0.7, r: 0.07, y: 0.05, off: 0.5 },
];
const MWH = [                                                   // le lotus du modèle, en coupe : 4 sépales, puis 4 couronnes (w : largeur relative au pétale modélisé)
  { n: 4, L: 0.8, w: 0.8, o: 1.5, c: 0.3, r: 0.2, y: -0.07, off: 0.39, sep: true },
  { n: 8, L: 1.32, w: 0.76, o: 1.02, c: 0.14, r: 0.2, y: -0.05, off: 0 },
  { n: 8, L: 1.22, w: 0.75, o: 0.74, c: 0.1, r: 0.18, y: -0.03, off: 0.39 },
  { n: 7, L: 1.1, w: 0.74, o: 0.5, c: 0.08, r: 0.16, y: -0.01, off: 0.2 },
  { n: 5, L: 0.94, w: 0.72, o: 0.3, c: 0.05, r: 0.13, y: 0.01, off: 0.7 },
];
const LITE = [3, 6, 6, 5, 0];                                   // les petites fleurs (boutons, graines) : moins de pétales
const WGEO = MODEL ? null : WHORLS.map((w, i) => petalGeo(w.L, w.w, w.bow, w.cup, i));
const STAM_GEO = (() => {
  const f = new THREE.CylinderGeometry(0.006, 0.011, 1, 6, 6); f.translate(0, 0.5, 0); const p = f.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.22 * p.getY(i) * p.getY(i)); f.computeVertexNormals();
  const a = new THREE.SphereGeometry(0.03, 8, 6); a.scale(1, 2.6, 1); a.translate(0, 1.02, 0.225);
  return mergeGeos([[f, '#f5dc6a'], [a, '#f6a32c']]);
})();
const CUP_GEO = new THREE.SphereGeometry(0.2, 20, 12, 0, TAU, Math.PI * 0.45, Math.PI * 0.55);
function makeBloom({ kind = 'blue', lite = false } = {}) {
  const grp = new THREE.Group(), pets = [], pm = petalMatOf(kind), T = MODEL ? MWH : WHORLS;
  T.forEach((wh, wi) => {
    const n = lite && MODEL ? LITE[wi] : wh.n;
    for (let k = 0; k < n; k++) {
      const az = wh.off + (k / n) * TAU + rr(-0.05, 0.05), pivot = new THREE.Group();
      pivot.position.set(Math.sin(az) * wh.r, wh.y, Math.cos(az) * wh.r); pivot.rotation.y = az;
      const m = new THREE.Mesh(MODEL ? (lite ? PGEO.lo : PGEO.hi) : WGEO[wi], wh.sep ? sepalMat : pm); m.castShadow = !lite; m.receiveShadow = true; m.rotation.z = rr(-0.07, 0.07);
      const s = rr(0.94, 1.05), sx = MODEL ? s * wh.L * wh.w : s, sy = MODEL ? s * wh.L : s; m.scale.set(sx, sy, sy);
      pivot.add(m); grp.add(pivot);
      pets.push({ m, az, sx, fold: !!MODEL && !wh.sep, o: wh.o + rr(-0.06, 0.06), c: wh.c, a: wh.c, v: 0, f: 0, wi, soft: wh.sep ? 0.45 : 1.05 - wi * 0.13, ph: rnd() * 6 });
    }
  });
  const rings = MODEL ? (lite ? [[16, 0.9, 0.28, 0.18]] : [[28, 1.05, 0.3, 0.19], [22, 0.82, 0.27, 0.175], [16, 0.6, 0.24, 0.16]]) : [[22, 0.85, 0.46, 0.07], [16, 0.55, 0.4, 0.05], [10, 0.25, 0.34, 0.03]];
  const count = rings.reduce((s, r) => s + r[0], 0), stam = new THREE.InstancedMesh(STAM_GEO, stamMat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), y0 = MODEL ? 0 : 0.06; let i = 0;
  rings.forEach(([n, tilt, len, r]) => { for (let k = 0; k < n; k++) { const az = (k / n) * TAU + rr(-0.1, 0.1); e.set(tilt + rr(-0.08, 0.08), az, 0, 'YXZ'); q.setFromEuler(e); m4.compose(new V3(Math.sin(az) * r, y0, Math.cos(az) * r), q, new V3(1, len * rr(0.9, 1.1), 1)); stam.setMatrixAt(i++, m4); } });
  stam.castShadow = !lite; grp.add(stam);
  let pod = null;
  if (MODEL) { pod = new THREE.Mesh(lite ? POD.lo : POD.hi, podMat); pod.castShadow = !lite; pod.receiveShadow = true; grp.add(pod); }
  else { const pistil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), new THREE.MeshStandardMaterial({ color: '#f0c23a', roughness: 0.6, emissive: '#5a3a00', emissiveIntensity: 0.5 })); pistil.scale.y = 0.6; pistil.position.y = 0.06; grp.add(pistil); }
  const cup = new THREE.Mesh(CUP_GEO, stemMat); cup.position.y = MODEL ? -0.03 : 0.06; if (MODEL) cup.scale.set(1.15, 0.9, 1.15); else cup.scale.set(1, 1.2, 1); cup.castShadow = !lite; grp.add(cup);
  return { grp, pets, stam, pod, cup };
}
function poseBloom(F, bloom, vl, dt, t) {
  for (const p of F.pets) {
    const b = smooth(p.wi * 0.1, 0.62 + p.wi * 0.09, bloom) + Math.max(0, bloom - 1) * 0.5;
    const push = vl.x * Math.sin(p.az) + vl.z * Math.cos(p.az);                     // la fleur avance vers ce pétale : l’eau le referme
    const tgt = lerp(p.c, p.o, b) - push * 0.17 * p.soft + vl.y * 0.1 * p.soft + Math.sin(t * 0.8 + p.ph) * 0.018 * b;
    p.v += ((tgt - p.a) * 40 - p.v * 7.5) * dt; p.a = clamp(p.a + p.v * dt, 0.03, 1.8);
    p.m.rotation.x = p.a;
    p.f += (clamp(-push * 0.2 + vl.y * 0.1, -0.45, 0.6) - p.f) * Math.min(1, dt * 6); p.m.morphTargetInfluences[0] = p.f;
    if (p.fold) p.m.scale.x = p.sx * (0.6 + 0.4 * clamp(b));                       // fermé, le pétale se replie sur lui-même
  }
  const cb = clamp(bloom), s = 0.42 + 0.58 * cb; F.stam.scale.set(s, 0.62 + 0.38 * cb, s);
  if (F.pod) { const ps = 0.6 + 0.55 * cb; F.pod.scale.setScalar(ps); F.pod.position.y = -0.05 + 0.13 * ps; }
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
const P = rest.map((v) => v.clone()), PP = rest.map((v) => v.clone()), P0 = rest.map((v) => v.clone()), R = rest.map((v) => v.clone());   // R : la position affichée (interpolée)
const stemCurve = new THREE.CatmullRomCurve3(R), stemGeo = makeTube(44, 10);
const stem = new THREE.Mesh(stemGeo, stemMat); stem.castShadow = true; stem.receiveShadow = true; stem.frustumCulled = false; scene.add(stem);
const head = new THREE.Group(); scene.add(head);
const flower = makeBloom(); head.add(flower.grp);
const glowL = new THREE.PointLight('#ffd98a', 0.5, 2.6, 2); glowL.position.y = 0.3; head.add(glowL);
const hitProxy = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); hitProxy.position.y = 0.45; head.add(hitProxy);

// les feuilles du lotus : rondes, la tige plantée en leur centre ; elles se balancent et s’écartent quand on agite l’eau
const leaves = [];
{
  const tex = canvasTex(512, 512, (x, w) => {
    const c = w / 2, g = x.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#c9dc8e'); g.addColorStop(0.07, '#8fb55c'); g.addColorStop(0.45, '#4f8a43'); g.addColorStop(0.9, '#356f37'); g.addColorStop(1, '#2a5c2f');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
    for (let k = 0; k < 22; k++) {                              // les nervures partent du centre et se divisent en deux près du bord
      const a = (k / 22) * TAU + rr(-0.04, 0.04), fk = rr(0.5, 0.66), fx = c + Math.cos(a) * c * fk, fy = c + Math.sin(a) * c * fk;
      x.strokeStyle = 'rgba(214,236,160,0.5)'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(c, c); x.quadraticCurveTo(c + Math.cos(a + 0.04) * c * fk * 0.5, c + Math.sin(a + 0.04) * c * fk * 0.5, fx, fy); x.stroke();
      x.strokeStyle = 'rgba(214,236,160,0.36)'; x.lineWidth = 1.7;
      [-1, 1].forEach((sg) => { x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(c + Math.cos(a + sg * 0.05) * c * 0.8, c + Math.sin(a + sg * 0.05) * c * 0.8, c + Math.cos(a + sg * 0.1) * c * 0.99, c + Math.sin(a + sg * 0.1) * c * 0.99); x.stroke(); });
    }
    for (let k = 0; k < 900; k++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * c; x.fillStyle = `rgba(${rnd() < 0.5 ? '20,50,20' : '200,230,150'},${0.04 + rnd() * 0.05})`; x.beginPath(); x.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 1 + rnd() * 3, 0, TAU); x.fill(); }
  });
  const leafMat = water(new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color('#dff7c4'), sheenRoughness: 0.5, side: SIDE }), { cau: 0.75, trans: 0.55 });
  const LG = MODEL ? MODEL.Feuille : new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  [[-1.3, -0.5, 1.05, 0.95, 0.3], [1.4, -0.75, 0.6, 1.08, 0.38], [-0.4, -1.75, 1.8, 0.82, 0.22], [0.95, 0.7, 0.3, 0.7, 0.45]].forEach(([x, z, h, s, tilt]) => {
    const top = new V3(x, gH(x, z) + h, z), bx = x * 0.55, bz = z * 0.55, base = new V3(bx, gH(bx, bz) - 0.05, bz);
    const pts = [base, new V3(lerp(bx, x, 0.5), lerp(base.y, top.y, 0.45), lerp(bz, z, 0.5)), new V3(lerp(bx, x, 0.9), top.y - 0.14, lerp(bz, z, 0.9)), top.clone().setY(top.y - 0.02)];
    const g = makeTube(24, 6); updateTube(g, new THREE.CatmullRomCurve3(pts), 0.03, 0.02); const st = new THREE.Mesh(g, stemMat); st.castShadow = true; st.receiveShadow = true; scene.add(st);
    const pivot = new THREE.Group(); pivot.position.copy(top); pivot.rotation.y = Math.atan2(x, z); scene.add(pivot);
    const tg = new THREE.Group(); pivot.add(tg);
    const m = new THREE.Mesh(LG, leafMat); m.scale.set(s, s * 0.9, s); m.rotation.y = rr(0, TAU); m.castShadow = true; m.receiveShadow = true; tg.add(m);
    leaves.push({ tg, top, tilt, ph: rnd() * 6, f: 0 });
  });
}

// deux boutons encore fermés, pour la compagnie
const buds = [[-2.1, -1.6, 2.1, 0.5, 'blue'], [2.1, -2.0, 1.5, 0.44, 'blanc']].map(([x, z, h, s, kind], k) => {
  const root = new THREE.Group(); root.position.set(x, gH(x, z) - 0.05, z); scene.add(root);
  const pts = [new V3(0, 0, 0), new V3(0.1 * (k ? -1 : 1), h * 0.5, 0.05), new V3(0.26 * (k ? -1 : 1), h, 0.1)], g = makeTube(20, 8);
  updateTube(g, new THREE.CatmullRomCurve3(pts), 0.05, 0.03); const st = new THREE.Mesh(g, stemMat); st.castShadow = true; root.add(st);
  const F = makeBloom({ kind, lite: true }); F.grp.position.copy(pts[2]); F.grp.rotation.z = (k ? 1 : -1) * 0.22; F.grp.scale.setScalar(s); root.add(F.grp);
  poseBloom(F, 0, new V3(), 1, 0); for (const p of F.pets) { p.a = p.c; p.m.rotation.x = p.c; }
  return { root, ph: k * 2.1 };
});

// les graines (un clic sur le sable) : une tige sort en rebondissant, puis un petit lotus s’ouvre
const sprouts = [], SP_MAX = small ? 3 : 6, SP_KIND = ['rose', 'blanc', 'blue'], ZERO = new V3(); let spN = 0;
function plant(x, z) {
  if (Math.hypot(x - 0.15, z) < 1.6 || Math.hypot(x, z) > 10 || z > 3.4) return false;
  if (leaves.some((l) => Math.hypot(l.top.x - x, l.top.z - z) < 0.85) || buds.some((b) => Math.hypot(b.root.position.x - x, b.root.position.z - z) < 0.7)) return false;
  const alive = sprouts.filter((s) => !s.dead);
  if (alive.some((s) => Math.hypot(s.x - x, s.z - z) < 0.8)) return false;
  if (alive.length >= SP_MAX) { alive[0].dead = true; alive[0].deadT = now; }        // la plus ancienne s’efface
  const h = rr(0.85, 1.5), lean = rr(-0.22, 0.22), root = new THREE.Group(); root.position.set(x, gH(x, z) - 0.04, z); root.rotation.y = rr(0, TAU); root.scale.setScalar(0.001); scene.add(root);
  const pts = [new V3(0, 0, 0), new V3(lean * 0.3, h * 0.5, 0.04), new V3(lean, h, 0.1)], g = makeTube(16, 6);
  updateTube(g, new THREE.CatmullRomCurve3(pts), 0.034, 0.022); const st = new THREE.Mesh(g, stemMat); st.castShadow = true; root.add(st);
  const F = makeBloom({ kind: SP_KIND[spN++ % SP_KIND.length], lite: true }); F.grp.position.copy(pts[2]); F.grp.rotation.z = -lean * 0.5; F.grp.scale.setScalar(rr(0.34, 0.42)); root.add(F.grp);
  poseBloom(F, 0, ZERO, 1, 0); for (const p of F.pets) { p.a = p.c; p.m.rotation.x = p.c; }
  sprouts.push({ root, F, tube: g, x, z, t0: now, dead: false, deadT: 0, ph: rnd() * 6 });
  emit(16, x, gH(x, z) + 0.12, z, 0.45, 0.06); sound.sprout(clamp(x / 8, -0.9, 0.9));
  return true;
}
function stepSprouts(dt) {
  for (let i = sprouts.length - 1; i >= 0; i--) {
    const s = sprouts[i], age = now - s.t0, gr = clamp(age / 1.6) - 1;
    const sc = s.dead ? 1 - smooth(0, 1.1, now - s.deadT) : 1 + 2.70158 * gr * gr * gr + 1.70158 * gr * gr;   // elle pousse en rebondissant un peu
    s.root.scale.setScalar(Math.max(0.001, sc));
    s.root.rotation.z = Math.sin(now * 0.7 + s.ph) * 0.05; s.root.rotation.x = Math.cos(now * 0.53 + s.ph) * 0.04;
    poseBloom(s.F, s.dead ? 0 : smooth(1.3, 3.8, age), ZERO, dt, now);
    if (s.dead && now - s.deadT > 1.2) { scene.remove(s.root); s.tube.dispose(); sprouts.splice(i, 1); }
  }
}

// un banc de petits poissons : ils tournent ensemble autour de la fleur, et s’écartent de la main
const fish = (() => {
  const n = small ? 10 : 18, body = new THREE.SphereGeometry(1, 14, 10), p = body.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = z < 0 ? 1 - 0.78 * Math.pow(-z, 1.5) : 1 - 0.3 * z * z; p.setXYZ(i, x * 0.042 * k, y * 0.07 * k, z * 0.17); }
  body.computeVertexNormals();
  const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.14, 0, 0.075, -0.27, 0, 0, -0.215, 0, 0, -0.14, 0, 0, -0.215, 0, -0.075, -0.27]), 3)); tail.computeVertexNormals();
  const geo = mergeGeos([[body, '#c4d6e0'], [tail, '#8aa6b8']]), gp = geo.attributes.position, gc = geo.attributes.color;
  for (let i = 0; i < gp.count; i++) { const k = smooth(-0.03, 0.05, gp.getY(i)); gc.setXYZ(i, gc.getX(i) * (1.12 - 0.62 * k), gc.getY(i) * (1.1 - 0.52 * k), gc.getZ(i) * (1.08 - 0.42 * k)); }   // le dos sombre, le ventre clair
  const ph = new Float32Array(n); for (let i = 0; i < n; i++) ph[i] = rnd();
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.1, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aPhase;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.x += sin(uTime * 12.0 + aPhase * 6.2831 - position.z * 15.0) * 0.024 * smoothstep(0.1, -0.27, position.z);');
  };
  mat.customProgramCacheKey = () => 'dvfish';
  const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = true; im.frustumCulled = false; scene.add(im);
  const list = Array.from({ length: n }, (_, i) => ({ off: new V3(rr(-1.2, 1.2), rr(-0.5, 0.5), rr(-1.4, 1.4)), fl: new V3(), pos: new V3(), q: new THREE.Quaternion(), s: rr(0.75, 1.2), ph: ph[i] }));
  return { im, list, a: 2.2, scare: 0, ready: false };
})();
const _fc = new V3(), _fd = new V3(), _fx = new V3(), _fy = new V3(0, 1, 0), _fv = new V3(), _fe = new V3(), _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion();
function stepFish(dt) {
  const S = fish; S.scare = Math.max(0, S.scare - dt * 0.4); S.a += dt * (0.13 + S.scare * 0.3);
  const a = S.a; _fc.set(Math.cos(a) * 5.4, 4.1 + Math.sin(a * 0.7) * 0.8, -3.2 + Math.sin(a) * 3);
  _fd.set(-Math.sin(a) * 5.4, 0, Math.cos(a) * 3).normalize(); _fx.crossVectors(_fy, _fd).normalize();
  const ro = ray.ray.origin, rd = ray.ray.direction;
  for (let i = 0; i < S.list.length; i++) {
    const f = S.list[i];
    _fe.copy(_fc).addScaledVector(_fx, f.off.x).addScaledVector(_fy, f.off.y + Math.sin(now * 0.9 + f.ph * 9) * 0.08).addScaledVector(_fd, f.off.z);
    if (ptr.on && !grab.on && phase === 'live') {               // la main approche : le poisson file
      _fv.subVectors(f.pos, ro); const pr = _fv.dot(rd); _fv.addScaledVector(rd, -pr); const dd = _fv.length();
      if (pr > 0 && dd < 1.6) { f.fl.addScaledVector(_fv, ((1.6 - dd) / Math.max(dd, 0.1)) * dt * 9); S.scare = Math.min(1, S.scare + dt * 2); }
    }
    if (impulse) { const age = now - impulse.t; _fv.subVectors(f.pos, impulse.at); const dd = _fv.length(); if (age < 0.9 && dd < age * 5 + 0.6) f.fl.addScaledVector(_fv, (dt * 7) / Math.max(dd, 0.3)); }
    f.fl.multiplyScalar(Math.pow(0.35, dt)); _fe.add(f.fl);
    if (!S.ready) f.pos.copy(_fe);
    _fv.copy(f.pos); f.pos.lerp(_fe, Math.min(1, dt * 2.2)); _fv.subVectors(f.pos, _fv);
    if (_fv.lengthSq() > 1e-9) { _fm.lookAt(_fe.copy(f.pos).add(_fv), f.pos, _fy); _fq.setFromRotationMatrix(_fm); f.q.slerp(_fq, Math.min(1, dt * 6)); }
    _fm.compose(f.pos, f.q, _fe.setScalar(f.s)); S.im.setMatrixAt(i, _fm);
  }
  S.ready = true; S.im.instanceMatrix.needsUpdate = true;
}

/* ---------- les carpes koï (modélisées dans Blender) : elles nagent en ondulant, viennent voir la main, fuient, mangent ---------- */
const KV = (U2) => ({ key: 'k', uniforms: U2, decl: 'uniform float kPhase, kAmp, kBend, kFin;',
  code: `{ float zz = position.z, tl = smoothstep(0.3, -0.78, zz);
    transformed.x += sin(zz * 8.0 + kPhase) * kAmp * (0.12 + 0.88 * tl * tl) + kBend * (zz - 0.05) * (zz - 0.05) * 0.8;
    float fin = step(0.07, abs(position.x)) * smoothstep(0.42, 0.3, zz) * step(-0.05, zz) * step(position.y, -0.02);
    transformed.y += fin * sin(kPhase * 0.5) * kFin * (abs(position.x) - 0.07) * 1.6; }` });
function koiSkin(kind, sd) {                                    // la peau : motifs kohaku / showa / ogon, et le bord clair de chaque écaille
  return canvasTex(512, 256, (x, W, H) => {
    const im = x.createImageData(W, H), d = im.data, white = [246, 242, 234], red = kind === 'showa' ? [196, 48, 26] : [224, 72, 32], black = [20, 20, 22], gold = [232, 170, 52];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W, v = 1 - (j + 0.5) / H, o = (j * W + i) * 4, back = 1 - clamp(Math.abs(v - 0.25) / 0.26);
      let c;
      if (kind === 'ogon') { const k = fbm(u * 18 + sd, v * 18) * 0.35 + (1 - back) * 0.3; c = [lerp(gold[0], 255, k), lerp(gold[1], 228, k), lerp(gold[2], 150, k)]; }
      else {
        const edge = u > 0.05 && u < 0.93 ? 1 : 0.3, m = smooth(0.47, 0.51, fbm(u * 6.5 + sd, v * 8 + sd * 0.7) * (0.5 + back * 0.85) * edge);
        c = [lerp(white[0], red[0], m), lerp(white[1], red[1], m), lerp(white[2], red[2], m)];
        if (kind === 'showa') { const s = smooth(0.5, 0.55, fbm(u * 5 + sd + 9, v * 6 + 3) * (0.35 + back * 0.7) * (u > 0.12 ? 1 : 0.6)); c = [lerp(c[0], black[0], s), lerp(c[1], black[1], s), lerp(c[2], black[2], s)]; }
      }
      // les écailles : des arcs en quinconce, plus marqués sur le dos
      const sv = v * 46, row = Math.floor(sv), su = u * 92 + (row % 2) * 0.5, fu = su - Math.floor(su) - 0.5, fv = sv - row, r = Math.hypot(fu * 1.15, fv);
      const sc = smooth(0.38, 0.5, r) * smooth(1.1, 0.5, r) * (0.35 + back * 0.65) * (u > 0.17 && u < 0.95 ? 1 : 0);
      const k = 1 + sc * 0.16 - (1 - back) * 0.04 - Math.max(0, v - 0.6) * 0.0;
      d[o] = Math.min(255, c[0] * k); d[o + 1] = Math.min(255, c[1] * k); d[o + 2] = Math.min(255, c[2] * k); d[o + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  });
}
const KOI_BUMP = canvasTex(512, 256, (x, W, H) => {
  const im = x.createImageData(W, H), d = im.data;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const u = (i + 0.5) / W, v = 1 - (j + 0.5) / H, sv = v * 46, row = Math.floor(sv), su = u * 92 + (row % 2) * 0.5, fu = su - Math.floor(su) - 0.5, fv = sv - row, r = Math.hypot(fu * 1.15, fv), h = 128 + 70 * smooth(0.55, 0.15, r) * (u > 0.17 ? 1 : 0), o = (j * W + i) * 4; d[o] = d[o + 1] = d[o + 2] = h; d[o + 3] = 255; }
  x.putImageData(im, 0, 0);
}, false);
function finTex(kind) {                                         // les nageoires : voile translucide, rayons fins
  return canvasTex(256, 64, (x, W, H) => {
    const im = x.createImageData(W, H), d = im.data;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const t = (i + 0.5) / W, a = (j + 0.5) / H, ray = 0.5 + 0.5 * Math.cos(a * TAU * 16), o = (j * W + i) * 4;
      let c = kind === 'ogon' ? [240, 196, 96] : [250, 244, 236];
      if (kind === 'showa' && t < 0.45) c = [lerp(30, c[0], t / 0.45), lerp(30, c[1], t / 0.45), lerp(32, c[2], t / 0.45)];
      if (kind === 'kohaku' && t < 0.2) c = [252, 214, 190];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255 * clamp((0.5 - 0.32 * t + ray * 0.22) * smooth(1, 0.86, t));
    }
    x.putImageData(im, 0, 0);
  });
}
const koi = [];
if (MODEL && MODEL.KoiCorps) {
  [['kohaku', 1.0, 1.3], ['showa', 0.86, 4.1], ['ogon', 0.78, 7.7]].forEach(([kind, s, sd], i) => {
    const U2 = { kPhase: { value: i * 2 }, kAmp: { value: 0.04 }, kBend: { value: 0 }, kFin: { value: 0.3 } }, V = KV(U2);
    const body = new THREE.Mesh(MODEL.KoiCorps, water(new THREE.MeshPhysicalMaterial({ map: koiSkin(kind, sd), bumpMap: KOI_BUMP, bumpScale: 0.35, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.22, metalness: kind === 'ogon' ? 0.5 : 0.04 }), { cau: 0.6, trans: 0.12, vtx: V }));
    const fins = new THREE.Mesh(MODEL.KoiNageoires, water(new THREE.MeshPhysicalMaterial({ map: finTex(kind), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.42, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }), { cau: 0.3, trans: 0.7, vtx: V }));
    const eyes = new THREE.Mesh(MODEL.KoiYeux, water(new THREE.MeshStandardMaterial({ color: '#060607', roughness: 0.05, metalness: 0.35 }), { cau: 0, vtx: V }));
    body.castShadow = true; fins.renderOrder = 2; [body, fins, eyes].forEach((m) => { m.frustumCulled = false; });
    const g = new THREE.Group(); g.add(body, fins, eyes); g.scale.setScalar(s); scene.add(g);
    const a = 1.2 + i * 2.1, k = { g, U: U2, pos: new V3(0.15 + Math.cos(a) * 4, 2.2 + i * 0.7, -0.6 + Math.sin(a) * 3.2), yaw: a + 1.6, pitch: 0, roll: 0, speed: 0.4, yawRate: 0, tgt: new V3(), mode: 'wander', until: 0, pel: null, s };
    koiTarget(k); koi.push(k);
  });
}
function koiTarget(k) { const a = rnd() * TAU, r = rr(2.4, 5.6); k.tgt.set(0.15 + Math.cos(a) * r, rr(1.3, 4.6), -0.6 + Math.sin(a) * r * 0.8); }
function koiWander(k) { koiTarget(k); k.until = now + rr(7, 13); k.mode = 'wander'; }
const _kd = new V3(), _kf = new V3(), _ka = new V3(), _kb = new V3();
let curious = false; const curiousPt = new V3();
function avoidSphere(p, c, rad, w) { _ka.subVectors(p, c); const dd = _ka.length(); if (dd < rad && dd > 1e-4) _kd.addScaledVector(_ka, ((rad - dd) / rad) * w / dd); }
function stepKoi(dt) {
  if (!koi.length) return;
  let cq = null, cd = 1e9;
  if (curious) for (const k of koi) { const dd = k.pos.distanceTo(curiousPt); if (k.mode !== 'flee' && dd < cd) { cd = dd; cq = k; } }
  for (const k of koi) {
    if (k.mode === 'flee' && now > k.until) koiWander(k);
    if (k.mode !== 'flee') {
      let best = null, bd = 6.5; for (const pl of pellets) if (pl.alive) { const dd = pl.pos.distanceTo(k.pos); if (dd < bd) { bd = dd; best = pl; } }
      if (best) { k.mode = 'eat'; k.pel = best; k.tgt.copy(best.pos); }
      else if (k === cq) { k.mode = 'curious'; k.tgt.copy(curiousPt); }
      else if (k.mode !== 'wander') koiWander(k);
      else if (k.pos.distanceTo(k.tgt) < 0.9 || now > k.until) koiWander(k);
    }
    _kd.subVectors(k.tgt, k.pos); const dist = _kd.length(); _kd.multiplyScalar(1 / Math.max(dist, 1e-4));
    // éviter la fleur, sa tige, les autres carpes, la caméra
    avoidSphere(k.pos, headPos, 1.7, 2.4); avoidSphere(k.pos, camera.position, 2.6, 2);
    _ka.subVectors(headPos, P[0]); const tt = clamp(_kb.subVectors(k.pos, P[0]).dot(_ka) / _ka.lengthSq()); _kb.copy(P[0]).addScaledVector(_ka, tt); avoidSphere(k.pos, _kb, 0.75, 1.6);
    for (const o of koi) if (o !== k) avoidSphere(k.pos, o.pos, 1.0, 1.2);
    _kd.normalize();
    const dyaw = Math.atan2(_kd.x, _kd.z), dpitch = Math.asin(clamp(_kd.y, -0.55, 0.55));
    let e = dyaw - k.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
    const maxR = k.mode === 'flee' ? 3.2 : 1.05;
    k.yawRate += (clamp(e * 1.7, -maxR, maxR) - k.yawRate) * (1 - Math.exp(-dt * 4));
    k.yaw += k.yawRate * dt; k.pitch += (dpitch * 0.7 - k.pitch) * (1 - Math.exp(-dt * 2));
    let vs = k.mode === 'flee' ? 2.4 : k.mode === 'curious' ? clamp((dist - 0.6) * 0.8, 0, 0.5) : k.mode === 'eat' ? 0.8 : 0.48;
    vs *= 1 - 0.45 * Math.min(1, Math.abs(e) / 1.6);
    k.speed += (vs - k.speed) * (1 - Math.exp(-dt * (k.mode === 'flee' ? 6 : 1.4)));
    const cp = Math.cos(k.pitch); _kf.set(Math.sin(k.yaw) * cp, Math.sin(k.pitch), Math.cos(k.yaw) * cp);
    k.pos.addScaledVector(_kf, k.speed * dt);
    const r0 = Math.hypot(k.pos.x - 0.15, k.pos.z + 0.6); if (r0 > 7.5) { k.pos.x = 0.15 + ((k.pos.x - 0.15) * 7.5) / r0; k.pos.z = -0.6 + ((k.pos.z + 0.6) * 7.5) / r0; }
    k.pos.y = clamp(k.pos.y, gH(k.pos.x, k.pos.z) + 0.5, SURF - 1.2);
    if (k.mode === 'eat' && k.pel) {                             // la bouche arrive sur le granulé : il disparaît
      _ka.copy(k.pos).addScaledVector(_kf, 0.47 * k.s);
      if (!k.pel.alive) koiWander(k); else if (_ka.distanceTo(k.pel.pos) < 0.2) { k.pel.alive = false; sound.koiEat(clamp(k.pos.x / 7, -0.9, 0.9)); emit(4, _ka.x, _ka.y + 0.05, _ka.z, 0.1, 0.035); tipDone('feed'); koiWander(k); }
    }
    k.U.kPhase.value += dt * (4.2 + k.speed * 10); k.U.kAmp.value += ((0.028 + k.speed * 0.04) - k.U.kAmp.value) * Math.min(1, dt * 3);
    k.U.kBend.value += (k.yawRate * 0.26 - k.U.kBend.value) * Math.min(1, dt * 5); k.U.kFin.value = k.mode === 'curious' ? 0.9 : 0.35;
    k.roll += (-k.yawRate * 0.16 - k.roll) * Math.min(1, dt * 3);
    k.g.position.copy(k.pos); k.g.rotation.set(-k.pitch, k.yaw, k.roll, 'YXZ');
  }
}
function scareKoi(at, rad = 2.8) {
  for (const k of koi) { _ka.subVectors(k.pos, at); const dd = _ka.length(); if (dd < rad) { k.mode = 'flee'; k.until = now + 1.5; k.tgt.copy(k.pos).addScaledVector(_ka.normalize(), 4.5); sound.koiFlee(clamp(k.pos.x / 7, -0.9, 0.9)); } }
}

/* ---------- les granulés (double-clic dans l’eau) : ils coulent doucement, les carpes viennent les manger ---------- */
const pellets = [], PEL = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: '#b8662c', roughness: 0.65, emissive: '#3a1404', emissiveIntensity: 0.4 }), 18);
PEL.frustumCulled = false; PEL.count = 18; scene.add(PEL);
for (let i = 0; i < 18; i++) pellets.push({ pos: new V3(0, -99, 0), v: new V3(), alive: false, t: 0, ph: rnd() * 6 });
const _pm = new THREE.Matrix4(), _ps = new V3(), _pq = new THREE.Quaternion();
function feed(at) {
  let n = 0;
  for (const pl of pellets) { if (pl.alive || n >= 7) continue; pl.alive = true; pl.t = now; pl.pos.set(at.x + rr(-0.3, 0.3), at.y + rr(-0.15, 0.25), at.z + rr(-0.3, 0.3)); pl.v.set(rr(-0.05, 0.05), -rr(0.16, 0.26), rr(-0.05, 0.05)); n++; }
  sound.feed(clamp(at.x / 7, -0.9, 0.9)); emit(6, at.x, at.y, at.z, 0.4, 0.04);
}
function stepPellets(dt) {
  for (let i = 0; i < pellets.length; i++) {
    const pl = pellets[i];
    if (pl.alive) {
      const fl = gH(pl.pos.x, pl.pos.z) + 0.03;
      if (pl.pos.y > fl) { pl.pos.addScaledVector(pl.v, dt); pl.pos.x += Math.sin(now * 1.3 + pl.ph) * 0.03 * dt; } else pl.pos.y = fl;
      if (now - pl.t > 26) pl.alive = false;
    }
    _ps.setScalar(pl.alive ? 1 : 0.0001); _pm.compose(pl.pos, _pq, _ps); PEL.setMatrixAt(i, _pm);
  }
  PEL.instanceMatrix.needsUpdate = true;
}

/* ---------- les anneaux de bulles : la fleur en souffle un quand on clique dessus ---------- */
const RING_GEO = new THREE.TorusGeometry(1, 0.055, 12, 64);
const rings = Array.from({ length: 4 }, () => {
  const m = new THREE.Mesh(RING_GEO, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uA: { value: 0 }, uNight: U.night },
    vertexShader: 'varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uA, uNight; varying vec3 vN, vV;
      void main(){ float f = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), rim = pow(f, 2.2), sp = pow(max(dot(reflect(-vV, vN), normalize(vec3(0.3, 1.0, 0.25))), 0.0), 28.0);
        vec3 c = mix(vec3(0.55, 0.85, 1.0), vec3(1.0), rim) * (0.2 + rim * 0.75) + sp * 1.4 + vec3(0.9, 0.6, 1.0) * pow(f, 6.0) * 0.2;
        gl_FragColor = vec4(c * (1.0 - 0.45 * uNight), (0.1 + rim * 0.75 + sp) * uA); }`,
  }));
  m.visible = false; m.frustumCulled = false; m.renderOrder = 7; scene.add(m);
  return { m, on: false, t: 0, pos: new V3(), r0: 0.3, spin: 0 };
});
let ringIx = 0;
function blowRing() {
  const rg = rings[ringIx++ % rings.length]; rg.on = true; rg.t = now; rg.m.visible = true; rg.spin = rr(-0.4, 0.4);
  tmp.set(0, 1, 0).applyQuaternion(head.quaternion); rg.pos.copy(headPos).addScaledVector(tmp, 0.75);
}
function stepRings(dt) {
  for (const rg of rings) {
    if (!rg.on) continue;
    const a = now - rg.t, R0 = 0.28 + Math.sqrt(a) * 0.55;
    rg.pos.y += (0.7 + a * 0.12) * dt; rg.pos.x += Math.sin(a * 1.7 + rg.spin * 9) * 0.06 * dt;
    rg.m.position.copy(rg.pos); rg.m.scale.set(R0 * (1 + Math.sin(a * 5) * 0.04), R0 * (1 - Math.sin(a * 5) * 0.04), Math.max(0.35, 1 / Math.sqrt(R0)) * R0);
    rg.m.rotation.set(Math.PI / 2 + Math.sin(a * 1.3) * 0.12, a * rg.spin, Math.cos(a * 1.1) * 0.1);
    rg.m.material.uniforms.uA.value = smooth(0, 0.25, a) * (1 - smooth(SURF - 1.2, SURF - 0.3, rg.pos.y));
    if (rg.pos.y > SURF - 0.35) { rg.on = false; rg.m.visible = false; DROPS[dropIx++ % 6].set(rg.pos.x, rg.pos.z, now, 1); sound.ringPop(clamp(rg.pos.x / 8, -0.9, 0.9)); emit(10, rg.pos.x, SURF - 0.5, rg.pos.z, R0, 0.05); }
  }
}

/* ---------- l’entrée, façon dessin technique : le contour de chaque pétale en pointillés, ses poignées de courbe,
   les axes et les cercles de construction ; le tout est en 3D, posé exactement sur la fleur ---------- */
const lineScene = new THREE.Scene();
let BP = null;
function buildBlueprint() {
  if (!MODEL || !MODEL._meta || !MODEL._meta.petalOutline) return null;
  const segs = [], marks = [], OUT = MODEL._meta.petalOutline.map((p) => new V3(p[0], p[1], p[2])), RIB = MODEL._meta.petalRib.map((p) => new V3(p[0], p[1], p[2]));
  const W = new V3(), Wb = new V3(), M = new THREE.Matrix4();
  const poly = (pts, mat, t0, t1, k, closed = false) => {         // une polyligne : distances cumulées (pointillés) et ordre de tracé
    const P2 = pts.map((p) => p.clone().applyMatrix4(mat)); if (closed) P2.push(P2[0].clone());
    let L = 0; const acc = [0]; for (let i = 1; i < P2.length; i++) { L += P2[i].distanceTo(P2[i - 1]); acc.push(L); }
    for (let i = 1; i < P2.length; i++) segs.push({ a: P2[i - 1], b: P2[i], d0: acc[i - 1], d1: acc[i], t0: lerp(t0, t1, acc[i - 1] / L), t1: lerp(t0, t1, acc[i] / L), k });
  };
  const H = head.matrixWorld;
  // les axes et les cercles de construction (dans le repère de la fleur)
  const RX = 2.3; [[new V3(0, 0.12, 0), new V3(RX, 0.12, 0)], [new V3(0, 0.12, 0), new V3(-RX, 0.12, 0)], [new V3(0, 0.12, 0), new V3(0, 0.12, RX)], [new V3(0, 0.12, 0), new V3(0, 0.12, -RX)]].forEach(([a, b]) => poly([a, b], H, 0, 0.14, 1));
  [0.62, 1.22, 1.78].forEach((r, i) => { const c = []; for (let k = 0; k <= 96; k++) { const a = (k / 96) * TAU - Math.PI / 2; c.push(new V3(Math.cos(a) * r, 0.12, Math.sin(a) * r)); } poly(c, H, 0.06 + i * 0.05, 0.24 + i * 0.05, 1); });
  [[RX, 0], [-RX, 0], [0, RX], [0, -RX]].forEach(([x, z]) => marks.push({ p: new V3(x, 0.12, z).applyMatrix4(H), t: 0.14, s: 2 }));
  // le cœur du lotus : son contour et ses 20 graines
  if (flower.pod) {
    flower.pod.updateMatrixWorld(true); const pm = flower.pod.matrixWorld, c = [];
    for (let k = 0; k <= 64; k++) { const a = (k / 64) * TAU; c.push(new V3(Math.cos(a) * 0.17, 0.1, Math.sin(a) * 0.17)); }
    poly(c, pm, 0.24, 0.32, 0);
    const seeds = [[0, 0]]; for (let k = 0; k < 7; k++) seeds.push([Math.cos((k / 7) * TAU) * 0.066, Math.sin((k / 7) * TAU) * 0.066]); for (let k = 0; k < 12; k++) seeds.push([Math.cos((k / 12) * TAU) * 0.122, Math.sin((k / 12) * TAU) * 0.122]);
    seeds.forEach(([x, z], i) => marks.push({ p: new V3(x, 0.1, z).applyMatrix4(pm), t: 0.3 + i * 0.002, s: 3 }));
  }
  // les pétales, du cœur vers l’extérieur ; leurs poignées de Bézier sur les deux couronnes extérieures
  const ORDER = [4, 3, 2, 1, 0];
  flower.pets.forEach((p, i) => {
    p.m.updateMatrixWorld(true); M.copy(p.m.matrixWorld);
    const o = ORDER.indexOf(p.wi), t0 = 0.3 + o * 0.12 + (i % 9) * 0.006, t1 = t0 + 0.13;
    poly(OUT, M, t0, t1, 0); poly(RIB, M, t0 + 0.03, t1, 3);
    if (p.wi === 1 || p.wi === 2) {
      const nO = OUT.length, ids = [Math.round(nO * 0.25), Math.round(nO * 0.5) - 1, Math.round(nO * 0.75)];
      ids.forEach((j) => {
        const a = OUT[(j - 1 + nO) % nO], b = OUT[(j + 1) % nO], c = OUT[j]; W.subVectors(b, a).normalize().multiplyScalar(0.16);
        const pA = c.clone().sub(W).applyMatrix4(M), pB = c.clone().add(W).applyMatrix4(M), pC = c.clone().applyMatrix4(M);
        segs.push({ a: pA, b: pB, d0: 0, d1: 1, t0: t1, t1: t1 + 0.015, k: 2 });
        marks.push({ p: pC, t: t1, s: 0 }, { p: pA, t: t1 + 0.012, s: 1 }, { p: pB, t: t1 + 0.012, s: 1 });
      });
    }
  });
  // la géométrie des lignes épaisses (un quadrilatère par segment, élargi à l’écran)
  const n = segs.length, A = new Float32Array(n * 12), B = new Float32Array(n * 12), S = new Float32Array(n * 4), E = new Float32Array(n * 4), D = new Float32Array(n * 4), T = new Float32Array(n * 4), K = new Float32Array(n * 4), idx = new Uint32Array(n * 6);
  segs.forEach((s, i) => { for (let v = 0; v < 4; v++) { const o = i * 4 + v; A.set([s.a.x, s.a.y, s.a.z], o * 3); B.set([s.b.x, s.b.y, s.b.z], o * 3); S[o] = v & 1 ? 1 : -1; E[o] = v >> 1; D[o] = v >> 1 ? s.d1 : s.d0; T[o] = v >> 1 ? s.t1 : s.t0; K[o] = s.k; } idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(A, 3)); g.setAttribute('aA', new THREE.BufferAttribute(A, 3)); g.setAttribute('aB', new THREE.BufferAttribute(B, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(S, 1)); g.setAttribute('aE', new THREE.BufferAttribute(E, 1)); g.setAttribute('aD', new THREE.BufferAttribute(D, 1)); g.setAttribute('aT', new THREE.BufferAttribute(T, 1)); g.setAttribute('aK', new THREE.BufferAttribute(K, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  const LU = { uRes: { value: new THREE.Vector2(1, 1) }, uW: { value: 1.2 }, uDraw: { value: 0 }, uAlpha: { value: 1 }, uDash: { value: 30 }, uC0: { value: new THREE.Color('#eef6ff') }, uC2: { value: new THREE.Color('#6aa8ff') } };
  const lines = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, uniforms: LU,
    vertexShader: `attribute vec3 aA, aB; attribute float aS, aE, aD, aT, aK; uniform vec2 uRes; uniform float uW; varying float vD, vT, vK;
      void main(){ vec4 ca = projectionMatrix * viewMatrix * vec4(aA, 1.0), cb = projectionMatrix * viewMatrix * vec4(aB, 1.0);
        vec2 sa = ca.xy / ca.w * uRes, sb = cb.xy / cb.w * uRes, dr = sb - sa; dr = length(dr) > 1e-5 ? normalize(dr) : vec2(1.0, 0.0);
        vec4 c = mix(ca, cb, aE); float w = uW * (aK > 1.5 && aK < 2.5 ? 1.15 : aK > 2.5 ? 0.8 : 1.0);
        c.xy += vec2(-dr.y, dr.x) * aS * w / uRes * c.w; vD = aD; vT = aT; vK = aK; gl_Position = c; }`,
    fragmentShader: `uniform float uDraw, uAlpha, uDash; uniform vec3 uC0, uC2; varying float vD, vT, vK;
      void main(){ if (vT > uDraw) discard; float a = uAlpha; vec3 col = uC0;
        if (vK < 0.5) { if (fract(vD * uDash) > 0.45) discard; a *= 0.9; }
        else if (vK < 1.5) { if (fract(vD * uDash * 0.3) > 0.55) discard; a *= 0.32; }
        else if (vK < 2.5) { col = uC2; }
        else { if (fract(vD * uDash) > 0.4) discard; a *= 0.34; }
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  }));
  lines.frustumCulled = false; lineScene.add(lines);
  const mp = new Float32Array(marks.length * 3), mt = new Float32Array(marks.length), ms = new Float32Array(marks.length);
  marks.forEach((m, i) => { mp.set([m.p.x, m.p.y, m.p.z], i * 3); mt[i] = m.t; ms[i] = m.s; });
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('aT', new THREE.BufferAttribute(mt, 1)); mg.setAttribute('aShape', new THREE.BufferAttribute(ms, 1));
  const PU = { uPx: { value: 8 }, uDraw: LU.uDraw, uAlpha: LU.uAlpha, uC0: LU.uC0, uC2: LU.uC2 };
  const pts = new THREE.Points(mg, new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, uniforms: PU,
    vertexShader: `attribute float aT, aShape; uniform float uPx, uDraw; varying float vS, vOn;
      void main(){ vS = aShape; vOn = smoothstep(aT, aT + 0.025, uDraw); vec4 mv = viewMatrix * vec4(position, 1.0);
        gl_PointSize = uPx * (aShape > 2.5 ? 0.55 : aShape > 1.5 ? 1.0 : aShape > 0.5 ? 0.8 : 0.9) * (0.3 + 0.7 * vOn) * (1.0 + 0.35 * sin(vOn * 3.14159)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uAlpha; uniform vec3 uC0, uC2; varying float vS, vOn;
      void main(){ if (vOn < 0.01) discard; vec2 q = gl_PointCoord * 2.0 - 1.0; float a;
        if (vS < 0.5) { float d = max(abs(q.x), abs(q.y)); a = smoothstep(1.0, 0.75, d); }
        else if (vS < 1.5) { a = smoothstep(1.0, 0.7, length(q)); }
        else { float r = length(q); a = smoothstep(1.0, 0.8, r) * smoothstep(0.35, 0.55, r); }
        vec3 col = vS < 1.5 ? uC2 : uC0; gl_FragColor = vec4(col, a * uAlpha * vOn * (vS > 2.5 ? 0.6 : 1.0));
        #include <colorspace_fragment>
      }`,
  }));
  pts.frustumCulled = false; lineScene.add(pts);
  // les étiquettes du dessin (texte HTML, positionné à chaque image sur ces points 3D)
  const labels = [{ text: "Nelumbo nucifera · lotus bleu", p: new V3(1.78 * Math.cos(-0.78), 0.12, 1.78 * Math.sin(-0.78)).applyMatrix4(H), at: 0.22 }, { text: "Ø 3,56", p: new V3(-RX, 0.12, 0).applyMatrix4(H), at: 0.14 }];
  if (flower.pod) labels.push({ text: "Cœur · 20 graines", p: new V3(0.17, 0.1, 0.02).applyMatrix4(flower.pod.matrixWorld), at: 0.33 });
  const p1 = flower.pets.find((p) => p.wi === 1); if (p1) labels.push({ text: "31 pétales · 4 couronnes", p: OUT[Math.round(OUT.length / 2) - 1].clone().applyMatrix4(p1.m.matrixWorld), at: 0.86 });
  return { LU, PU, lines, pts, labels };
}
// pendant le dessin, les pétales sont des formes blanches à peine visibles, qui se remplissent en tournant (comme une jauge)
const bpU = { uSweep: { value: 0 }, uHeadInv: { value: new THREE.Matrix4() } };
const bpMat = new THREE.MeshBasicMaterial({ color: '#dfeeff', transparent: true, depthWrite: false, side: THREE.DoubleSide });
bpMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, bpU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uHeadInv; varying vec3 vLoc;').replace('#include <project_vertex>', '#include <project_vertex>\n  vLoc = (uHeadInv * modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSweep; varying vec3 vLoc;').replace('#include <opaque_fragment>', '{ float a = atan(vLoc.x, -vLoc.z); if (a < 0.0) a += 6.2831853; diffuseColor.a = 0.012 + 0.04 * smoothstep(uSweep, uSweep - 0.05, a); }\n#include <opaque_fragment>');
};
bpMat.customProgramCacheKey = () => 'bp';

/* ---------- particules en suspension, bulles ---------- */
const motes = (() => {
  const n = small ? 700 : 1500, pos = new Float32Array(n * 3), sd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([rr(0, 24), rr(0, 24), rr(0, 24)], i * 3); sd[i] = rnd(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: U.time, uScale: { value: 500 }, uCam: { value: new V3() }, uNight: U.night, uEnv: U.env, uRo: { value: new V3() }, uRd: { value: new V3(0, 0, -1) }, uPk: { value: 0 } },
    vertexShader: `attribute float aSeed; uniform float uTime, uScale, uNight, uPk; uniform vec3 uCam, uRo, uRd; varying float vA, vG, vS;
      void main(){ vec3 p = position; p.y += uTime * (0.03 + aSeed * 0.05); p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.4 + uTime * 0.06; p.z += cos(uTime * 0.17 + aSeed * 17.0) * 0.4;
        p = uCam + mod(p - uCam + 12.0, 24.0) - 12.0;
        vec3 w = p - uRo; vec3 q = w - uRd * max(dot(w, uRd), 0.0); vG = exp(-dot(q, q) * 2.2) * uPk * uNight;   // la nuit, le plancton s’allume quand la main passe
        vec4 mv = viewMatrix * vec4(p, 1.0); float dz = -mv.z; vS = aSeed;
        gl_PointSize = (0.018 + aSeed * 0.04) * uScale / max(dz, 0.3) * (1.0 + uNight * 0.12 + vG * 1.4);
        vA = smoothstep(0.3, 1.6, dz) * smoothstep(15.0, 6.0, dz) * (0.3 + 0.7 * fract(aSeed * 7.3));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uNight, uTime, uEnv; varying float vA, vG, vS;
      void main(){ float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
        float tw = 0.55 + 0.45 * sin(uTime * (1.5 + vS * 2.0) + vS * 60.0);
        vec3 c = mix(vec3(0.82, 0.96, 1.0) * 1.3, vec3(0.3, 1.0, 0.86) * (1.2 + vG * 6.0) * tw, uNight);
        gl_FragColor = vec4(c, a * vA * mix(0.7, 0.3 + vG * 1.6, uNight) * uEnv); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts); return m;
})();
const NB = small ? 220 : 380;
const bub = { pos: new Float32Array(NB * 3), size: new Float32Array(NB), vy: new Float32Array(NB), sd: new Float32Array(NB), next: 0 };
const bubMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: true, fog: false, uniforms: { uScale: { value: 500 }, uNight: U.night },
  vertexShader: `attribute float aSize; uniform float uScale; varying float vA;
    void main(){ vec4 mv = viewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(-mv.z, 0.3); vA = step(0.0005, aSize) * smoothstep(0.25, 0.9, -mv.z); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uNight; varying float vA;
    void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0 || vA < 0.01) discard;
      float rim = smoothstep(0.5, 1.0, r), spec = smoothstep(0.26, 0.0, length(c - vec2(-0.17, -0.2)));
      gl_FragColor = vec4((mix(vec3(0.5, 0.8, 0.95), vec3(0.95, 1.0, 1.0), rim) * (0.6 + rim * 0.9) + spec * 2.2) * (1.0 - 0.6 * uNight), (0.1 + rim * 0.75 + spec) * vA); }`,
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

/* ---------- passe finale : profondeur de champ, halo, ondulation de l’eau, étalonnage ; à l’entrée, le dessin qui se remplit de réalité ---------- */
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
const VOIDC = new THREE.Color('#05080d');                       // le noir de l’entrée (un bleu nuit presque noir)
renderer.setClearColor(VOIDC, 1);
const finalMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tSoft: { value: hB.texture }, cNear: { value: camera.near }, cFar: { value: camera.far }, uFocus: { value: 8 }, uDof: { value: 1 }, uTime: U.time, uLift: { value: 0 }, uFade: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uReveal: { value: 1 }, uCen: { value: new THREE.Vector2(0.5, 0.5) }, uVoid: { value: VOIDC }, uEnv: U.env },
  vertexShader: FSV,
  fragmentShader: `uniform sampler2D tColor, tDepth, tSoft; uniform float cNear, cFar, uFocus, uDof, uTime, uLift, uFade, uReveal, uEnv; uniform vec2 uRes, uCen; uniform vec3 uVoid; varying vec2 vUv;
    void main(){
      vec2 uv = vUv + vec2(sin(vUv.y * 17.0 + uTime * 1.3), cos(vUv.x * 15.0 + uTime * 1.1)) * 0.0011 * uEnv;      // l’eau fait onduler l’image
      float dz = texture2D(tDepth, uv).x, dist = (cNear * cFar) / (cFar - dz * (cFar - cNear));
      vec2 dir = uv - 0.5, ca = dir * (0.0012 + dot(dir, dir) * 0.006);
      vec3 sharp = vec3(texture2D(tColor, uv - ca).r, texture2D(tColor, uv).g, texture2D(tColor, uv + ca).b), soft = texture2D(tSoft, uv).rgb;
      float coc = max(smoothstep(uFocus * 1.3, uFocus * 3.2, dist), smoothstep(uFocus * 0.66, uFocus * 0.28, dist)) * uDof;
      vec3 c = mix(sharp, soft, coc);
      c += max(soft - 0.9, 0.0) * 0.5;
      c *= 1.0 - dot(dir, dir) * 0.85;
      c = mix(c, vec3(0.8, 0.96, 1.0) * 3.2, uLift);                                                   // la remontée vers la lumière
      if (uReveal < 1.0) { vec2 q = (vUv - uCen) * vec2(uRes.x / uRes.y, 1.0); float R = uReveal * 1.7; c = mix(uVoid, c, smoothstep(R, R - 0.24, length(q))); }
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
// phases : load (le dessin se trace) → gate (la vraie fleur, les boutons) → dive (on plonge dans la fleur) → live → leave
let phase = 'load', now = 0, bloom = 0.72, bloomV = 0, frames = 0, narrow = false, nextDrop = 0.6, dropIx = 0, lastAmb = 0, liveT = 0;
let shy = 0, shyT = -9, night = 0, nightOn = false, glowKick = 0;
const orbit = { az: 0, pol: 1.54, taz: 0, tpol: 1.54, R: 8.2 };
const CEN = new V3(0.15, 2.75, 0.5);
const ptr = { on: false, ndc: new THREE.Vector2(9, 9), speed: 0, force: 0, forceS: 0, t: 0, down: false, mode: null, sx: 0, sy: 0, st: 0, moved: 0, id: -1, stillT: 0, over: false, px: 0, py: 0 };
const grab = { on: false, target: new V3(), sm: new V3(), plane: new THREE.Plane(), off: new V3() };
const ray = new THREE.Raycaster(), headPos = new V3().copy(P[NN - 1]), headPrev = headPos.clone(), headVel = new V3(), vLocal = new V3(), qInv = new THREE.Quaternion(), axisY = new V3(0, 1, 0), tmp = new V3(), tmp2 = new V3(), camPos = new V3(), camTgt = new V3(), livePos = new V3(), liveTgt = new V3(), qHead = new THREE.Quaternion(), _ia = new V3();
let impulse = null;                                           // un clic dans l’eau : une onde qui pousse tout
const load = { p: 0, last: 0, hold: false, going: false };
const intro = { draw: 0, rv: -1, lines: 1, roll: 0, envK: 0, envOn: false, envT: 0, sway: 0, D: 5, sw: null };
const HSTEP = 1 / 120; let simAcc = 0, simT = 0, restK = 1;   // la tige : pas de temps fixe (1/120 s), images interpolées

// la nuit : l’eau s’assombrit, la lumière du soleil devient celle de la lune, les fleurs et le plancton s’allument
const SUN_D = new THREE.Color('#e9fbff'), SUN_N = new THREE.Color('#9fbcff'), GLOW_D = new THREE.Color('#ffd98a'), GLOW_N = new THREE.Color('#7fc0ff');
function applyNight(k) {
  FOG.copy(PAL_D[0]).lerp(PAL_N[0], k); DEEP.copy(PAL_D[1]).lerp(PAL_N[1], k); TOP.copy(PAL_D[2]).lerp(PAL_N[2], k);
  U.day.value = 1 - k; U.night.value = k;
  sun.intensity = lerp(2.3, 0.5, k); sun.color.copy(SUN_D).lerp(SUN_N, k); hemi.intensity = lerp(1.25, 0.28, k); fill.intensity = lerp(0.55, 0.12, k);
  glowL.color.copy(GLOW_D).lerp(GLOW_N, k); glowL.distance = lerp(2.6, 5.5, k);
  renderer.toneMappingExposure = lerp(1.08, 1.22, k);
}

// la tige : une chaîne de points (Verlet), ramenée vers sa forme de repos, poussée par l’eau et par la main.
// Pas de temps fixe + main lissée + tête sans inertie quand on la tient : plus aucun tremblement.
function stepChain(h, t) {
  const damp = Math.pow(grab.on ? 0.9 : 0.935, h * 60), sk = (reduced ? 0.35 : 1) * intro.sway;
  const ro = ray.ray.origin, rd = ray.ray.direction, pf = ptr.forceS;
  restK += ((grab.on ? 0.15 : 1) - restK) * (1 - Math.exp(-h * (grab.on ? 9 : 1.8)));
  const ks = KS * restK;
  for (let i = 1; i < NN; i++) {
    const w = i / (NN - 1), p = P[i], q = PP[i];
    if (grab.on && i === NN - 1) { q.copy(p); continue; }
    const sx = w * w * (Math.sin(t * 0.7 + 1) * 0.26 + Math.sin(t * 1.31) * 0.1) * sk, sz = w * w * (Math.cos(t * 0.53) * 0.18 + Math.sin(t * 1.07 + 2) * 0.08) * sk;
    let ax = (rest[i].x + sx - p.x) * ks, ay = (rest[i].y - p.y) * ks, az = (rest[i].z + sz - p.z) * ks;
    if (ptr.on && !grab.on && pf > 0.01 && phase === 'live') {   // la main pousse l’eau : la fleur s’écarte (noyau doux, sans à-coup)
      tmp.subVectors(p, ro); const pr = tmp.dot(rd);
      if (pr > 0) { tmp.addScaledVector(rd, -pr); const dist = tmp.length(), RP = 1.2; if (dist < RP) { const k = 1 - dist / RP, f = k * k * (3 - 2 * k) * pf * w * 1.6, inv = 1 / Math.max(dist, 0.2); ax += tmp.x * inv * f + rd.x * f * 0.5; ay += tmp.y * inv * f + rd.y * f * 0.5; az += tmp.z * inv * f + rd.z * f * 0.5; } }
    }
    if (impulse) { tmp.subVectors(p, impulse.at); const dist = tmp.length(), age = now - impulse.t, f = (Math.exp(-((dist - age * 5) ** 2) * 1.2) * Math.exp(-age * 1.2) * 34 * w) / Math.max(dist, 0.4); ax += tmp.x * f; ay += tmp.y * f * 0.4; az += tmp.z * f; }
    const vx = (p.x - q.x) * damp, vy = (p.y - q.y) * damp, vz = (p.z - q.z) * damp;
    q.copy(p); p.x += vx + ax * h * h; p.y += vy + ay * h * h; p.z += vz + az * h * h;
  }
  if (grab.on) {                                              // la main : lissée, et la tête la suit sans dépasser la longueur de la tige
    grab.sm.lerp(grab.target, 1 - Math.exp(-h * 14));
    tmp.subVectors(grab.sm, P[0]); const len = tmp.length(); if (len > SL * 0.97) tmp.multiplyScalar((SL * 0.97) / len);
    tmp.add(P[0]); tmp.y = Math.max(tmp.y, gH(tmp.x, tmp.z) + 0.3); P[NN - 1].lerp(tmp, 1 - Math.exp(-h * 20));
  }
  for (let k = 0; k < 10; k++) {
    for (let i = 1; i < NN; i++) {
      const a = P[i - 1], b = P[i]; tmp2.subVectors(b, a); const len = tmp2.length() || 1e-5, df = (len - SEG) / len;
      if (i === 1) b.addScaledVector(tmp2, -df); else if (grab.on && i === NN - 1) a.addScaledVector(tmp2, df); else { a.addScaledVector(tmp2, df * 0.5); b.addScaledVector(tmp2, -df * 0.5); }
    }
  }
  for (let i = 1; i < NN - 1; i++) { tmp2.addVectors(P[i - 1], P[i + 1]).multiplyScalar(0.5); P[i].lerp(tmp2, 0.05); }
  for (let i = 1; i < NN; i++) { const fl = gH(P[i].x, P[i].z) + 0.09; if (P[i].y < fl) P[i].y = fl; }
}

function drop(t) {
  const x = rr(-7.5, 7.5), z = phase === 'live' ? rr(-12, 0) : rr(-11, 3), k = dropIx++ % 6;
  DROPS[k].set(x, z, t, rr(0.45, 1)); sound.drop(clamp(x / 8, -0.9, 0.9), phase === 'live' ? 0.5 : 1);
  emit(3, x, SURF - 0.5, z, 0.3, 0.05);
}

/* ---------- la caméra : au-dessus de la fleur (le dessin), la plongée dans la fleur, puis autour d’elle ---------- */
function computeLive(lift) {
  const R2 = orbit.R * (narrow ? 1.28 : 1);
  livePos.set(CEN.x + R2 * Math.sin(orbit.pol) * Math.sin(orbit.az), CEN.y + R2 * Math.cos(orbit.pol), CEN.z + R2 * Math.sin(orbit.pol) * Math.cos(orbit.az)); livePos.y = Math.max(livePos.y, 0.55);
  liveTgt.copy(CEN).lerp(headPos, 0.3); if (narrow) liveTgt.y -= 1.25;
  const fl = reduced ? 0 : 1; livePos.x += Math.sin(now * 0.31) * 0.14 * fl; livePos.y += Math.sin(now * 0.43) * 0.09 * fl + lift * 4.6; liveTgt.y += lift * 8.5;
}
function introCamera() {
  const up = _ia.set(0, 1, 0).applyQuaternion(head.quaternion);
  camera.fov = narrow ? 50 : 38; camera.updateProjectionMatrix();
  camera.position.copy(headPos).addScaledVector(up, intro.D);
  camera.up.set(0, 0, -1).applyQuaternion(head.quaternion).applyAxisAngle(up, intro.roll);
  camTgt.copy(headPos).addScaledVector(camera.up, intro.D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (narrow ? 0.05 : 0.09));   // la fleur un peu sous le centre (le titre au-dessus)
  camera.lookAt(camTgt);
}
const SW_DUR = 5.4, swU = (x) => x - (0.85 * Math.sin(TAU * x)) / TAU;   // lent au départ, vite dans les pétales, lent à l’arrivée
function swX(u) { let a = 0, b = 1; for (let i = 0; i < 32; i++) { const m = (a + b) / 2; if (swU(m) < u) a = m; else b = m; } return (a + b) / 2; }
function startSwoop() {
  computeLive(0);
  const hp = headPos.clone(), up = new V3(0, 1, 0).applyQuaternion(head.quaternion), side = new V3(livePos.x - hp.x, 0, livePos.z - hp.z).normalize();
  const K = [camera.position.clone(), hp.clone().addScaledVector(up, 1.0).addScaledVector(side, 0.08), hp.clone().addScaledVector(up, 0.16).addScaledVector(side, 0.48), hp.clone().addScaledVector(up, -0.55).addScaledVector(side, 1.45), livePos.clone()];
  const T = [camTgt.clone(), hp.clone().addScaledVector(side, 0.04), hp.clone().addScaledVector(side, 1.7).addScaledVector(up, -0.35), hp.clone().addScaledVector(up, -0.1), liveTgt.clone()];
  intro.sw = { P: new THREE.CatmullRomCurve3(K, false, 'centripetal'), T: new THREE.CatmullRomCurve3(T, false, 'centripetal'), up0: camera.up.clone(), f0: camera.fov, t: 0 };
  camera.near = 0.03; camera.updateProjectionMatrix(); finalMat.uniforms.cNear.value = 0.03;
}
function swoopCamera(dt) {
  const S = intro.sw; S.t += dt; const x = clamp(S.t / SW_DUR), u = swU(x);
  S.P.getPoint(u, camPos); S.T.getPoint(u, camTgt);
  computeLive(0); const b = smooth(0.8, 1, u); camPos.lerp(livePos, b); camTgt.lerp(liveTgt, b);
  camera.up.copy(S.up0).lerp(axisY, smooth(0.42, 0.72, u)).normalize();
  const fLive = narrow ? 54 : 38; camera.fov = u < 0.5 ? lerp(S.f0, 50, smooth(0.15, 0.5, u)) : lerp(50, fLive, smooth(0.5, 0.95, u)); camera.updateProjectionMatrix();
  camera.position.copy(camPos); camera.lookAt(camTgt);
  if (!intro.envOn && u >= 0.5) envOn();
  if (x >= 1) { phase = 'live'; liveT = now; d.classList.add('dv-live'); camera.up.set(0, 1, 0); camera.near = 0.2; camera.updateProjectionMatrix(); finalMat.uniforms.cNear.value = 0.2; }
}
let ENV = [];
function setEnv(on) { for (const o of ENV) o.visible = on; }
function envOn() {                                            // on sort des pétales : l’eau apparaît autour de nous
  intro.envOn = true; intro.envT = now; setEnv(true); scene.fog.density = 0.42;
  emit(40, camera.position.x, camera.position.y - 0.6, camera.position.z, 2.4, 0.08);
}

function tick(dt) {
  now += dt; U.time.value = now; frames++;
  const live = phase === 'live' || phase === 'leave';
  // les gouttes à la surface
  if (now > nextDrop && intro.envOn) { drop(now); nextDrop = now + (live ? rr(1.4, 3.6) : rr(0.6, 1.4)); }
  // l’entrée : le dessin se trace au rythme du chargement, puis se remplit de réalité
  if (phase === 'load') { intro.draw += (boot.p / 100 - intro.draw) * Math.min(1, dt * 4); if (boot.p >= 100 && intro.draw > 0.985 && intro.rv < 0) startReveal(); }
  if (intro.rv >= 0 && intro.rv < 50) { intro.rv += dt; finalMat.uniforms.uReveal.value = intro.rv > 2.2 ? 1 : ease(clamp(intro.rv / 1.8)); intro.lines = 1 - smooth(0.8, 2.0, intro.rv); if (phase === 'load' && intro.rv > 1.2) toGate(); }
  if (phase === 'gate') intro.roll += dt * 0.03;
  if (intro.envOn && intro.envK < 1) {
    intro.envK = Math.min(1, (now - intro.envT) / 2.6); const e = ease(intro.envK);
    U.env.value = e; scene.fog.density = lerp(0.42, 0.052, e); intro.sway = smooth(0, 1, intro.envK);
  }
  scene.fog.color.copy(VOIDC).lerp(FOG, U.env.value);
  // la souris : sa force retombe si elle ne bouge plus
  ptr.speed *= Math.pow(0.02, dt); ptr.force = ptr.on ? 20 * (0.16 + Math.min(1.5, ptr.speed * 0.45)) : 0; ptr.forceS += (ptr.force - ptr.forceS) * (1 - Math.exp(-dt * 8));
  if (ptr.on) { ray.setFromCamera(ptr.ndc, camera); const t0 = (1.3 - ray.ray.origin.y) / (ray.ray.direction.y || 1e-5); if (t0 > 0 && t0 < 40) { tmp.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t0); U.push.value.set(tmp.x, tmp.z, Math.min(1.3, 0.12 + ptr.speed * 0.4)); } }
  else U.push.value.z *= Math.pow(0.05, dt);
  // la fleur timide : un geste brusque tout près d’elle, et elle se referme d’un coup (puis se rouvre, doucement)
  if (phase === 'live' && ptr.on && !grab.on && ptr.speed > (coarse ? 3.2 : 1.8) && now - shyT > 1.6) {
    tmp.subVectors(headPos, ray.ray.origin); const pr = tmp.dot(ray.ray.direction); tmp.addScaledVector(ray.ray.direction, -pr);
    if (pr > 0 && tmp.length() < 1.5) { shy = 1; shyT = now; bloomV -= 2.2; sound.shy(); emit(8, headPos.x, headPos.y + 0.4, headPos.z, 0.6, 0.05); tipDone('shy'); touched(); }
  }
  if (now - shyT > 0.7) shy = Math.max(0, shy - dt * 0.42);
  // une carpe curieuse : la souris reste immobile dans l’eau
  curious = phase === 'live' && ptr.on && !ptr.down && !grab.on && !ptr.over && !coarse && now - ptr.stillT > 0.9;
  if (curious) { camera.getWorldDirection(tmp2); const dd = tmp.subVectors(CEN, ray.ray.origin).dot(tmp2) / Math.max(0.2, ray.ray.direction.dot(tmp2)); curiousPt.copy(ray.ray.origin).addScaledVector(ray.ray.direction, dd); curiousPt.y = clamp(curiousPt.y, 1.2, SURF - 1.6); for (const k of koi) if (k.mode === 'curious' && k.pos.distanceTo(curiousPt) < 0.9) tipDone('curious'); }
  // l’ouverture de la fleur
  if (phase === 'load') bloom = 0.72;
  else if (phase === 'gate') bloom = 0.72 + Math.sin(now * 0.9) * 0.02;
  else { const fast = now - shyT < 0.7; bloomV += ((1 - 0.88 * shy - bloom) * (fast ? 26 : 5.5) - bloomV * (fast ? 8 : 3.4)) * dt; bloom = clamp(bloom + bloomV * dt, 0.04, 1.2); }
  if (impulse && now - impulse.t > 3) impulse = null;
  // la nuit
  const nPrev = night; night += ((nightOn ? 1 : 0) - night) * Math.min(1, dt * 1.2);
  if (Math.abs(night - nPrev) > 1e-5 || frames < 3) applyNight(night);
  glowKick *= Math.pow(0.25, dt);
  const pulse = night * (0.34 + 0.1 * Math.sin(now * 1.3) + glowKick * 0.9);
  for (const kd in petalMats) petalMats[kd].emissiveIntensity = pulse;
  podMat.emissiveIntensity = night * (0.22 + glowKick * 0.4); stamMat.emissiveIntensity = 0.55 + night * (1.4 + glowKick);
  // la tige : pas fixes, puis position interpolée pour l’image
  simAcc = Math.min(simAcc + dt, 0.1);
  while (simAcc >= HSTEP) { for (let i = 0; i < NN; i++) P0[i].copy(P[i]); stepChain(HSTEP, simT); simT += HSTEP; simAcc -= HSTEP; }
  const al = simAcc / HSTEP; for (let i = 0; i < NN; i++) R[i].lerpVectors(P0[i], P[i], al);
  updateTube(stemGeo, stemCurve, 0.085, 0.05);
  headPrev.copy(headPos); headPos.copy(R[NN - 1]);
  tmp.subVectors(headPos, headPrev).multiplyScalar(1 / Math.max(dt, 1e-3)); if (tmp.length() > 5) tmp.setLength(5); headVel.lerp(tmp, 1 - Math.exp(-dt * 7));
  head.position.copy(headPos);
  tmp.subVectors(R[NN - 1], R[NN - 4]).normalize(); qHead.setFromUnitVectors(axisY, tmp); head.quaternion.slerp(qHead, 1 - Math.exp(-dt * 12));
  qInv.copy(head.quaternion).invert(); vLocal.copy(headVel).applyQuaternion(qInv);
  poseBloom(flower, bloom, vLocal, dt, now);
  glowL.intensity = lerp(0.12 + 0.38 * clamp(bloom), (1.4 + glowKick * 2) * (0.35 + 0.65 * clamp(bloom)), night);
  if (intro.envOn) {
    for (const l of leaves) {                                // les feuilles se balancent, et s’écartent quand on agite l’eau près d’elles
      const dx = U.push.value.x - l.top.x, dz = U.push.value.y - l.top.z;
      let push = U.push.value.z * Math.exp(-(dx * dx + dz * dz) * 0.3);
      if (impulse) { const dist = l.top.distanceTo(impulse.at), age = now - impulse.t; push += Math.exp(-((dist - age * 5) ** 2) * 1.2) * Math.exp(-age * 1.2) * 1.5; }
      l.f += (push - l.f) * Math.min(1, dt * 4);
      l.tg.rotation.x = l.tilt + Math.sin(now * 0.6 + l.ph) * 0.05 + Math.sin(now * 0.27 + l.ph * 2) * 0.03 + l.f * 0.3;
      l.tg.rotation.z = Math.sin(now * 0.45 + l.ph * 1.7) * 0.05 + l.f * 0.08 * Math.sin(l.ph * 3);
    }
    buds.forEach((b) => { b.root.rotation.z = Math.sin(now * 0.6 + b.ph) * 0.05; b.root.rotation.x = Math.cos(now * 0.47 + b.ph) * 0.04; });
    stepSprouts(dt); stepFish(dt); stepKoi(dt); stepPellets(dt); stepRings(dt);
    if (now - lastAmb > 0.22) { lastAmb = now; const x = rr(-7, 7), z = rr(-10, 2); emit(1, x, gH(x, z) + 0.1, z, 0.1, 0.06); }
    if (phase === 'dive' && now - intro.envT < 1.6 && Math.random() < 0.7) emit(3, camera.position.x + rr(-1.5, 1.5), camera.position.y - rr(0.3, 1.5), camera.position.z + rr(-1.5, 1.5), 0.4, 0.08);
  }
  if (headVel.length() > 2.2 && Math.random() < 0.5) emit(1, headPos.x, headPos.y + 0.3, headPos.z, 0.7, 0.05);
  stepBubbles(dt, now);
  // le chargement vers l’équipe : on remonte
  if (phase === 'live') {
    if (load.hold) { load.p = Math.min(1, load.p + dt / 2.4); load.last = performance.now(); }
    else if (performance.now() - load.last > 420) load.p = Math.max(0, load.p - dt * 0.8);
    if (load.p >= 1) leave();
    stepTips();
  }
  const lift = load.p * load.p;
  // la caméra
  orbit.az += (orbit.taz - orbit.az) * Math.min(1, dt * 5); orbit.pol += (orbit.tpol - orbit.pol) * Math.min(1, dt * 5);
  if (phase === 'load' || phase === 'gate') introCamera();
  else if (phase === 'dive') swoopCamera(dt);
  else { computeLive(lift); camera.position.copy(livePos); camera.fov = (narrow ? 54 : 38) + lift * 8; camera.updateProjectionMatrix(); camera.lookAt(liveTgt); }
  sky.position.copy(camera.position);
  const M = motes.uniforms; M.uCam.value.copy(camera.position);
  if (ptr.on) { M.uRo.value.copy(ray.ray.origin); M.uRd.value.copy(ray.ray.direction); }
  M.uPk.value += ((ptr.on ? Math.min(1.4, 0.35 + ptr.speed * 0.25) : 0) - M.uPk.value) * Math.min(1, dt * 5);
  const F = finalMat.uniforms; F.uFocus.value += (camera.position.distanceTo(headPos) - F.uFocus.value) * Math.min(1, dt * (phase === 'dive' ? 12 : 4)); F.uDof.value = (small ? 0.75 : 1) * (intro.envOn ? 1 : 0.4); F.uLift.value = Math.pow(load.p, 4) * 0.7;
  // le dessin : épaisseur des pointillés à l’écran, centre du dévoilement, étiquettes
  if (intro.lines > 0.004 && BP) {
    const wpp = (2 * camera.position.distanceTo(headPos) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / (innerHeight * PR);
    BP.LU.uDash.value = 1 / (7 * PR * wpp); BP.LU.uDraw.value = intro.draw; BP.LU.uAlpha.value = intro.lines;
    bpU.uSweep.value = smooth(0.3, 0.98, intro.draw) * TAU;
    for (const L of bpLabels) { tmp.copy(L.p).project(camera); L.el.style.transform = `translate(${((tmp.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`; L.el.style.opacity = String((intro.draw > L.at ? 1 : 0) * intro.lines); }
  } else if (bpBox && !bpBox.hidden) bpBox.hidden = true;
  if (phase === 'load' || phase === 'gate') { tmp.copy(headPos).project(camera); F.uCen.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5); }
  if (live) { sound.rise(load.p); ring(load.p); }
}
function render() {
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  const B = blurMat.uniforms;
  B.tColor.value = rt.texture; B.uDir.value.set(1 / hA.width, 0); pass(blurMat, hA);
  B.tColor.value = hA.texture; B.uDir.value.set(0, 1 / hA.height); pass(blurMat, hB);
  B.tColor.value = hB.texture; B.uDir.value.set(1.8 / hA.width, 0); pass(blurMat, hA);
  B.tColor.value = hA.texture; B.uDir.value.set(0, 1.8 / hA.height); pass(blurMat, hB);
  pass(finalMat, null);
  if (BP && intro.lines > 0.004) { renderer.autoClear = false; renderer.render(lineScene, camera); renderer.autoClear = true; }
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
  const sc = (H * 0.5) / Math.tan(THREE.MathUtils.degToRad(38 / 2)); motes.uniforms.uScale.value = sc; bubMat.uniforms.uScale.value = sc; finalMat.uniforms.uRes.value.set(W, H);
  const fv = THREE.MathUtils.degToRad(narrow ? 50 : 38) / 2, fh = Math.atan(Math.tan(fv) * camera.aspect); intro.D = 1.62 / ((narrow ? 0.8 : 0.56) * Math.tan(Math.min(fv, fh)));
  if (BP) { BP.LU.uRes.value.set(W / 2, H / 2); BP.LU.uW.value = 0.62 * PR; BP.PU.uPx.value = 7 * PR; }
}
addEventListener('resize', resize);

/* ---------- les gestes ---------- */
const setNdc = (e) => { const r = canvas.getBoundingClientRect(); ptr.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
function touched() { if (!d.classList.contains('dv-touched')) d.classList.add('dv-touched'); }
function grabStart() { grab.on = true; camera.getWorldDirection(tmp); grab.plane.setFromNormalAndCoplanarPoint(tmp, headPos); grab.target.copy(headPos); grab.sm.copy(headPos); grab.off.set(0, 0, 0); if (ray.ray.intersectPlane(grab.plane, tmp2)) grab.off.subVectors(headPos, tmp2); sound.grab(); emit(6, headPos.x, headPos.y + 0.3, headPos.z, 0.8, 0.05); touched(); }
function grabEnd() { if (!grab.on) return; grab.on = false; const f = clamp(headPos.distanceTo(rest[NN - 1]) / 2.5, 0.3, 1.2); sound.release(f); emit(10, headPos.x, headPos.y + 0.3, headPos.z, 0.9, 0.06); if (f > 0.45) tipDone('grab'); }
function breathe() { bloomV -= 3.4; glowKick = 1; sound.breathe(); blowRing(); emit(26, headPos.x, headPos.y + 0.5, headPos.z, 0.9, 0.1); tipDone('breathe'); touched(); }
function groundHit() {                                        // où le rayon de la souris touche le sable
  const o = ray.ray.origin, v = ray.ray.direction; if (v.y > -0.03) return null;
  let t = (gH(0, 0) - o.y) / v.y;
  for (let i = 0; i < 6; i++) t = (gH(o.x + v.x * t, o.z + v.z * t) - o.y) / v.y;
  return t > 0 && t < 30 ? new V3().copy(o).addScaledVector(v, t) : null;
}
function waterPoint() {                                       // un point dans l’eau, à hauteur de la fleur, sous la souris
  camera.getWorldDirection(tmp2); const dd = tmp.subVectors(CEN, ray.ray.origin).dot(tmp2) / Math.max(0.2, ray.ray.direction.dot(tmp2));
  const p = new V3().copy(ray.ray.origin).addScaledVector(ray.ray.direction, dd); p.y = clamp(p.y, 1.4, SURF - 1.8); return p;
}
function wave(at) {                                           // un clic dans l’eau : une onde qui pousse tout (la fleur, les feuilles, les carpes)
  impulse = { at, t: now }; U.push.value.z = 1.4; emit(14, at.x, at.y, at.z, 0.5, 0.08); sound.wave(clamp(ptr.ndc.x, -1, 1)); scareKoi(at);
}
function setNight(on) {
  if (phase !== 'live' && phase !== 'leave') return;
  nightOn = on; d.classList.toggle('dv-night', on); sound.night(on); touched(); if (on) tipDone('night');
  if (nightBtn) { nightBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); nightBtn.setAttribute('aria-label', on ? 'Rallumer la lumière' : 'Éteindre la lumière'); nightBtn.lastChild.textContent = on ? 'Jour' : 'Nuit'; }
}
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
  if (Math.hypot(e.clientX - ptr.px, e.clientY - ptr.py) > 4) { ptr.stillT = now; ptr.px = e.clientX; ptr.py = e.clientY; }
  if (phase !== 'live') return;
  ray.setFromCamera(ptr.ndc, camera);
  if (ptr.down) {
    ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy));
    if (ptr.mode === 'grab') { if (ray.ray.intersectPlane(grab.plane, tmp2)) grab.target.copy(tmp2).add(grab.off); }
    else { orbit.taz = clamp(orbit.taz - e.movementX * 0.005, -1.25, 1.25); orbit.tpol = clamp(orbit.tpol - e.movementY * 0.004, 1.02, 1.72); if (ptr.moved > 8) touched(); }
  } else { ptr.over = ray.intersectObject(hitProxy).length > 0; canvas.style.cursor = ptr.over ? 'grab' : ''; }
});
let clickTimer = 0, lastClick = 0;
function pointerUp(e) {
  if (!ptr.down || (e.pointerId !== undefined && e.pointerId !== ptr.id)) return; ptr.down = false;
  const click = ptr.moved < 7 && performance.now() - ptr.st < 400;
  if (ptr.mode === 'grab') { grabEnd(); canvas.style.cursor = 'grab'; if (click) breathe(); }
  else if (click && phase === 'live') {                      // un clic : une graine (sable) ou une onde (eau) ; deux clics : à manger pour les carpes
    const tN = performance.now(), wp = waterPoint();
    if (clickTimer && tN - lastClick < 320) { clearTimeout(clickTimer); clickTimer = 0; feed(wp); touched(); }
    else {
      lastClick = tN; const gp = groundHit(), at = (() => { const t0 = ray.ray.direction.dot(tmp.subVectors(headPos, ray.ray.origin)); return new V3().copy(ray.ray.origin).addScaledVector(ray.ray.direction, t0); })();
      clickTimer = setTimeout(() => { clickTimer = 0; if (gp && plant(gp.x, gp.z)) tipDone('plant'); else wave(at); touched(); }, 290);
    }
  }
  if (e.pointerType && e.pointerType !== 'mouse') ptr.on = false;
}
canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
canvas.addEventListener('pointerleave', () => { if (!ptr.down) ptr.on = false; });
addEventListener('keydown', (e) => {
  if (phase !== 'live') { if (phase === 'gate' && e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); enter(true); } return; }
  const kx = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (kx) { for (let i = 1; i < NN; i++) PP[i].x -= kx * 0.09 * (i / NN); touched(); e.preventDefault(); }
  if (e.key === ' ') { breathe(); e.preventDefault(); }
  if (e.key === 'n' || e.key === 'N') setNight(!nightOn);
  if (['ArrowDown', 'PageDown'].includes(e.key)) { pushLoad(0.08); e.preventDefault(); }
});

/* ---------- les astuces : une seule à la fois ; elle change quand on l’a essayée ---------- */
const TIPS = [
  ['grab', 'Attrapez la fleur et tirez-la jusqu’au sable', 'Attrapez la fleur et tirez-la jusqu’au sable'],
  ['breathe', 'Cliquez sur la fleur : elle souffle un anneau de bulles', 'Touchez la fleur : elle souffle un anneau de bulles'],
  ['feed', 'Double-cliquez dans l’eau : les carpes viennent manger', 'Touchez deux fois l’eau : les carpes viennent manger'],
  ['plant', 'Cliquez sur le sable : une graine pousse', 'Touchez le sable : une graine pousse'],
  ['curious', 'Laissez la souris immobile dans l’eau : une carpe vient voir', ''],
  ['shy', 'Passez vite tout près d’elle : elle se referme', 'Glissez vite tout près d’elle : elle se referme'],
  ['night', 'Bouton « Nuit » : tout s’illumine', 'Bouton « Nuit » : tout s’illumine'],
].filter((t) => !coarse || t[2]);
const tipsDone = new Set(), tipEl = $('[data-tip]'), tipNum = $('[data-tip-n]'), tipTxt = $('[data-tip-t]');
let tipIx = -1, tipAt = 0;
function tipDone(k) { tipsDone.add(k); }
function showTip(i) {
  tipIx = i; tipAt = now; if (!tipEl) return; tipEl.classList.add('is-out');
  setTimeout(() => { tipNum.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(TIPS.length).padStart(2, '0'); tipTxt.textContent = TIPS[i][coarse ? 2 : 1]; tipEl.classList.remove('is-out'); }, 420);
}
function stepTips() {
  if (tipIx < 0) { if (now - liveT > 1.4) showTip(0); return; }
  const cur = TIPS[tipIx][0];
  if (tipsDone.has(cur) ? now - tipAt > 1.8 : now - tipAt > 11) {
    let j = tipIx; for (let s = 0; s < TIPS.length; s++) { j = (j + 1) % TIPS.length; if (!tipsDone.has(TIPS[j][0])) break; }
    if (j !== tipIx) showTip(j); else tipAt = now;
  }
}

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
addEventListener('pageshow', (e) => { if (e.persisted) { load.going = false; load.p = 0; if (phase === 'leave') phase = 'live'; d.classList.remove('dv-go'); ring(0); } });

/* ---------- l’entrée, le son ---------- */
const soundBtn = $('[data-sound]'), nightBtn = $('[data-night]');
const label = () => { if (soundBtn) soundBtn.textContent = muted ? 'Activer le son' : 'Couper le son'; };
label();
const underwater = () => phase === 'dive' || phase === 'live' || phase === 'leave';
if (soundBtn) soundBtn.addEventListener('click', () => {
  muted = !muted; try { localStorage.setItem('ms_dv_sound', muted ? 'off' : 'on'); } catch (e) { /* rien */ }
  sound.setMuted(muted); if (!muted) { sound.start(); if (underwater()) sound.settle(nightOn); } label();
});
if (nightBtn) nightBtn.addEventListener('click', () => setNight(!nightOn));
let bpBox = null; const bpLabels = [];
function startReveal() {                                      // le dessin se remplit de réalité, du centre vers les bords
  intro.rv = 0; finalMat.uniforms.uReveal.value = 0;
  for (const p of flower.pets) if (p.m.userData.real) p.m.material = p.m.userData.real;
  flower.stam.visible = true; if (flower.pod) flower.pod.visible = true; if (flower.cup) flower.cup.visible = true;
  sound.reveal();
}
function toGate() { phase = 'gate'; d.classList.add('dv-loaded'); const a = $('[data-gate-actions]'); if (a) { a.hidden = false; const b = a.querySelector('button'); if (b && !AT) b.focus({ preventScroll: true }); } }
function enter(withSound) {
  if (phase !== 'gate') return;
  muted = !withSound; try { localStorage.setItem('ms_dv_sound', muted ? 'off' : 'on'); } catch (e) { /* rien */ }
  sound.setMuted(muted); if (withSound) sound.start();
  label(); d.classList.add('dv-in'); intro.rv = 99; intro.lines = 0; finalMat.uniforms.uReveal.value = 1;
  if (reduced) { envOn(); intro.envT = now - 3; phase = 'live'; liveT = now; d.classList.add('dv-live'); if (withSound) sound.settle(false); return; }
  startSwoop(); phase = 'dive';
  if (withSound) sound.enter({ through: SW_DUR * swX(0.46), water: SW_DUR * swX(0.5), arrive: SW_DUR * 0.96 });
}
$$('[data-enter]').forEach((b) => { b.addEventListener('click', () => enter(b.dataset.enter === '1')); b.addEventListener('pointerenter', () => sound.hover()); });
if (coarse) { const hint = $('[data-hint]'); if (hint) hint.textContent = 'Maintenez le cercle pour rencontrer l’équipe'; }

/* ---------- départ ---------- */
resize();
for (let i = 0; i < 40; i++) { const x = rr(-7, 7), z = rr(-10, 2); emit(1, x, rr(0.5, SURF - 1), z, 0.1, 0.06); }
ENV = scene.children.filter((o) => o !== head && !o.isLight && o !== sun.target && !rings.some((r) => r.m === o));   // la tige aussi : vue de dessus, elle salirait le dessin
// la fleur, immobile et à demi ouverte : le dessin technique se pose exactement sur elle
for (let i = 0; i < NN; i++) { P[i].copy(rest[i]); PP[i].copy(rest[i]); P0[i].copy(rest[i]); R[i].copy(rest[i]); }
headPos.copy(rest[NN - 1]); headPrev.copy(headPos); head.position.copy(headPos); tmp.subVectors(rest[NN - 1], rest[NN - 4]).normalize(); head.quaternion.setFromUnitVectors(axisY, tmp);
for (let i = 0; i < 240; i++) poseBloom(flower, 0.72, ZERO, 1 / 60, 0);
head.updateMatrixWorld(true);
if (AT) {                                                     // captures : directement au fond
  phase = 'live'; liveT = -9; bloom = 1; intro.envOn = true; intro.envK = 1; intro.sway = 1; intro.lines = 0; U.env.value = 1; scene.fog.density = 0.052;
  d.classList.add('dv-in', 'dv-live', 'dv-touched', 'dv-loaded'); const gt = $('[data-gate]'); if (gt) gt.hidden = true;
} else {
  BP = buildBlueprint();
  setEnv(false); scene.fog.density = 0; U.env.value = 0;
  if (BP) {
    for (const p of flower.pets) { p.m.userData.real = p.m.material; p.m.material = bpMat; }
    flower.stam.visible = false; if (flower.pod) flower.pod.visible = false; if (flower.cup) flower.cup.visible = false;
    bpU.uHeadInv.value.copy(head.matrixWorld).invert();
    bpBox = document.createElement('div'); bpBox.className = 'bp'; bpBox.setAttribute('aria-hidden', 'true'); document.body.appendChild(bpBox);
    for (const L of BP.labels) { const el = document.createElement('span'); el.className = 'bp__l'; el.textContent = L.text; bpBox.appendChild(el); bpLabels.push({ el, p: L.p, at: L.at }); }
    resize();
  } else intro.draw = 1;
}
tick(1 / 60); render();
d.classList.add('dv-ready');
boot.cap = 100;
requestAnimationFrame(frame);
window.__dv = {
  get phase() { return phase; }, get frames() { return frames; }, get load() { return load.p; }, get bloom() { return bloom; }, get shy() { return shy; }, get night() { return night; },
  get intro() { return { draw: +intro.draw.toFixed(3), rv: +intro.rv.toFixed(2), envK: +intro.envK.toFixed(2), lines: +intro.lines.toFixed(2) }; },
  get koi() { return koi.map((k) => ({ mode: k.mode, pos: k.pos.toArray().map((v) => +v.toFixed(2)) })); }, get pellets() { return pellets.filter((p) => p.alive).length; },
  get ptr() { return { speed: +ptr.speed.toFixed(2), on: ptr.on, down: ptr.down, mode: ptr.mode }; }, get sprouts() { return sprouts.filter((s) => !s.dead).length; }, get model() { return !!MODEL; }, get sound() { return sound.running; },
  get bp() { return BP ? { n: BP.lines.geometry.index.count, res: BP.LU.uRes.value.toArray(), w: BP.LU.uW.value, dash: BP.LU.uDash.value, draw: BP.LU.uDraw.value, a: BP.LU.uAlpha.value, vis: BP.lines.visible, a0: Array.from(BP.lines.geometry.attributes.aA.array.slice(0, 6)), b0: Array.from(BP.lines.geometry.attributes.aB.array.slice(0, 3)) } : null; },
  get tip() { return tipIx >= 0 ? TIPS[tipIx][0] : null; }, get rings() { return rings.filter((r) => r.on).length; },
  enter, breathe, plant, setNight, feed: (x, y, z) => feed(new V3(x, y, z)), scare: () => { shy = 1; shyT = now; bloomV -= 2.2; sound.shy(); },
  head: () => headPos.toArray().map((v) => +v.toFixed(3)),
  headScreen: () => { tmp.copy(headPos); tmp.y += 0.4; tmp.project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (tmp.x * 0.5 + 0.5) * r.width, r.top + (-tmp.y * 0.5 + 0.5) * r.height]; },
  screen: (x, y, z) => { tmp.set(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (tmp.x * 0.5 + 0.5) * r.width, r.top + (-tmp.y * 0.5 + 0.5) * r.height]; },
};
