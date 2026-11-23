/* ==========================================================================
   « Mettez le désordre. On remet de l'ordre. » (accueil, après « En ligne en 21 jours »)
   Une sphère de nos identités visuelles : les 8 planches (marques fictives) découpées case par case (affiche, logo,
   couleurs, typographie, carte de visite, icône, en-tête), soit 64 tuiles épaisses aux tranches bleues.
   - Le voile : le bleu de la bande du dessus continue sur la section, puis se défait en points qui rapetissent,
     depuis la sphère vers les bords (les mêmes points que le paysage avant « Nos projets »).
   - Au départ, les tuiles flottent en désordre ; quand le doigt (la main en lignes de balayage bleues) touche,
     elles se rangent en sphère, d'abord autour du doigt.
   - La sphère tourne seule ; on la fait tourner à la souris ou au doigt (avec de l'élan) ; la tuile survolée s'avance.
   - Un clic sur une tuile : le logo de sa marque sort seul de la sphère et vient devant, puis « bam » (une onde bleue)
     toutes les tuiles de la marque le rejoignent et la planche s'ouvre en grand ; la sphère recule. Un clic (ou Échap)
     les renvoie dans la sphère.
   - Les ondes, en 3D : la surface de la sphère ondule doucement ; au clic, une vague part de la vignette touchée
     et traverse toute la sphère. Le décor : un sol en miroir avec une grille bleue fine, un halo ; la caméra bouge
     un peu avec la souris.
   Les planches sont des images (public/assets/img/identites, faites par _msdesign-src/perf/identites/capture.mjs).
   Three.js ; une seule toile. jouer() : la séquence ; montrer() : directement rangée ; recouvrir() : retour au bleu.
   ========================================================================== */
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

