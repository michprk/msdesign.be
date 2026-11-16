// =============================================================================
// Le fond de « Nos projets » : de grands plis de lumière floue (comme une feuille ou un tissu vus de très près),
// aux couleurs de M&S (bleu nuit, bleu, crème, une pointe d'orange), qui ondulent lentement.
// La souris est une « boule invisible » : elle ne se voit pas, mais elle remue la lumière sur son passage,
// comme un doigt dans l'eau, puis tout se repose doucement.
//   • une petite image « trace » (¼ de la taille) garde la mémoire du passage de la souris : sa vitesse
//     (rouge, vert) et son intensité (bleu) ; à chaque image elle s'estompe et se laisse emporter par elle-même ;
//   • le fond lit cette trace pour déformer et éclairer les plis.
// =============================================================================
const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// la trace : s'estompe, se laisse emporter par sa propre vitesse, et reçoit la souris
const FS_TRACE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 sortie;
uniform sampler2D uPrec;
uniform vec2 uSouris, uVitesse;
uniform float uRatio, uForce;
void main() {
  vec4 p = texture(uPrec, vUv);
  vec2 v = p.rg * 2.0 - 1.0;
  vec4 a = texture(uPrec, vUv - v * 0.006);                 // un peu emportée par son propre mouvement
  vec2 va = (a.rg * 2.0 - 1.0) * 0.975;
  float b = a.b * 0.972;
  vec2 d = (vUv - uSouris) * vec2(uRatio, 1.0);
  float w = exp(-dot(d, d) / 0.009) * uForce;               // la « boule » : une tache douce autour de la souris
  va = clamp(va + uVitesse * w, -1.0, 1.0);
  b = min(1.0, b + w * min(1.0, length(uVitesse) * 1.5));
  sortie = vec4(va * 0.5 + 0.5, b, 1.0);
}`;

// le fond : des plis de lumière qui ondulent, déformés par la trace
const FS_FOND = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 sortie;
uniform sampler2D uTrace;
uniform vec2 uRes;
uniform float uTemps;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 3; k++) { s += a * bruit(p); p = p * 2.03 + 3.7; a *= 0.5; } return s / 0.875; }
float t;
// la surface d'un grand tissu souple : un relief doux, lentement tordu
float relief(vec2 p) {
  vec2 q = vec2(fbm(p * 0.9 + vec2(0.0, t)), fbm(p * 0.9 + vec2(4.1, -t)));
  return fbm(p * 0.7 + q * 1.9 + vec2(t * 0.7, 0.0));
}
void main() {
  float r = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(r, 1.0) * 0.95;
  vec4 tr = texture(uTrace, vUv);
  vec2 dep = tr.rg * 2.0 - 1.0;
  p -= dep * 0.38;                                          // la souris pousse le tissu (la « boule invisible »)
  t = uTemps * 0.045;
  // le relief et sa pente : la lumière glisse sur les plis comme sur du satin
  float e = 0.012, h0 = relief(p);
  float hx = relief(p + vec2(e, 0.0)) - relief(p - vec2(e, 0.0));
  float hy = relief(p + vec2(0.0, e)) - relief(p - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx * 1.5, -hy * 1.5, 2.0 * e));
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 7.0);
  float rasant = pow(1.0 - n.z, 1.6);                       // le bord des plis, là où ils tournent
  vec3 nuit = vec3(0.025, 0.04, 0.12), bleu = vec3(0.07, 0.33, 0.9), ciel = vec3(0.52, 0.68, 1.0), creme = vec3(0.97, 0.94, 0.89), orange = vec3(0.86, 0.38, 0.12);
  vec3 c = mix(nuit, bleu, smoothstep(0.15, 0.8, h0));
  c *= 0.6 + 0.75 * diff;
  c = mix(c, ciel, rasant * 0.45);
  c += creme * spec * 0.55;                                 // les reflets clairs sur la crête des plis
  c = mix(c, orange, smoothstep(0.72, 0.95, h0) * (1.0 - diff) * 0.35);   // une pointe d'orange dans les creux chauds
  c += mix(ciel, creme, 0.5) * tr.b * 0.32;                 // un éclat là où la souris vient de passer
  c *= 1.0 - 0.32 * dot(p * 0.55, p * 0.55);                // les bords plus sombres
  c += (h(vUv * uRes + fract(uTemps)) - 0.5) * 0.03;        // un grain fin
  sortie = vec4(c, 1.0);
}`;

