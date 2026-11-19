// =============================================================================
// L'éclaboussure d'encre : quand le grand coup de pinceau bleu arrive au centre de l'écran, il éclabousse ;
// l'encre tourbillonne (une vraie petite simulation de fluide, WebGL 2), puis s'étend et « mange » le papier :
// là où elle est passée, on voit la scène qui était derrière (le ciel, la poire dorée, la main). Il ne reste
// qu'un liseré d'encre sur le bord qui avance, et quand il a dépassé les coins de l'écran, le papier a disparu.
//   createEncre(canvas, { onFini }) → { eclabousser(x, y), recouvrir(), devoiler(), visible(v), taille() }
//   ou null (pas de WebGL 2 : la scène est simplement visible). x, y en pixels du canevas.
// La simulation : la vitesse de l'eau est transportée par elle-même, rendue sans compression (pression),
// avec un peu de tourbillon en plus ; l'encre suit l'eau.
// =============================================================================

const VS = `#version 300 es
precision highp float;
in vec2 aPos; out vec2 vUv, vL, vR, vT, vB;
uniform vec2 uTexel;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const ENTETE = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 sortie;
`;

// ajoute une tache (de vitesse ou d'encre) autour d'un point
const SPLAT = ENTETE + `uniform sampler2D uCible; uniform vec2 uPoint; uniform vec3 uValeur; uniform float uRayon, uRatio;
void main() { vec2 p = vUv - uPoint; p.x *= uRatio; sortie = vec4(texture(uCible, vUv).xyz + exp(-dot(p, p) / uRayon) * uValeur, 1.0); }`;

// transporte une grandeur le long de la vitesse
const ADVECTION = ENTETE + `uniform sampler2D uVitesse, uSource; uniform vec2 uTexelV; uniform float uDt, uGarde;
void main() { vec2 c = vUv - uDt * texture(uVitesse, vUv).xy * uTexelV; sortie = uGarde * texture(uSource, c); }`;

const DIVERGENCE = ENTETE + `uniform sampler2D uVitesse;
void main() {
  float L = texture(uVitesse, vL).x, R = texture(uVitesse, vR).x, T = texture(uVitesse, vT).y, B = texture(uVitesse, vB).y;
  vec2 C = texture(uVitesse, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  sortie = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const ROTATIONNEL = ENTETE + `uniform sampler2D uVitesse;
