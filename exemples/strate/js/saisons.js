/* Strate — la page Saisons : le même jardin, du printemps à l'hiver.
   Un cran de molette = une saison (transition douce), un curseur, les flèches, ou l'image qu'on fait glisser. */
const root = document.documentElement;
const qs = (s, el = document) => el.querySelector(s), qsa = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let reduced = false;
try { reduced = localStorage.getItem('strate_motion') === 'reduce'; } catch (e) { /* stockage indisponible */ }
const params = new URLSearchParams(location.search);
if (params.get('motion') === 'reduce') reduced = true;
root.classList.add('js', reduced ? 'motion-reduce' : 'motion-full');
const motionBtn = qs('[data-motion-toggle]');
if (motionBtn) {
  motionBtn.textContent = reduced ? 'Remettre les animations' : 'Réduire les animations';
  motionBtn.addEventListener('click', () => { try { localStorage.setItem('strate_motion', reduced ? 'full' : 'reduce'); } catch (e) { /* rien */ } location.reload(); });
}

const SEASONS = [
  { name: 'Printemps', months: 'mars à mai', text: 'L’amélanchier fleurit en blanc avant ses feuilles. Les graminées repartent du pied, coupées début mars.', top: [220, 232, 236], bot: [238, 243, 239] },
  { name: 'Été', months: 'juin à août', text: 'Le jardin est plein : sauges, échinops et achillées fleurissent sous un feuillage dense.', top: [211, 229, 240], bot: [237, 243, 241] },
  { name: 'Automne', months: 'septembre à novembre', text: 'L’amélanchier vire à l’orange, les graminées dorent, les feuilles tombent sur la pelouse.', top: [231, 228, 217], bot: [239, 236, 229] },
  { name: 'Hiver', months: 'décembre à février', text: 'Reste la structure : les buis, la haie d’ifs et les graminées givrées, laissées debout pour les oiseaux.', top: [216, 224, 234], bot: [238, 241, 245] },
];
const NOW = [11, 0, 1].includes(new Date().getMonth()) ? 3 : [2, 3, 4].includes(new Date().getMonth()) ? 0 : [5, 6, 7].includes(new Date().getMonth()) ? 1 : 2;

const section = qs('.sz'), stage = qs('.sz__stage'), canvas = qs('.sz__canvas'), range = qs('#sz-range');
const nameEl = qs('[data-season-name]'), monthsEl = qs('[data-season-months]'), textEl = qs('[data-season-text]'), ticks = qsa('[data-season]');
qsa('[data-season-card]').forEach((li) => { if (+li.dataset.seasonCard === NOW) { li.classList.add('is-now'); const t = qs('.year__months', li); if (t) t.textContent += ', en ce moment'; } });
ticks.forEach((b) => b.classList.toggle('is-now', +b.dataset.season === NOW));

/* la saison affichée suit une cible, en douceur */
let target = 0, shown = 0, shownLabel = -1, garden = null, top = 0, vh = innerHeight;
function measure() { vh = qsa('.sz__step')[0]?.offsetHeight || innerHeight; top = section.getBoundingClientRect().top + scrollY; }
measure();
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function paint() {
  const i0 = Math.min(2, Math.floor(shown)), t = shown - i0, A = SEASONS[i0], B = SEASONS[i0 + 1];
  const tp = mix(A.top, B.top, t), bt = mix(A.bot, B.bot, t);
  stage.style.setProperty('--sky-top', `rgb(${tp})`); stage.style.setProperty('--sky-bot', `rgb(${bt})`);
  const lab = Math.round(shown);
  if (lab !== shownLabel) {
    shownLabel = lab; const S = SEASONS[lab];
    nameEl.textContent = S.name; monthsEl.textContent = S.months + (lab === NOW ? ', en ce moment' : ''); textEl.textContent = S.text;
    range.setAttribute('aria-valuetext', S.name);
    ticks.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.season === lab)));
    qs('.sz__now').classList.remove('is-swap'); void qs('.sz__now').offsetWidth; qs('.sz__now').classList.add('is-swap');
  }
  if (document.activeElement !== range && !dragging) range.value = String(Math.round(shown * 100));
  if (garden) garden.setSeason(shown);
}

