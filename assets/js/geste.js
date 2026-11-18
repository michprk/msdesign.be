// =============================================================================
// « Le geste » : la Création d'Adam, peinte comme une vraie fresque (image 4K), qui s'anime dans le navigateur.
// Pas de vidéo ni de découpe : un petit programme graphique (WebGL 2) déforme la peinture elle-même.
//   • l'approche : les deux bras partent nettement écartés, puis glissent l'un vers l'autre ; seule la bande de
//     plâtre entre eux s'étire puis se resserre (les bords des mains sont mesurés ligne par ligne :
//     _msdesign-src/perf/geste-bande.mjs → geste-bande.json, puis adoucis d'une ligne à l'autre, voir plus bas).
//     Pendant ce temps, on s'avance vers les doigts, comme une caméra ; la fin ralentit beaucoup : les index
//     hésitent avant de se toucher ;
//   • le contact : un éclat de lumière chaude naît entre les doigts, une onde traverse le plâtre, et la lumière
//     court dans les fissures de la fresque, du point de contact jusqu'aux bords ;
//   • (étape 2, que l'accueil n'utilise plus) la fresque s'efface en taches à partir du point de contact.
// Avancement piloté de l'extérieur : setEtat(0 | 1 | 2) → 0 mains écartées, 1 contact, 2 papier.
// =============================================================================
import BANDE from './geste-bande.json';

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 sortie;
uniform sampler2D uImg, uBande;
uniform vec2 uRes, uFoyer, uSouris;
uniform float uRatio, uZoom, uDA, uDG, uFondu, uEclat, uN;

// les bords des mains pour une ligne de la bande : deux nombres sur 16 bits rangés dans les 4 octets d'un pixel
vec2 ligne(float k) { vec4 t = texelFetch(uBande, ivec2(0, int(k)), 0) * 255.0; return vec2(t.r * 256.0 + t.g, t.b * 256.0 + t.a) / 65535.0; }
// les bords des mains à la hauteur y (0 en haut, 1 en bas), entre deux lignes mesurées
vec2 bords(float y) { float fy = clamp(y, 0.0, 1.0) * (uN - 1.0), k0 = floor(fy); return mix(ligne(k0), ligne(min(k0 + 1.0, uN - 1.0)), fy - k0); }

// un bruit doux (pour des bords irréguliers, comme un enduit)
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += a * bruit(p); p *= 2.03; a *= 0.5; } return s; }

