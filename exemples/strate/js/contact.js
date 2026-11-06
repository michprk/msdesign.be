/* Strate — la page Contact.
   La photo se découvre, le titre arrive mot à mot, puis un plan de jardin se dessine au crayon :
   ses lignes horizontales tombent exactement sur les lignes du formulaire, le reste s'efface,
   et les champs apparaissent un à un. À l'envoi, une pousse sort de terre. */
const root = document.documentElement;
const qs = (s, el = document) => el.querySelector(s), qsa = (s, el = document) => [...el.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';

let reduced = false;
try { reduced = localStorage.getItem('strate_motion') === 'reduce'; } catch (e) { /* stockage indisponible */ }
if (new URLSearchParams(location.search).get('motion') === 'reduce') reduced = true;
root.classList.add('js', reduced ? 'motion-reduce' : 'motion-full');
const motionBtn = qs('[data-motion-toggle]');
if (motionBtn) {
  motionBtn.textContent = reduced ? 'Remettre les animations' : 'Réduire les animations';
  motionBtn.addEventListener('click', () => { try { localStorage.setItem('strate_motion', reduced ? 'full' : 'reduce'); } catch (e) { /* rien */ } location.reload(); });
}

/* le titre, mot à mot */
const title = qs('[data-words]');
if (title && !reduced) {
  const words = title.textContent.trim().split(/\s+/);
  title.textContent = '';
  words.forEach((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; s.style.setProperty('--i', i); title.append(s, i < words.length - 1 ? ' ' : ''); });
}
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-in')));

/* le plan au crayon */
const form = qs('.vform'), sketch = qs('.vform__sketch');
qsa('[data-step]', form).forEach((el, i) => el.style.setProperty('--n', i));
const wob = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;          // tremblement reproductible
function path(d, cls, i) { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); p.setAttribute('pathLength', '1'); p.style.setProperty('--i', i); sketch.append(p); return p; }
function crown(cx, cy, r, bumps, seed) {
  let d = '';
  for (let k = 0; k < bumps; k++) {
    const a0 = (k / bumps) * Math.PI * 2 + seed, a1 = ((k + 1) / bumps) * Math.PI * 2 + seed, am = (a0 + a1) / 2;
    const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r], c = [cx + Math.cos(am) * r * 1.18, cy + Math.sin(am) * r * 1.18];
    d += (k ? '' : `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}`) + `Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
  }
  return d + 'Z';
}
function buildSketch() {
  sketch.textContent = '';
  const fr = form.getBoundingClientRect(), W = fr.width, H = fr.height;
  sketch.setAttribute('viewBox', `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`);
  const ys = qsa('.vfield', form).map((f) => qs('input, select, textarea', f).getBoundingClientRect().bottom - fr.top - 0.5);
  let i = 0;
  // les murs de la parcelle et la façade
  const top = Math.max(4, ys[0] - 56), bot = ys[ys.length - 1];
  path(`M${W * 0.02} ${bot + 10}V${top}H${W * 0.98}V${bot + 10}`, 'sk sk--deco', i++);
  path(`M${W * 0.02} ${top + 6}H${W * 0.98}`, 'sk sk--deco sk--thin', i++);
  // les lignes du plan, qui deviendront celles du formulaire
  ys.forEach((y, k) => path(`M0 ${y.toFixed(1)}Q${(W * 0.5).toFixed(1)} ${(y + (wob(k) - 0.5) * 3).toFixed(1)} ${W.toFixed(1)} ${y.toFixed(1)}`, 'sk sk--line', i++));
  // un arbre, un petit arbre, leurs troncs
  const t1 = { x: W * 0.8, y: (ys[0] + ys[1]) / 2 + 4, r: Math.min(46, W * 0.08) }, t2 = { x: W * 0.17, y: (ys[2] + ys[3]) / 2, r: Math.min(30, W * 0.055) };
  path(crown(t1.x, t1.y, t1.r, 11, 0.4), 'sk sk--deco', i++); path(`M${t1.x - 2.5} ${t1.y}a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0`, 'sk sk--deco', i++);
  path(crown(t2.x, t2.y, t2.r, 9, 1.3), 'sk sk--deco', i++);
  // une allée courbe et ses pas japonais
  const pA = `M${W * 0.36} ${bot + 8}C${W * 0.32} ${ys[3]} ${W * 0.62} ${ys[2]} ${W * 0.55} ${ys[1]}S${W * 0.6} ${top + 20} ${W * 0.66} ${top + 6}`;
  path(pA, 'sk sk--deco', i++);
  for (let k = 0; k < 5; k++) { const y = ys[Math.min(ys.length - 1, 4 - k)] - 18, x = W * (0.4 + 0.04 * Math.sin(k * 1.7)); path(`M${x} ${y}h26v10h-26z`, 'sk sk--deco sk--thin', i++); }
  // des hachures pour un massif
  let h = ''; const by = ys[2] + 14, bh = Math.max(20, ys[3] - ys[2] - 40);
  for (let x = W * 0.66; x < W * 0.94; x += 9) h += `M${x.toFixed(1)} ${(by + bh).toFixed(1)}l12 ${(-bh).toFixed(1)}`;
  path(h, 'sk sk--deco sk--thin', i++);
  // une cote, comme sur un vrai plan
  path(`M${W * 0.99 + 0} ${top}v${bot - top}M${W * 0.985} ${top}h${W * 0.012}M${W * 0.985} ${bot}h${W * 0.012}`, 'sk sk--deco sk--thin', i++);
  const t = document.createElementNS(SVGNS, 'text'); t.setAttribute('x', (W * 0.97).toFixed(0)); t.setAttribute('y', ((top + bot) / 2).toFixed(0)); t.setAttribute('class', 'sk-txt'); t.setAttribute('text-anchor', 'end'); t.textContent = '8,40 m'; sketch.append(t);
}
function play() {
  if (reduced) { form.classList.add('is-built'); return; }
  buildSketch();
  requestAnimationFrame(() => form.classList.add('is-drawing'));
  setTimeout(() => form.classList.add('is-built'), 1900);
}
if (form) {
  if (reduced || !('IntersectionObserver' in window)) play();
  else { const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setTimeout(play, document.fonts ? 0 : 200); } }, { threshold: 0.2 }); (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => io.observe(form), 500)); }
}

/* l'envoi : vérification simple, puis une pousse */
const fields = { nom: '#f-nom', contact: '#f-contact', commune: '#f-commune', surface: '#f-surface', message: '#f-message' };
function check(key) {
  const el = qs(fields[key]), v = el.value.trim();
  let ok = v.length > 0;
  if (key === 'contact' && ok) ok = /@.+\./.test(v) || v.replace(/\D/g, '').length >= 8;
  const err = qs('#e-' + key); err.hidden = ok; el.setAttribute('aria-invalid', String(!ok));
  if (!ok) el.setAttribute('aria-describedby', 'e-' + key); else el.removeAttribute('aria-describedby');
  return ok;
}
Object.keys(fields).forEach((k) => qs(fields[k]).addEventListener('blur', () => { if (qs(fields[k]).value.trim() || form.classList.contains('was-sent')) check(k); }));
if (form) form.addEventListener('submit', (e) => {
  e.preventDefault(); form.classList.add('was-sent');
  const bad = Object.keys(fields).filter((k) => !check(k));
  if (bad.length) { qs(fields[bad[0]]).focus(); return; }
  form.classList.add('is-sent');
  qsa('input, select, textarea', form).forEach((el) => { el.readOnly = true; if (el.tagName === 'SELECT') el.disabled = true; });
  const btn = qs('.vbtn', form); btn.disabled = true; qs('span', btn).textContent = 'Demande envoyée';
  const done = qs('.vform__done', form); done.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => done.classList.add('is-on'))); done.focus({ preventScroll: true });
});
