// =============================================================================
// L'écran WebGL (Three.js) : une seule scène, un seul rectangle plein écran.
// Il affiche deux photos à la fois (A et B), chacune avec son propre cadrage :
//   - un zoom qui « plonge » vers un point de la photo (la caméra avance),
//   - un fondu de A vers B au moment où l'on passe d'une photo à la suivante,
//   - un flou de vitesse dirigé vers le centre pendant la plongée,
//   - un éclair chaud quand on traverse la fenêtre,
//   - la lueur qui pulse sur la fenêtre allumée, un halo sur l'objet survolé,
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
uniform vec2 uEcran, uImageA, uImageB, uCentreA, uCentreB, uObjetPos;
uniform float uZoomA, uZoomB, uMix, uFlou, uTemps, uGrain, uLueur, uObjet, uNoir, uChaud;
uniform vec4 uBaie;                       // gauche, bas, droite, haut (fractions de la photo A)

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// Où lire dans une photo : cadrage « couverture » (la photo remplit l'écran), zoom autour d'un centre.
vec2 cadre(vec2 uv, vec2 image, vec2 centre, float zoom) {
  float ea = uEcran.x / uEcran.y, ia = image.x / image.y;
  vec2 part = ea > ia ? vec2(1.0, ia / ea) : vec2(ea / ia, 1.0);
  return centre + (uv - 0.5) * part / zoom;
}

// Une photo lue avec un flou de vitesse : plusieurs échantillons glissés vers le centre de l'écran.
// Un petit décalage aléatoire par pixel évite les « traînées en escalier » du flou.
vec3 photo(sampler2D t, vec2 image, vec2 centre, float zoom) {
  vec2 p = cadre(vUv, image, centre, zoom);
  vec3 c = vec3(0.0);
  if (uFlou < 0.01) {
    c = texture2D(t, p).rgb;
  } else {
    float j = hash(vUv * uEcran + 0.37);
    for (int i = 0; i < 12; i++) {
      float k = (float(i) + j) / 12.0;
      c += texture2D(t, mix(p, centre, k * uFlou * 0.085)).rgb;
    }
    c /= 12.0;
  }
  return c;
}

void main() {
  vec3 a = photo(tA, uImageA, uCentreA, uZoomA);
  vec3 c = a;
  if (uMix > 0.001) c = mix(a, photo(tB, uImageB, uCentreB, uZoomB), uMix);

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
    const V2 = (x = 1, y = 1) => ({ value: new THREE.Vector2(x, y) });
    this.u = {
      tA: { value: null }, tB: { value: null },
      uEcran: V2(), uImageA: V2(16, 9), uImageB: V2(16, 9), uCentreA: V2(0.5, 0.5), uCentreB: V2(0.5, 0.5), uObjetPos: V2(-1, -1),
      uZoomA: { value: 1 }, uZoomB: { value: 1 }, uMix: { value: 0 }, uFlou: { value: 0 }, uTemps: { value: 0 }, uGrain: { value: 0.03 },
      uLueur: { value: 0 }, uObjet: { value: 0 }, uNoir: { value: 0 }, uChaud: { value: 0 },
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

  /** Ce qu'on montre : la photo A (cadrage), la photo B (cadrage) et le mélange entre les deux. */
  montrer(A, B, mix) {
    this.u.tA.value = this.texture(A.img); this.u.uImageA.value.set(A.img.naturalWidth, A.img.naturalHeight);
    this.u.uCentreA.value.set(A.centre[0], A.centre[1]); this.u.uZoomA.value = A.zoom;
    if (B && mix > 0.001) {
      this.u.tB.value = this.texture(B.img); this.u.uImageB.value.set(B.img.naturalWidth, B.img.naturalHeight);
      this.u.uCentreB.value.set(B.centre[0], B.centre[1]); this.u.uZoomB.value = B.zoom;
    }
    this.u.uMix.value = B ? mix : 0;
  }

  /** La part de la photo visible à l'écran (cadrage couverture). */
  part(img) {
    const ea = window.innerWidth / window.innerHeight, ia = img.naturalWidth / img.naturalHeight;
    return ea > ia ? [1, ia / ea] : [ea / ia, 1];
  }

  /** Centre de cadrage limité pour ne jamais montrer le bord de la photo. */
  borne(img, x, y, zoom) {
    const [px, py] = this.part(img);
    const mx = px / (2 * zoom), my = py / (2 * zoom);
    return [Math.min(1 - mx, Math.max(mx, x)), Math.min(1 - my, Math.max(my, y))];
  }

  /** Point de la photo A (x, y vers le haut) → position à l'écran, en pixels. */
  versEcran(img, centre, zoom, x, y) {
    const [px, py] = this.part(img);
    const sx = 0.5 + (x - centre[0]) * zoom / px, sy = 0.5 + (y - centre[1]) * zoom / py;
    return [sx * window.innerWidth, (1 - sy) * window.innerHeight];
  }

  rendre(temps) {
    if (!this.u.tA.value) return;
    this.u.uTemps.value = temps;
    this.renderer.render(this.scene, this.camera);
  }
}
