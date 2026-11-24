/* ==========================================================================
   « Mettez le désordre. On remet de l'ordre. » (accueil, après « En ligne en 21 jours »)
   Une sphère de nos identités visuelles, au milieu, sur un fond noir où ondule une nappe de lumière (comme un drap
   de soie éclairé de côté, avec un grain de film).
   - Les vignettes : les logos de 24 marques fictives (un symbole dessiné, un nom dans sa typographie, sur sa couleur :
     _msdesign-src/perf/identites/logos.html), chacun trois fois. Ce sont de petites plaques épaisses aux coins
     arrondis, courbées sur la sphère, avec l'image des deux côtés : la sphère est ajourée, on voit à l'intérieur les
     vignettes de l'autre côté. Rangées rangée par rangée.
   - Le voile : le bleu de la bande du dessus continue sur la section, puis se défait en points qui rapetissent.
   - Au départ, les vignettes flottent en désordre ; quand le doigt (la main en lignes de balayage bleues) touche,
     elles se rangent en sphère, d'abord autour du doigt.
   - La sphère tourne seule ; on la fait tourner à la souris ou au doigt (avec de l'élan) ; la vignette survolée
     s'avance et s'éclaire. La surface ondule doucement.
   - Un clic sur une vignette : la sphère ralentit et s'assombrit, et le logo apparaît en grand au milieu, dessiné par
     des points qui grandissent depuis son centre (comme le voile de points bleus). Un clic (ou Échap) : les points
     rapetissent, le logo s'efface.
   Les logos sont des images (public/assets/img/identites/logo-*, faites par _msdesign-src/perf/identites/logos.mjs).
   Three.js ; une seule toile. jouer() : la séquence ; montrer() : directement rangée ; recouvrir() : retour au bleu.
   ========================================================================== */
import * as THREE from 'three';

const BLEU = [21 / 255, 94 / 255, 239 / 255];        // --blue, le même bleu que la bande du dessus
const COPIES = 3;                                     // chaque logo apparaît trois fois sur la sphère

