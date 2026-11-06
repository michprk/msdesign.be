/* Strate — la page Saisons : l'étang du Bois de la Cambre, le même lieu aux quatre saisons.
   Un cran de molette = une saison ; la photo suivante se dévoile par un balayage doux, de gauche à droite.
   Aussi : un curseur, les boutons, les flèches du clavier, ou la photo qu'on fait glisser. */
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
  { name: 'Printemps', months: 'mars à mai', text: 'Les arbres de l’île débourrent, l’eau reflète un vert tendre. Chez vous, c’est le moment de planter les vivaces.' },
  { name: 'Été', months: 'juin à août', text: 'Le feuillage est au plus dense, l’ombre gagne les berges. Chez vous : arrosage au pied, tôt le matin.' },
  { name: 'Automne', months: 'septembre à novembre', text: 'Les chênes et les hêtres virent au cuivre le long de l’allée. Chez vous : la saison de plantation des arbres.' },
  { name: 'Hiver', months: 'décembre à février', text: 'L’étang gèle, il ne reste que la structure des arbres. Chez vous : taille des fruitiers, dessin des plans.' },
];
const mo = new Date().getMonth();
const NOW = [11, 0, 1].includes(mo) ? 3 : [2, 3, 4].includes(mo) ? 0 : [5, 6, 7].includes(mo) ? 1 : 2;

const section = qs('.sz'), stage = qs('.sz__stage'), photos = qs('.sz__photos'), imgs = qsa('.sz__img'), range = qs('#sz-range');
const nameEl = qs('[data-season-name]'), monthsEl = qs('[data-season-months]'), textEl = qs('[data-season-text]'), ticks = qsa('[data-season]'), nowBox = qs('.sz__now');
qsa('[data-season-card]').forEach((li) => { if (+li.dataset.seasonCard === NOW) { li.classList.add('is-now'); const t = qs('.year__months', li); if (t) t.textContent += ', en ce moment'; } });
ticks.forEach((b) => b.classList.toggle('is-now', +b.dataset.season === NOW));

let target = 0, shown = 0, shownLabel = -1, top = 0, vh = innerHeight, dragging = false;
function measure() { vh = qsa('.sz__step')[0]?.offsetHeight || innerHeight; top = section.getBoundingClientRect().top + scrollY; }
measure();

/* les photos : celles d'avant restent, la suivante se dévoile en balayage */
let lastKey = '';
function paintPhotos() {
  const i0 = Math.min(2, Math.floor(shown)), t = reduced ? Math.round(shown - i0) : shown - i0;
  const key = i0 + ':' + t.toFixed(3); if (key === lastKey) return; lastKey = key;
  imgs.forEach((im, k) => {
    let m = 'none', vis = '1';
    if (k === i0 + 1) {
      if (t <= 0.001) vis = '0';
      else if (t < 0.999) { const p = t * 150 - 25; m = `linear-gradient(100deg, #000 ${(p - 22).toFixed(1)}%, rgba(0,0,0,0) ${(p + 22).toFixed(1)}%)`; }
    } else if (k > i0 + 1) vis = '0';
    im.style.opacity = vis; im.style.webkitMaskImage = m; im.style.maskImage = m;
  });
}
function paint() {
  paintPhotos();
  const lab = Math.round(shown);
  if (lab !== shownLabel) {
    shownLabel = lab; const S = SEASONS[lab];
    nameEl.textContent = S.name; monthsEl.textContent = S.months + (lab === NOW ? ', en ce moment' : ''); textEl.textContent = S.text;
    range.setAttribute('aria-valuetext', S.name);
    ticks.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.season === lab)));
    nowBox.classList.remove('is-swap'); void nowBox.offsetWidth; nowBox.classList.add('is-swap');
  }
  if (document.activeElement !== range && !dragging) range.value = String(Math.round(shown * 100));
}

/* défilement : un cran = une saison */
const Lenis = window.Lenis;
let lenis = null, lockUntil = 0, lastWheel = 0, lastDir = 0;
const stepY = (i) => top + i * vh;
function goSeason(i, fast = false) {
  i = clamp(i, 0, 3); lockUntil = performance.now() + (fast ? 600 : 1250);
  if (lenis) lenis.scrollTo(stepY(i), { duration: fast ? 0.8 : 1.6, easing: ease, lock: true, force: true });
  else scrollTo({ top: stepY(i), behavior: reduced ? 'auto' : 'smooth' });
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
range.addEventListener('input', () => { const v = +range.value / 100; target = v; if (lenis) lenis.scrollTo(top + v * vh, { immediate: true, force: true }); else scrollTo(0, top + v * vh); });
range.addEventListener('change', () => goSeason(Math.round(+range.value / 100), true));
ticks.forEach((b) => b.addEventListener('click', () => goSeason(+b.dataset.season)));
addEventListener('keydown', (e) => {
  if (document.activeElement === range || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
  const y = lenis ? lenis.targetScroll : scrollY; if (y < top - vh * 0.5 || y > top + 3 * vh + 2) return;
  const cur = clamp(Math.round((y - top) / vh), 0, 3);
  if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key) && cur < 3) { e.preventDefault(); goSeason(cur + 1); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key) && cur > 0) { e.preventDefault(); goSeason(cur - 1); }
});
let dragX = 0, dragV = 0, px = 0, py = 0, tx = 0, ty = 0;
photos.addEventListener('pointerdown', (e) => { dragging = true; dragX = e.clientX; dragV = target; photos.setPointerCapture(e.pointerId); stage.classList.add('is-dragging'); });
photos.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; }
  if (dragging) target = clamp(dragV - ((e.clientX - dragX) / photos.clientWidth) * 3.2, 0, 3);
});
const endDrag = () => { if (!dragging) return; dragging = false; stage.classList.remove('is-dragging'); goSeason(Math.round(target), true); };
photos.addEventListener('pointerup', endDrag); photos.addEventListener('pointercancel', endDrag);

/* la boucle */
function frame() {
  const y = lenis ? lenis.animatedScroll : scrollY;
  if (!dragging) target = clamp((y - top) / vh, 0, 3);
  shown += (target - shown) * (reduced ? 1 : dragging ? 0.2 : 0.12);
  if (Math.abs(target - shown) < 0.0005) shown = target;
  if (!reduced) { px += (tx - px) * 0.05; py += (ty - py) * 0.05; photos.style.transform = `translate3d(${(-px * 12).toFixed(2)}px, ${(-py * 8).toFixed(2)}px, 0) scale(1.04)`; }
  paint();
  requestAnimationFrame(frame);
}
addEventListener('resize', measure);
new ResizeObserver(measure).observe(document.body);
root.classList.add('photos-ready');
if (params.has('qa')) {
  const v = clamp(parseFloat(params.get('qa')) || 0, 0, 3); target = shown = v; paint();
  Promise.all(imgs.map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; })))).then(() => { document.title += ' [qa-ready]'; });
} else { paint(); requestAnimationFrame(frame); }