export function createFond(canvas, { reduced = false } = {}) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false });
  if (!gl) return null;
  const programme = (fs) => {
    const sh = (type, code) => { const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const pT = programme(FS_TRACE), pF = programme(FS_FOND);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const u = (p, n) => gl.getUniformLocation(p, n);
  const UT = { prec: u(pT, 'uPrec'), souris: u(pT, 'uSouris'), vitesse: u(pT, 'uVitesse'), ratio: u(pT, 'uRatio'), force: u(pT, 'uForce') };
  const UF = { trace: u(pF, 'uTrace'), res: u(pF, 'uRes'), temps: u(pF, 'uTemps') };

  // deux images « trace » qui se passent le relais (on lit l'une, on écrit l'autre)
  let traces = [], tw = 0, th = 0;
  const creerTraces = (w, h) => {
    traces.forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
    const neutre = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) neutre.set([128, 128, 0, 255], i * 4);
    traces = [0, 1].map(() => {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, neutre);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    tw = w; th = h;
  };

  // le fond est flou : on le calcule à 60 % de la taille de l'écran, le navigateur l'agrandit
  const ECHELLE = 0.6;
  const taille = () => {
    const w = Math.max(2, Math.round(canvas.clientWidth * ECHELLE)), h = Math.max(2, Math.round(canvas.clientHeight * ECHELLE));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const t2 = [Math.max(2, Math.round(w / 3)), Math.max(2, Math.round(h / 3))];
    if (t2[0] !== tw || t2[1] !== th) creerTraces(t2[0], t2[1]);
  };

  let vivant = false, raf = 0, debut = performance.now(), dernier = 0;
  let souris = [0.5, 0.5], avant = null, vitesse = [0, 0], force = 0;
  const image = (now) => {
    raf = 0;
    taille();
    const dt = Math.min(0.05, (now - (dernier || now)) / 1000); dernier = now;
    // 1. la trace
    const [lire, ecrire] = traces;
    gl.useProgram(pT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, ecrire.fb); gl.viewport(0, 0, tw, th);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lire.tex); gl.uniform1i(UT.prec, 0);
    gl.uniform2f(UT.souris, souris[0], souris[1]);
    gl.uniform2f(UT.vitesse, vitesse[0], vitesse[1]);
    gl.uniform1f(UT.ratio, canvas.width / canvas.height);
    gl.uniform1f(UT.force, force);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    traces = [ecrire, lire];
    vitesse = [vitesse[0] * 0.6, vitesse[1] * 0.6]; force *= 0.85;
    // 2. le fond
    gl.useProgram(pF);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ecrire.tex); gl.uniform1i(UF.trace, 0);
    gl.uniform2f(UF.res, canvas.width, canvas.height);
    gl.uniform1f(UF.temps, reduced ? 12.0 : (now - debut) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('is-pret');
    if (vivant && !reduced && dt >= 0) raf = requestAnimationFrame(image);
  };
  const demarrer = () => { if (!raf) raf = requestAnimationFrame(image); };

  return {
    // x, y : position de la souris dans la scène, de 0 à 1 (y vers le haut)
    souris(x, y) {
      if (avant) { vitesse = [Math.max(-1, Math.min(1, (x - avant[0]) * 18)), Math.max(-1, Math.min(1, (y - avant[1]) * 18))]; force = 1; }
      avant = [x, y]; souris = [x, y];
      if (reduced) demarrer();
    },
    sortie() { avant = null; },
    visible(v) { vivant = v; if (v) { dernier = 0; demarrer(); } },
  };
}