/* défilement : un cran = une saison */
const Lenis = window.Lenis;
let lenis = null, lockUntil = 0, lastWheel = 0, lastDir = 0;
const stepY = (i) => top + i * vh;
function goSeason(i, fast = false) {
  i = clamp(i, 0, 3); lockUntil = performance.now() + (fast ? 600 : 1250);
  if (lenis) lenis.scrollTo(stepY(i), { duration: fast ? 0.8 : 1.6, easing: ease, lock: true, force: true });
  else { scrollTo({ top: stepY(i), behavior: reduced ? 'auto' : 'smooth' }); }
  if (reduced) target = shown = i;
}
if (Lenis && !reduced) {
  lenis = new Lenis({
    lerp: 0.1, smoothWheel: true, respectReducedMotion: false,
    virtualScroll: (e) => {
      const ev = e.event; if (!ev || ev.type !== 'wheel' || ev.ctrlKey) return true;
      const now = performance.now(), dy = e.deltaY; if (!dy) return true;
      const dir = Math.sign(dy), fresh = now - lastWheel > 220 || dir !== lastDir; lastWheel = now; lastDir = dir;
      if (now < lockUntil) { ev.preventDefault(); return false; }
      const y = lenis.targetScroll;
      if (y < top - 2 && dir > 0 && y > top - vh * 0.9) { goSeason(0); ev.preventDefault(); return false; }   // on cale d'abord la vue sur le printemps
      const inZone = y >= top - 2 && (y < top + 3 * vh - 2 || (y <= top + 3 * vh + 2 && dir < 0));
      if (!inZone) return true;
      const cur = clamp(Math.round((y - top) / vh), 0, 3);
      if (!fresh) { if (Math.abs(y - stepY(cur)) > 4) goSeason(cur, true); ev.preventDefault(); return false; }
      const next = cur + dir; if (next < 0 || next > 3) return true;
      goSeason(next); ev.preventDefault(); return false;
    },
  });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  if (!params.has('qa')) requestAnimationFrame(raf);
}

/* curseur, boutons, clavier, glisser */
let dragging = false;
range.addEventListener('input', () => { const v = +range.value / 100; target = v; if (lenis) lenis.scrollTo(top + v * vh, { immediate: true, force: true }); else scrollTo(0, top + v * vh); });
range.addEventListener('change', () => goSeason(Math.round(+range.value / 100), true));
ticks.forEach((b) => b.addEventListener('click', () => goSeason(+b.dataset.season)));
addEventListener('keydown', (e) => {
  if (document.activeElement === range || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
  const y = lenis ? lenis.targetScroll : scrollY; if (y < top - vh * 0.5 || y > top + 3 * vh + 2) return;
  const cur = clamp(Math.round((y - top) / vh), 0, 3);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { if (cur < 3) { e.preventDefault(); goSeason(cur + 1); } }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { if (cur > 0) { e.preventDefault(); goSeason(cur - 1); } }
});
let dragX = 0, dragV = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; dragX = e.clientX; dragV = target; canvas.setPointerCapture(e.pointerId); stage.classList.add('is-dragging'); });
canvas.addEventListener('pointermove', (e) => {
  if (garden && e.pointerType !== 'touch') { const r = canvas.getBoundingClientRect(); garden.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)); }
  if (!dragging) return; target = clamp(dragV + ((e.clientX - dragX) / canvas.clientWidth) * 3.2, 0, 3);
});
const endDrag = () => { if (!dragging) return; dragging = false; stage.classList.remove('is-dragging'); goSeason(Math.round(target), true); };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

/* la scène */
function start() {
  const ok = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } })();
  if (!ok) { root.classList.add('no-webgl'); return; }
  const low = matchMedia('(pointer: coarse)').matches || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
  import('./garden.js').then(({ createGarden }) => {
    garden = createGarden({ canvas, low, mode: 'seasons' });
    window.__strateSeasons = garden;
    garden.setSeason(shown); garden.render();
    root.classList.add('garden-ready');
    if (params.has('qa')) { const v = clamp(parseFloat(params.get('qa')) || 0, 0, 3); target = shown = v; paint(); for (let k = 0; k < 3; k++) garden.render(); document.title += ' [qa-ready]'; }
  }).catch(() => root.classList.add('no-webgl'));
}

let visible = true;
new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '100px' }).observe(stage);
function frame() {
  const y = lenis ? lenis.animatedScroll : scrollY;
  if (!dragging) target = clamp((y - top) / vh, 0, 3);
  shown += (target - shown) * (reduced ? 1 : dragging ? 0.18 : 0.12);
  if (Math.abs(target - shown) < 0.0005) shown = target;
  paint();
  if (garden && visible) garden.render();
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { measure(); if (garden) garden.resize(); });
new ResizeObserver(() => { measure(); if (garden) garden.resize(); }).observe(document.body);
start(); paint();
if (!params.has('qa')) requestAnimationFrame(frame);