void main() { float L = texture(uVitesse, vL).y, R = texture(uVitesse, vR).y, T = texture(uVitesse, vT).x, B = texture(uVitesse, vB).x; sortie = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`;

// renforce les petits tourbillons (sans cela, l'eau numérique est trop sage)
const TOURBILLON = ENTETE + `uniform sampler2D uVitesse, uRot; uniform float uForce, uDt;
void main() {
  float L = texture(uRot, vL).x, R = texture(uRot, vR).x, T = texture(uRot, vT).x, B = texture(uRot, vB).x, C = texture(uRot, vUv).x;
  vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 0.0001; f *= uForce * C; f.y *= -1.0;
  sortie = vec4(texture(uVitesse, vUv).xy + f * uDt, 0.0, 1.0);
}`;

const PRESSION = ENTETE + `uniform sampler2D uPression, uDivergence;
void main() { float L = texture(uPression, vL).x, R = texture(uPression, vR).x, T = texture(uPression, vT).x, B = texture(uPression, vB).x;
  sortie = vec4((L + R + B + T - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`;

const GRADIENT = ENTETE + `uniform sampler2D uPression, uVitesse;
void main() { float L = texture(uPression, vL).x, R = texture(uPression, vR).x, T = texture(uPression, vT).x, B = texture(uPression, vB).x;
  sortie = vec4(texture(uVitesse, vUv).xy - vec2(R - L, T - B), 0.0, 1.0); }`;

const AMORTI = ENTETE + `uniform sampler2D uSource; uniform float uValeur;
void main() { sortie = uValeur * texture(uSource, vUv); }`;

// l'affichage : le papier, l'encre bleue qui tourbillonne, et le trou qui s'ouvre sur la scène derrière ;
// le bord du trou est irrégulier (un bruit, et l'encre qui le pousse) et garde un liseré d'encre
const AFFICHAGE = ENTETE + `uniform sampler2D uEncre; uniform vec3 uBleu, uPapier; uniform vec2 uTexelE, uCentre; uniform float uFront, uRatio;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bruit(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * bruit(p); p *= 2.07; a *= 0.5; } return s; }
void main() {
  float e = clamp(texture(uEncre, vUv).x, 0.0, 1.6);
  float dx = texture(uEncre, vUv + vec2(uTexelE.x, 0.0)).x - texture(uEncre, vUv - vec2(uTexelE.x, 0.0)).x;
  float dy = texture(uEncre, vUv + vec2(0.0, uTexelE.y)).x - texture(uEncre, vUv - vec2(0.0, uTexelE.y)).x;
  vec2 q = (vUv - uCentre) * vec2(uRatio, 1.0);
  float d = length(q) + 0.12 * (fbm(vUv * vec2(uRatio, 1.0) * 3.5) - 0.5) - 0.07 * e;
  float trou = (1.0 - smoothstep(uFront - 0.012, uFront + 0.012, d)) * step(0.0001, uFront);   // 1 : on voit la scène
  float bord = exp(-pow((d - uFront) / 0.03, 2.0)) * step(0.0001, uFront);                     // le liseré d'encre
  float encreA = clamp(smoothstep(0.12, 0.62, e) * (1.0 - 0.9 * trou) + bord, 0.0, 1.0);
  float a = max(1.0 - trou, encreA);
  vec3 encre = uBleu * (1.0 - 0.16 * smoothstep(0.9, 1.5, e)) + vec3(0.06) * clamp(-dx * 1.4 + dy * 1.4, -1.0, 1.0);
  vec3 c = mix(uPapier, encre, encreA / max(a, 0.001)) + (h(gl_FragCoord.xy) - 0.5) * 0.022;
  sortie = vec4(c * a, a);                                                                          // alpha prémultiplié
}`;

const rvb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const lisse = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createEncre(canvas, { bleu = 0x155eef, papier = 0xf5f1e9, onFini = null } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;

  const compiler = (fs) => {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nom = gl.getActiveUniform(p, i).name; u[nom] = gl.getUniformLocation(p, nom); }
    return { p, u };
  };
  const P = {
    splat: compiler(SPLAT), advection: compiler(ADVECTION), divergence: compiler(DIVERGENCE), rot: compiler(ROTATIONNEL),
    tourbillon: compiler(TOURBILLON), pression: compiler(PRESSION), gradient: compiler(GRADIENT), amorti: compiler(AMORTI),
    affichage: compiler(AFFICHAGE),
  };
  const tampon = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // une texture de calcul (et son double, pour lire l'une en écrivant dans l'autre)
  const cible = (w, h, format, interne, lineaire = true) => {
    gl.activeTexture(gl.TEXTURE0);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const f = lineaire ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, interne, w, h, 0, format, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, fb, w, h, texel: [1 / w, 1 / h], lier(i) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); return i; } };
  };
  const double = (w, h, format, interne, lineaire) => {
    let a = cible(w, h, format, interne, lineaire), b = cible(w, h, format, interne, lineaire);
    return { get lire() { return a; }, get ecrire() { return b; }, echanger() { [a, b] = [b, a]; }, w, h, texel: a.texel };
  };

  let vitesse, encre, pression, divergence, rot, W = 1, H = 1, ratio = 1;
  const papierC = rvb(papier), bleuC = rvb(bleu);

  const dessiner = (sortie) => {
    if (sortie) { gl.bindFramebuffer(gl.FRAMEBUFFER, sortie.fb); gl.viewport(0, 0, sortie.w, sortie.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const utiliser = (prog, texel) => { gl.useProgram(prog.p); gl.uniform2f(prog.u.uTexel, texel[0], texel[1]); return prog.u; };

  const initialiser = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(2, Math.round(canvas.clientWidth * dpr)); H = Math.max(2, Math.round(canvas.clientHeight * dpr));
    canvas.width = W; canvas.height = H; ratio = W / H;
    const res = (base) => { const court = Math.round(base), long = Math.round(base * Math.max(ratio, 1 / ratio)); return ratio >= 1 ? [long, court] : [court, long]; };
    const [vw, vh] = res(Math.min(160, Math.min(W, H) / 4)), [ew, eh] = res(Math.min(720, Math.min(W, H)));
    vitesse = double(vw, vh, gl.RG, gl.RG16F); encre = double(ew, eh, gl.RED, gl.R16F);
    pression = double(vw, vh, gl.RED, gl.R16F, false); divergence = cible(vw, vh, gl.RED, gl.R16F, false); rot = cible(vw, vh, gl.RED, gl.R16F, false);
  };

  const tache = (d, x, y, valeur, rayon) => {
    const u = utiliser(P.splat, d.texel);
    gl.uniform1i(u.uCible, d.lire.lier(0)); gl.uniform2f(u.uPoint, x, y); gl.uniform3f(u.uValeur, valeur[0], valeur[1], valeur[2] || 0);
    gl.uniform1f(u.uRayon, rayon); gl.uniform1f(u.uRatio, ratio);
    dessiner(d.ecrire); d.echanger();
  };

  const pas = (dt) => {
    let u = utiliser(P.rot, vitesse.texel); gl.uniform1i(u.uVitesse, vitesse.lire.lier(0)); dessiner(rot);
    u = utiliser(P.tourbillon, vitesse.texel); gl.uniform1i(u.uVitesse, vitesse.lire.lier(0)); gl.uniform1i(u.uRot, rot.lier(1));
    gl.uniform1f(u.uForce, 26); gl.uniform1f(u.uDt, dt); dessiner(vitesse.ecrire); vitesse.echanger();
    u = utiliser(P.divergence, vitesse.texel); gl.uniform1i(u.uVitesse, vitesse.lire.lier(0)); dessiner(divergence);
    u = utiliser(P.amorti, pression.texel); gl.uniform1i(u.uSource, pression.lire.lier(0)); gl.uniform1f(u.uValeur, 0.8); dessiner(pression.ecrire); pression.echanger();
    u = utiliser(P.pression, pression.texel); gl.uniform1i(u.uDivergence, divergence.lier(1));
    for (let i = 0; i < 18; i++) { gl.uniform1i(u.uPression, pression.lire.lier(0)); dessiner(pression.ecrire); pression.echanger(); }
    u = utiliser(P.gradient, vitesse.texel); gl.uniform1i(u.uPression, pression.lire.lier(0)); gl.uniform1i(u.uVitesse, vitesse.lire.lier(1)); dessiner(vitesse.ecrire); vitesse.echanger();
    u = utiliser(P.advection, vitesse.texel); gl.uniform2f(u.uTexelV, vitesse.texel[0], vitesse.texel[1]); gl.uniform1f(u.uDt, dt);
    gl.uniform1i(u.uVitesse, vitesse.lire.lier(0)); gl.uniform1i(u.uSource, vitesse.lire.lier(0)); gl.uniform1f(u.uGarde, 1 / (1 + dt * 0.6)); dessiner(vitesse.ecrire); vitesse.echanger();
    u = utiliser(P.advection, encre.texel); gl.uniform2f(u.uTexelV, vitesse.texel[0], vitesse.texel[1]); gl.uniform1f(u.uDt, dt);
    gl.uniform1i(u.uVitesse, vitesse.lire.lier(0)); gl.uniform1i(u.uSource, encre.lire.lier(1)); gl.uniform1f(u.uGarde, 1 / (1 + dt * 0.25)); dessiner(encre.ecrire); encre.echanger();
  };

  // le trou s'ouvre sur la scène : son rayon (en hauteurs d'écran), qui grandit après l'éclaboussure
  let centre = [0.5, 0.5], front = 0, tEclat = -1;
  const OUVERTURE = 0.35, DUREE = 1.7;                     // en secondes : l'attente avant que le trou s'ouvre, puis son ouverture
  const loin = () => Math.hypot(Math.max(centre[0], 1 - centre[0]) * ratio, Math.max(centre[1], 1 - centre[1])) + 0.2;
  const afficher = () => {
    const u = utiliser(P.affichage, encre.texel);
    gl.uniform1i(u.uEncre, encre.lire.lier(0)); gl.uniform3f(u.uBleu, ...bleuC); gl.uniform3f(u.uPapier, ...papierC);
    gl.uniform2f(u.uTexelE, encre.texel[0], encre.texel[1]); gl.uniform2f(u.uCentre, centre[0], centre[1]);
    gl.uniform1f(u.uFront, front); gl.uniform1f(u.uRatio, ratio);
    gl.clearColor(0, 0, 0, 0); dessiner(null);
  };

  let vivant = true, raf = 0, dernier = 0, actif = false, fini = false;
  const image = (now) => {
    raf = 0;
    if (!vivant || !actif) return;
    const dt = Math.min(1 / 40, (now - (dernier || now)) / 1000 || 1 / 60); dernier = now;
    pas(dt);
    if (tEclat >= 0) {
      const t = (now - tEclat) / 1000;
      front = loin() * lisse(Math.min(1, Math.max(0, (t - OUVERTURE) / DUREE)));
      if (t > OUVERTURE + DUREE && !fini) { fini = true; actif = false; if (onFini) onFini(); }
    }
    afficher();
    if (actif) raf = requestAnimationFrame(image);
  };
  const demarrer = () => { if (!raf && vivant && actif) { dernier = 0; raf = requestAnimationFrame(image); } };

  initialiser();
  afficher();

  return {
    // le coup de pinceau arrive : de l'encre en anneau qui tourne, l'eau qui tourbillonne, puis le trou qui s'ouvre
    eclabousser(px, py) {
      const r = canvas.getBoundingClientRect(), x = px / r.width, y = 1 - py / r.height;
      centre = [x, y]; front = 0; fini = false; actif = true; tEclat = performance.now();
      const n = 12, R = 0.085;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, cx = x + Math.cos(a) * R / ratio, cy = y + Math.sin(a) * R;
        tache(encre, cx, cy, [1.0, 0, 0], 0.0014);
        tache(vitesse, cx, cy, [-Math.sin(a) * 420, Math.cos(a) * 420], 0.0025);
      }
      tache(encre, x, y, [1.2, 0, 0], 0.0026);
      demarrer();
    },
    // le papier revient, intact (avant un nouveau coup de pinceau)
    recouvrir() { actif = false; fini = false; tEclat = -1; front = 0; initialiser(); afficher(); },
    // la scène, directement (sans coup de pinceau)
    devoiler() { actif = false; fini = true; tEclat = -1; front = 0; if (onFini) onFini(); },
    visible(v) { vivant = v; if (v) demarrer(); },
    taille() { initialiser(); afficher(); },
  };
}
