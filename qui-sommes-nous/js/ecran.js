// =============================================================================
// L'écran WebGL (Three.js) : une seule scène, un seul rectangle plein écran.
// Il affiche les images du film (en fondu entre deux images pour un défilement
// très doux), cadrées comme une photo « couverture », avec :
//   - la lueur chaude qui pulse sur la baie allumée,
//   - un halo sur l'objet survolé dans le studio,
//   - un zoom/recadrage doux vers un objet (chapitres),
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
uniform float uMix, uTemps, uZoom, uGrain, uLueur, uObjet, uNoir, uVapeur;
uniform vec2 uEcran, uImage, uCentre, uObjetPos, uTasse;
uniform vec4 uBaie;                       // gauche, bas, droite, haut (fractions de l'image)

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bruit(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }

void main() {
  // cadrage « couverture » + zoom autour d'un centre (en fractions de l'image)
  float ea = uEcran.x / uEcran.y, ia = uImage.x / uImage.y;
  vec2 part = ea > ia ? vec2(1.0, ia / ea) : vec2(ea / ia, 1.0);
  vec2 p = uCentre + (vUv - 0.5) * part / uZoom;
  vec3 c = mix(texture2D(tA, p).rgb, texture2D(tB, p).rgb, uMix);

  // lueur chaude autour de la baie (rectangle adouci), qui pulse doucement
  vec2 bc = vec2(uBaie.x + uBaie.z, uBaie.y + uBaie.w) * 0.5, bt = vec2(uBaie.z - uBaie.x, uBaie.w - uBaie.y) * 0.5;
  vec2 d = max(abs(p - bc) - bt, 0.0) / (bt.y * 1.6);
  float halo = exp(-dot(d, d) * 2.2);
  float pouls = 0.75 + 0.25 * sin(uTemps * 2.4);
  c += vec3(1.0, 0.62, 0.28) * halo * uLueur * pouls * 0.55;
  vec2 inside = step(abs(p - bc), bt);
  c *= 1.0 + inside.x * inside.y * uLueur * pouls * 0.35;

  // halo sur l'objet survolé
  vec2 o = (p - uObjetPos) * vec2(ia, 1.0);
  c += vec3(1.0, 0.85, 0.6) * exp(-dot(o, o) * 90.0) * uObjet * 0.45;

  // vapeur du café : un filet qui monte et ondule au-dessus de la tasse
  vec2 q = (p - uTasse) * vec2(ia, 1.0) * 110.0;
  if (uVapeur > 0.0 && q.y > 0.0 && q.y < 9.0) {
    float x = q.x + sin(q.y * 0.7 - uTemps * 1.3) * 0.6 * (q.y / 9.0);
    float fil = exp(-x * x * 0.9) * smoothstep(0.0, 1.5, q.y) * (1.0 - q.y / 9.0);
    fil *= bruit(vec2(x * 1.5, q.y * 0.9 - uTemps * 1.6));
    c += vec3(0.9) * fil * 0.16 * uVapeur;
  }

  // vignettage et grain
  vec2 v = vUv - 0.5;
  c *= 1.0 - dot(v, v) * 0.55;
  c += (hash(vUv * uEcran + fract(uTemps * 7.13)) - 0.5) * uGrain;
  c *= 1.0 - uNoir;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Ecran {
  constructor(canvas, image) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // les images sont déjà « finies » (pas de conversion)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tex = () => { const t = new THREE.Texture(); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
    this.tA = tex(); this.tB = tex();
    this.u = {
      tA: { value: this.tA }, tB: { value: this.tB }, uMix: { value: 0 }, uTemps: { value: 0 }, uZoom: { value: 1 }, uGrain: { value: 0.035 },
      uLueur: { value: 0 }, uObjet: { value: 0 }, uNoir: { value: 0 }, uVapeur: { value: 0 }, uTasse: { value: new THREE.Vector2(-1, -1) },
      uEcran: { value: new THREE.Vector2(1, 1) }, uImage: { value: new THREE.Vector2(image.largeur, image.hauteur) },
      uCentre: { value: new THREE.Vector2(0.5, 0.5) }, uObjetPos: { value: new THREE.Vector2(-1, -1) }, uBaie: { value: new THREE.Vector4(0, 0, 0, 0) },
    };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: this.u, depthTest: false }));
    this.scene.add(this.mesh);
    this.imgA = null; this.imgB = null;
    this.taille();
  }

  /** Adapte l'écran à la fenêtre du navigateur. */
  taille() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.u.uEcran.value.set(w, h);
  }

  /** Les deux images à mélanger (t = 0 : seulement A, t = 1 : seulement B). */
  images(A, B, t) {
    if (A && A !== this.imgA) { this.tA.image = A; this.tA.needsUpdate = true; this.imgA = A; }
    if (B && B !== this.imgB) { this.tB.image = B; this.tB.needsUpdate = true; this.imgB = B; }
    this.u.uMix.value = A === B ? 0 : t;
  }

  /** La part de l'image visible à l'écran (cadrage couverture), pour placer les boutons au bon endroit. */
  part() {
    const ea = this.u.uEcran.value.x / this.u.uEcran.value.y, ia = this.u.uImage.value.x / this.u.uImage.value.y;
    return ea > ia ? [1, ia / ea] : [ea / ia, 1];
  }

  /** Point de l'image (x, y vers le haut) → position à l'écran en pixels. */
  versEcran(x, y) {
    const [px, py] = this.part(), z = this.u.uZoom.value, c = this.u.uCentre.value;
    const sx = 0.5 + (x - c.x) * z / px, sy = 0.5 + (y - c.y) * z / py;
    return [sx * window.innerWidth, (1 - sy) * window.innerHeight];
  }

  /** Centre de cadrage limité pour ne jamais montrer le bord de l'image. */
  centre(x, y, zoom) {
    const [px, py] = this.part();
    const mx = px / (2 * zoom), my = py / (2 * zoom);
    return [Math.min(1 - mx, Math.max(mx, x)), Math.min(1 - my, Math.max(my, y))];
  }

  rendre(temps) {
    this.u.uTemps.value = temps;
    this.renderer.render(this.scene, this.camera);
  }
}
