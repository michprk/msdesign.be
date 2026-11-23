/* ==========================================================================
   Le champ de points (accueil, juste avant « Nos projets »)
   Un paysage fait de dizaines de milliers de points bleus, vu en perspective : une vallée calme au milieu
   (là où se pose le titre) et des crêtes de chaque côté. Les points avancent doucement vers nous,
   une houle les traverse, la souris soulève ceux qu'elle survole.
     naitre()  : le paysage se lève depuis le centre, comme une vague (une seule fois)
     plonger() : la caméra fonce dans la vallée, les points s'étirent en traînées, le fond passe au bleu nuit
     reposer() : retour à l'état calme (appelé une fois qu'on est arrivé aux projets)
   WebGL 2 sans bibliothèque : un seul petit carré, dessiné une fois par point (instances) ;
   la position de chaque point se calcule dans le shader à partir de son numéro.
   ========================================================================== */

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCoin;
uniform vec2 uGrille;              // colonnes, rangées
uniform vec2 uPas;                 // écart entre deux points (x, z), en unités du monde
uniform float uZ0;                 // la rangée la plus proche
uniform float uFlux, uFluxAvant;   // de combien le champ a avancé vers nous (maintenant, un instant avant)
uniform float uT, uNaissance, uNuit, uVallee, uTaille, uDpr;
uniform float uPlonge, uGel;        // la plongée (0 → 1) ; le champ « gelé » au départ : il ne se replie plus, on le traverse
uniform mat4 uVP, uVPAvant;
uniform vec2 uEcran;               // taille du dessin, en pixels
uniform vec3 uSouris;              // x, z au sol, force
out vec2 vLocal;
out float vDemi;
out float vR;
out float vA;
out vec3 vCouleur;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 3; k++) { s += a * bruit(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// des crêtes nettes (bruit « replié ») : des montagnes plutôt que des bosses
float cretes(vec2 p) { float s = 0.0, a = 0.6; for (int k = 0; k < 4; k++) { float n = 1.0 - abs(bruit(p) * 2.0 - 1.0); s += a * n * n; p = p * 2.07 + 9.7; a *= 0.47; } return s; }

void main() {
  float colonnes = uGrille.x;
  float ix = mod(float(gl_InstanceID), colonnes), iz = floor(float(gl_InstanceID) / colonnes);
  float D = uGrille.y * uPas.y;
  // au calme, les rangées qui passent devant repartent au fond ; pendant la plongée, plus de repli : on traverse le champ
  float base = uPlonge > 0.0 ? uGel : uFlux;
  float z0 = uZ0 - mod(iz * uPas.y - base, D);                             // sa place dans le champ
  float z = z0 + (uPlonge > 0.0 ? uFlux - uGel : 0.0);                     // sa place réelle (pendant la plongée, il vient vers nous)
  float x = (ix - (colonnes - 1.0) * 0.5 + mod(iz, 2.0) * 0.5) * uPas.x;   // une rangée sur deux décalée d'un demi-pas
  vec2 t = vec2(x, z0 - base);                                              // l'endroit du terrain que ce point porte
  float ax = abs(x);

  // le terrain : une vallée au milieu, des crêtes de chaque côté, une houle légère sur tout le champ
  float vallee = smoothstep(uVallee, uVallee * 2.6 + 1.4, ax);
  float h = vallee * (0.1 + 1.75 * cretes(t * 0.15 + vec2(3.1, 0.0)) * smoothstep(0.0, 0.6, cretes(t * 0.05 + 11.0)) + 0.3 * fbm(t * 0.5));
  h += 0.05 * sin(t.y * 1.25 + x * 0.4 - uT * 1.1);

  // la naissance : le paysage se lève depuis le milieu, une vague qui part vers les côtés et le lointain
  float retard = clamp(length(vec2(x * 0.075, (uZ0 - z0) * 0.03)), 0.0, 1.0) * 0.6;
  float p = clamp((uNaissance - retard) / 0.4, 0.0, 1.0);
  float vague = p > 0.0 && p < 1.0 ? exp(-pow((p - 0.45) * 4.5, 2.0)) : 0.0;
  h *= 1.0 - pow(1.0 - p, 3.0);

  // la souris soulève les points qu'elle survole
  vec2 dm = vec2(x - uSouris.x, (z - uSouris.y) * 0.75);
  float bosse = uSouris.z * exp(-dot(dm, dm) * 1.3);
  h += bosse * 0.55;

  vec4 c = uVP * vec4(x, h, z, 1.0);
  if (c.w < 0.25) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
  vec4 cp = uVPAvant * vec4(x, h, z - (uFlux - uFluxAvant), 1.0);
  vec2 s = c.xy / c.w;
  vec2 sp = cp.w > 0.25 ? cp.xy / cp.w : s;
  vec2 dv = (s - sp) * 0.5 * uEcran;                  // le chemin parcouru à l'écran, en pixels : la traînée
  float L = min(length(dv), uEcran.y * 0.4);

  float r = uTaille * uDpr * pow(12.0 / c.w, 0.7) * (1.0 + bosse * 0.9 + vague * 0.7);
  r = clamp(r, 0.6 * uDpr, 5.5 * uDpr);
  vec2 dir = L > 0.01 ? normalize(dv) : vec2(1.0, 0.0), perp = vec2(-dir.y, dir.x);
  vLocal = vec2(aCoin.x * (L * 0.5 + r + 1.0), aCoin.y * (r + 1.0));
  vDemi = L * 0.5;
  vR = r;
  vec2 centre = s - dv / uEcran;                      // au milieu de la traînée
  vec2 decale = (dir * vLocal.x + perp * vLocal.y) * 2.0 / uEcran;
  gl_Position = vec4((centre + decale) * c.w, c.z, c.w);

  // l'encre : le fond de la vallée à peine marqué, les crêtes franches ; le lointain et les bords se perdent
  float a = mix(0.17, 1.0, smoothstep(0.05, 0.55, h));
  a = mix(a, 1.0, max(uNuit * 0.6, smoothstep(0.0, 0.35, uPlonge) * 0.75));   // en plongée, le sol file sous nous
  a *= mix(0.4, 1.0, smoothstep(0.0, 0.2, p));
  a *= smoothstep(uZ0 - D, uZ0 - D + 8.0, z0);                // le lointain se perd
  a *= (1.0 - smoothstep(uZ0 - 1.5, uZ0 + 0.01, z0)) * (1.0 - uPlonge) + uPlonge;   // la rangée de devant s'efface avant de repartir au fond
  float bord = (colonnes - 1.0) * 0.5 * uPas.x;
  a *= 1.0 - smoothstep(bord - 3.0, bord, ax);
  a *= clamp(r / (1.2 * uDpr), 0.35, 1.0);
  a /= 1.0 + L / (r * 5.0);
  vA = a;

  float k = smoothstep(0.05, 1.3, h);
  vec3 jour = mix(vec3(0.6, 0.7, 0.92), vec3(0.082, 0.369, 0.937), k);      // bleu pâle → bleu électrique
  jour = mix(jour, vec3(0.03, 0.2, 0.62), smoothstep(1.25, 2.1, h));          // le haut des crêtes, plus profond
  jour = mix(jour, vec3(0.082, 0.369, 0.937), clamp(max(bosse, vague), 0.0, 1.0) * 0.85);
  vec3 nuit = mix(vec3(0.3, 0.48, 1.0), vec3(0.86, 0.91, 1.0), k);
  vCouleur = mix(jour, nuit, uNuit);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vDemi;
in float vR;
in float vA;
in vec3 vCouleur;
out vec4 o;
void main() {
  float d = length(vec2(max(abs(vLocal.x) - vDemi, 0.0), vLocal.y));   // un point, ou une capsule quand il file
  float a = vA * (1.0 - smoothstep(vR - 0.75, vR + 0.35, d));
  if (a < 0.003) discard;
  o = vec4(vCouleur * a, a);
}`;

const JOUR = [245 / 255, 241 / 255, 233 / 255];   // le beige de la page (--bg)
const BLEU = [24 / 255, 60 / 255, 178 / 255];       // au milieu de la plongée
const NUIT = [7 / 255, 12 / 255, 33 / 255];        // le bleu nuit de « Nos projets »
const NAISSANCE = 2.6;                              // secondes
const PLONGEE = 1.15;

const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function perspective(fov, aspect, pres, loin) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (pres - loin);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (loin + pres) * nf, -1, 0, 0, 2 * loin * pres * nf, 0];
}
function regard(oeil, cible) {
  let zx = oeil[0] - cible[0], zy = oeil[1] - cible[1], zz = oeil[2] - cible[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx;                       // haut = (0, 1, 0)
  l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return {
    m: [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * oeil[0] + xy * oeil[1] + xz * oeil[2]), -(yx * oeil[0] + yy * oeil[1] + yz * oeil[2]), -(zx * oeil[0] + zy * oeil[1] + zz * oeil[2]), 1],
    avant: [-zx, -zy, -zz], droite: [xx, xy, xz], haut: [yx, yy, yz],
  };
}
function fois(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}

export function createChamp(toile, opts = {}) {
  const gl = toile.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const shader = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = {};
  for (const n of ['uGrille', 'uPas', 'uZ0', 'uFlux', 'uFluxAvant', 'uT', 'uNaissance', 'uNuit', 'uVallee', 'uTaille', 'uDpr', 'uVP', 'uVPAvant', 'uEcran', 'uSouris', 'uPlonge', 'uGel']) U[n] = gl.getUniformLocation(prog, n);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);

  const reduit = !!opts.reduced;
  let W = 1, H = 1, dpr = 1, aspect = 1, colonnes = 200, rangees = 180, pasX = 0.09, vallee = 1.3, Z0 = 3.4;
  const PAS_Z = 0.3;                                  // des rangées bien séparées : chacune dessine une ligne de crête
  let visible = false, boucle = 0, dernier = 0, temps = 0, flux = 0;
  let naissance = reduit ? 1 : 0, nee = reduit, tNaissance = 0;
  let plonge = -1, finPlongee = null, gel = 0;                  // -1 : au calme ; sinon le temps écoulé depuis le départ
  const souris = { x: 0, z: -8, f: 0, cx: 0, cz: -8, cf: 0, vx: 0, vz: 0 };

  // la caméra : un peu en hauteur, objectif long (les rangées se serrent comme sur une gravure) ;
  // pendant la plongée elle descend dans la vallée et l'angle s'ouvre
  const camera = (u) => {
    const portrait = aspect < 0.95, e = u * u;
    const fov = ((portrait ? 44 : 30) + 10 * e) * Math.PI / 180;
    const oeil = [0, (portrait ? 3.0 : 2.8) - 2.1 * lisse(0, 0.7, u), 9];
    // on regarde presque à l'horizontale : l'horizon tombe sous le milieu de l'écran, le titre a de l'air au-dessus
    const r = regard(oeil, [0, (portrait ? 2.4 : 1.95) - 1.45 * lisse(0, 0.7, u), -10]);
    return { vp: fois(perspective(fov, aspect, 0.1, 80), r.m), r, fov, oeil };
  };
  // le champ fonce vers nous : ça part tout de suite et ça accélère jusqu'au bout
  const fluxPlongee = (u) => 14 * u + 46 * Math.pow(u, 2.0);

  const taille = () => {
    const b = toile.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (b.width * dpr > 2800) dpr = 2800 / b.width;
    W = Math.max(1, Math.round(b.width * dpr)); H = Math.max(1, Math.round(b.height * dpr));
    toile.width = W; toile.height = H;
    aspect = b.width / Math.max(1, b.height);
    // assez large pour remplir l'écran jusqu'au lointain ; moins de points sur un petit écran
    const c = camera(0), demi = 38 * Math.tan(c.fov / 2) * aspect + 3;
    const max = b.width < 760 ? 26000 : 62000;
    rangees = b.width < 760 ? 96 : 112;
    pasX = Math.max(0.06, (2 * demi) / (max / rangees));
    colonnes = Math.ceil((2 * demi) / pasX);
    vallee = aspect < 0.95 ? 0.55 : 1.3;
    Z0 = 1.2;
    gl.viewport(0, 0, W, H);
    dessiner();
  };

  const dessiner = () => {
    let u = 0, nuit = 0;
    if (plonge >= 0) { u = Math.min(1, plonge / PLONGEE); nuit = lisse(0.3, 0.9, u); }
    const f = flux + fluxPlongee(u);
    const c = camera(u);
    const ua = Math.max(0, u - 0.05), avant = plonge >= 0 ? camera(ua) : c, fAvant = plonge >= 0 ? flux + fluxPlongee(ua) : f;
    // le fond passe par le bleu (pas par le gris) avant le bleu nuit des projets
    const fond = nuit < 0.5 ? JOUR.map((j, i) => j + (BLEU[i] - j) * nuit * 2) : BLEU.map((b, i) => b + (NUIT[i] - b) * (nuit * 2 - 1));
    gl.clearColor(fond[0], fond[1], fond[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uGrille, colonnes, rangees);
    gl.uniform2f(U.uPas, pasX, PAS_Z);
    gl.uniform1f(U.uZ0, Z0);
    gl.uniform1f(U.uFlux, f);
    gl.uniform1f(U.uFluxAvant, fAvant);
    gl.uniform1f(U.uPlonge, u);
    gl.uniform1f(U.uGel, gel);
    gl.uniform1f(U.uT, temps);
    gl.uniform1f(U.uNaissance, naissance);
    gl.uniform1f(U.uNuit, nuit);
    gl.uniform1f(U.uVallee, vallee);
    gl.uniform1f(U.uTaille, W / dpr < 760 ? 1.35 : 1.5);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniformMatrix4fv(U.uVP, false, c.vp);
    gl.uniformMatrix4fv(U.uVPAvant, false, avant.vp);
    gl.uniform2f(U.uEcran, W, H);
    gl.uniform3f(U.uSouris, souris.cx, souris.cz, souris.cf * (1 - nuit));
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, colonnes * rangees);
  };

  const image = (now) => {
    boucle = 0;
    const dt = Math.min(0.05, dernier ? (now - dernier) / 1000 : 0.016);
    dernier = now;
    if (!reduit) { temps += dt; flux = (flux + dt * 0.32) % 4000; }
    if (!nee && tNaissance > 0) { naissance = Math.min(1, (now - tNaissance) / 1000 / NAISSANCE); if (naissance >= 1) nee = true; }
    // la souris : un ressort, pour que la bosse glisse au lieu de sauter
    const k = 1 - Math.exp(-dt * 7);
    souris.cx += (souris.x - souris.cx) * k; souris.cz += (souris.z - souris.cz) * k; souris.cf += (souris.f - souris.cf) * (1 - Math.exp(-dt * 4));
    if (plonge >= 0 && finPlongee) {
      plonge += dt;
      if (plonge >= PLONGEE) { const fin = finPlongee; finPlongee = null; plonge = PLONGEE; fin(); }
    }
    dessiner();
    if (visible && !document.hidden && !reduit) boucle = requestAnimationFrame(image);
  };
  const relancer = () => { if (!boucle && visible && !reduit) { dernier = 0; boucle = requestAnimationFrame(image); } };
  document.addEventListener('visibilitychange', relancer);

  taille();
  toile.classList.add('is-pret');

  return {
    visible(oui) { visible = oui; if (oui) relancer(); else if (boucle) { cancelAnimationFrame(boucle); boucle = 0; } },
    taille,
    naitre() { if (nee || tNaissance) return; tNaissance = performance.now(); relancer(); },
    // x, y : la position de la souris sur la section, de -0,5 à 0,5 ; on cherche où ce rayon touche le sol
    souris(x, y) {
      if (reduit) return;
      const c = camera(0), t = Math.tan(c.fov / 2);
      const d = [0, 1, 2].map((i) => c.r.avant[i] + c.r.droite[i] * (x * 2) * t * aspect + c.r.haut[i] * (-y * 2) * t);
      if (d[1] > -0.02) { souris.f = 0; return; }
      const s = (0.45 - c.oeil[1]) / d[1];
      souris.x = c.oeil[0] + d[0] * s; souris.z = c.oeil[2] + d[2] * s; souris.f = 1;
    },
    quitte() { souris.f = 0; },
    plonger(fin) {
      if (reduit) { if (fin) fin(); return; }
      naissance = 1; nee = true; plonge = 0; gel = flux; finPlongee = fin || (() => {}); relancer();
    },
    reposer() { plonge = -1; finPlongee = null; dessiner(); },
  };
}
