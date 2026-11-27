/* ==========================================================================
   La main-curseur : à la souris, dans certaines sections (la sphère des identités, « Nos projets »), le curseur
   devient une petite main holographique bleue, l'index qui montre. C'est la main qui touche la sphère, en plus
   petit et en lignes de balayage.
   - Une petite toile WebGL 2 (340 px), fixe, qui suit la souris ; le bout de l'index est exactement sous le pointeur.
   - Les lignes sont horizontales à l'écran : elles glissent sur la main quand elle monte ou descend.
   - Elles sont plus épaisses dans les ombres de la photo, sur un voile sombre en forme de main : elle se voit sur le
     noir comme sur une image claire.
   - Une bande claire descend le long de la main ; un point marque le bout du doigt.
   - Sur un lien ou un projet, elle s'éclaire et un anneau entoure le doigt. Quand on appuie, elle s'enfonce et une
     onde part du doigt. Quand elle va vite, ses lignes se décalent et elle penche un peu.
   - Le vrai curseur est caché seulement dans ces zones (html.a-main-curseur) ; il revient sur ce qu'une zone exclut
     (la fiche d'un projet, la liste au clavier) et partout ailleurs.
   - Pas de main au doigt (écrans tactiles), ni sans WebGL 2 : le curseur reste normal.
   Usage : const m = creerMainCurseur({ image }) ; m.zone(element, { cibles, exclure, projet }).
   ========================================================================== */

const C = 340;              // la toile (px), centrée sur le bout du doigt
const ANGLE = -0.72;        // la main tournée pour que l'index montre à gauche, un peu vers le haut
const ECH = 300;            // pixels par largeur d'image (2720 × 1536 ; le bout de l'index en 0,245 ; 0,5)
const PAS = 3;              // l'écart entre deux lignes

const VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uDpr, uAngle, uEch, uT, uProjet, uAppui, uOnde, uVit, uPas, uC, uHaut;
out vec4 sortie;
float h1(float n) { return fract(sin(n * 127.1 + 31.7) * 43758.5453); }
// la main dans l'image ; d : en pixels depuis le bout du doigt (y vers le haut)
vec4 lire(vec2 d) {
  float c = cos(-uAngle), s = sin(-uAngle);
  vec2 q = vec2(c * d.x - s * d.y, s * d.x + c * d.y) / uEch;
  vec2 st = vec2(0.245, 0.5) + vec2(q.x, q.y * 1.771);
  if (st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0) return vec4(0.0);
  vec4 t = texture(uTex, st);
  t.a *= 1.0 - smoothstep(0.55, 0.68, st.x);                         // le poignet se perd
  t.a *= 1.0 - 0.5 * smoothstep(0.475, 0.41, st.y) * smoothstep(0.5, 0.43, st.x);   // l'index montre, les autres doigts restent discrets
  return t;
}
void main() {
  vec2 lp = gl_FragCoord.xy / uDpr;                // dans la toile, en pixels (y vers le haut)
  float sy = uHaut + uC - lp.y;                     // la même ligne d'écran (y vers le bas)
  float li = floor(sy / uPas);
  float r1 = h1(li);
  // chaque ligne tressaille un peu ; davantage quand la main va vite
  float dec = (r1 - 0.5) * (0.4 + 9.0 * uVit) + sin(uT * 3.1 + li * 1.7) * 0.3;
  vec2 bout = vec2(uC * 0.5);
  vec2 d = vec2(lp.x + dec, uC - ((li + 0.5) * uPas - uHaut)) - bout;
  d /= 1.0 - 0.09 * uAppui;                         // appuyer : la main s'enfonce vers le doigt
  vec4 c = lire(d);
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float l = clamp((lum - 0.28) / 0.57, 0.0, 1.0);
  float bp = 46.0 - mod(uT, 2.8) / 2.8 * 200.0;     // une bande claire qui descend le long de la main
  float bande = exp(-pow((d.y - bp) / 10.0, 2.0));
  float w = c.a * mix(0.78, 0.26, pow(l, 0.7)) * (1.0 + 0.25 * uProjet + 0.3 * bande);
  float f = abs(fract(sy / uPas) - 0.5);
  float aa = 0.7 / (uPas * uDpr);
  float trait = (1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, f)) * step(0.04, c.a);
  float a = trait * (0.88 + 0.12 * bande);
  float fond = smoothstep(0.02, 0.5, c.a) * 0.42;   // le voile sombre sous les lignes
  // le bout du doigt : un point ; sur un projet, un anneau ; à l'appui, une onde qui s'élargit
  vec2 b = lp - bout;
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
  sortie = vec4(col * tout, tout);                  // couleurs prémultipliées
}`;

export function creerMainCurseur({ image } = {}) {
  const rien = { zone() {} };
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return rien;
  const toile = document.createElement('canvas');
  let gl = null;
  try { gl = toile.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return rien;
  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return rien;
  gl.useProgram(prog);
  const tampon = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uTex', 'uDpr', 'uAngle', 'uEch', 'uT', 'uProjet', 'uAppui', 'uOnde', 'uVit', 'uPas', 'uC', 'uHaut']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(U.uTex, 0); gl.uniform1f(U.uEch, ECH); gl.uniform1f(U.uPas, PAS); gl.uniform1f(U.uC, C);

  toile.className = 'main-curseur';
  toile.setAttribute('aria-hidden', 'true');
  document.body.append(toile);
  let dpr = 1;
  const regler = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    toile.width = toile.height = Math.round(C * dpr);
    gl.viewport(0, 0, toile.width, toile.height);
  };
  regler();
  window.addEventListener('resize', regler);

  // l'image de la main : chargée la première fois qu'on entre dans une zone
  let pret = false, charge = false;
  const charger = () => {
    if (charge) return;
    charge = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      pret = true;
      lancer();
    };
    img.src = image;
  };

  /* ---------- où est la souris : dans quelle zone, sur quoi ---------- */
  const zones = [];
  const p = { x: -9999, y: -9999, souris: false, zone: null, cible: false };
  const html = document.documentElement;
  const reperer = (el) => {
    let z = null;
    if (p.souris && el && el.closest) for (const zz of zones) if (zz.el.contains(el)) { z = zz; break; }
    if (z && z.exclure && el.closest(z.exclure)) z = null;
    p.zone = z;
    p.cible = !!(z && z.cibles && el.closest(z.cibles));
    html.classList.toggle('a-main-curseur', !!z && pret);
    if (z) { charger(); lancer(); }
  };
  window.addEventListener('pointermove', (e) => { p.souris = e.pointerType === 'mouse'; p.x = e.clientX; p.y = e.clientY; reperer(e.target); }, { passive: true });
  window.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') { p.souris = true; p.x = e.clientX; p.y = e.clientY; reperer(e.target); } }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { p.souris = false; reperer(null); return; } if (p.zone) { appuye = true; m.tOnde = t; lancer(); } }, { passive: true });
  window.addEventListener('pointerup', () => { appuye = false; }, { passive: true });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { p.souris = false; reperer(null); } });
  window.addEventListener('blur', () => { appuye = false; reperer(null); });
  // en défilant sans bouger la souris, ce qui est sous elle change
  let sale = false;
  window.addEventListener('scroll', () => {
    if (!p.souris || sale) return;
    sale = true;
    requestAnimationFrame(() => { sale = false; reperer(document.elementFromPoint(p.x, p.y)); });
  }, { passive: true });

  /* ---------- l'animation ---------- */
  const m = { vis: 0, vit: 0, angle: ANGLE, appui: 0, projet: 0, tOnde: -9, x: -9999, y: -9999, px: null, py: null };
  let appuye = false, t = 0, dernier = 0, raf = 0;
  const lisse = (v, cible, k, dt) => v + (cible - v) * (1 - Math.exp(-dt * k));
  const image_ = (now) => {
    raf = 0;
    const dt = dernier ? Math.min(0.05, Math.max(0.001, (now - dernier) / 1000)) : 0.016;
    dernier = now;
    t += dt;
    const calme = html.classList.contains('reduced');
    const ici = !!p.zone && pret;
    html.classList.toggle('a-main-curseur', ici);
    const vx = ici && m.px !== null ? (p.x - m.px) / dt : 0, vy = ici && m.py !== null ? (p.y - m.py) / dt : 0;
    m.px = ici ? p.x : null; m.py = ici ? p.y : null;
    if (ici) { m.x = p.x; m.y = p.y; }
    m.vis = lisse(m.vis, ici ? 1 : 0, 16, dt);
    m.vit = lisse(m.vit, ici && !calme ? Math.min(1, Math.hypot(vx, vy) / 2600) : 0, 10, dt);
    m.angle = lisse(m.angle, ANGLE + (calme ? 0 : Math.max(-0.18, Math.min(0.18, vx * 0.00009))), 7, dt);
    m.appui = lisse(m.appui, appuye && ici ? 1 : 0, 18, dt);
    const surProjet = ici && (p.cible || (p.zone.projet ? !!p.zone.projet() : false));
    m.projet = lisse(m.projet, surProjet && !appuye ? 1 : 0, 10, dt);
    const on = m.vis > 0.01;
    toile.classList.toggle('is-on', on);
    if (on) {
      const gx = Math.round((m.x - C / 2) * dpr) / dpr, gy = Math.round((m.y - C / 2) * dpr) / dpr;
      toile.style.transform = 'translate3d(' + gx + 'px, ' + gy + 'px, 0)';
      toile.style.opacity = m.vis.toFixed(3);
      gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uAngle, m.angle); gl.uniform1f(U.uT, calme ? 0 : t);
      gl.uniform1f(U.uProjet, m.projet); gl.uniform1f(U.uAppui, m.appui); gl.uniform1f(U.uOnde, t - m.tOnde);
      gl.uniform1f(U.uVit, m.vit); gl.uniform1f(U.uHaut, gy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (ici || on) raf = requestAnimationFrame(image_);
    else dernier = 0;
  };
  const lancer = () => { if (!raf && pret && !document.hidden) raf = requestAnimationFrame(image_); };
  document.addEventListener('visibilitychange', lancer);
  toile.addEventListener('webglcontextlost', () => { pret = false; zones.length = 0; html.classList.remove('a-main-curseur'); toile.classList.remove('is-on'); });

  return {
    // une zone où la main remplace le curseur ; cibles : ce qui l'éclaire (liens, projets) ; exclure : où le vrai
    // curseur revient ; projet() : (facultatif) dit à chaque image si la main est sur un projet (la sphère)
    zone(el, opts = {}) { if (el) zones.push({ el, cibles: opts.cibles || '', exclure: opts.exclure || '', projet: opts.projet || null }); },
  };
}
