// =============================================================================
// L'écran WebGL (Three.js) : une seule scène, un seul rectangle plein écran.
// Il affiche deux photos à la fois (A et B), chacune avec son propre cadrage :
//   - un zoom qui « plonge » vers un point de la photo (la caméra avance),
//   - un fondu de A vers B au moment où l'on passe d'une photo à la suivante,
//   - un flou de vitesse dirigé vers le centre pendant la plongée (chaque photo le sien),
//   - un léger balancement de caméra (comme un drone) pour que l'image ne soit jamais figée,
//   - la vie dans les photos : nuages qui dérivent, lumières qui scintillent, ciel qui glisse,
//     vapeur du café (voir VIE dans donnees.js),
//   - un éclair chaud quand on traverse la fenêtre, la lueur de la fenêtre allumée, un halo sur l'objet survolé,
//   - un léger grain de pellicule et un vignettage, comme au cinéma.
// =============================================================================
import * as THREE from 'three';

const VERTEX = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAGMENT = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, tB;
uniform vec2 uEcran, uImageA, uImageB, uCentreA, uCentreB, uObjetPos, uRot, uSway, uTasse;
uniform float uZoomA, uZoomB, uMix, uFlou, uFlouB, uTemps, uGrain, uLueur, uObjet, uNoir, uChaud, uSur, uVieA, uVieB;
uniform vec4 uBaie;                       // gauche, bas, droite, haut (fractions de la photo A)

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * bruit(p); p = p * 2.07 + 13.7; a *= 0.5; } return s; }
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Où lire dans une photo : cadrage « couverture » (la photo remplit l'écran), zoom autour d'un centre,
// plus le balancement de la caméra (petit décalage et petite rotation de l'image entière).
vec2 cadre(vec2 uv, vec2 image, vec2 centre, float zoom) {
  float ea = uEcran.x / uEcran.y, ia = image.x / image.y;
  vec2 part = ea > ia ? vec2(1.0, ia / ea) : vec2(ea / ia, 1.0);
  vec2 q = (uv - 0.5 + uSway) * vec2(ea, 1.0);
  q = vec2(q.x * uRot.x - q.y * uRot.y, q.x * uRot.y + q.y * uRot.x) / vec2(ea, 1.0);
  return centre + q * part / (zoom * uSur);
}

// Le mouvement à l'intérieur de la photo (un petit glissement des pixels, seulement là où ça a du sens).
vec2 derive(sampler2D t, vec2 p, vec2 image, float vie) {
  if (vie < 0.5) return vec2(0.0);
  vec3 c = texture2D(t, p).rgb;
  float l = lum(c), s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  vec2 a = vec2(image.x / image.y, 1.0);
  if (vie < 1.5) {
    // les nuages : sous l'horizon, clairs et peu colorés ; ils gonflent et glissent lentement
    float m = smoothstep(0.16, 0.42, l) * (1.0 - smoothstep(0.14, 0.32, s)) * (1.0 - smoothstep(0.66, 0.72, p.y));
    if (m < 0.01) return vec2(0.0);
    vec2 q = p * a * 5.0;
    vec2 d = vec2(fbm(q + vec2(uTemps * 0.07, 0.0)), fbm(q + vec2(5.2, 1.3) - vec2(0.0, uTemps * 0.05))) - 0.47;
    return d * 0.009 * m;
  }
  if (vie < 2.5) {
    // le ciel : bleu, au-dessus des toits ; il glisse doucement de côté
    if (p.y < 0.45) return vec2(0.0);
    float m = smoothstep(0.03, 0.12, c.b - c.r) * smoothstep(0.08, 0.2, l) * (1.0 - smoothstep(0.55, 0.75, l));
    if (m < 0.01) return vec2(0.0);
    vec2 q = p * a * vec2(2.5, 7.0);
    float d = fbm(q + vec2(uTemps * 0.05, 0.0)) - 0.47;
    return vec2(d * 0.008, d * 0.0015) * m;
  }
  return vec2(0.0);
}

// Une photo lue avec sa vie et, pendant la plongée, un flou de vitesse vers le centre de l'écran.
vec3 photo(sampler2D t, vec2 image, vec2 centre, float zoom, float vie, float flou) {
  vec2 p = cadre(vUv, image, centre, zoom);
  vec2 d = derive(t, p, image, vie);
  vec3 c = vec3(0.0);
  if (flou < 0.01) {
    c = texture2D(t, p + d).rgb;
    // en dérivant, un pixel de ciel ne doit pas aller chercher un bout d'immeuble
    if (vie > 1.5 && vie < 2.5 && dot(d, d) > 0.0) {
      vec3 c0 = texture2D(t, p).rgb;
      float ok = smoothstep(0.03, 0.12, c.b - c.r);
      c = mix(c0, c, ok);
    }
  } else {
    float j = hash(vUv * uEcran + 0.37);
    for (int i = 0; i < 12; i++) {
      float k = (float(i) + j) / 12.0;
      c += texture2D(t, mix(p, centre, k * flou * 0.085) + d).rgb;
    }
    c /= 12.0;
  }
  // les lumières de la ville, vues de très haut, scintillent
  if (vie > 0.5 && vie < 1.5) {
    float m = smoothstep(0.42, 0.8, lum(c)) * smoothstep(0.08, 0.3, c.r - c.b) * (1.0 - smoothstep(0.62, 0.7, p.y));
    if (m > 0.01) c *= 1.0 + (bruit(p * vec2(image.x / image.y, 1.0) * 900.0 + uTemps * 2.6) - 0.5) * 0.7 * m;
  }
  // la vapeur du café, qui monte en volutes au-dessus de la tasse
  if (vie > 2.5) {
    vec2 a = vec2(image.x / image.y, 1.0);
    vec2 q = (p - uTasse) * a;
    if (q.y > -0.005 && q.y < 0.14 && abs(q.x) < 0.06) {
      float h = max(q.y, 0.0);
      float x = q.x - (sin(h * 38.0 - uTemps * 1.1) * 0.35 + (fbm(vec2(h * 14.0 - uTemps * 0.35, uTemps * 0.08)) - 0.5) * 1.6) * h * 0.22;
      float w = 0.004 + h * 0.16;
      float n = fbm(vec2(x * 70.0, h * 26.0 - uTemps * 0.75));
      float v = exp(-(x * x) / (w * w)) * smoothstep(0.0, 0.012, h) * (1.0 - smoothstep(0.05, 0.13, h)) * smoothstep(0.32, 0.72, n);
      c = mix(c, vec3(1.0, 0.95, 0.88), v * 0.24);
    }
  }
  return c;
}

void main() {
  vec3 a = photo(tA, uImageA, uCentreA, uZoomA, uVieA, uFlou);
  vec3 c = a;
  if (uMix > 0.001) c = mix(a, photo(tB, uImageB, uCentreB, uZoomB, uVieB, uFlouB), uMix);

  // lueur chaude autour de la fenêtre allumée (sur la photo A), qui pulse doucement
  if (uLueur > 0.001) {
    vec2 p = cadre(vUv, uImageA, uCentreA, uZoomA);
    vec2 bc = vec2(uBaie.x + uBaie.z, uBaie.y + uBaie.w) * 0.5, bt = vec2(uBaie.z - uBaie.x, uBaie.w - uBaie.y) * 0.5;
    vec2 d = max(abs(p - bc) - bt, 0.0) / max(bt.y * 2.2, 0.004);
    float pouls = 0.72 + 0.28 * sin(uTemps * 2.4);
    c += vec3(1.0, 0.64, 0.3) * exp(-dot(d, d) * 2.0) * uLueur * pouls * 0.5;
  }

  // halo sur l'objet survolé (dans le studio)
  if (uObjet > 0.001) {
    vec2 p = cadre(vUv, uImageA, uCentreA, uZoomA);
    vec2 o = (p - uObjetPos) * vec2(uImageA.x / uImageA.y, 1.0);
    c += vec3(1.0, 0.86, 0.62) * exp(-dot(o, o) * 70.0) * uObjet * 0.4;
  }

  // éclair chaud (on traverse la fenêtre), vignettage, grain, fondu au noir
  c = mix(c, vec3(1.0, 0.82, 0.6), uChaud);
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 0.6;
  c += (hash(vUv * uEcran + fract(uTemps * 7.13)) - 0.5) * uGrain;
  c *= 1.0 - uNoir;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Ecran {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // les photos sont déjà « finies » (pas de conversion)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // un peu de marge autour de l'image, pour que le balancement de la caméra ne montre jamais le bord
    this.sur = 1.035;
    this.sway = [0, 0]; this.rot = 0;
    const V2 = (x = 1, y = 1) => ({ value: new THREE.Vector2(x, y) });
    this.u = {
      tA: { value: null }, tB: { value: null },
      uEcran: V2(), uImageA: V2(16, 9), uImageB: V2(16, 9), uCentreA: V2(0.5, 0.5), uCentreB: V2(0.5, 0.5), uObjetPos: V2(-1, -1),
      uRot: V2(1, 0), uSway: V2(0, 0), uTasse: V2(-1, -1),
      uZoomA: { value: 1 }, uZoomB: { value: 1 }, uMix: { value: 0 }, uFlou: { value: 0 }, uFlouB: { value: 0 }, uTemps: { value: 0 }, uGrain: { value: 0.03 },
      uLueur: { value: 0 }, uObjet: { value: 0 }, uNoir: { value: 0 }, uChaud: { value: 0 }, uSur: { value: this.sur },
      uVieA: { value: 0 }, uVieB: { value: 0 },
      uBaie: { value: new THREE.Vector4(0, 0, 0, 0) },
    };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: this.u, depthTest: false }));
    this.scene.add(this.mesh);
    this.textures = new Map();
    this.taille();
  }

  /** Transforme une photo chargée (Image) en texture, une seule fois. */
  texture(img) {
    if (!this.textures.has(img)) {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
      this.textures.set(img, t);
    }
    return this.textures.get(img);
  }

  taille() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.u.uEcran.value.set(w, h);
  }

  /** Le balancement de la caméra, comme un drone qui tient sa position : lent, jamais répétitif. force : 0 → 1. */
  balancer(t, force = 1) {
    const sx = (Math.sin(t * 0.31) + 0.6 * Math.sin(t * 0.77 + 1.3) + 0.3 * Math.sin(t * 1.9 + 0.4)) * 0.0016 * force;
    const sy = (Math.sin(t * 0.27 + 2.1) + 0.6 * Math.sin(t * 0.69 + 0.2) + 0.3 * Math.sin(t * 1.7 + 2.6)) * 0.0013 * force;
    const r = (Math.sin(t * 0.23 + 0.7) + 0.5 * Math.sin(t * 0.61 + 2.2)) * 0.0014 * force;
    this.sway = [sx, sy]; this.rot = r;
    this.u.uSway.value.set(sx, sy); this.u.uRot.value.set(Math.cos(r), Math.sin(r));
  }

  /** Ce qu'on montre : la photo A (cadrage), la photo B (cadrage) et le mélange entre les deux. vie : voir VIE. */
  montrer(A, B, mix) {
    this.u.tA.value = this.texture(A.img); this.u.uImageA.value.set(A.img.naturalWidth, A.img.naturalHeight);
    this.u.uCentreA.value.set(A.centre[0], A.centre[1]); this.u.uZoomA.value = A.zoom; this.u.uVieA.value = A.vie || 0;
    if (B && mix > 0.001) {
      this.u.tB.value = this.texture(B.img); this.u.uImageB.value.set(B.img.naturalWidth, B.img.naturalHeight);
      this.u.uCentreB.value.set(B.centre[0], B.centre[1]); this.u.uZoomB.value = B.zoom; this.u.uVieB.value = B.vie || 0;
    }
    this.u.uMix.value = B ? mix : 0;
  }

  /** La part de la photo visible à l'écran (cadrage couverture). */
  part(img) {
    const ea = window.innerWidth / window.innerHeight, ia = img.naturalWidth / img.naturalHeight;
    return ea > ia ? [1, ia / ea] : [ea / ia, 1];
  }

  /** Centre de cadrage limité pour ne jamais montrer le bord de la photo (balancement compris). */
  borne(img, x, y, zoom) {
    const [px, py] = this.part(img);
    const mx = px / (2 * zoom * this.sur) + 0.004, my = py / (2 * zoom * this.sur) + 0.004;
    return [Math.min(1 - mx, Math.max(mx, x)), Math.min(1 - my, Math.max(my, y))];
  }

  /** Point de la photo A (x, y vers le haut) → position à l'écran, en pixels (balancement compris). */
  versEcran(img, centre, zoom, x, y) {
    const [px, py] = this.part(img), ea = window.innerWidth / window.innerHeight, z = zoom * this.sur;
    let qx = ((x - centre[0]) * z / px) * ea, qy = (y - centre[1]) * z / py;
    const c = Math.cos(-this.rot), s = Math.sin(-this.rot);
    [qx, qy] = [qx * c - qy * s, qx * s + qy * c];
    const ux = qx / ea + 0.5 - this.sway[0], uy = qy + 0.5 - this.sway[1];
    return [ux * window.innerWidth, (1 - uy) * window.innerHeight];
  }

  rendre(temps) {
    if (!this.u.tA.value) return;
    this.u.uTemps.value = temps;
    this.renderer.render(this.scene, this.camera);
  }
}
