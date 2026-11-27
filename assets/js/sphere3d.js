/* ==========================================================================
   « Mettez le désordre. On remet de l'ordre. » (accueil, après « En ligne en 21 jours »)
   La sphère des identités : notre galerie de logos, au milieu, sur un fond noir où ondule une nappe de lumière (un
   drap de soie éclairé de côté, avec un grain de film).
   - Les projets (assets/js/projets.js) : douze identités imaginées par le studio. Chacune est un îlot sur la sphère :
     quatre plaques épaisses aux coins arrondis, découpées dans sa planche (l'affiche, le logo, la carte de visite,
     l'icône), posées comme une petite mise en page. Les îlots sont espacés : on voit tout de suite douze projets.
   - La sphère elle-même est en verre clair (d'après une image de référence générée par IA, _msdesign-src/perf/shots/
     sphere-ia/reference-4.png) : elle réfracte la soie du fond, un liseré clair à peine irisé la souligne, un bleu
     profond s'installe dans le bas ; les plaques sont posées presque à plat dessus, avec une ombre de contact ; on voit
     les îlots de l'autre côté à travers le verre, estompés et bleutés. Une lumière tourne lentement. Elle est entière à
     l'écran, sous le titre (opts.haut), avec son bord et son fond lumineux.
   - Le curseur : une petite main holographique bleue, l'index qui montre (la même main que celle qui touche la sphère,
     en lignes de balayage), dessinée dans la toile ; le vrai curseur est caché (app.js, main.css). Elle s'éclaire sur
     un projet, s'enfonce quand on appuie (une onde part du doigt) et ses lignes tremblent quand elle va vite.
   - Le voile : le bleu de la bande du dessus continue sur la section, puis se défait en points qui rapetissent. Au
     départ, les plaques flottent en désordre ; quand le doigt (la main en lignes de balayage bleues) touche, elles se
     rangent, d'abord autour du doigt.
   - Au repos, la sphère tourne très lentement ; elle suit un peu le curseur, et les plaques proches de lui se
     soulèvent. Au survol d'un projet, son îlot se soulève, s'éclaire de sa couleur et fait son geste (des bulles pour
     le bar à vins, des prises pour la salle d'escalade, un tour de potier pour l'atelier céramique…) ; son nom
     apparaît (onEtiquette).
   - Au clic : la sphère ralentit et amène l'îlot face à nous, la caméra avance doucement ; les quatre plaques quittent
     la sphère et reprennent leur place dans la planche entière, que des points complètent ; la fiche du projet
     s'ouvre à côté (onOuvre, dans app.js). Fermer : le chemin inverse. Projet suivant : l'un repart, l'autre arrive.
   Three.js ; une seule toile. jouer() : la séquence ; montrer() : directement rangée ; recouvrir() : retour au bleu.
   ========================================================================== */
import * as THREE from 'three';
import { CASES, SUR_LA_SPHERE, ILOT } from './projets.js';

const BLEU = [21 / 255, 94 / 255, 239 / 255];        // --blue, le même bleu que la bande du dessus
const PLANCHE = 1.6;                                  // le format des planches (16:10)
const S = 0.47;                                       // la taille d'un îlot : 0,47 radian de sphère par hauteur de planche