// le sol : un miroir doux (le reflet de la planche s'efface en s'éloignant) et une grille bleue très fine qui fuit
// vers l'horizon ; il se fond dans le fond de la section (alpha). Les distances sont en « unités de planche ».
const SOL = {
  name: 'SolGrille',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uCentre: { value: new THREE.Vector2() }, uEchelle: { value: 1 },
    uBleu: { value: new THREE.Color() }, uFond: { value: new THREE.Color() }, uT: { value: 0 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vMonde;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 m = modelMatrix * vec4(position, 1.0);
      vMonde = m.xyz;
      gl_Position = projectionMatrix * viewMatrix * m;
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uCentre;
    uniform float uEchelle, uT;
    uniform vec3 uBleu, uFond;
    varying vec4 vUv;
    varying vec3 vMonde;
    void main() {
      vec2 p = (vMonde.xz - uCentre) / uEchelle;
      float dist = length(p * vec2(0.5, 1.0));
      vec4 r = texture2DProj(tDiffuse, vUv);
      float kr = (1.0 - smoothstep(0.15, 1.8, dist)) * 0.22 * r.a;
      // la grille : une ligne toutes les 0,4 unité ; plus fine et plus pâle au loin (pas de moiré)
      vec2 g = p / 0.4, fw = fwidth(g);
      vec2 l2 = abs(fract(g - 0.5) - 0.5) / max(fw, vec2(1e-4));
      float ligne = (1.0 - min(min(l2.x, l2.y), 1.0)) * (1.0 - smoothstep(0.25, 0.7, max(fw.x, fw.y)));
      // une onde de lumière lente qui part de la planche
      float onde = 0.5 + 0.5 * sin(dist * 3.2 - uT * 1.4);
      float pres = length(p * vec2(0.42, 1.9));                // vers nous, la grille s'efface vite
      float kg = ligne * (0.15 + 0.17 * onde) * (1.0 - smoothstep(0.6, 3.4, pres));
      vec3 c = mix(uFond, r.rgb, kr);
      c = mix(c, uBleu, kg);
      gl_FragColor = vec4(c, (1.0 - smoothstep(2.2, 6.0, dist)) * 0.95);
      #include <colorspace_fragment>
    }`,
};

const BLEU = [21 / 255, 94 / 255, 239 / 255];        // --blue, le même bleu que la bande du dessus
const PW = 3.2, PH = 2.0, EP = 0.075;                 // la planche (16:10), l'épaisseur des blocs
const JOINT = 0.007;                                  // l'écart entre deux blocs remis en ordre : un fil bleu
// la découpe, en fractions de la planche (u vers la droite, v vers le bas), case par case (voir planche.html) :
// l'affiche à gauche ; à droite l'en-tête, le logo, deux couleurs, la typographie, la carte de visite, l'icône
const DECOUPE = [
  [0, 0, 0.5, 1],
  [0.5, 0, 1, 0.08], [0.5, 0.08, 1, 0.42],
  [0.5, 0.42, 0.625, 0.72], [0.625, 0.42, 0.75, 0.72], [0.75, 0.42, 1, 0.72],
  [0.5, 0.72, 0.8, 1], [0.8, 0.72, 1, 1],
];

const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const entre = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const sortie = (t) => 1 - Math.pow(1 - t, 3);
// un hasard qui donne toujours les mêmes valeurs (la planche se défait toujours de la même façon)
const hasard = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// un halo rond (ombre, lueur), dessiné une fois
function texHalo(couleur) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), d = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  d.addColorStop(0, couleur); d.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = d; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// un studio pour les reflets : ciel bleu pâle en haut, horizon clair, sol plus sombre ; des boîtes à lumière blanches
// et un néon bleu sur le côté
function studio(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP;
      void main() {
        vec3 haut = vec3(0.45, 0.58, 0.92), milieu = vec3(0.86, 0.85, 0.82), bas = vec3(0.3, 0.26, 0.22);
        vec3 c = vP.y > 0.0 ? mix(milieu, haut, pow(vP.y, 0.6)) : mix(milieu, bas, pow(-vP.y, 0.5));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));
  const boite = (l, h, x, y, z, force, couleur = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    m.material.color.setRGB(couleur[0] * force, couleur[1] * force, couleur[2] * force);
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  boite(9, 6, -7, 8, 8, 5);
  boite(4, 12, 10, 2, 3, 2.6);
  boite(1.2, 14, 6, 1, -9, 5, [0.25, 0.5, 1.6]);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02, 0.1, 100).texture;
  pm.dispose();
  return env;
}

// un bloc : une boîte fine ; sa face avant montre sa case de la planche
function bloc(l, h, u0, v0, u1, v1, mats) {
  const g = new THREE.BoxGeometry(l, h, EP);
  const uv = g.attributes.uv;
  for (let i = 16; i < 20; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), 1 - v1 + uv.getY(i) * (v1 - v0));   // la face avant (+z)
  return new THREE.Mesh(g, mats);
}

export function createSphere(toile, opts = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const reduit = !!opts.reduced;
  const marques = opts.marques && opts.marques.length ? opts.marques : [];

  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
  camera.position.set(0, 0, 10);

  /* ---------- les matériaux : une face par marque (sa planche), les tranches, le dos ---------- */
  const chargeur = new THREE.TextureLoader();
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const texture = (src, fin) => {
    const t = chargeur.load(src, () => { if (fin) fin(t); dessiner(); });
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    return t;
  };
  const faces = marques.map((m) => new THREE.MeshStandardMaterial({ color: '#0b0d12', emissive: '#ffffff', emissiveMap: texture(m.petite), roughness: 0.22, metalness: 0, toneMapped: false }));
  const grandes = marques.map(() => false);
  const tranche = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...BLEU, THREE.SRGBColorSpace), emissive: new THREE.Color().setRGB(...BLEU, THREE.SRGBColorSpace), emissiveIntensity: 0.6, roughness: 0.3, toneMapped: false });
  const dos = new THREE.MeshStandardMaterial({ color: '#e8edf6', roughness: 0.45 });
  // les tranches : bleues quand les tuiles volent, presque blanches une fois rangées
  const TR_BLEU = new THREE.Color().setRGB(...BLEU, THREE.SRGBColorSpace), TR_PALE = new THREE.Color('#dde4f2');

  /* ---------- les tuiles : chaque case de chaque planche ---------- */
  // sur la sphère (rayon 1), rangée par rangée comme un mur de vignettes enroulé : 8 rangées entre 70° sud et 70° nord ;
  // dans une rangée, toutes les vignettes ont la même hauteur (leur largeur suit leur format) et l'écart se répartit.
  // Les marques sont mêlées. L'en-tête des planches (une bande très fine) reste caché dans la sphère : il ne sort qu'avec
  // la planche ouverte.
  const CONTACT = new THREE.Vector3(1, 0.12, 0.25).normalize();       // là où le doigt touche la sphère
  const tmp = new THREE.Object3D();
  const tuiles = [];
  marques.forEach((m, b) => DECOUPE.forEach(([u0, v0, u1, v1], k) => {
    const i = b * DECOUPE.length + k;
    const l = (u1 - u0) * PW, h = (v1 - v0) * PH;
    const mesh = bloc(l - JOINT, h - JOINT, u0, v0, u1, v1, [tranche, tranche, tranche, tranche, faces[b], dos]);
    mesh.userData.i = i;
    const hh = (n) => hasard(i * 5.31 + n);
    const dir = new THREE.Vector3(hh(1) - 0.5, (hh(2) - 0.5) * 0.8, hh(3) - 0.5).normalize();
    tuiles.push({
      mesh, b, k, i, l, h, cachee: k === 1,
      bx: (u0 + u1) / 2 * PW - PW / 2, by: PH / 2 - (v0 + v1) / 2 * PH,          // sa case dans la planche
      p: new THREE.Vector3(), q: new THREE.Quaternion(), ks: 0.0001,              // sa place sur la sphère (plus bas)
      // son désordre : quelque part autour de la sphère, tournée n'importe comment
      cp: dir.multiplyScalar(1.35 + hh(4) * 0.95), cq: new THREE.Quaternion().setFromEuler(new THREE.Euler((hh(5) - 0.5) * 2.2, (hh(6) - 0.5) * 3, (hh(7) - 0.5) * 1.6)),
      seuil: 0.3, pop: 0, wb: 0, wl: 0,
    });
    scene.add(mesh);
  }));
  {
    const RANGS = [-70, -50, -30, -10, 10, 30, 50, 70].map((d) => (d * Math.PI) / 180);
    const ECART = 0.028;
    const caps = RANGS.map((f) => 2 * Math.PI * Math.cos(f));
    const capTot = caps.reduce((a, c) => a + c, 0);
    const visibles = tuiles.filter((t) => !t.cachee).sort((a, c) => hasard(a.i * 3.17 + 0.5) - hasard(c.i * 3.17 + 0.5));
    // la hauteur des vignettes : de quoi remplir les rangées à 90 % (sans dépasser l'écart entre deux rangées)
    const format = (t) => Math.min(1.85, t.l / t.h);
    const somme = visibles.reduce((a, t) => a + format(t), 0);
    const HT = Math.min(0.315, (0.9 * capTot - visibles.length * ECART) / somme);
    const larg = (t) => HT * format(t);
    const remplissage = visibles.reduce((a, t) => a + larg(t) + ECART, 0) / capTot;
    const rangs = RANGS.map(() => []);
    const pris = RANGS.map(() => 0);
    // de l'équateur vers les pôles, chaque rangée prend des vignettes jusqu'à sa part
    const ordre = [3, 4, 2, 5, 1, 6, 0, 7];
    let n = 0;
    for (const ri of ordre) {
      while (n < visibles.length && (rangs[ri].length === 0 || pris[ri] + larg(visibles[n]) + ECART <= caps[ri] * remplissage * 1.03)) {
        rangs[ri].push(visibles[n]); pris[ri] += larg(visibles[n]) + ECART; n++;
      }
    }
    while (n < visibles.length) {                          // s'il en reste : là où il y a le plus de place
      const ri = caps.map((c, r) => c - pris[r]).reduce((m, v, r, a) => (v > a[m] ? r : m), 0);
      rangs[ri].push(visibles[n]); pris[ri] += larg(visibles[n]) + ECART; n++;
    }
    RANGS.forEach((f, ri) => {
      const rang = rangs[ri];
      const utile = rang.reduce((a, t) => a + larg(t), 0);
      const serre = Math.min(1, (caps[ri] - rang.length * ECART) / utile);   // une rangée trop pleine : on serre un peu
      const jeu = (caps[ri] - utile * serre) / Math.max(1, rang.length);
      let x = hasard(ri * 9.1) * caps[ri];                 // chaque rangée commence ailleurs
      for (const t of rang) {
        const w = larg(t) * serre, a = (x + w / 2) / Math.cos(f);
        t.p.set(Math.cos(f) * Math.cos(a), Math.sin(f), Math.cos(f) * Math.sin(a));
        tmp.position.copy(t.p); tmp.lookAt(t.p.clone().multiplyScalar(2));
        t.q.copy(tmp.quaternion); t.ks = w / t.l;
        // l'ordre revient d'abord autour du doigt, puis gagne toute la sphère
        t.seuil = 0.42 * (1 - t.p.distanceTo(CONTACT) / 2);
        x += w + jeu;
      }
    });
  }
  const maillages = tuiles.map((t) => t.mesh);

  // la lueur au point de contact
  const lueur = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo('rgba(140, 180, 255, 1)'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scene.add(lueur);

  /* ---------- le décor : le sol en miroir et sa grille, un halo ---------- */
  const sol = new Reflector(new THREE.PlaneGeometry(80, 80), { shader: SOL, clipBias: 0.003, textureWidth: 512, textureHeight: 512 });
  sol.rotation.x = -Math.PI / 2;
  sol.material.transparent = true;
  sol.material.depthWrite = false;
  sol.material.toneMapped = false;
  sol.material.uniforms.uBleu.value.set('#3d74f5');
  sol.material.uniforms.uFond.value.set('#e9edf4');
  sol.renderOrder = -2;
  scene.add(sol);
  const ombre = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), new THREE.MeshBasicMaterial({ map: texHalo('rgba(20, 30, 70, 0.5)'), transparent: true, depthWrite: false, toneMapped: false }));
  ombre.rotation.x = -Math.PI / 2;
  scene.add(ombre);
  const decor = new THREE.Group();                         // centré sur la sphère, à son échelle
  scene.add(decor);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo('rgba(110, 150, 255, 0.55)'), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  halo.position.set(0, 0.05, -2.2); halo.scale.set(6.2, 5.2, 1); halo.renderOrder = -3;
  decor.add(halo);


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
  const centre = new THREE.Vector3(), centreP = new THREE.Vector3(), contact = new THREE.Vector3();
  let R = 1, echelle = 1, logoL = 1;                                  // le rayon de la sphère ; l'échelle de la planche ouverte
  const qPlanche = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.03, -0.1, 0));
  const qFace = new THREE.Quaternion();                    // le logo seul : bien de face
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
    camera.aspect = W / H; camera.updateProjectionMatrix();
    camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();                            // avant de projeter des points (sinon : NaN)
    ortho.left = 0; ortho.right = W; ortho.top = H; ortho.bottom = 0; ortho.updateProjectionMatrix();
    sol.getRenderTarget().setSize(Math.round(W * dpr * 0.6), Math.round(H * dpr * 0.6));
    // la sphère (et la planche ouverte) : un peu haute, le titre est en bas à gauche ; sur un écran en hauteur, plus haute
    portrait = W / H < 0.9;
    const cx = 0.5, cy = portrait ? 0.58 : 0.6;
    const t = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    centre.set((cx * 2 - 1) * t * camera.aspect, (1 - cy * 2) * t, 0);
    R = Math.min((portrait ? 0.27 : 0.32) * 2 * t, (portrait ? 0.4 : 0.3) * 2 * t * camera.aspect);
    // la planche ouverte : en grand, au milieu (le titre s'efface pendant ce temps)
    echelle = Math.min(((portrait ? 0.9 : 0.74) * 2 * t * camera.aspect) / PW, ((portrait ? 0.4 : 0.7) * 2 * t) / PH);
    centreP.set(0, (1 - (portrait ? 0.5 : 0.52) * 2) * t, 0);
    logoL = ((portrait ? 0.7 : 0.44) * 2 * t * camera.aspect) / (0.5 * PW);   // l'échelle du logo seul (sa case fait une demi-planche de large)
    // le sol, sous la sphère ; le décor, centré sur elle
    const bas = centre.y - R * 1.3;
    sol.position.set(centre.x, bas, 0);
    sol.material.uniforms.uCentre.value.set(centre.x, 0);
    sol.material.uniforms.uEchelle.value = R * 1.5;
    ombre.scale.setScalar(R);
    ombre.position.set(centre.x, bas + 0.003, 0);
    decor.position.copy(centre); decor.scale.setScalar(R);
    lueur.scale.setScalar(R * 0.75);
    voile.material.uniforms.uDiag.value = Math.hypot(W, H) * dpr;
    voile.material.uniforms.uMaille.value = Math.round((portrait ? 13 : 16) * dpr);
    poser();
    // la main : sa taille d'après la place entre le point de contact et le bord droit
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
  // la rotation de la sphère : elle tourne seule ; on la lance à la main (avec de l'élan) ; elle se penche un peu
  let lacet = 0.6, tangage = 0.12, vLacet = 0, appui = null, aGlisse = false, survol = -1;
  // la planche ouverte : quelle marque (-1 : aucune), et où en est l'ouverture (0 → 1)
  let ouverte = -1, vers = -1, ouv = 0, tOuvre = 0, tBam = -1, source = null;
  const LOGO = 2, BAM = 0.8;                               // la case du logo dans la planche ; le « bam », en secondes après le clic
  const onContact = opts.onContact || (() => {});
  const onOuvre = opts.onOuvre || (() => {});
  const cs = new THREE.Vector3(), qs = new THREE.Quaternion(), eul = new THREE.Euler();
  let Rc = 1;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qx = new THREE.Quaternion();
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();

  // la pose de chaque tuile : entre sa place sur la sphère, son désordre, et sa case dans la planche ouverte
  function poser() {
    const recul = sortie(Math.min(1, ouv * 1.2));
    cs.copy(centre).add(v1.set(0, R * 0.08 * recul, -R * 2.2 * recul));
    Rc = R * (1 - 0.12 * recul);
    qs.setFromEuler(eul.set(tangage, lacet, 0, 'YXZ'));
    const kt = lisse(0, 0.3, D);
    for (const t of tuiles) {
      const d = Math.min(1, Math.max(0, (D - t.seuil) / (1 - 0.42)));
      const ec = d * d * (3 - 2 * d);
      // sur la sphère : la surface ondule doucement (une vague qui monte), une vague part de la vignette cliquée,
      // la vignette survolée s'avance un peu ; l'en-tête reste caché au centre
      let onde = t.cachee ? 0 : 0.016 * Math.sin(t.p.y * 7 - temps * 1.5) + 0.1 * t.pop;
      if (!t.cachee && tBam >= 0 && source) {
        const f = (temps - tBam) * 2.4, ang = t.p.angleTo(source);
        onde += 0.14 * Math.exp(-(((ang - f) / 0.32) ** 2)) * Math.max(0, 1 - f / 3.6);
      }
      v1.copy(t.p).multiplyScalar(1 + onde).applyQuaternion(qs).multiplyScalar(Rc).add(cs);
      q1.copy(qs).multiply(t.q);
      let s = t.cachee ? 0.0001 : t.ks * Rc * (1 + 0.1 * t.pop);
      // en désordre : autour de la sphère, avec un léger flottement
      if (ec > 0) {
        v2.copy(t.cp).multiplyScalar(R).add(centre);
        v2.y += Math.sin(temps * 0.9 + t.cp.x * 4) * 0.05 * R;
        v1.lerp(v2, ec);
        qx.setFromEuler(eul.set(0, temps * 0.25 * (t.cp.z > 0 ? 1 : -1), 0));
        q2.copy(t.cq).multiply(qx);
        q1.slerp(q2, ec);
        s += (t.ks * R * 0.85 - s) * ec;
      }
      // le logo seul, au milieu, devant la sphère (premier temps du clic)
      if (t.wl > 0) {
        const e = t.wl * t.wl * (3 - 2 * t.wl);
        v2.copy(centreP).add(v1.clone().sub(centreP).multiplyScalar(0));
        v2.z += 0.4;
        v1.lerp(v2, e);
        q1.slerp(qFace, e);
        s += (logoL * (1 + 0.04 * Math.sin(temps * 3)) - s) * e;
      }
      // dans la planche ouverte : chaque tuile de la marque choisie à sa case, devant la sphère
      if (t.wb > 0) {
        const e = t.wb * t.wb * (3 - 2 * t.wb);
        v2.set(t.bx * echelle, t.by * echelle, 0).applyQuaternion(qPlanche).add(centreP);
        v1.lerp(v2, e);
        q1.slerp(qPlanche, e);
        s += (echelle - s) * e;
      }
      t.mesh.position.copy(v1);
      t.mesh.quaternion.copy(q1);
      t.mesh.scale.setScalar(s);
    }
    tranche.color.copy(TR_PALE).lerp(TR_BLEU, kt); tranche.emissive.copy(TR_PALE).lerp(TR_BLEU, kt);
    tranche.emissiveIntensity = 0.25 + 0.35 * kt;
    // le doigt touche la sphère sur son côté droit ; quand une planche est ouverte, il touche son bord droit
    v1.copy(CONTACT).multiplyScalar(Rc * 1.02).add(cs);
    v2.set(PW / 2 * echelle, 0.3 * echelle, 0.02).applyQuaternion(qPlanche).add(centreP);
    contact.copy(v1).lerp(v2, sortie(ouv));
    camera.updateMatrixWorld();
    placerEcran();
  }

  function dessiner() {
    // la caméra se déplace un peu (la souris, et une lente respiration) : on sent la profondeur
    camera.position.set(cam.x + Math.sin(temps * 0.21) * 0.1, cam.y + Math.sin(temps * 0.17) * 0.05, 10);
    camera.lookAt(cam.x * 0.3, cam.y * 0.3, 0);
    camera.updateMatrixWorld();
    poser();

    sol.material.uniforms.uT.value = temps;
    const tl = temps - tLueur;
    lueur.material.opacity = tl >= 0 && tl < 1.2 ? Math.sin(Math.PI * tl / 1.2) * 0.9 : 0;
    ombre.material.opacity = 0.55 - D * 0.3;
    // la main
    const u = main.material.uniforms;
    u.uOrdre.value = ordreMain; u.uT.value = temps; u.uTrouble.value = souris.trouble;
    const gx = glisse * W * 0.16;
    main.scale.set(mainPos.l, mainPos.h, 1);
    main.position.set(mainPos.x + mainPos.l / 2 + gx, H - (mainPos.y + mainPos.h / 2) + Math.sin(temps * 0.7) * 3, 0);
    u.uSouris.value.set((souris.x - mainPos.x - gx) / mainPos.l, (souris.y - mainPos.y) / mainPos.h);
    main.visible = pretMain;
    voile.material.uniforms.uVoile.value = voileV;
    voile.visible = voileV < 1.3;
    renderer.clear();
    renderer.render(plan, ortho);
    renderer.render(scene, camera);
    renderer.render(dessus, ortho);
  }

  // la tuile sous la souris (seulement sur la sphère rangée)
  const viser = (x, y) => {
    if (etat !== 'ordre' || ouv > 0.05) return -1;
    ndc.set((x / W) * 2 - 1, 1 - (y / H) * 2);
    raycaster.setFromCamera(ndc, camera);
    const h = raycaster.intersectObjects(maillages, false).find((x) => !tuiles[x.object.userData.i].cachee);
    return h ? h.object.userData.i : -1;
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
    // un ressort : les tuiles claquent en place
    vD += (34 * (cible - D) - 2 * Math.sqrt(34) * 0.7 * vD) * dt;
    D = Math.max(0, Math.min(1.25, D + vD * dt));
    // la rotation : seule, plus l'élan donné à la main ; ralentie quand une planche est ouverte
    if (!appui) {
      lacet += (0.16 * (1 - 0.85 * ouv) + vLacet) * dt * (reduit ? 0 : 1);
      vLacet *= Math.exp(-dt * 1.6);
      tangage += (0.12 - tangage) * (1 - Math.exp(-dt * 1.5));
    }
    // l'ouverture d'une planche : ses tuiles partent une à une, la sphère recule
    const versOuv = vers >= 0 ? 1 : 0;
    ouv += (versOuv - ouv) * (1 - Math.exp(-dt * 3.2));
    if (vers < 0 && ouv < 0.02) ouverte = -1;
    const depuis = temps - tOuvre;
    for (const t of tuiles) {
      const sienne = t.b === ouverte && vers >= 0;
      // premier temps : le logo seul ; second temps (après le « bam ») : toutes les cases, une à une
      const cl = sienne && t.k === LOGO && depuis < BAM + 0.6 ? 1 : 0;
      const cb = sienne && depuis >= BAM + t.k * 0.03 ? 1 : 0;
      t.wl += (cl - t.wl) * (1 - Math.exp(-dt * (cl ? 6 : 4)));
      t.wb += (cb - t.wb) * (1 - Math.exp(-dt * (cb ? 5.5 : 5)));
      t.pop += ((t.mesh.userData.i === survol ? 1 : 0) - t.pop) * (1 - Math.exp(-dt * 9));
    }
    souris.trouble += ((souris.f ? 1 : 0) - souris.trouble) * (1 - Math.exp(-dt * 5));
    const kc = 1 - Math.exp(-dt * 2.2);
    cam.x += ((souris.f && !appui ? (souris.x / W - 0.5) * 0.7 : 0) - cam.x) * kc;
    cam.y += ((souris.f && !appui ? (0.5 - souris.y / H) * 0.35 : 0) - cam.y) * kc;
    dessiner();
    if (visible && !document.hidden) boucle = requestAnimationFrame(image);
  };
  const relancer = () => { if (!boucle && visible) { dernier = 0; boucle = requestAnimationFrame(image); } };
  document.addEventListener('visibilitychange', relancer);

  // ouvrir la planche d'une marque (ses tuiles sortent de la sphère) ; la planche en grand, si l'écran le mérite
  const ouvrir = (b, i) => {
    ouverte = b; vers = b; tOuvre = temps;
    // la vague part de la vignette cliquée
    if (i != null) { source = tuiles[i].p; tBam = temps; }
    onOuvre(b);
    const m = marques[b];
    if (m.grande && !grandes[b]) { grandes[b] = true; texture(m.grande, (t) => { faces[b].emissiveMap = t; }); }
    relancer();
  };
  const fermer = () => { vers = -1; onOuvre(-1); relancer(); };

  const enOrdre = () => { etat = 'ordre'; D = 0; vD = 0; ordreMain = 1; voileV = 1.35; glisse = 0; touche = true; };
  taille();
  if (reduit) enOrdre();
  dessiner();

  return {
    visible(oui) { visible = oui; if (oui && !reduit) relancer(); else if (!oui && boucle) { cancelAnimationFrame(boucle); boucle = 0; } if (reduit) dessiner(); },
    taille,
    // la séquence : le voile se défait, la main arrive, le doigt touche, les tuiles se rangent en sphère
    jouer() { if (reduit) { enOrdre(); onContact(); dessiner(); return; } etat = 'joue'; t0 = temps; touche = false; D = 1; vD = 0; fermer(); relancer(); },
    montrer() { enOrdre(); onContact(); dessiner(); relancer(); },
    recouvrir() { etat = 'bleu'; D = 1; vD = 0; ordreMain = 0; voileV = 0; glisse = 1; touche = false; tLueur = -9; vers = -1; ouv = 0; ouverte = -1; tuiles.forEach((t) => { t.wb = 0; t.wl = 0; }); onOuvre(-1); dessiner(); },
    souris(x, y, dedans) {
      souris.x = x; souris.y = y; souris.f = dedans ? 1 : 0;
      if (appui) {
        const dx = x - appui.x, dy = y - appui.y;
        if (Math.hypot(dx, dy) > 6) aGlisse = true;
        const pas = (x - appui.px) / W * 4.2;
        lacet += pas; vLacet = vLacet * 0.6 + (pas / Math.max(0.008, (performance.now() - appui.t) / 1000)) * 0.4;
        tangage = Math.max(-0.5, Math.min(0.6, tangage + (y - appui.py) / H * 1.6));
        appui.px = x; appui.py = y; appui.t = performance.now();
      }
      survol = dedans ? viser(x, y) : -1;
      relancer();
    },
    appui(x, y) { if (etat === 'ordre' && ouv < 0.5) { appui = { x, y, px: x, py: y, t: performance.now() }; aGlisse = false; vLacet = 0; } },
    lache() { appui = null; },
    // ce qu'il y a sous la souris : 'tuile' (on peut cliquer), 'sphere' (on peut tourner), '' (rien)
    sous(x, y) {
      if (etat !== 'ordre') return '';
      if (ouv > 0.5) return 'planche';
      if (viser(x, y) >= 0) return 'tuile';
      return Math.hypot(x - cSphere[0], y - cSphere[1]) < rSphere * 1.1 ? 'sphere' : '';
    },
    // un clic : sur une tuile, sa marque s'ouvre en planche ; quand une planche est ouverte, n'importe quel clic la referme
    clic(x, y) {
      if (aGlisse) { aGlisse = false; return false; }
      if (etat !== 'ordre') return false;
      if (vers >= 0) { fermer(); return true; }
      const i = viser(x, y);
      if (i < 0) return false;
      ouvrir(tuiles[i].b, i);
      return true;
    },
    fermer() { if (vers >= 0) { fermer(); return true; } return false; },
    ouverte: () => vers,
  };
}