const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const entre = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const sortie = (t) => 1 - Math.pow(1 - t, 3);
// un hasard qui donne toujours les mêmes valeurs
const hasard = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// un halo rond (lueur), dessiné une fois
function texHalo(couleur) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), d = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  d.addColorStop(0, couleur); d.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = d; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// une vignette : une plaque épaisse (w × h × ep) aux coins arrondis : une face avant et une face arrière quadrillées
// (pour pouvoir se courber ; les coins sont découpés dans le shader) et une tranche qui suit l'arrondi.
// aFace : 1 l'avant, -1 l'arrière (l'image en miroir : elle se lit correctement depuis l'intérieur de la sphère), 0 la tranche.
function plaque(w, h, ep, r) {
  const pos = [], uv = [], face = [], idx = [];
  const grille = (z, signe) => {
    const n = 10, base = pos.length / 3;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const u = i / n, v = j / n;
      pos.push((u - 0.5) * w, (v - 0.5) * h, z);
      uv.push(signe > 0 ? u : 1 - u, v);
      face.push(signe);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = base + j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      if (signe > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
    }
  };
  grille(ep / 2, 1);
  grille(-ep / 2, -1);
  // la tranche : le contour arrondi (coins en 6 pas, côtés en 8), du dos à l'avant
  const contour = [];
  const coin = (cx, cy, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * (Math.PI / 2); contour.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  const cote = (x0, y0, x1, y1) => { for (let k = 1; k < 8; k++) contour.push([x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8]); };
  const X = w / 2 - r, Y = h / 2 - r;
  coin(X, -Y, -Math.PI / 2); cote(w / 2, -Y, w / 2, Y);
  coin(X, Y, 0); cote(X, h / 2, -X, h / 2);
  coin(-X, Y, Math.PI / 2); cote(-w / 2, Y, -w / 2, -Y);
  coin(-X, -Y, Math.PI); cote(-X, -h / 2, X, -h / 2);
  const base = pos.length / 3;
  for (const [x, y] of contour) { pos.push(x, y, -ep / 2, x, y, ep / 2); uv.push(0, 0, 0, 0); face.push(0, 0); }
  const n = contour.length;
  for (let k = 0; k < n; k++) {
    const a = base + 2 * k, b = base + 2 * ((k + 1) % n);
    idx.push(a, b, b + 1, a, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
const VS_TUILE = `
  attribute float aFace;
  uniform vec3 uCentre;
  uniform float uR, uBend, uEch;
  varying vec2 vUv;
  varying float vFace;
  varying vec3 vRad;
  varying vec3 vMonde;
  void main() {
    vUv = uv;
    vFace = aFace;
    vec4 base = modelMatrix * vec4(position.xy, 0.0, 1.0);
    vec4 m = modelMatrix * vec4(position, 1.0);
    vec3 d = normalize(base.xyz - uCentre);
    // courbée sur la sphère, en gardant son épaisseur
    m.xyz = mix(m.xyz, uCentre + d * (uR + position.z * uEch), uBend);
    vRad = normalize(mix(normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0)), d, uBend));
    vMonde = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }`;
const FS_TUILE = `
  uniform sampler2D uMap, uMap2;
  uniform vec4 uRect, uRect2;
  uniform vec2 uTaille;
  uniform float uCoin, uSombre, uLueur, uFondu, uPoints, uMaille;
  uniform vec3 uBord;
  varying vec2 vUv;
  varying float vFace;
  varying vec3 vRad;
  varying vec3 vMonde;
  void main() {
    vec3 v = normalize(cameraPosition - vMonde), c;
    if (abs(vFace) > 0.5) {
      vec2 q = (vUv - 0.5) * uTaille;
      vec2 b = uTaille * 0.5 - vec2(uCoin);
      float sd = length(max(abs(q) - b, 0.0)) - uCoin;
      if (sd > 0.0) discard;                                // les coins arrondis
      if (uPoints < 0.999) {                                // apparaît par des points qui grandissent depuis le centre
        vec2 pp = vUv * uTaille, cel = floor(pp / uMaille), ctr = (cel + 0.5) * uMaille;
        float dist = length(ctr / uTaille - 0.5) * 1.42;
        float kk = clamp(uPoints * 1.7 - dist * 0.7, 0.0, 1.0);
        kk = kk * kk * (3.0 - 2.0 * kk);
        if (length(pp - ctr) > uMaille * 0.74 * kk) discard;
      }
      vec3 n = vRad * sign(vFace);
      vec3 img = texture2D(uMap, mix(uRect.xy, uRect.zw, vUv)).rgb;
      if (uFondu > 0.0) img = mix(img, texture2D(uMap2, mix(uRect2.xy, uRect2.zw, vUv)).rgb, uFondu);
      float l = 0.55 + 0.45 * max(dot(n, v), 0.0);
      float reflet = pow(max(dot(reflect(-v, n), normalize(vec3(-0.35, 0.75, 0.55))), 0.0), 30.0);
      c = img * l + reflet * 0.18;
      if (vFace < 0.0) c *= 0.78;                            // l'intérieur de la sphère, un peu dans l'ombre
      c += uLueur * vec3(0.18, 0.36, 1.0) * (1.0 - smoothstep(0.0, uCoin, -sd)) * 0.9;
    } else {
      if (uPoints < 0.999) discard;
      vec3 n = normalize(cross(dFdx(vMonde), dFdy(vMonde)));
      c = uBord * (0.45 + 0.55 * abs(dot(n, v)));            // la tranche, claire
    }
    c *= 1.0 - uSombre;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

// le fond : une nappe de lumière qui ondule en travers de l'écran, comme un drap de soie éclairé de côté
// (dessinée en demi-résolution), puis un grain de film et un vignettage, à pleine résolution
const FS_SOIE = `
  uniform vec2 uRes;
  uniform float uT;
  varying vec2 vUv;
  float nappe(vec2 p, float t, float decal, float ampl, float larg) {
    float x = p.x;
    float yc = decal + ampl * (0.55 * sin(x * 1.25 + t * 0.9) + 0.3 * sin(x * 2.6 - t * 1.25 + 1.7) + 0.15 * sin(x * 4.1 + t * 0.6));
    float w = larg * (1.0 + 0.55 * sin(x * 1.05 - t * 0.7 + 0.5) + 0.25 * sin(x * 3.1 + t));
    float s = (p.y - yc) / max(w, 0.015);
    if (abs(s) > 1.8) return 0.0;
    float corps = exp(-s * s * 1.5);                                   // la lumière dans l'épaisseur
    float pli = 0.5 + 0.5 * cos(s * 3.0 + x * 2.2 - t * 1.1);          // les plis
    float fils = 0.86 + 0.14 * sin(s * 70.0 + x * 9.0 + t * 0.4);      // la trame fine
    float bord = exp(-pow((abs(s) - 0.95) * 8.0, 2.0));                // le bord, plus vif
    float face = 0.5 + 0.5 * sin(x * 1.7 - t * 0.8);                  // la face éclairée, la face à l'ombre
    return corps * pli * fils * mix(0.3, 1.0, face) + bord * face * 0.55;
  }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float t = uT * 0.32;
    float a = nappe(p, t, 0.06, 0.2, 0.15) + 0.5 * nappe(p * vec2(0.82, 1.1) + vec2(0.4, 0.02), t * 0.8 + 2.0, -0.04, 0.17, 0.11);
    float lointain = 0.25 * nappe(p * vec2(0.6, 0.9) + vec2(-0.6, 0.0), t * 0.6 + 5.0, 0.12, 0.25, 0.22);
    vec3 fond = mix(vec3(0.012, 0.016, 0.03), vec3(0.03, 0.038, 0.065), 1.0 - clamp(length(p) * 0.9, 0.0, 1.0));
    vec3 c = fond + vec3(0.86, 0.9, 1.0) * (a * 0.82 + lointain);
    gl_FragColor = vec4(c, 1.0);
  }`;
const FS_GRAIN = `
  uniform sampler2D uSoie;
  uniform vec2 uRes;
  uniform float uT;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 c = texture2D(uSoie, vUv).rgb;
    c += (h(floor(gl_FragCoord.xy) + fract(uT * 7.3) * 91.7) - 0.5) * 0.055;   // le grain
    vec2 p = vUv - 0.5;
    c *= 1.0 - dot(p, p) * 0.55;                                               // le vignettage
    gl_FragColor = vec4(c, 1.0);
  }`;
const VS_PLEIN = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }';

export function createSphere(toile, opts = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x05070d, 1);
  renderer.autoClear = false;
  const reduit = !!opts.reduced;
  const marques = opts.marques && opts.marques.length ? opts.marques : [];

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
  camera.position.set(0, 0, 10);

  /* ---------- le fond : la soie (demi-résolution) et le grain ---------- */
  const fondCible = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType });
  const fondScene = new THREE.Scene(), grainScene = new THREE.Scene();
  const ortho2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const soie = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 } }, vertexShader: VS_PLEIN, fragmentShader: FS_SOIE, depthTest: false, depthWrite: false }));
  soie.frustumCulled = false; fondScene.add(soie);
  const grain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { uSoie: { value: fondCible.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 } }, vertexShader: VS_PLEIN, fragmentShader: FS_GRAIN, depthTest: false, depthWrite: false }));
  grain.frustumCulled = false; grainScene.add(grain);

  /* ---------- les vignettes ---------- */
  const chargeur = new THREE.TextureLoader();
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const texture = (src, fin) => {
    const t = chargeur.load(src, () => { if (fin) fin(t); dessiner(); });
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    return t;
  };
  const logos = marques.map((m) => texture(m.petite));
  const grandes = marques.map(() => null);
  const BORD = new THREE.Color('#e9ecf2');
  const matiere = (tex, rect) => new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex }, uRect: { value: new THREE.Vector4(...rect) }, uMap2: { value: tex }, uRect2: { value: new THREE.Vector4(...rect) }, uFondu: { value: 0 },
      uTaille: { value: new THREE.Vector2(1, 1) }, uCoin: { value: 0.05 }, uSombre: { value: 0 }, uLueur: { value: 0 }, uBord: { value: BORD },
      uCentre: { value: new THREE.Vector3() }, uR: { value: 1 }, uBend: { value: 1 }, uEch: { value: 1 }, uPoints: { value: 1 }, uMaille: { value: 0.05 },
    },
    vertexShader: VS_TUILE, fragmentShader: FS_TUILE, side: THREE.DoubleSide,
  });
  const CONTACT = new THREE.Vector3(1, 0.12, 0.25).normalize();       // là où le doigt touche la sphère
  const tmp = new THREE.Object3D();
  const tuiles = [];
  for (let k = 0; k < COPIES; k++) marques.forEach((m, b) => {
    const i = tuiles.length;
    const hh = (n) => hasard(i * 5.31 + n);
    const dir = new THREE.Vector3(hh(1) - 0.5, (hh(2) - 0.5) * 0.8, hh(3) - 0.5).normalize();
    tuiles.push({
      mesh: null, b, k, i, tex: logos[b], rect: [0, 0, 1, 1], format: 4 / 3,
      p: new THREE.Vector3(), q: new THREE.Quaternion(), w: 0.3, h: 0.3, r: 1 + (hh(8) - 0.5) * 0.035,   // sa place (plus bas)
      cp: dir.multiplyScalar(1.35 + hh(4) * 0.95), cq: new THREE.Quaternion().setFromEuler(new THREE.Euler((hh(5) - 0.5) * 2.2, (hh(6) - 0.5) * 3, (hh(7) - 0.5) * 1.6)),
      seuil: 0.3, pop: 0,
    });
  });
  // sur la sphère (rayon 1), rangée par rangée : dans une rangée, toutes les vignettes ont la même hauteur et l'écart
  // se répartit ; les marques sont mêlées. La sphère est ajourée : les vignettes en couvrent un peu plus de la moitié,
  // de vrais espaces entre les rangées laissent voir l'intérieur.
  {
    const ECART = 0.05, POLE = 1.3, COUVERT = 0.66;
    // mélangées ; les trois copies d'un même logo, réparties loin les unes des autres (un tiers de tour d'écart dans l'ordre)
    const toutes = [...tuiles].sort((a, c) => ((a.b * 0.618 + a.k / COPIES) % 1) - ((c.b * 0.618 + c.k / COPIES) % 1));
    const somme = toutes.reduce((a, t) => a + t.format, 0);
    let HT = Math.sqrt((4 * Math.PI * COUVERT) / somme);
    const nR = Math.max(5, Math.round((2 * POLE) / (HT * 1.3)) + 1);
    const RANGS = Array.from({ length: nR }, (_, r) => -POLE + (r * 2 * POLE) / (nR - 1));
    HT = Math.min(HT, ((2 * POLE) / (nR - 1)) * 0.8);
    const caps = RANGS.map((f) => 2 * Math.PI * Math.cos(f));
    const capTot = caps.reduce((a, c) => a + c, 0);
    let rempli = (HT * somme + toutes.length * ECART) / capTot;
    if (rempli > 0.96) { HT *= (0.96 * capTot - toutes.length * ECART) / (HT * somme); rempli = 0.96; }
    const larg = (t) => HT * t.format;
    const ordreRangs = [...RANGS.keys()].sort((a, c) => Math.abs(a - (nR - 1) / 2) - Math.abs(c - (nR - 1) / 2) || a - c);
    const rangs = RANGS.map(() => []), pris = RANGS.map(() => 0);
    let n = 0;
    for (const ri of ordreRangs) {                          // de l'équateur vers les pôles
      while (n < toutes.length && (rangs[ri].length === 0 || pris[ri] + larg(toutes[n]) + ECART <= caps[ri] * rempli * 1.03)) {
        rangs[ri].push(toutes[n]); pris[ri] += larg(toutes[n]) + ECART; n++;
      }
    }
    while (n < toutes.length) {
      const ri = caps.map((c, r) => c - pris[r]).reduce((m, v, r, a) => (v > a[m] ? r : m), 0);
      rangs[ri].push(toutes[n]); pris[ri] += larg(toutes[n]) + ECART; n++;
    }
    RANGS.forEach((f, ri) => {
      const rang = rangs[ri];
      const utile = rang.reduce((a, t) => a + larg(t), 0);
      const serre = Math.min(1, (caps[ri] - rang.length * ECART) / utile);
      const jeu = (caps[ri] - utile * serre) / Math.max(1, rang.length);
      let x = hasard(ri * 9.1) * caps[ri];
      for (const t of rang) {
        const w = larg(t) * serre, a = (x + w / 2) / Math.cos(f);
        t.p.set(Math.cos(f) * Math.cos(a), Math.sin(f), Math.cos(f) * Math.sin(a));
        tmp.position.copy(t.p); tmp.lookAt(t.p.clone().multiplyScalar(2));
        t.q.copy(tmp.quaternion);
        t.w = w; t.h = w / t.format;
        t.seuil = 0.42 * (1 - t.p.distanceTo(CONTACT) / 2);
        x += w + jeu;
      }
    });
    // chaque vignette devient une plaque à ses mesures (rayon 1) : épaisse, coins arrondis
    for (const t of tuiles) {
      const coin = Math.min(t.w, t.h) * 0.075;
      t.mesh = new THREE.Mesh(plaque(t.w, t.h, HT * 0.065, coin), matiere(t.tex, t.rect));
      t.mesh.material.uniforms.uTaille.value.set(t.w, t.h);
      t.mesh.material.uniforms.uCoin.value = coin;
      t.mesh.userData.i = t.i;
      t.mesh.frustumCulled = false;
      scene.add(t.mesh);
    }
  }
  const maillages = tuiles.map((t) => t.mesh);

  // la planche ouverte : une grande carte (la planche entière de la marque), qui part de la vignette cliquée
  const matCarte = matiere(logos[0] || null, [0, 0, 1, 1]);
  const carte = new THREE.Mesh(plaque(4 / 3, 1, 0.022, 0.06), matCarte);
  carte.visible = false; carte.frustumCulled = false; carte.renderOrder = 2;
  scene.add(carte);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo('rgba(70, 120, 255, 0.55)'), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  aura.renderOrder = 1;
  scene.add(aura);
  // la lueur au point de contact
  const lueur = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo('rgba(140, 180, 255, 1)'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scene.add(lueur);

  /* ---------- la main en lignes de balayage, et le voile de points (en pixels, par-dessus) ---------- */
  const plan = new THREE.Scene(), dessus = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  let pretMain = false;
  const texMain = new THREE.TextureLoader().load(opts.main, () => { pretMain = true; dessiner(); });
  texMain.colorSpace = THREE.NoColorSpace;
  texMain.minFilter = THREE.LinearMipmapLinearFilter; texMain.anisotropy = 4;
  const main = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTex: { value: texMain }, uN: { value: 120 }, uOrdre: { value: 0 }, uSouris: { value: new THREE.Vector2(-9, -9) }, uTrouble: { value: 0 }, uT: { value: 0 }, uBleu: { value: new THREE.Vector3(...BLEU) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uTex; uniform float uN, uOrdre, uTrouble, uT; uniform vec2 uSouris; uniform vec3 uBleu;
      varying vec2 vUv;
      float h1(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
      void main() {
        float v = 1.0 - vUv.y;                                   // 0 en haut de l'image
        float li = floor(v * uN);
        float r1 = h1(li), r2 = h1(li + 71.3);
        // chaque ligne arrive de la droite à son rythme, puis se cale
        float o = clamp((uOrdre - r1 * 0.45) / 0.55, 0.0, 1.0);
        o = 1.0 - pow(1.0 - o, 3.0);
        float dec = (1.0 - o) * (0.12 + 0.55 * r2);
        // la souris : les lignes autour d'elle tressaillent
        float dy = (v - uSouris.y) * uN;
        dec += uTrouble * exp(-dy * dy / 40.0) * exp(-pow((vUv.x - uSouris.x) * 4.0, 2.0)) * (r2 - 0.5) * 0.07 * (0.6 + 0.4 * sin(uT * 30.0 + li));
        vec2 st = vec2(vUv.x - dec, 1.0 - (li + 0.5) / uN);
        vec4 c = (st.x < 0.0 || st.x > 1.0) ? vec4(0.0) : texture2D(uTex, st);
        float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        // plus épaisse dans les ombres, très fine dans la lumière (la peau de la photo est entre 0,3 et 0,5)
        float l = clamp((lum - 0.28) / 0.57, 0.0, 1.0);
        float w = c.a * mix(0.64, 0.07, pow(l, 0.7));
        float d = abs(fract(v * uN) - 0.5);
        float px = fwidth(v * uN);
        float a = (1.0 - smoothstep(w * 0.5 - px * 0.6, w * 0.5 + px * 0.6, d)) * step(0.04, c.a);
        a *= 1.0 - smoothstep(0.8, 1.0, vUv.x);                  // le bras se perd vers la droite
        a *= 0.35 + 0.65 * o;
        gl_FragColor = vec4(uBleu, a);
      }`,
  }));
  plan.add(main);
  main.material.uniforms.uBleu.value.set(0.33, 0.52, 1.0);     // sur le noir, un bleu un peu plus lumineux
  const voile = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uVoile: { value: 0 }, uCentre: { value: new THREE.Vector2() }, uDiag: { value: 1 }, uMaille: { value: 16 }, uBleu: { value: new THREE.Vector3(...BLEU) } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }',
    fragmentShader: `
      uniform float uVoile, uDiag, uMaille; uniform vec2 uCentre; uniform vec3 uBleu;
      void main() {
        vec2 p = gl_FragCoord.xy, cel = floor(p / uMaille), ctr = (cel + 0.5) * uMaille;
        float dist = length(ctr - uCentre) / uDiag;              // 0 sur la planche, ~1 dans le coin le plus loin
        float k = clamp(uVoile * 1.6 - dist * 1.15, 0.0, 1.0);
        k = k * k * (3.0 - 2.0 * k);
        float r = uMaille * 0.72 * (1.0 - k);                    // 0,72 maille : les points se touchent, tout est bleu
        float a = 1.0 - smoothstep(r - 0.8, r + 0.8, length(p - ctr));
        if (a < 0.003) discard;
        gl_FragColor = vec4(uBleu, a);
      }`,
  }));
  voile.frustumCulled = false;
  dessus.add(voile);

  /* ---------- la mise en page ---------- */
  let W = 1, H = 1, dpr = 1, portrait = false, mainPos = { x: 0, y: 0, l: 1, h: 1 };
  const centre = new THREE.Vector3(), contact = new THREE.Vector3();
  let R = 1, tVue = 1;                                     // le rayon de la sphère ; la demi-hauteur visible à z = 0
  const MAIN_DOIGT = [0.245, 0.5];                        // le bout de l'index, dans l'image de la main (2720 × 1536)
  const ecran = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (0.5 - p.y * 0.5) * H]; };
  let cSphere = [0, 0], rSphere = 1;                       // la sphère à l'écran (pour la souris et le voile)
  const placerEcran = () => {
    const [cx, cy] = ecran(cs);
    const bord = ecran(cs.clone().add(new THREE.Vector3(Rc, 0, 0)));
    cSphere = [cx, cy]; rSphere = Math.abs(bord[0] - cx);
    const [sx, sy] = ecran(contact);
    mainPos.x = sx + 3 - mainPos.l * MAIN_DOIGT[0];
    mainPos.y = sy - mainPos.h * MAIN_DOIGT[1];
    voile.material.uniforms.uCentre.value.set(cx * dpr, (H - cy) * dpr);
    lueur.position.copy(contact);
  };
  const taille = () => {
    const b = toile.getBoundingClientRect();
    W = Math.max(1, b.width); H = Math.max(1, b.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (W * dpr > 3400) dpr = 3400 / W;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    fondCible.setSize(Math.round(W * dpr * 0.5), Math.round(H * dpr * 0.5));
    soie.material.uniforms.uRes.value.set(W, H);
    grain.material.uniforms.uRes.value.set(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();                            // avant de projeter des points (sinon : NaN)
    ortho.left = 0; ortho.right = W; ortho.top = H; ortho.bottom = 0; ortho.updateProjectionMatrix();
    // la sphère : au milieu, sous le titre ; énorme
    portrait = W / H < 0.9;
    tVue = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    centre.set(0, (1 - (portrait ? 0.58 : 0.612) * 2) * tVue, 0);
    R = Math.min((portrait ? 0.3 : 0.378) * 2 * tVue, (portrait ? 0.46 : 0.38) * 2 * tVue * camera.aspect);
    lueur.scale.setScalar(R * 0.75);
    voile.material.uniforms.uDiag.value = Math.hypot(W, H) * dpr;
    voile.material.uniforms.uMaille.value = Math.round((portrait ? 13 : 16) * dpr);
    poser();
    const [sx] = ecran(contact);
    const l = portrait ? W * 1.0 : Math.max(W * 0.6, (W - sx) / (1 - MAIN_DOIGT[0]) * 1.05);
    mainPos.l = l; mainPos.h = l * (1536 / 2720);
    main.material.uniforms.uN.value = Math.round(mainPos.h / (portrait ? 3.6 : 4.2));
    dessiner();
  };

  /* ---------- le temps ---------- */
  let visible = false, boucle = 0, dernier = 0, temps = 0, t0 = 0;
  let etat = 'bleu';                                      // 'bleu' (recouvert), 'joue', 'ordre'
  let D = 1, vD = 0, ordreMain = 0, voileV = 0, glisse = 1, touche = false, tLueur = -9;
  const souris = { x: -9999, y: -9999, f: 0, trouble: 0 };
  const cam = { x: 0, y: 0 };
  let lacet = 0.6, tangage = 0.1, vLacet = 0, appui = null, aGlisse = false, survol = -1;
  // la plongée : quelle vignette est ouverte (-1 : aucune), où en est la plongée (z) et l'envol de la carte (k)
  let choisie = -1, ouvert = false, z = 0, k = 0;
  const onContact = opts.onContact || (() => {});
  const onOuvre = opts.onOuvre || (() => {});
  const cs = new THREE.Vector3(), qs = new THREE.Quaternion(), eul = new THREE.Euler();
  let Rc = 1;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qx = new THREE.Quaternion();
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();

  // la pose de chaque vignette : entre sa place sur la sphère et son désordre ; puis la carte ouverte
  function poser() {
    const ez = z * z * (3 - 2 * z);
    cs.copy(centre);
    Rc = R * (1 - 0.08 * ez);
    qs.setFromEuler(eul.set(tangage, lacet, 0, 'YXZ'));
    for (const t of tuiles) {
      const u = t.mesh.material.uniforms;
      const d = Math.min(1, Math.max(0, (D - t.seuil) / (1 - 0.42)));
      const ec = d * d * (3 - 2 * d);
      // sur la sphère : la surface ondule doucement, une vague part de la vignette cliquée, la survolée s'avance
      let onde = 0.012 * Math.sin(t.p.y * 7 - temps * 1.5) * (1 - ez) + 0.07 * t.pop;
      const rr = Rc * (t.r + onde);
      v1.copy(t.p).applyQuaternion(qs).multiplyScalar(rr).add(cs);
      q1.copy(qs).multiply(t.q);
      let ech = Rc, bend = 1;
      // en désordre : autour de la sphère, à plat, avec un léger flottement
      if (ec > 0) {
        v2.copy(t.cp).multiplyScalar(R).add(centre);
        v2.y += Math.sin(temps * 0.9 + t.cp.x * 4) * 0.05 * R;
        v1.lerp(v2, ec);
        qx.setFromEuler(eul.set(0, temps * 0.25 * (t.cp.z > 0 ? 1 : -1), 0));
        q2.copy(t.cq).multiply(qx);
        q1.slerp(q2, ec);
        ech = R * 0.9 * ec + Rc * (1 - ec);
        bend = 1 - ec;
      }
      t.mesh.position.copy(v1);
      t.mesh.quaternion.copy(q1);
      t.mesh.scale.setScalar(ech);
      u.uEch.value = ech;
      u.uCentre.value.copy(cs);
      u.uR.value = rr;
      u.uBend.value = bend;
      u.uSombre.value = 0.62 * ez;
      u.uLueur.value = t.pop;
    }
    // la carte : le logo en grand, au milieu, devant la sphère ; il apparaît par des points
    if (choisie >= 0 && k > 0.001) {
      const t = tuiles[choisie], uc = carte.material.uniforms;
      const zc = R * 1.25, tv = Math.tan((camera.fov * Math.PI) / 360) * (10 - zc);
      const lc = Math.min((portrait ? 0.86 : 0.5) * 2 * tv * camera.aspect, (portrait ? 0.42 : 0.62) * 2 * tv * (4 / 3)), hc = lc / (4 / 3);
      carte.position.set(camera.position.x, camera.position.y - 0.02 * tv, zc);
      carte.quaternion.identity();
      carte.scale.set(lc / (4 / 3), hc, hc);
      uc.uTaille.value.set(4 / 3, 1);
      uc.uCoin.value = 0.045;
      uc.uMaille.value = (4 / 3) / (portrait ? 26 : 38);
      uc.uPoints.value = k;
      uc.uEch.value = hc;
      uc.uMap.value = t.tex; uc.uRect.value.set(...t.rect);
      uc.uMap2.value = grandes[t.b] || t.tex; uc.uRect2.value.set(0, 0, 1, 1);
      uc.uFondu.value = grandes[t.b] && grandes[t.b].image ? 1 : 0;
      uc.uCentre.value.copy(cs); uc.uR.value = Rc; uc.uBend.value = 0;
      carte.visible = true;
      aura.visible = true;
      aura.position.set(carte.position.x, carte.position.y, carte.position.z - 0.05);
      aura.scale.set(lc * 1.5, hc * 1.8, 1);
      aura.material.opacity = 0.55 * lisse(0.3, 1, k);
    } else { carte.visible = false; aura.visible = false; }
    // le doigt touche la sphère sur son côté droit
    contact.copy(CONTACT).multiplyScalar(Rc * 1.02).add(cs);
    camera.updateMatrixWorld();
    placerEcran();
  }

  function dessiner() {
    camera.position.set(cam.x + Math.sin(temps * 0.21) * 0.08, cam.y + Math.sin(temps * 0.17) * 0.04, 10);
    camera.lookAt(cam.x * 0.3, cam.y * 0.3, 0);
    camera.updateMatrixWorld();
    poser();
    const tl = temps - tLueur;
    lueur.material.opacity = tl >= 0 && tl < 1.2 ? Math.sin(Math.PI * tl / 1.2) * 0.9 : 0;
    // la main (elle s'efface quand on plonge dans la sphère)
    const u = main.material.uniforms;
    u.uOrdre.value = ordreMain; u.uT.value = temps; u.uTrouble.value = souris.trouble;
    const gx = (glisse + z * 0.6) * W * 0.16;
    main.scale.set(mainPos.l, mainPos.h, 1);
    main.position.set(mainPos.x + mainPos.l / 2 + gx, H - (mainPos.y + mainPos.h / 2) + Math.sin(temps * 0.7) * 3, 0);
    u.uSouris.value.set((souris.x - mainPos.x - gx) / mainPos.l, (souris.y - mainPos.y) / mainPos.h);
    main.visible = pretMain && z < 0.7;
    voile.material.uniforms.uVoile.value = voileV;
    voile.visible = voileV < 1.3;
    soie.material.uniforms.uT.value = temps;
    grain.material.uniforms.uT.value = temps;
    renderer.setRenderTarget(fondCible);
    renderer.render(fondScene, ortho2);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(grainScene, ortho2);
    renderer.render(plan, ortho);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.render(dessus, ortho);
  }

  // la vignette sous la souris (seulement sur la sphère rangée, hors plongée)
  const viser = (x, y) => {
    if (etat !== 'ordre' || z > 0.05) return -1;
    ndc.set((x / W) * 2 - 1, 1 - (y / H) * 2);
    raycaster.setFromCamera(ndc, camera);
    for (const h of raycaster.intersectObjects(maillages, false)) {
      // les coins arrondis ne comptent pas, ni le dos des vignettes de l'autre côté
      const t = tuiles[h.object.userData.i];
      v1.copy(t.p).applyQuaternion(qs);
      if (v1.z < -0.05) continue;
      return t.i;
    }
    // dans un joint entre deux vignettes : la plus proche de l'endroit où le rayon touche la sphère
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    v2.copy(o).sub(cs);
    const bq = v2.dot(d), cq = v2.lengthSq() - Rc * Rc, disc = bq * bq - cq;
    if (disc < 0) return -1;
    v2.copy(d).multiplyScalar(-bq - Math.sqrt(disc)).add(o).sub(cs).normalize().applyQuaternion(q2.copy(qs).invert());
    let mieux = -1, angle = 0.22;
    for (const t of tuiles) { const g = t.p.angleTo(v2); if (g < angle) { angle = g; mieux = t.i; } }
    return mieux;
  };

  const image = (now) => {
    boucle = 0;
    const dt = Math.min(0.05, dernier ? (now - dernier) / 1000 : 0.016);
    dernier = now;
    temps += dt;
    let cible = 1;
    if (etat === 'joue') {
      const t = temps - t0;
      voileV = Math.min(1.35, (t / 1.1) * 1.35);
      ordreMain = entre(t, 0.25, 1.85);
      glisse = 1 - sortie(entre(t, 0.15, 1.85));
      if (!touche && t >= 1.85) { touche = true; tLueur = temps; onContact(); }
      cible = touche ? 0 : 1;
      if (t > 3.4) etat = 'ordre';
    } else if (etat === 'ordre') cible = 0;
    // on ressort de l'univers : les points bleus se referment, les vignettes repartent en désordre
    else if (etat === 'couvre') {
      voileV = Math.max(0, voileV - dt * 4);
      if (voileV <= 0) { etat = 'bleu'; D = 1; vD = 0; ordreMain = 0; glisse = 1; touche = false; }
    }
    vD += (34 * (cible - D) - 2 * Math.sqrt(34) * 0.7 * vD) * dt;
    D = Math.max(0, Math.min(1.25, D + vD * dt));
    // la plongée : la sphère se tourne vers la vignette choisie et grossit ; puis la carte s'envole
    z += ((ouvert ? 1 : 0) - z) * (1 - Math.exp(-dt * 5));
    // les points : à vitesse constante (0,55 s pour apparaître, 0,4 s pour s'effacer)
    k = Math.max(0, Math.min(1, k + (ouvert ? dt / 0.55 : -dt / 0.4)));
    if (!ouvert && k <= 0 && z < 0.02) choisie = -1;
    if (ouvert) {
      lacet += 0.02 * dt * (reduit ? 0 : 1);               // la sphère tourne à peine pendant ce temps
      vLacet = 0;
    } else if (!appui) {
      lacet += (0.14 * (1 - z) + vLacet) * dt * (reduit ? 0 : 1);
      vLacet *= Math.exp(-dt * 1.6);
      tangage += (0.1 - tangage) * (1 - Math.exp(-dt * 1.2));
    }
    for (const t of tuiles) t.pop += ((t.i === survol ? 1 : 0) - t.pop) * (1 - Math.exp(-dt * 10));
    souris.trouble += ((souris.f ? 1 : 0) - souris.trouble) * (1 - Math.exp(-dt * 5));
    const kc = 1 - Math.exp(-dt * 2.2);
    cam.x += ((souris.f && !appui && !ouvert ? (souris.x / W - 0.5) * 0.6 : 0) - cam.x) * kc;
    cam.y += ((souris.f && !appui && !ouvert ? (0.5 - souris.y / H) * 0.3 : 0) - cam.y) * kc;
    dessiner();
    if (visible && !document.hidden) boucle = requestAnimationFrame(image);
  };
  const relancer = () => { if (!boucle && visible) { dernier = 0; boucle = requestAnimationFrame(image); } };
  document.addEventListener('visibilitychange', relancer);

  // ouvrir : le logo de la vignette, en grand (sa version 1200 px dès qu'elle est chargée)
  const ouvrir = (i) => {
    const t = tuiles[i];
    choisie = i; ouvert = true;
    const m = marques[t.b];
    if (m.grande && !grandes[t.b]) grandes[t.b] = texture(m.grande);
    onOuvre(t.b);
    relancer();
  };
  const fermer = () => { if (!ouvert) return false; ouvert = false; onOuvre(-1); relancer(); return true; };

  const enOrdre = () => { etat = 'ordre'; D = 0; vD = 0; ordreMain = 1; voileV = 1.35; glisse = 0; touche = true; };
  taille();
  if (reduit) enOrdre();
  dessiner();

  return {
    visible(oui) { visible = oui; if (oui && !reduit) relancer(); else if (!oui && boucle) { cancelAnimationFrame(boucle); boucle = 0; } if (reduit) dessiner(); },
    taille,
    jouer() { if (reduit) { enOrdre(); onContact(); dessiner(); return; } etat = 'joue'; t0 = temps; touche = false; D = 1; vD = 0; fermer(); relancer(); },
    montrer() { enOrdre(); onContact(); dessiner(); relancer(); },
    couvrir() { if (etat === 'bleu' || etat === 'couvre') return; fermer(); if (reduit) { this.recouvrir(); return; } etat = 'couvre'; relancer(); },
    // le défilement donne de l'élan à la sphère
    elan(d) { if (etat !== 'ordre' || ouvert || reduit) return; vLacet = Math.max(-0.9, Math.min(0.9, vLacet + d * 0.0016)); relancer(); },
    recouvrir() { etat = 'bleu'; D = 1; vD = 0; ordreMain = 0; voileV = 0; glisse = 1; touche = false; tLueur = -9; ouvert = false; z = 0; k = 0; choisie = -1; onOuvre(-1); dessiner(); },
    souris(x, y, dedans) {
      souris.x = x; souris.y = y; souris.f = dedans ? 1 : 0;
      if (appui) {
        if (Math.hypot(x - appui.x, y - appui.y) > 6) aGlisse = true;
        const pas = (x - appui.px) / W * 4.2;
        lacet += pas; vLacet = vLacet * 0.6 + (pas / Math.max(0.008, (performance.now() - appui.t) / 1000)) * 0.4;
        tangage = Math.max(-0.6, Math.min(0.7, tangage + (y - appui.py) / H * 1.6));
        appui.px = x; appui.py = y; appui.t = performance.now();
      }
      survol = dedans && !appui ? viser(x, y) : -1;
      relancer();
    },
    appui(x, y) { if (etat === 'ordre' && !ouvert) { appui = { x, y, px: x, py: y, t: performance.now() }; aGlisse = false; vLacet = 0; } },
    lache() { appui = null; },
    sous(x, y) {
      if (etat !== 'ordre') return '';
      if (ouvert) return 'planche';
      if (viser(x, y) >= 0) return 'tuile';
      return Math.hypot(x - cSphere[0], y - cSphere[1]) < rSphere * 1.05 ? 'sphere' : '';
    },
    // un clic : sur une vignette, on plonge et sa planche s'ouvre ; quand elle est ouverte, n'importe quel clic referme
    clic(x, y) {
      if (aGlisse) { aGlisse = false; return false; }
      if (etat !== 'ordre') return false;
      if (ouvert) return fermer();
      const i = viser(x, y);
      if (i < 0) return false;
      ouvrir(i);
      return true;
    },
    fermer,
    ouverte: () => (ouvert ? tuiles[choisie].b : -1),
  };
}