const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const entre = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const sortie = (t) => 1 - Math.pow(1 - t, 3);
// un hasard qui donne toujours les mêmes valeurs
const hasard = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// une plaque épaisse (w × h × ep) aux coins arrondis : une face avant et une face arrière quadrillées (pour pouvoir se
// courber ; les coins sont découpés dans le shader) et une tranche qui suit l'arrondi.
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
  uniform vec4 uRect, uRect2, uFocus;
  uniform vec2 uTaille;
  uniform float uCoin, uSombre, uLueur, uFondu, uPoints, uMaille, uEclat, uFocusK;
  uniform vec3 uBord, uTeinte, uLumiere;
  varying vec2 vUv;
  varying float vFace;
  varying vec3 vRad;
  varying vec3 vMonde;
  void main() {
    vec3 v = normalize(cameraPosition - vMonde), c;
    if (abs(vFace) > 0.5) {
      vec2 q = (vUv - 0.5) * uTaille;
      vec2 dq = abs(q) - (uTaille * 0.5 - vec2(uCoin));
      float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - uCoin;   // la distance au bord (négative dedans)
      if (sd > 0.0) discard;                                // les coins arrondis
      if (uPoints < 0.999) {                                // apparaît par des points qui grandissent depuis le centre
        vec2 pp = vUv * uTaille, cel = floor(pp / uMaille), ctr = (cel + 0.5) * uMaille;
        float dist = length(ctr / uTaille - 0.5) * 1.42;
        float kk = clamp(uPoints * 1.7 - dist * 0.7, 0.0, 1.0);
        kk = kk * kk * (3.0 - 2.0 * kk);
        if (length(pp - ctr) > uMaille * 0.74 * kk) discard;
      }
      vec3 n = vRad * sign(vFace);
      vec2 st = mix(uRect.xy, uRect.zw, vUv);
      vec3 img = texture2D(uMap, st).rgb;
      if (uFondu > 0.0) img = mix(img, texture2D(uMap2, mix(uRect2.xy, uRect2.zw, vUv)).rgb, uFondu);
      float l = 0.55 + 0.45 * max(dot(n, v), 0.0);
      // la lumière qui tourne lentement : un reflet doux qui glisse sur les plaques
      float reflet = pow(max(dot(reflect(-v, n), uLumiere), 0.0), 28.0);
      c = img * l * (1.0 + uEclat) + reflet * 0.2;
      if (vFace < 0.0) c *= 0.74;                            // l'intérieur de la sphère, un peu dans l'ombre
      // le survol : un liseré de la couleur du projet
      c += uLueur * uTeinte * (1.0 - smoothstep(0.0, uCoin * 0.9, -sd)) * 0.9;
      // une case mise en avant dans la planche ouverte : le reste s'assombrit
      if (uFocusK > 0.0) {
        float dedans = step(uFocus.x, st.x) * step(st.x, uFocus.z) * step(uFocus.y, st.y) * step(st.y, uFocus.w);
        c *= mix(1.0, 0.3 + 0.7 * dedans, uFocusK);
      }
    } else {
      if (uPoints < 0.999) discard;
      vec3 n = normalize(cross(dFdx(vMonde), dFdy(vMonde)));
      c = uBord * (0.45 + 0.55 * abs(dot(n, v))) + uLueur * uTeinte * 0.35;   // la tranche, claire
    }
    c *= 1.0 - uSombre;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

// le verre : une sphère de verre clair qui respire à peine. Elle réfracte la soie du fond (déformée, plus fort vers le
// bord, les trois couleurs un peu décalées), s'assombrit et bleuit vers le bas ; un liseré clair et un reflet doux
const VS_COEUR = `
  uniform float uT, uAmp;
  varying vec3 vN;
  varying vec3 vP;
  varying vec3 vNv;
  void main() {
    vec3 p = position;
    float n = sin(p.x * 3.1 + uT * 0.35) * sin(p.y * 2.7 - uT * 0.28) * sin(p.z * 3.3 + uT * 0.22)
            + 0.5 * sin(p.x * 5.3 - uT * 0.4 + p.z * 2.0) * sin(p.y * 4.1 + uT * 0.31);
    p *= 1.0 + uAmp * n;
    vec4 m = modelMatrix * vec4(p, 1.0);
    vP = m.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vNv = normalize((viewMatrix * vec4(vN, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * m;
  }`;
const FS_COEUR = `
  uniform sampler2D uSoie;
  uniform vec2 uRes;
  uniform vec3 uLumiere;
  uniform float uT, uOpacite;
  varying vec3 vN;
  varying vec3 vP;
  varying vec3 vNv;
  void main() {
    vec3 v = normalize(cameraPosition - vP), n = normalize(vN);
    float cosv = max(dot(n, v), 0.0);
    float fr = pow(1.0 - cosv, 3.0);
    // la soie vue à travers le verre : déplacée selon la normale, davantage vers le bord ; un peu de dispersion
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 dec = -vNv.xy * (0.05 + 0.22 * (1.0 - cosv));
    vec3 refr = vec3(texture2D(uSoie, uv + dec * 0.97).r, texture2D(uSoie, uv + dec).g, texture2D(uSoie, uv + dec * 1.04).b);
    // le corps du verre : presque incolore en haut, un bleu profond qui monte du bas (en couleurs d'écran, comme la soie)
    float bas = clamp(0.5 - n.y * 0.5, 0.0, 1.0);
    vec3 corps = mix(vec3(0.026, 0.036, 0.062), vec3(0.03, 0.13, 0.36), pow(bas, 1.6));
    vec3 c = corps + refr * mix(vec3(1.12, 1.15, 1.2), vec3(0.7, 0.84, 1.1), bas);
    // la lumière qui traverse le verre se concentre en bas, juste à l'intérieur du bord : un croissant bleu lumineux
    float croissant = smoothstep(0.5, 0.95, bas) * smoothstep(0.04, 0.3, cosv) * (1.0 - smoothstep(0.3, 0.7, cosv));
    c += vec3(0.22, 0.48, 1.0) * croissant * 0.55;
    // un anneau clair, fin, juste à l'intérieur du bord (le verre épais renvoie la lumière tout autour)
    c += vec3(0.5, 0.64, 0.92) * exp(-pow((cosv - 0.2) / 0.07, 2.0)) * 0.14;
    // les reflets : le studio (plus clair en haut), le liseré du bord (à peine irisé), la lumière qui tourne
    vec3 r = reflect(-v, n);
    float studio = smoothstep(-0.2, 0.9, r.y);
    vec3 irise = 0.5 + 0.5 * cos(6.2831 * (fr * 1.6 + vec3(0.0, 0.33, 0.67)));
    c += fr * (vec3(0.35, 0.45, 0.62) * studio * 0.55 + mix(vec3(0.8, 0.88, 1.0), irise, 0.3) * smoothstep(0.6, 0.97, fr) * 0.6);
    // le bord : un liseré fin et net, plus vif en haut
    float bord = smoothstep(0.62, 0.97, fr) * (0.72 + 0.28 * clamp(n.y + 0.4, 0.0, 1.0));
    c += mix(vec3(0.78, 0.86, 1.0), irise, 0.2) * bord * 1.05;
    // une grande boîte à lumière de studio, en haut à gauche, qui se reflète en long sur le verre
    float boite = smoothstep(0.25, 0.55, r.y) * smoothstep(0.15, -0.35, r.x) * smoothstep(-0.2, 0.4, r.z);
    c += vec3(0.75, 0.82, 0.95) * boite * (0.13 + 0.3 * fr);
    float spec = pow(max(dot(n, normalize(uLumiere + v)), 0.0), 220.0);
    float halo = pow(max(dot(n, normalize(uLumiere + v)), 0.0), 16.0);
    c += spec * 0.45 + halo * 0.025;
    float a = clamp(0.7 + 0.28 * fr + spec * 0.3, 0.0, 1.0) * uOpacite;
    gl_FragColor = vec4(c, a);
  }`;

// l'ombre de contact d'une plaque sur le verre : un rectangle arrondi flou, posé sur la sphère
const VS_OMBRE = `
  uniform vec3 uCentre;
  uniform float uR;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 base = modelMatrix * vec4(position.xy, 0.0, 1.0);
    vec3 m = uCentre + normalize(base.xyz - uCentre) * uR;
    gl_Position = projectionMatrix * viewMatrix * vec4(m, 1.0);
  }`;
const FS_OMBRE = `
  uniform vec2 uTaille;
  uniform float uFlou, uForce;
  varying vec2 vUv;
  void main() {
    vec2 q = (vUv - 0.5) * uTaille * 1.4;
    vec2 dq = abs(q) - (uTaille * 0.5 - vec2(uFlou));
    float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - uFlou;
    float a = uForce * (1.0 - smoothstep(-uFlou, uFlou * 1.8, sd));
    if (a < 0.003) discard;
    gl_FragColor = vec4(0.0, 0.008, 0.03, a);
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
    vec3 c = fond + vec3(0.86, 0.9, 1.0) * (a * 0.94 + lointain * 1.1);
    gl_FragColor = vec4(c, 1.0);
  }`;
const FS_GRAIN = `
  uniform sampler2D uSoie;
  uniform vec2 uRes;
  uniform float uT, uVoile;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 c = texture2D(uSoie, vUv).rgb * (1.0 - uVoile);
    c += (h(floor(gl_FragCoord.xy) + fract(uT * 7.3) * 91.7) - 0.5) * 0.055;   // le grain
    vec2 p = vUv - 0.5;
    c *= 1.0 - dot(p, p) * 0.55;                                               // le vignettage
    gl_FragColor = vec4(c, 1.0);
  }`;
const VS_PLEIN = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }';

// le geste de chaque projet au survol (h : 0 → 1) : il parle de son métier. Les décalages sont en hauteur de planche,
// le soulèvement en rayon de sphère, les rotations en radians.
function geste(nom, t, h, T, o) {
  o.dx = 0; o.dy = 0; o.lift = 0; o.roll = 0; o.tx = 0; o.ty = 0; o.glow = 0; o.plat = 0;
  if (h < 0.0005) return o;
  const ci = t.ci, d = Math.hypot(t.lx, t.ly);
  switch (nom) {
    case 'bulles':      // le bar à vins : les plaques remontent chacune à son rythme, comme des bulles
      o.lift = h * (0.035 + 0.03 * (0.5 + 0.5 * Math.sin(T * 2.4 - ci * 1.3))); break;
    case 'relief':      // la salle d'escalade : des prises à des hauteurs différentes
      o.lift = h * [0.03, 0.09, 0.055, 0.12][ci]; break;
    case 'tour':        // l'atelier céramique : l'îlot tourne doucement, comme sur un tour
      o.roll = h * 0.11 * Math.sin(T * 1.1); o.lift = h * 0.045; break;
    case 'spectre':     // l'opticien : les plaques s'écartent comme la lumière dans un prisme
      o.dx = h * 0.06 * (ci - 1.5); o.lift = h * (0.03 + 0.014 * ci); o.glow = h * 0.2 * (0.5 + 0.5 * Math.sin(T * 2 - ci)); break;
    case 'ecrin':       // l'institut de beauté : l'écrin s'ouvre
      o.dx = h * t.lx * 0.09; o.dy = h * t.ly * 0.09; o.lift = h * 0.05; break;
    case 'oblique':     // l'atelier vélo : les plaques glissent le long de la barre oblique
      { const s = (ci % 2 ? 1 : -1) * h * 0.04; o.dx = s * 0.5; o.dy = s; o.lift = h * 0.045; } break;
    case 'drape':       // la créatrice de mode : les plaques ondulent comme un tissu
      o.tx = h * 0.24 * Math.sin(T * 1.6 - t.lx * 2.2); o.lift = h * 0.045; o.plat = h * 0.7; break;
    case 'sillon':      // le disquaire : une onde part du centre, comme un sillon
      o.lift = h * (0.035 + 0.028 * Math.sin(T * 3.2 - d * 7)); o.roll = h * 0.035 * Math.sin(T * 0.8); break;
    case 'assemblage':  // la menuiserie : les pièces se déboîtent
      o.dx = h * (t.lx < 0 ? -0.05 : 0.05); o.lift = h * (ci === 0 ? 0.03 : 0.065); break;
    case 'flamme':      // les bougies : la lumière vacille
      o.lift = h * 0.045; o.glow = h * (0.3 + 0.18 * Math.sin(T * 9.1) + 0.1 * Math.sin(T * 13.7 + ci)); break;
    case 'pages':       // le kiosque : les pages se tournent
      o.ty = h * (0.3 + 0.06 * Math.sin(T * 1.4 + ci)) * (ci % 2 ? -1 : 1); o.lift = h * 0.05; o.plat = h * 0.75; break;
    case 'onde':        // la piscine : des ronds dans l'eau
      o.lift = h * (0.032 + 0.03 * Math.sin(T * 2.6 - d * 6)); break;
    default: o.lift = h * 0.045;
  }
  return o;
}

