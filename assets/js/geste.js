// =============================================================================
// « Le geste » : la Création d'Adam, peinte comme une vraie fresque (image 4K), qui s'anime dans le navigateur.
// Pas de vidéo ni de découpe : un petit programme graphique (WebGL 2) déforme la peinture elle-même.
//   • tout ce qui est à gauche de la bande de plâtre (le bras d'Adam) glisse vers la droite,
//     tout ce qui est à droite (le bras de Dieu) glisse vers la gauche ; seule la bande entre eux se resserre,
//     jusqu'à ce que les deux index se touchent (les bords des mains sont mesurés ligne par ligne :
//     _msdesign-src/perf/geste-bande.mjs → geste-bande.json) ;
//   • ensuite, la fresque s'efface en taches irrégulières à partir du point de contact et laisse voir
//     le papier de l'accueil (le fond de la section, en CSS, derrière le dessin).
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
uniform float uRatio, uZoom, uDA, uDG, uFondu, uTemps, uN;

// les bords des mains pour une ligne de la bande : deux nombres sur 16 bits rangés dans les 4 octets d'un pixel
vec2 ligne(float k) { vec4 t = texelFetch(uBande, ivec2(0, int(k)), 0) * 255.0; return vec2(t.r * 256.0 + t.g, t.b * 256.0 + t.a) / 65535.0; }

// un bruit doux (pour un bord d'effacement irrégulier, comme un enduit qui s'écaille)
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

  // le glissement des deux bras : trois morceaux par ligne (Adam | bande de plâtre | Dieu)
  float fy = clamp(uv.y, 0.0, 1.0) * (uN - 1.0), k0 = floor(fy);
  vec2 b = mix(ligne(k0), ligne(min(k0 + 1.0, uN - 1.0)), fy - k0);
  float A = b.r, G = b.g, a2 = A + uDA, g2 = G - uDG, x = uv.x, s;
  if (x <= a2) s = x * A / a2;
  else if (x < g2) s = A + (x - a2) * (G - A) / max(g2 - a2, 1e-5);
  else s = G + (x - g2) * (1.0 - G) / (1.0 - g2);
  vec3 c = texture(uImg, vec2(s, uv.y)).rgb;

  // l'effacement vers le papier : des taches qui partent du point de contact et gagnent tout l'écran
  float d = length((uv - uFoyer) * vec2(uRatio, 1.0));
  float v = 0.62 * d + 0.5 * fbm(uv * vec2(uRatio, 1.0) * 5.0 + 3.1);
  float t = uFondu * 1.45 - 0.05;
  float alpha = smoothstep(t - 0.035, t + 0.035, v);
  // un liseré à peine plus sombre au bord de la zone effacée (le plâtre qui s'écaille)
  float bord = 1.0 - smoothstep(0.0, 0.06, abs(v - t));
  c *= 1.0 - 0.10 * bord * step(0.001, uFondu);
  sortie = vec4(c * alpha, alpha);
}`;

const lisse = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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
  const U = {}; ['uImg', 'uBande', 'uRes', 'uFoyer', 'uSouris', 'uRatio', 'uZoom', 'uDA', 'uDG', 'uFondu', 'uTemps', 'uN'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

  // la bande (bords des mains, ligne par ligne) : une texture d'une colonne ; chaque pixel porte les deux bords
  // sur 16 bits chacun (rouge + vert pour Adam, bleu + alpha pour Dieu), lus tels quels par le programme
  const n = BANDE.a.length, data = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const a = Math.round(BANDE.a[k] * 65535), g = Math.round(BANDE.g[k] * 65535);
    data.set([a >> 8, a & 255, g >> 8, g & 255], k * 4);
  }
  const texB = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(U.uBande, 1);
  gl.uniform1f(U.uN, n);

  // les réglages du mouvement (en fractions de la largeur de l'image)
  const ECART = 0.011;                                     // au départ, chaque main recule d'environ 60 px (sur 5 504)
  const FERME = BANDE.fermeture / 2;                       // puis chacune avance de la moitié de l'écart mesuré : contact
  gl.uniform2f(U.uFoyer, BANDE.contact.x, BANDE.contact.y);
  gl.uniform1f(U.uRatio, BANDE.w / BANDE.h);

  let pret = false, vivant = true, T = 0, cible = 0, dernier = 0, souris = [0, 0], sourisL = [0, 0], touche = false, raf = 0;
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

  // T va de 0 à 2 : 0→1 les mains se rejoignent (1 s), 1→2 la fresque s'efface dans le papier (1,6 s)
  const image = (now) => {
    raf = 0;
    if (!pret || !vivant) return;
    const dt = Math.min(0.05, (now - (dernier || now)) / 1000); dernier = now;
    if (T !== cible) {
      const v = T < 1 || (cible < 1 && T <= 1) ? 1 / 1.0 : 1 / 1.6;
      T = cible > T ? Math.min(cible, T + v * dt) : Math.max(cible, T - v * dt);
    }
    sourisL[0] += (souris[0] - sourisL[0]) * 0.05; sourisL[1] += (souris[1] - sourisL[1]) * 0.05;
    const p1 = lisse(Math.min(1, Math.max(0, T))), p2 = lisse(Math.min(1, Math.max(0, T - 1)));
    const d = -ECART + (ECART + FERME) * p1;
    taille();
    gl.uniform1f(U.uDA, d); gl.uniform1f(U.uDG, d);
    gl.uniform1f(U.uZoom, 1.0 + 0.1 * p1 + 0.22 * p2);
    gl.uniform1f(U.uFondu, p2);
    gl.uniform2f(U.uSouris, sourisL[0] * 0.006, sourisL[1] * 0.004);
    gl.uniform1f(U.uTemps, now / 1000);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // le contact : prévenir une fois (le titre change), et de nouveau si l'on recule
    const contact = p1 > 0.985;
    if (contact !== touche) { touche = contact; if (onContact) onContact(contact); }
    const bouge = T !== cible || Math.abs(souris[0] - sourisL[0]) + Math.abs(souris[1] - sourisL[1]) > 0.002;
    if (bouge) raf = requestAnimationFrame(image);
  };
  const demarrer = () => { if (!raf) { dernier = 0; raf = requestAnimationFrame(image); } };

  return {
    setEtat(e) { cible = Math.max(0, Math.min(2, e)); if (reduced) T = cible; demarrer(); },
    souris(x, y) { souris = [x, y]; demarrer(); },
    visible(v) { vivant = v; if (v) demarrer(); },
    taille() { demarrer(); },
  };
}