void main() {
  // l'image remplit l'écran (comme « cover »), puis on s'approche du point de contact
  float r = uRes.x / uRes.y;
  vec2 uv = vUv;
  if (r > uRatio) uv.y = 0.5 + (uv.y - 0.5) * uRatio / r; else uv.x = 0.5 + (uv.x - 0.5) * r / uRatio;
  uv.y = 1.0 - uv.y;                                       // l'image se lit de haut en bas
  vec2 centre = vec2(0.5) + (uFoyer - vec2(0.5)) * min(1.0, (uZoom - 1.0) * 4.0);
  uv = centre + (uv - centre) / uZoom + uSouris;

  // l'onde du contact : un anneau qui part des doigts et fait onduler la peinture sur son passage
  vec2 q = (uv - uFoyer) * vec2(uRatio, 1.0);
  float d = length(q);
  float onde = exp(-pow((d - 0.04 - uEclat * 1.1) / 0.05, 2.0)) * smoothstep(0.0, 0.08, uEclat) * (1.0 - uEclat);
  uv -= q / max(d, 1e-4) / vec2(uRatio, 1.0) * onde * 0.006;

  // les deux bras glissent l'un vers l'autre : trois morceaux par ligne (Adam | bande de plâtre | Dieu) ;
  // seule la bande s'étire ou se resserre
  vec2 b = bords(uv.y);
  float A = b.r, G = b.g, a2 = A + uDA, g2 = G - uDG, x = uv.x, s;
  if (x <= a2) s = x * A / a2;
  else if (x < g2) s = A + (x - a2) * (G - A) / max(g2 - a2, 1e-5);
  else s = G + (x - g2) * (1.0 - G) / (1.0 - g2);
  vec2 p = vec2(s, uv.y);
  vec3 c = texture(uImg, p).rgb;

  // la lumière du contact
  if (uEclat > 0.0) {
    // l'éclat : il naît entre les doigts en un instant, puis s'étale et s'éteint doucement
    float halo = exp(-d * d / (0.0012 + 0.03 * uEclat)) * smoothstep(0.0, 0.08, uEclat) * (1.0 - smoothstep(0.08, 1.0, uEclat));
    // les fissures : là où le plâtre est plus sombre que ses environs ; ni la peau ni le contour des mains
    // (des traits sombres eux aussi, mais entourés de couleur) ne s'allument
    // (un trait fin et net, plus un halo plus large autour, mesuré sur des versions floues de la peinture)
    const vec3 Y = vec3(0.299, 0.587, 0.114);
    vec3 f = texture(uImg, p, 3.0).rgb, c1 = texture(uImg, p, 1.5).rgb, f2 = texture(uImg, p, 4.5).rgb;
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)), satF = max(f2.r, max(f2.g, f2.b)) - min(f2.r, min(f2.g, f2.b));
    float fissure = (smoothstep(0.02, 0.09, dot(f, Y) - dot(c, Y)) + 0.55 * smoothstep(0.01, 0.05, dot(f2, Y) - dot(c1, Y)))
                  * (1.0 - smoothstep(0.12, 0.22, sat)) * (1.0 - smoothstep(0.09, 0.14, satF));
    // le front de lumière part du contact et gagne tout le mur, avec un bord irrégulier ; derrière lui, les fissures
    // gardent un moment leur lueur, comme des braises, puis s'éteignent
    float front = uEclat * 1.3;
    float dn = d + 0.10 * (fbm(uv * vec2(uRatio, 1.0) * 5.0 + 7.3) - 0.5);
    float atteint = smoothstep(front + 0.01, front - 0.03, dn);
    float braise = exp(-max(front - dn, 0.0) * 2.5);
    float veine = fissure * atteint * braise * (1.0 - smoothstep(0.75, 1.0, uEclat));
    vec3 chaud = vec3(1.0, 0.80, 0.52);
    c = 1.0 - (1.0 - c) * (1.0 - chaud * clamp(0.75 * halo + 1.4 * veine, 0.0, 1.0));   // en « écran » : la lumière s'ajoute
  }

  // l'effacement vers le papier : des taches qui partent du point de contact et gagnent tout l'écran
  float v = 0.62 * d + 0.5 * fbm(uv * vec2(uRatio, 1.0) * 5.0 + 3.1);
  float t = uFondu * 1.45 - 0.05;
  float alpha = smoothstep(t - 0.035, t + 0.035, v);
  // un liseré à peine plus sombre au bord de la zone effacée (le plâtre qui s'écaille)
  float bord = 1.0 - smoothstep(0.0, 0.06, abs(v - t));
  c *= 1.0 - 0.10 * bord * step(0.001, uFondu);
  sortie = vec4(c * alpha, alpha);
}`;

const lisse = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// l'approche : un départ en douceur, de la vitesse au milieu, et une très longue fin (les doigts hésitent)
const approche = (t) => { const s = t * t * (3 - 2 * t); return 1 - (1 - s) * (1 - s); };

export function createGeste(canvas, { src, reduced = false, onContact } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const prog = (() => {
    const sh = (type, code) => { const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  })();
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uImg', 'uBande', 'uRes', 'uFoyer', 'uSouris', 'uRatio', 'uZoom', 'uDA', 'uDG', 'uFondu', 'uEclat', 'uN'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

  // les bords adoucis d'une ligne à l'autre : mesurés tels quels, ils sautent d'un coup à hauteur des doigts, et
  // quand les mains s'écartent beaucoup, le plâtre se déchirerait en lignes horizontales. On prend d'abord, sur
  // ±3 % de la hauteur, le bord le plus avancé de chaque main, puis on lisse (3 passes sur un tiers de cette
  // distance) : la bande s'élargit et se resserre en douceur, sans jamais mordre sur une main.
  const adoucir = (v, avance) => {
    const n = v.length, R = Math.round(n * 0.03), r = Math.round(R / 3);
    let w = v.map((_, k) => { let m = v[k]; for (let j = Math.max(0, k - R); j <= Math.min(n - 1, k + R); j++) m = avance(m, v[j]); return m; });
    for (let passe = 0; passe < 3; passe++) {
      w = w.map((_, k) => { let s = 0, c = 0; for (let j = Math.max(0, k - r); j <= Math.min(n - 1, k + r); j++) { s += w[j]; c++; } return s / c; });
    }
    return w;
  };
  const bordA = adoucir(BANDE.a, Math.max), bordG = adoucir(BANDE.g, Math.min);

  // la bande (bords des mains, ligne par ligne) : une texture d'une colonne ; chaque pixel porte les deux bords
  // sur 16 bits chacun (rouge + vert pour Adam, bleu + alpha pour Dieu), lus tels quels par le programme
  const n = BANDE.a.length, data = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const a = Math.round(bordA[k] * 65535), g = Math.round(bordG[k] * 65535);
    data.set([a >> 8, a & 255, g >> 8, g & 255], k * 4);
  }
  const texB = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(U.uBande, 1);
  gl.uniform1f(U.uN, n);

  // les réglages du mouvement (en fractions de la largeur de l'image)
  // au départ, chaque main recule d'environ 130 px (sur 5 504) ; sur un écran étroit (téléphone), où l'on ne voit
  // que le milieu de la fresque, l'écart serait démesuré : il diminue avec la part de l'image qui est visible
  const ECART = 0.024, RATIO = BANDE.w / BANDE.h;
  const FERME = BANDE.fermeture / 2;                       // puis chacune avance de la moitié de l'écart mesuré : contact
  const DUREE = 1.9, DUREE_RETOUR = 1.2, DUREE_FONDU = 1.6, DUREE_ECLAT = 1.5;   // en secondes
  gl.uniform2f(U.uFoyer, BANDE.contact.x, BANDE.contact.y);
  gl.uniform1f(U.uRatio, RATIO);

  let pret = false, vivant = true, fige = false, T = 0, S = 0, cible = 0, dernier = 0, souris = [0, 0], sourisL = [0, 0], touche = false, raf = 0;
  const img = new Image(); img.decoding = 'async'; img.src = src;
  img.decode().then(() => {
    const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uImg, 0);
    pret = true; canvas.classList.add('is-pret'); demarrer();
  }).catch(() => {});

  const taille = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h); gl.uniform2f(U.uRes, w, h);
  };

  // T va de 0 à 2 : 0→1 les mains se rejoignent (1,9 s), 1→2 la fresque s'efface dans le papier (1,6 s) ;
  // S va de 0 à 1 : la lumière du contact (1,5 s), dès que les doigts se touchent
  const image = (now) => {
    raf = 0;
    if (!pret || !vivant) return;
    const dt = Math.min(0.05, (now - (dernier || now)) / 1000); dernier = now;
    if (!fige && T !== cible) {
      const v = T >= 1 && (cible > 1 || T > 1) ? 1 / DUREE_FONDU : cible < T ? 1 / DUREE_RETOUR : 1 / DUREE;
      T = cible > T ? Math.min(cible, T + v * dt) : Math.max(cible, T - v * dt);
    }
    sourisL[0] += (souris[0] - sourisL[0]) * 0.05; sourisL[1] += (souris[1] - sourisL[1]) * 0.05;
    const p1 = approche(Math.min(1, Math.max(0, T))), p2 = lisse(Math.min(1, Math.max(0, T - 1)));
    const contact = p1 > 0.985;
    if (!fige) {
      if (cible >= 1 && contact) S = Math.min(1, S + dt / DUREE_ECLAT);
      else if (cible < 1) S = Math.max(0, S - dt / 0.35);
    }
    taille();
    const ecart = ECART * Math.min(1, Math.max(0.35, Math.min(1, canvas.width / canvas.height / RATIO) / 0.85));
    const d = -ecart + (ecart + FERME) * p1;
    gl.uniform1f(U.uDA, d); gl.uniform1f(U.uDG, d);
    gl.uniform1f(U.uZoom, 1.06 + 0.3 * p1 + 0.05 * lisse(S) + 0.22 * p2);
    gl.uniform1f(U.uFondu, p2);
    gl.uniform1f(U.uEclat, S);
    gl.uniform2f(U.uSouris, sourisL[0] * 0.006, sourisL[1] * 0.004);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // le contact : prévenir une fois (le titre change), et de nouveau si l'on recule
    if (contact !== touche) { touche = contact; if (onContact) onContact(contact); }
    const eclat = !fige && ((cible >= 1 && contact && S < 1) || (cible < 1 && S > 0));
    const bouge = (!fige && T !== cible) || eclat || Math.abs(souris[0] - sourisL[0]) + Math.abs(souris[1] - sourisL[1]) > 0.002;
    if (bouge) raf = requestAnimationFrame(image);
  };
  const demarrer = () => { if (!raf) { dernier = 0; raf = requestAnimationFrame(image); } };

  const api = {
    setEtat(e) { cible = Math.max(0, Math.min(2, e)); if (reduced) { T = cible; S = cible >= 1 ? 1 : 0; } demarrer(); },
    souris(x, y) { souris = [x, y]; demarrer(); },
    visible(v) { vivant = v; if (v) demarrer(); },
    taille() { demarrer(); },
  };
  // en développement seulement : figer une image précise de l'animation (T de 0 à 2, S de 0 à 1) pour la vérifier
  if (import.meta.env.DEV) window.__msGeste = { poser(t, s = 0) { fige = true; T = cible = t; S = s; demarrer(); }, liberer() { fige = false; demarrer(); } };
  return api;
}