// où poser les îlots : trois rangées décalées, aucune aux pôles (la sphère est entière à l'écran), pour que chaque
// projet reste lisible quand la sphère tourne
function centresIlots(n) {
  const rangs = n <= 4 ? [n] : [Math.round(n / 3), n - 2 * Math.round(n / 3), Math.round(n / 3)];
  const lats = rangs.length === 1 ? [0.1] : [0.66, 0.03, -0.6];
  const out = [];
  rangs.forEach((m, r) => {
    for (let i = 0; i < m; i++) out.push({ lat: lats[r], lon: (i / m) * Math.PI * 2 + (r === 1 ? 0 : Math.PI / m) + 0.35 });
  });
  return out;
}

export function createSphere(toile, opts = {}) {
  const projets = opts.projets || [];
  if (!projets.length) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.capabilities.isWebGL2) { renderer.dispose(); return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x05070d, 1);
  renderer.autoClear = false;
  const reduit = !!opts.reduced;
  const onContact = opts.onContact || (() => {});
  const onOuvre = opts.onOuvre || (() => {});
  const onEtiquette = opts.onEtiquette || (() => {});

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
  camera.position.set(0, 0, 10);

  /* ---------- le fond : la soie (demi-résolution) et le grain ---------- */
  let echelleFond = 0.5;
  const fondCible = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType });
  const fondScene = new THREE.Scene(), grainScene = new THREE.Scene();
  const ortho2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const soie = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 } }, vertexShader: VS_PLEIN, fragmentShader: FS_SOIE, depthTest: false, depthWrite: false }));
  soie.frustumCulled = false; fondScene.add(soie);
  const grain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { uSoie: { value: fondCible.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 }, uVoile: { value: 0 } }, vertexShader: VS_PLEIN, fragmentShader: FS_GRAIN, depthTest: false, depthWrite: false }));
  grain.frustumCulled = false; grainScene.add(grain);

  /* ---------- les images : une planche par projet (la grande seulement à l'ouverture, sur les écrans fins) ---------- */
  const chargeur = new THREE.TextureLoader();
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const texture = (src) => {
    const t = chargeur.load(src, () => dessiner());
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    return t;
  };
  const planches = projets.map((p) => texture(p.image));
  const grandes = projets.map(() => null);
  const BORD = new THREE.Color('#bfc5d0');
  const lumiere = new THREE.Vector3(-0.35, 0.75, 0.55).normalize();
  const matiere = (tex, rect, teinte) => new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex }, uRect: { value: new THREE.Vector4(...rect) }, uMap2: { value: tex }, uRect2: { value: new THREE.Vector4(...rect) }, uFondu: { value: 0 },
      uTaille: { value: new THREE.Vector2(1, 1) }, uCoin: { value: 0.05 }, uSombre: { value: 0 }, uLueur: { value: 0 }, uBord: { value: BORD },
      uTeinte: { value: new THREE.Color(teinte || '#4d7dff') }, uEclat: { value: 0 }, uLumiere: { value: lumiere },
      uFocus: { value: new THREE.Vector4(0, 0, 1, 1) }, uFocusK: { value: 0 },
      uCentre: { value: new THREE.Vector3() }, uR: { value: 1 }, uBend: { value: 1 }, uEch: { value: 1 }, uPoints: { value: 1 }, uMaille: { value: 0.05 },
    },
    vertexShader: VS_TUILE, fragmentShader: FS_TUILE, side: THREE.DoubleSide,
  });
  // une case de planche (u vers la droite, v vers le bas) → le rectangle dans l'image (v vers le haut)
  const rectGL = ([u0, v0, u1, v1]) => [u0, 1 - v1, u1, 1 - v0];

  /* ---------- les îlots : un par projet, sur la sphère de rayon 1 ---------- */
  const CONTACT = new THREE.Vector3(1, 0.12, 0.25).normalize();       // là où le doigt touche la sphère
  const m4 = new THREE.Matrix4();
  const ilots = centresIlots(projets.length).map(({ lat, lon }, pi) => {
    const C = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
    const E = new THREE.Vector3(Math.cos(lon), 0, -Math.sin(lon));
    const N = new THREE.Vector3().crossVectors(C, E);
    // la rotation qui amène l'îlot face à nous, droit
    const visee = new THREE.Quaternion().setFromRotationMatrix(m4.makeBasis(E, N, C)).invert();
    const pr = projets[pi];
    return { C, E, N, visee, pop: 0, k: 0, carte: null, couleur: new THREE.Color(pr.couleur || '#4d7dff'), geste: pr.geste };
  });
  const tuiles = [];
  projets.forEach((pr, pi) => SUR_LA_SPHERE.forEach((nom, ci) => {
    const [x0, y0, x1, y1] = ILOT.cases[nom];
    const cw = x1 - x0, ch = y1 - y0;
    const i = tuiles.length;
    const hh = (n) => hasard(i * 5.31 + n);
    const dir = new THREE.Vector3(hh(1) - 0.5, (hh(2) - 0.5) * 0.8, hh(3) - 0.5).normalize();
    const [u0, v0, u1, v1] = CASES[nom];
    tuiles.push({
      i, pi, ci, nom, cw, ch,
      lx: (x0 + x1) / 2 - ILOT.centre[0], ly: ILOT.centre[1] - (y0 + y1) / 2,      // sa place dans l'îlot (y vers le haut)
      bx: (u0 + u1) / 2 * PLANCHE, by: (v0 + v1) / 2,                               // sa place dans la planche
      rect: rectGL(CASES[nom]), r: 1 + (hh(8) - 0.5) * 0.016,
      // son désordre : quelque part autour de la sphère, tournée n'importe comment
      cp: dir.multiplyScalar(1.35 + hh(4) * 0.95), cq: new THREE.Quaternion().setFromEuler(new THREE.Euler((hh(5) - 0.5) * 2.2, (hh(6) - 0.5) * 3, (hh(7) - 0.5) * 1.6)),
      seuil: 0.3, prox: 0, sx: -9999, sy: -9999, mesh: null,
    });
  }));
  for (const t of tuiles) {
    const il = ilots[t.pi];
    const w = t.cw * S, h = t.ch * S, coin = Math.min(w, h) * 0.07;
    t.mesh = new THREE.Mesh(plaque(w, h, S * 0.05, coin), matiere(planches[t.pi], t.rect, projets[t.pi].couleur));
    t.ombre = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.4, h * 1.4, 8, 8), new THREE.ShaderMaterial({
      uniforms: { uCentre: { value: new THREE.Vector3() }, uR: { value: 1 }, uTaille: { value: new THREE.Vector2(w, h) }, uFlou: { value: coin }, uForce: { value: 0 } },
      vertexShader: VS_OMBRE, fragmentShader: FS_OMBRE, transparent: true, depthWrite: false,
    }));
    t.ombre.renderOrder = 2; t.ombre.frustumCulled = false;
    scene.add(t.ombre);
    const u = t.mesh.material.uniforms;
    u.uTaille.value.set(w, h); u.uCoin.value = coin;
    t.mesh.userData.i = t.i;
    t.mesh.frustumCulled = false;
    // le doigt range d'abord les plaques proches de lui
    const p = il.C.clone().addScaledVector(il.E, Math.tan(t.lx * S)).addScaledVector(il.N, Math.tan(t.ly * S)).normalize();
    t.seuil = 0.42 * (1 - p.distanceTo(CONTACT) / 2);
    scene.add(t.mesh);
  }
  const maillages = tuiles.map((t) => t.mesh);
  const parProjet = projets.map((_, pi) => tuiles.filter((t) => t.pi === pi));

  // le cœur de verre
  const coeur = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uAmp: { value: reduit ? 0 : 0.006 }, uLumiere: { value: lumiere }, uOpacite: { value: 1 }, uSoie: { value: fondCible.texture }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: VS_COEUR, fragmentShader: FS_COEUR, transparent: true, depthWrite: true,
  }));
  coeur.renderOrder = 1;
  scene.add(coeur);
  // la lueur au point de contact
  const texLueur = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), d = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    d.addColorStop(0, 'rgba(140, 180, 255, 1)'); d.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = d; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const lueur = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLueur, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scene.add(lueur);

  // la planche entière d'un projet, créée à sa première ouverture : elle complète, par des points, les quatre plaques
  const carteDe = (pi) => {
    const il = ilots[pi];
    if (il.carte) return il.carte;
    const m = new THREE.Mesh(plaque(PLANCHE, 1, 0.02, 0.03), matiere(planches[pi], [0, 0, 1, 1], projets[pi].couleur));
    const u = m.material.uniforms;
    u.uTaille.value.set(PLANCHE, 1); u.uCoin.value = 0.03; u.uBend.value = 0;
    m.visible = false; m.frustumCulled = false; m.renderOrder = 2;
    scene.add(m);
    il.carte = m;
    return m;
  };

  /* ---------- la main en lignes de balayage, et le voile de points (en pixels, par-dessus) ---------- */
  const plan = new THREE.Scene(), dessus = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  let pretMain = false;
  const texMain = new THREE.TextureLoader().load(opts.main, () => { pretMain = true; dessiner(); });
  texMain.colorSpace = THREE.NoColorSpace;
  texMain.minFilter = THREE.LinearMipmapLinearFilter; texMain.anisotropy = 4;
  const main = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTex: { value: texMain }, uN: { value: 120 }, uOrdre: { value: 0 }, uSouris: { value: new THREE.Vector2(-9, -9) }, uTrouble: { value: 0 }, uT: { value: 0 }, uBleu: { value: new THREE.Vector3(0.33, 0.52, 1.0) }, uOpac: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uTex; uniform float uN, uOrdre, uTrouble, uT, uOpac; uniform vec2 uSouris; uniform vec3 uBleu;
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
        a *= (0.35 + 0.65 * o) * uOpac;
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
        float dist = length(ctr - uCentre) / uDiag;              // 0 au centre de la sphère, ~1 dans le coin le plus loin
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

  /* ---------- le curseur : une main holographique bleue, l'index qui montre ----------
     La même image que la grande main, tournée pour que l'index montre en haut à gauche ; le bout de l'index est
     exactement sous la souris. Des lignes de balayage horizontales (à l'écran), plus épaisses dans les ombres ; un
     léger halo ; une bande claire qui descend ; un point au bout du doigt. Sur un projet : plus claire, un anneau au
     doigt ; appuyer : elle s'enfonce et une onde part du doigt ; vite : ses lignes se décalent. */
  const curseurScene = new THREE.Scene();
  const CURSEUR = 360;                                    // le carré où on la dessine (px), centré sur le bout du doigt
  const doigt = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: {
      uTex: { value: texMain }, uBout: { value: new THREE.Vector2(-999, -999) }, uDpr: { value: 1 }, uAngle: { value: -0.72 }, uEch: { value: 300 },
      uT: { value: 0 }, uVis: { value: 0 }, uProjet: { value: 0 }, uAppui: { value: 0 }, uOnde: { value: 9 }, uVit: { value: 0 }, uPas: { value: 3 },
    },
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uTex; uniform vec2 uBout; uniform float uDpr, uAngle, uEch, uT, uVis, uProjet, uAppui, uOnde, uVit, uPas;
      float h1(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
      // la main dans l'image (2720 × 1536) : le bout de l'index en (0,245 ; 0,5) ; d : en pixels depuis le bout du doigt
      vec4 lire(vec2 d) {
        float c = cos(-uAngle), s = sin(-uAngle);
        vec2 q = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / uEch;
        vec2 st = vec2(0.245, 0.5) + vec2(q.x, q.y * 1.771);
        if (st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0) return vec4(0.0);
        vec4 t = texture2D(uTex, st);
        t.a *= 1.0 - smoothstep(0.55, 0.68, st.x);              // le poignet se perd
        // l'index montre : les autres doigts (sous lui dans l'image) restent plus discrets
        t.a *= 1.0 - 0.5 * smoothstep(0.475, 0.41, st.y) * smoothstep(0.5, 0.43, st.x);
        return t;
      }
      void main() {
        vec2 px = gl_FragCoord.xy / uDpr;                        // en pixels (y vers le haut)
        float li = floor(px.y / uPas);
        float r1 = h1(li);
        // chaque ligne tressaille un peu ; davantage quand la main va vite
        float dec = (r1 - 0.5) * (0.4 + 9.0 * uVit) + sin(uT * 3.1 + li * 1.7) * 0.3;
        vec2 d = vec2(px.x + dec, (li + 0.5) * uPas) - uBout;
        d /= 1.0 - 0.09 * uAppui;                                // appuyer : la main s'enfonce vers le doigt
        vec4 c = lire(d);
        float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        float l = clamp((lum - 0.28) / 0.57, 0.0, 1.0);
        // une bande claire qui descend le long de la main
        float bp = 46.0 - mod(uT, 2.8) / 2.8 * 200.0;
        float bande = exp(-pow((d.y - bp) / 10.0, 2.0));
        float w = c.a * mix(0.78, 0.26, pow(l, 0.7)) * (1.0 + 0.25 * uProjet + 0.3 * bande);
        float f = abs(fract(px.y / uPas) - 0.5);
        float aa = 0.7 / (uPas * uDpr);
        float trait = (1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, f)) * step(0.04, c.a);
        float a = trait * (0.88 + 0.12 * bande);
        // sous les lignes, un voile sombre à la forme de la main : elle se détache sur le verre bleu comme sur le noir
        float fond = smoothstep(0.02, 0.5, c.a) * 0.42;
        // le bout du doigt : un point ; sur un projet, un anneau ; à l'appui, une onde qui s'élargit
        vec2 b = px - uBout;
        float rb = length(b);
        float lignes = 1.0 - smoothstep(0.32 - aa, 0.32 + aa, f);
        a += exp(-rb * rb / 4.5) * 0.9;
        a += exp(-pow((rb - 8.0) / 1.1, 2.0)) * uProjet * 0.75;
        float o = clamp(uOnde / 0.6, 0.0, 1.0);
        a += exp(-pow((rb - (6.0 + 46.0 * (1.0 - pow(1.0 - o, 3.0)))) / 1.6, 2.0)) * (1.0 - o) * mix(0.35, 1.0, lignes) * 0.9;
        vec3 bleu = mix(vec3(0.5, 0.7, 1.0), vec3(0.84, 0.92, 1.0), clamp(bande * 0.7 + uProjet * 0.4 + uAppui * 0.4, 0.0, 1.0));
        a = clamp(a, 0.0, 1.0);
        float tout = a + fond * (1.0 - a);
        vec3 col = (bleu * a + vec3(0.01, 0.025, 0.07) * fond * (1.0 - a)) / max(tout, 0.001);
        gl_FragColor = vec4(col, tout * uVis);
      }`,
  }));
  doigt.frustumCulled = false; doigt.renderOrder = 10;
  curseurScene.add(doigt);
  const main2 = { x: -9999, y: -9999, vis: 0, vit: 0, px: 0, py: 0, angle: -0.72, appui: 0, tOnde: -9, projet: 0 };

  /* ---------- la mise en page ---------- */
  let W = 1, H = 1, dpr = 1, dprMax = 2, portrait = false, mainPos = { x: 0, y: 0, l: 1, h: 1 };
  const centre = new THREE.Vector3(), contact = new THREE.Vector3();
  let R = 1, tVue = 1;                                     // le rayon de la sphère ; la demi-hauteur visible à z = 0
  const MAIN_DOIGT = [0.245, 0.5];                        // le bout de l'index, dans l'image de la main (2720 × 1536)
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), n1 = new THREE.Vector3(), e1 = new THREE.Vector3(), y1 = new THREE.Vector3();
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), qx = new THREE.Quaternion();
  const ecran = (v) => { v3.copy(v).project(camera); return [(v3.x * 0.5 + 0.5) * W, (0.5 - v3.y * 0.5) * H, v3.z]; };
  let cSphere = [0, 0], rSphere = 1;                       // la sphère à l'écran (pour la souris et le voile)
  const cs = new THREE.Vector3(), qs = new THREE.Quaternion(), qBase = new THREE.Quaternion(), qVise = new THREE.Quaternion(), eul = new THREE.Euler();
  let Rc = 1;
  const placerEcran = () => {
    const [cx, cy] = ecran(cs);
    const bord = ecran(v2.set(Rc, 0, 0).add(cs));
    cSphere = [cx, cy]; rSphere = Math.abs(bord[0] - cx);
    const [sx, sy] = ecran(contact);
    mainPos.x = sx + 3 - mainPos.l * MAIN_DOIGT[0];
    mainPos.y = sy - mainPos.h * MAIN_DOIGT[1];
    voile.material.uniforms.uCentre.value.set(cx * dpr, (H - cy) * dpr);
    lueur.position.copy(contact);
  };
  const regler = () => {
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    fondCible.setSize(Math.max(4, Math.round(W * dpr * echelleFond)), Math.max(4, Math.round(H * dpr * echelleFond)));
    coeur.material.uniforms.uRes.value.set(W * dpr, H * dpr);
    voile.material.uniforms.uDiag.value = Math.hypot(W, H) * dpr;
    voile.material.uniforms.uMaille.value = Math.round((portrait ? 13 : 16) * dpr);
  };
  const taille = () => {
    const b = toile.getBoundingClientRect();
    W = Math.max(1, b.width); H = Math.max(1, b.height);
    portrait = W / H < 0.9;
    // la qualité : 2 au plus ; 1,75 sur téléphone ; jamais plus de 3 400 pixels de large
    dpr = Math.min(window.devicePixelRatio || 1, portrait && W < 700 ? 1.75 : 2, dprMax);
    if (W * dpr > 3400) dpr = 3400 / W;
    regler();
    soie.material.uniforms.uRes.value.set(W, H);
    grain.material.uniforms.uRes.value.set(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();                            // avant de projeter des points (sinon : NaN)
    ortho.left = 0; ortho.right = W; ortho.top = H; ortho.bottom = 0; ortho.updateProjectionMatrix();
    // la sphère : entière, sous le titre (opts.haut : le bas du texte, en pixels), avec de l'air en bas (et la barre
    // « devis » du téléphone) ; aussi grande que la place le permet
    tVue = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const upp = (2 * tVue) / H;                            // unités du monde par pixel, à z = 0
    const haut = Math.min(H * 0.42, Math.max(H * 0.12, opts.haut ? opts.haut() : H * 0.26));
    const dispo = Math.max(H * 0.34, H - haut - (portrait ? 104 : 34));
    const rPx = Math.min(dispo / 2, W * (portrait ? 0.45 : 0.32));
    const rp = rPx * upp * 0.965;                          // les plaques dépassent un peu du verre
    R = rp / Math.sqrt(1 + (rp / camera.position.z) ** 2); // la perspective grossit un peu la sphère
    centre.set(0, (H / 2 - (haut + dispo / 2)) * upp, 0);
    lueur.scale.setScalar(R * 0.75);
    poser();
    const [sx] = ecran(contact);
    const l = portrait ? W * 1.0 : Math.max(W * 0.6, (W - sx) / (1 - MAIN_DOIGT[0]) * 1.05);
    mainPos.l = l; mainPos.h = l * (1536 / 2720);
    main.material.uniforms.uN.value = Math.round(mainPos.h / (portrait ? 3.6 : 4.2));
    dessiner();
  };

  /* ---------- le temps ---------- */
  let visible = false, boucle = 0, dernier = 0, temps = 0, t0 = 0;
  let etat = 'bleu';                                      // 'bleu' (recouvert), 'joue', 'ordre', 'couvre'
  let D = 1, vD = 0, ordreMain = 0, voileV = 0, glisse = 1, touche = false, tLueur = -9;
  const souris = { x: -9999, y: -9999, f: 0, trouble: 0, m: 0 };   // m : c'est une souris (la main-curseur se montre)
  let appuye = false;
  const cam = { x: 0, y: 0 }, regard = { x: 0, y: 0 };
  let lacet = 0.25, tangage = 0.1, vLacet = 0, appui = null, aGlisse = false, survol = -1, focus = -1;
  // le projet ouvert (-1 : aucun) ; z : l'approche (la sphère l'amène face à nous, la caméra avance) ; zv : la sphère
  // tournée vers un projet (ouvert, ou choisi au clavier)
  let choisie = -1, ouvert = false, z = 0, zv = 0, vise = -1, caseFocus = null, focusK = 0;
  const g = { dx: 0, dy: 0, lift: 0, roll: 0, tx: 0, ty: 0, glow: 0, plat: 0 };
  const planche = { d: 6, Hb: 1, xc: 0, yc: 0 };       // la planche ouverte, dans l'espace de la caméra

  // la planche ouverte : à gauche de la fiche (ordinateur) ou en haut (téléphone), en pixels → espace de la caméra
  const placerPlanche = () => {
    planche.d = camera.position.z - R * 1.45;
    const wpp = (2 * Math.tan((camera.fov * Math.PI) / 360) * planche.d) / H;   // unités par pixel à cette distance
    let lp, cx, cy;
    if (portrait) { lp = W * 0.9; cx = W / 2; cy = 86 + lp / PLANCHE / 2; }
    else { lp = Math.min(W * 0.52, (H - 210) * PLANCHE); cx = W * 0.315; cy = 76 + (H - 76) / 2; }
    planche.Hb = (lp / PLANCHE) * wpp;
    planche.xc = (cx - W / 2) * wpp; planche.yc = -(cy - H / 2) * wpp;
  };
  // un point de la planche (en hauteur de planche, depuis son centre) → le monde
  const surPlanche = (x, y, recul, out) => out.set(planche.xc + x * planche.Hb, planche.yc + y * planche.Hb, -(planche.d + recul)).applyMatrix4(camera.matrixWorld);

  // la pose de chaque plaque : entre sa place dans son îlot, son désordre, et sa case dans la planche ouverte
  function poser() {
    const ez = z * z * (3 - 2 * z), evz = zv * zv * (3 - 2 * zv);
    cs.copy(centre);
    Rc = R * (1 - 0.05 * ez);
    qBase.setFromEuler(eul.set(tangage + regard.y, lacet + regard.x, 0, 'YXZ'));
    qs.copy(qBase).slerp(qVise, evz);
    placerPlanche();
    const onde = (p) => 0.007 * Math.sin(p * 7 - temps * 1.3) * (1 - ez);
    for (const t of tuiles) {
      const il = ilots[t.pi], u = t.mesh.material.uniforms;
      const d = Math.min(1, Math.max(0, (D - t.seuil) / (1 - 0.42)));
      const ec = d * d * (3 - 2 * d);
      // dans l'îlot : son geste au survol, et les plaques proches du curseur qui se soulèvent
      geste(reduit ? '' : il.geste, t, il.pop, temps, g);
      const lift = g.lift + 0.014 * t.prox;
      let lx = t.lx + g.dx, ly = t.ly + g.dy;
      if (g.roll) { const c = Math.cos(g.roll), s = Math.sin(g.roll); const a = lx * c - ly * s; ly = lx * s + ly * c; lx = a; }
      n1.copy(il.C).addScaledVector(il.E, Math.tan(lx * S)).addScaledVector(il.N, Math.tan(ly * S)).normalize();
      // son orientation : droite dans son îlot (tournée avec lui)
      e1.copy(il.E).multiplyScalar(Math.cos(g.roll)).addScaledVector(il.N, Math.sin(g.roll));
      e1.addScaledVector(n1, -e1.dot(n1)).normalize();
      y1.crossVectors(n1, e1);
      q1.setFromRotationMatrix(m4.makeBasis(e1, y1, n1));
      if (g.tx || g.ty) q1.multiply(qx.setFromEuler(eul.set(g.tx, g.ty, 0)));
      q1.premultiply(qs);
      const rr = Rc * (t.r + onde(n1.y) + lift);
      v1.copy(n1).applyQuaternion(qs).multiplyScalar(rr).add(cs);
      let ech = Rc, bend = 0.35 * (1 - g.plat);
      const nOmbre = v2.copy(n1).addScaledVector(e1, 0.012 + lift * 0.35).addScaledVector(y1, -0.016 - lift * 0.45).normalize();
      t.ombre.position.copy(nOmbre).applyQuaternion(qs).multiplyScalar(Rc).add(cs);
      t.ombre.quaternion.copy(q1);
      t.ombre.scale.setScalar(Rc);
      // en désordre : autour de la sphère, à plat, avec un léger flottement
      if (ec > 0) {
        v2.copy(t.cp).multiplyScalar(R).add(centre);
        v2.y += Math.sin(temps * 0.9 + t.cp.x * 4) * 0.05 * R;
        v1.lerp(v2, ec);
        qx.setFromEuler(eul.set(0, temps * 0.25 * (t.cp.z > 0 ? 1 : -1), 0));
        q2.copy(t.cq).multiply(qx);
        q1.slerp(q2, ec);
        ech = R * 0.9 * ec + Rc * (1 - ec);
        bend *= 1 - ec;
      }
      // la planche ouverte : chaque plaque rejoint sa case, l'une après l'autre, en passant un peu au-dessus de la sphère
      const f = il.k > 0 ? sortie(entre(il.k, 0.05 * t.ci, 0.05 * t.ci + 0.55)) : 0;
      if (f > 0) {
        const ef = f * f * (3 - 2 * f);
        surPlanche(t.bx - PLANCHE / 2, 0.5 - t.by, 0, v2);
        v3.copy(v1).sub(cs).normalize().multiplyScalar(Math.sin(Math.PI * ef) * 0.14 * R);
        v1.lerp(v2, ef).add(v3);
        q1.slerp(camera.quaternion, ef);
        ech += (planche.Hb / S - ech) * ef;
        bend *= 1 - ef;
      }
      t.mesh.position.copy(v1);
      t.mesh.quaternion.copy(q1);
      t.mesh.scale.setScalar(ech);
      t.mesh.visible = il.k < 0.999;
      { const uo = t.ombre.material.uniforms; uo.uCentre.value.copy(cs); uo.uR.value = Rc * 0.983;
        uo.uFlou.value = Math.min(t.mesh.material.uniforms.uCoin.value * (1.6 + lift * 40), 0.08);
        uo.uForce.value = 0.5 * (1 - ec) * (1 - f) / (1 + lift * 14) * (1 - 0.6 * (t.pi === choisie ? 0 : z)); t.ombre.visible = uo.uForce.value > 0.004; }
      u.uEch.value = ech;
      u.uCentre.value.copy(cs);
      u.uR.value = rr;
      u.uBend.value = bend;
      u.uSombre.value = (t.pi === choisie ? 0 : 0.6 * ez) + 0.25 * (focus >= 0 && t.pi !== focus ? zv : 0);
      u.uLueur.value = il.pop * (1 - f);
      u.uEclat.value = il.pop * 0.1 + g.glow + 0.06 * t.prox;
      // pour la souris : où est la plaque à l'écran (seulement celles qui nous font face)
      if (f === 0 && ec === 0) { const [sx, sy, sz] = ecran(v1); v2.copy(n1).applyQuaternion(qs); t.sx = v2.z > 0.1 && sz < 1 ? sx : -9999; t.sy = sy; } else t.sx = -9999;
    }
    // les planches ouvertes (ou qui se referment) : des points complètent les quatre plaques
    for (let pi = 0; pi < ilots.length; pi++) {
      const il = ilots[pi];
      if (!il.carte) continue;
      const kc = entre(il.k, 0.5, 1);
      il.carte.visible = kc > 0.001;
      if (!il.carte.visible) continue;
      const u = il.carte.material.uniforms;
      surPlanche(0, 0, 0.006, il.carte.position);
      il.carte.quaternion.copy(camera.quaternion);
      il.carte.scale.setScalar(planche.Hb);
      u.uEch.value = planche.Hb;
      u.uPoints.value = kc;
      u.uMaille.value = PLANCHE / (portrait ? 30 : 46);
      u.uMap2.value = grandes[pi] || planches[pi];
      u.uFondu.value = grandes[pi] && grandes[pi].image ? 1 : 0;
      u.uFocusK.value = pi === choisie ? focusK : 0;
    }
    // le cœur de verre
    coeur.position.copy(cs);
    coeur.quaternion.copy(qs);
    coeur.scale.setScalar(Rc * 0.975);
    coeur.material.uniforms.uT.value = temps;
    coeur.material.uniforms.uOpacite.value = 1 - 0.45 * ez;
    // le doigt touche la sphère sur son côté droit
    contact.copy(CONTACT).multiplyScalar(Rc * 1.02).add(cs);
    camera.updateMatrixWorld();
    placerEcran();
  }

  // le nom du projet survolé (ou choisi au clavier), au-dessus de son îlot
  let etiquette = -2;
  const placerEtiquette = () => {
    const pi = ouvert || z > 0.05 ? -1 : (focus >= 0 ? focus : survol);
    if (pi < 0) { if (etiquette !== -1) { etiquette = -1; onEtiquette(-1); } return; }
    const il = ilots[pi];
    n1.copy(il.C).addScaledVector(il.N, Math.tan(0.5 * S + 0.04)).normalize();
    v1.copy(n1).applyQuaternion(qs).multiplyScalar(Rc * 1.06).add(cs);
    const [x, y] = ecran(v1);
    etiquette = pi;
    onEtiquette(pi, x, y, Math.max(il.pop, focus === pi ? 1 : 0));
  };

  function dessiner() {
    camera.position.set(cam.x + Math.sin(temps * 0.21) * 0.08 * (1 - z), cam.y + Math.sin(temps * 0.17) * 0.04 * (1 - z), 10 - 0.75 * z * z * (3 - 2 * z));
    camera.lookAt(cam.x * 0.3, cam.y * 0.3, 0);
    camera.updateMatrixWorld();
    lumiere.set(-0.35 + 0.45 * Math.sin(temps * 0.13), 0.75, 0.55 + 0.25 * Math.cos(temps * 0.11)).normalize();
    poser();
    placerEtiquette();
    const tl = temps - tLueur;
    lueur.material.opacity = tl >= 0 && tl < 1.2 ? Math.sin(Math.PI * tl / 1.2) * 0.9 : 0;
    // la main (elle s'efface quand un projet s'ouvre)
    const u = main.material.uniforms;
    u.uOrdre.value = ordreMain; u.uT.value = temps; u.uTrouble.value = souris.trouble;
    u.uOpac.value = 1 - z;
    const gx = (glisse + z * 0.4) * W * 0.16;
    main.scale.set(mainPos.l, mainPos.h, 1);
    main.position.set(mainPos.x + mainPos.l / 2 + gx, H - (mainPos.y + mainPos.h / 2) + Math.sin(temps * 0.7) * 3, 0);
    u.uSouris.value.set((souris.x - mainPos.x - gx) / mainPos.l, (souris.y - mainPos.y) / mainPos.h);
    main.visible = pretMain && z < 0.98;
    voile.material.uniforms.uVoile.value = voileV;
    voile.visible = voileV < 1.3;
    soie.material.uniforms.uT.value = temps;
    grain.material.uniforms.uT.value = temps;
    grain.material.uniforms.uVoile.value = 0.35 * z;          // le fond s'efface un peu derrière la planche ouverte
    renderer.setRenderTarget(fondCible);
    renderer.render(fondScene, ortho2);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(grainScene, ortho2);
    renderer.render(plan, ortho);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.render(dessus, ortho);
    // la main-curseur, par-dessus tout (là où elle a été vue en dernier, le temps de s'effacer)
    doigt.visible = main2.vis > 0.01 && main2.x > -999;
    if (doigt.visible) {
      const ud = doigt.material.uniforms;
      doigt.scale.set(CURSEUR, CURSEUR, 1);
      doigt.position.set(main2.x, H - main2.y, 0);
      ud.uBout.value.set(main2.x, H - main2.y);
      ud.uDpr.value = dpr; ud.uAngle.value = main2.angle; ud.uT.value = reduit ? 0 : temps; ud.uVis.value = main2.vis;
      ud.uProjet.value = main2.projet; ud.uAppui.value = main2.appui; ud.uOnde.value = temps - main2.tOnde; ud.uVit.value = reduit ? 0 : main2.vit;
      renderer.render(curseurScene, ortho);
    }
  }

  // le projet sous la souris (seulement sur la sphère rangée, sans projet ouvert)
  const viser = (x, y) => {
    if (etat !== 'ordre' || z > 0.05 || ouvert) return -1;
    const ndc = new THREE.Vector2((x / W) * 2 - 1, 1 - (y / H) * 2);
    raycaster.setFromCamera(ndc, camera);
    for (const h of raycaster.intersectObjects(maillages, false)) {
      const t = tuiles[h.object.userData.i];
      // pas le dos des plaques de l'autre côté
      if (v1.copy(h.object.position).sub(cs).dot(v2.copy(camera.position).sub(cs)) < 0) continue;
      return t.pi;
    }
    // entre deux plaques d'un même îlot : l'îlot le plus proche de l'endroit où le rayon touche la sphère
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    v2.copy(o).sub(cs);
    const bq = v2.dot(d), cq = v2.lengthSq() - Rc * Rc, disc = bq * bq - cq;
    if (disc < 0) return -1;
    v2.copy(d).multiplyScalar(-bq - Math.sqrt(disc)).add(o).sub(cs).normalize().applyQuaternion(q2.copy(qs).invert());
    let mieux = -1, angle = 0.36;
    ilots.forEach((il, pi) => { const a = il.C.angleTo(v2); if (a < angle) { angle = a; mieux = pi; } });
    return mieux;
  };
  const raycaster = new THREE.Raycaster();

  // la qualité s'adapte : si l'appareil peine (plus de 26 ms par image en moyenne), on dessine moins de pixels
  let mesures = 0, moyenne = 16;
  const adapter = (brut) => {
    if (etat !== 'ordre' || brut > 100 || mesures > 400) return;
    moyenne += (brut - moyenne) * 0.05;
    if (++mesures % 90 === 0 && moyenne > 26) {
      if (dpr > 1.01) { dprMax = Math.max(1, dpr * 0.75); dpr = dprMax; regler(); }
      else if (echelleFond > 0.34) { echelleFond = 0.33; regler(); }
      moyenne = 16;
    }
  };

  const image = (now) => {
    boucle = 0;
    const brut = dernier ? now - dernier : 16;
    const dt = Math.min(0.05, brut / 1000);
    dernier = now;
    temps += dt;
    adapter(brut);
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
    // on ressort de l'univers : les points bleus se referment, les plaques repartent en désordre
    else if (etat === 'couvre') {
      voileV = Math.max(0, voileV - dt * 4);
      if (voileV <= 0) { etat = 'bleu'; D = 1; vD = 0; ordreMain = 0; glisse = 1; touche = false; }
    }
    vD += (34 * (cible - D) - 2 * Math.sqrt(34) * 0.7 * vD) * dt;
    D = Math.max(0, Math.min(1.25, D + vD * dt));
    // l'ouverture : la sphère amène l'îlot face à nous et la caméra avance ; puis les plaques rejoignent la planche
    const vite = reduit ? 4 : 1;
    const enCours = ilots.some((il) => il.k > 0.3);
    z += ((ouvert || enCours ? 1 : 0) - z) * (1 - Math.exp(-dt * 4.2 * vite));
    vise = ouvert ? choisie : focus;
    zv += ((vise >= 0 || enCours ? 1 : 0) - zv) * (1 - Math.exp(-dt * 4 * vite));
    if (vise >= 0) qVise.slerp(ilots[vise].visee, 1 - Math.exp(-dt * 5 * vite));
    else if (zv < 0.01) qVise.copy(qBase);
    ilots.forEach((il, pi) => {
      const veut = ouvert && pi === choisie;
      if (veut && z > 0.25) il.k = Math.min(1, il.k + (dt / 0.95) * vite);
      else if (!veut) il.k = Math.max(0, il.k - (dt / 0.7) * vite);
      il.pop += ((pi === survol || pi === focus) && !ouvert ? 1 - il.pop : -il.pop) * (1 - Math.exp(-dt * 9));
    });
    focusK += ((caseFocus ? 1 : 0) - focusK) * (1 - Math.exp(-dt * 8));
    if (!ouvert && ilots.every((il) => il.k <= 0) && z < 0.02) choisie = -1;
    // la rotation : très lente, seule, plus l'élan donné à la main ; arrêtée quand un projet est ouvert ou choisi
    if (ouvert || focus >= 0) vLacet = 0;
    else if (!appui) {
      lacet += (0.1 * (1 - zv) + vLacet) * dt * (reduit ? 0 : 1);
      vLacet *= Math.exp(-dt * 1.6);
      tangage += (0.1 - tangage) * (1 - Math.exp(-dt * 1.2));
    }
    // le projet sous le curseur change aussi quand la sphère tourne toute seule
    if (souris.f && !appui && !ouvert && etat === 'ordre') survol = viser(souris.x, souris.y);
    // les plaques proches du curseur
    const rayon = Math.min(W, H) * 0.17;
    for (const t of tuiles) {
      const dd = souris.f && !appui && !ouvert ? Math.hypot(t.sx - souris.x, t.sy - souris.y) / rayon : 9;
      const cibleP = dd < 1 ? (1 - dd) * (1 - dd) : 0;
      t.prox += (cibleP - t.prox) * (1 - Math.exp(-dt * 6));
    }
    souris.trouble += ((souris.f ? 1 : 0) - souris.trouble) * (1 - Math.exp(-dt * 5));
    const kc = 1 - Math.exp(-dt * 2.2);
    const libre = souris.f && !appui && !ouvert && !reduit;
    cam.x += ((libre ? (souris.x / W - 0.5) * 0.6 : 0) - cam.x) * kc;
    cam.y += ((libre ? (0.5 - souris.y / H) * 0.3 : 0) - cam.y) * kc;
    // la sphère regarde un peu vers le curseur
    regard.x += ((libre ? (souris.x / W - 0.5) * 0.16 : 0) - regard.x) * kc;
    regard.y += ((libre ? (souris.y / H - 0.5) * 0.1 : 0) - regard.y) * kc;
    // la main-curseur : elle apparaît, s'incline un peu dans le sens où elle va, s'éclaire sur un projet
    const ici = souris.m && souris.x > -999;
    const vx = ici && main2.x > -999 ? (souris.x - main2.x) / dt : 0, vy = ici && main2.x > -999 ? (souris.y - main2.y) / dt : 0;
    if (ici) { main2.x = souris.x; main2.y = souris.y; }
    main2.vis += ((ici ? 1 : 0) - main2.vis) * (1 - Math.exp(-dt * 16));
    main2.vit += ((ici ? Math.min(1, Math.hypot(vx, vy) / 2600) : 0) - main2.vit) * (1 - Math.exp(-dt * 10));
    main2.angle += ((-0.72 + (reduit ? 0 : Math.max(-0.18, Math.min(0.18, vx * 0.00009)))) - main2.angle) * (1 - Math.exp(-dt * 7));
    main2.appui += ((appuye ? 1 : 0) - main2.appui) * (1 - Math.exp(-dt * 18));
    main2.projet += ((survol >= 0 && !appui ? 1 : 0) - main2.projet) * (1 - Math.exp(-dt * 10));
    dessiner();
    if (visible && !document.hidden) boucle = requestAnimationFrame(image);
  };
  const relancer = () => { if (!boucle && visible) { dernier = 0; boucle = requestAnimationFrame(image); } };
  document.addEventListener('visibilitychange', relancer);

  // ouvrir un projet : sa planche (la grande sur les écrans fins, dès qu'elle est chargée), sa fiche
  const ouvrir = (pi) => {
    if (pi < 0 || pi >= projets.length) return;
    if (!ouvert) qVise.copy(qs);
    carteDe(pi);
    const pr = projets[pi];
    if (pr.grande && !grandes[pi]) grandes[pi] = texture(pr.grande);
    choisie = pi; ouvert = true; survol = -1; caseFocus = null;
    onOuvre(pi);
    relancer();
  };
  const fermer = () => { if (!ouvert) return false; ouvert = false; caseFocus = null; onOuvre(-1); relancer(); return true; };

  const enOrdre = () => { etat = 'ordre'; D = 0; vD = 0; ordreMain = 1; voileV = 1.35; glisse = 0; touche = true; };
  taille();
  if (reduit) enOrdre();
  dessiner();

  return {
    visible(oui) { visible = oui; if (oui && !reduit) relancer(); else if (!oui && boucle) { cancelAnimationFrame(boucle); boucle = 0; } if (oui && reduit) relancer(); },
    taille,
    jouer() { if (reduit) { enOrdre(); onContact(); dessiner(); return; } etat = 'joue'; t0 = temps; touche = false; D = 1; vD = 0; fermer(); relancer(); },
    montrer() { enOrdre(); onContact(); dessiner(); relancer(); },
    couvrir() { if (etat === 'bleu' || etat === 'couvre') return; fermer(); if (reduit) { this.recouvrir(); return; } etat = 'couvre'; relancer(); },
    // le défilement donne de l'élan à la sphère
    elan(d) { if (etat !== 'ordre' || ouvert || reduit) return; vLacet = Math.max(-0.9, Math.min(0.9, vLacet + d * 0.0016)); relancer(); },
    recouvrir() {
      etat = 'bleu'; D = 1; vD = 0; ordreMain = 0; voileV = 0; glisse = 1; touche = false; tLueur = -9;
      const etaitOuvert = ouvert;
      ouvert = false; z = 0; zv = 0; choisie = -1; focus = -1; caseFocus = null;
      ilots.forEach((il) => { il.k = 0; il.pop = 0; });
      if (etaitOuvert) onOuvre(-1);
      dessiner();
    },
    // dedans : la souris (ou un doigt posé) agit sur la sphère ; main : c'est une souris, la main-curseur la suit
    souris(x, y, dedans, main) {
      souris.x = x; souris.y = y; souris.f = dedans ? 1 : 0; souris.m = main ? 1 : 0;
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
    appui(x, y) {
      appuye = true; main2.tOnde = temps;                  // la main s'enfonce, une onde part du doigt
      if (etat === 'ordre' && !ouvert) { appui = { x, y, px: x, py: y, t: performance.now() }; aGlisse = false; vLacet = 0; focus = -1; }
      relancer();
    },
    lache() { appui = null; appuye = false; },
    sous(x, y) {
      if (etat !== 'ordre') return '';
      if (ouvert) return 'ouvert';
      if (viser(x, y) >= 0) return 'projet';
      return Math.hypot(x - cSphere[0], y - cSphere[1]) < rSphere * 1.05 ? 'sphere' : '';
    },
    // un clic : sur un îlot, son projet s'ouvre ; quand un projet est ouvert, un clic à côté de la fiche le referme
    clic(x, y) {
      if (aGlisse) { aGlisse = false; return false; }
      if (etat !== 'ordre') return false;
      if (ouvert) return fermer();
      const pi = viser(x, y);
      if (pi < 0) return false;
      ouvrir(pi);
      return true;
    },
    ouvrir(pi) { if (etat !== 'ordre') this.montrer(); ouvrir(pi); },
    fermer,
    // le projet suivant (+1) ou précédent (-1), sans quitter la fiche
    suivant(d) { if (!ouvert) return; ouvrir((choisie + d + projets.length) % projets.length); },
    // au clavier : la sphère se tourne vers le projet choisi (sans l'ouvrir) ; -1 : elle reprend sa rotation
    viser(pi) { if (etat !== 'ordre' && pi >= 0) this.montrer(); focus = pi; if (pi >= 0 && zv < 0.01) qVise.copy(qs); relancer(); },
    // une case mise en avant dans la planche ouverte ('affiche', 'logo'…), ou null
    cellule(nom) { caseFocus = nom && CASES[nom] ? nom : null; if (caseFocus) { const r = rectGL(CASES[caseFocus]); ilots.forEach((il) => { if (il.carte) il.carte.material.uniforms.uFocus.value.set(...r); }); } relancer(); },
    ouvert: () => (ouvert ? choisie : -1),
  };
}
