/* Strate — défilement par chapitres, arche, révélations, plans, calendrier.
   Un cran de molette = une animation entière (pas de défilement « au pas à pas »). */
const root = document.documentElement;
const qs = (s, el = document) => el.querySelector(s), qsa = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* animations : toutes par défaut ; le visiteur peut les réduire (pied de page ou ?motion=reduce) */
let reduced = false;
try { reduced = localStorage.getItem('strate_motion') === 'reduce'; } catch (e) { /* stockage indisponible */ }
if (new URLSearchParams(location.search).get('motion') === 'reduce') reduced = true;
root.classList.add('js', reduced ? 'motion-reduce' : 'motion-full');
const motionBtn = qs('[data-motion-toggle]');
if (motionBtn) {
  motionBtn.textContent = reduced ? 'Remettre les animations' : 'Réduire les animations';
  motionBtn.addEventListener('click', () => { try { localStorage.setItem('strate_motion', reduced ? 'full' : 'reduce'); } catch (e) { /* rien */ } location.reload(); });
}

const story = qs('.story'), stage = qs('.stage'), canvas = qs('.stage__canvas'), header = qs('.hdr'), note = qs('.ex-note');
const chapters = qsa('.chapter');
let vh = innerHeight, storyTop = 0, garden = null, p = 0;

qsa('[data-i]').forEach((el) => el.style.setProperty('--i', el.dataset.i));

function measure() {
  vh = (chapters[1] && chapters[1].offsetHeight) || innerHeight;
  storyTop = story.getBoundingClientRect().top + scrollY;
  root.style.setProperty('--vh', `${vh}px`);
}
measure();

/* ---------- défilement amorti (Lenis) et chapitres ---------- */
const Lenis = window.Lenis;
let lenis = null, lockUntil = 0, lastWheel = 0, lastDir = 0;
const chapterY = (i) => (i <= 0 ? 0 : storyTop + i * vh);
const currentScroll = () => (lenis ? lenis.targetScroll : scrollY);
const nearest = (y) => clamp(Math.round((y - storyTop) / vh), 0, 3);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function goChapter(i, fast = false) {
  const y = chapterY(i);
  lockUntil = performance.now() + (fast ? 700 : 1350);
  if (lenis) lenis.scrollTo(y, { duration: fast ? 0.9 : 1.7, easing: ease, lock: true, force: true });
  else scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
}

if (Lenis && !reduced) {
  lenis = new Lenis({
    lerp: 0.1, smoothWheel: true, respectReducedMotion: false,
    virtualScroll: (e) => {
      const ev = e.event;
      if (!ev || ev.type !== 'wheel' || ev.ctrlKey) return true;
      const now = performance.now(), dy = e.deltaY; if (!dy) return true;
      const dir = Math.sign(dy), fresh = now - lastWheel > 220 || dir !== lastDir;
      lastWheel = now; lastDir = dir;
      if (now < lockUntil) { ev.preventDefault(); return false; }       // geste en cours : on l'absorbe entier
      const y = currentScroll(), end = storyTop + 3 * vh;
      const inZone = y < end - 2 || (y <= end + 2 && dir < 0);
      if (!inZone) return true;
      const cur = nearest(y);
      if (!fresh) {                                             // fin d'une inertie : on se cale sur le chapitre le plus proche
        if (Math.abs(y - chapterY(cur)) > 4) goChapter(cur, true);
        ev.preventDefault(); return false;
      }
      const next = cur + dir;
      if (next < 0 || next > 3) return true;                    // au-delà : défilement normal
      goChapter(next); ev.preventDefault(); return false;
    },
  });
  window.__strateLenis = lenis;
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  if (!new URLSearchParams(location.search).has('qa')) requestAnimationFrame(raf);
}

/* clavier : flèches, page suivante, espace */
addEventListener('keydown', (e) => {
  if (reduced || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement?.tagName || '')) return;
  const down = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey, up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
  if (!down && !up) return;
  const y = currentScroll(); if (y > storyTop + 3 * vh + 2) return;
  const next = nearest(y) + (down ? 1 : -1);
  if (next < 0 || next > 3) return;
  e.preventDefault(); if (performance.now() > lockUntil) goChapter(next);
});

/* liens internes vers les chapitres (menu, boutons) */
qsa('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href').slice(1); const ch = chapters.findIndex((c) => c.id === id);
  if (ch >= 0) { e.preventDefault(); goChapter(ch); history.replaceState(null, '', `#${id}`); return; }
  const t = id && document.getElementById(id);
  if (t && lenis) { e.preventDefault(); lenis.scrollTo(t, { offset: -8, duration: 1.4, easing: ease }); history.replaceState(null, '', `#${id}`); }
}));
const descend = qs('[data-descend]');
if (descend) descend.addEventListener('click', () => goChapter(1));

/* écrans tactiles : aimantation douce des chapitres */
if (matchMedia('(pointer: coarse)').matches) root.classList.add('snap');

/* ---------- l'arche du premier écran ---------- */
const arch = qs('.hero__arch');
let archRect = null;
function measureArch() {
  if (!arch) return;
  const r = arch.getBoundingClientRect(), s = stage.getBoundingClientRect();
  archRect = { x: r.left - s.left, y: r.top + scrollY - (story.getBoundingClientRect().top + scrollY), w: r.width, h: r.height };
  if (garden) garden.setShift(((archRect.x + archRect.w / 2) / s.width) * 2 - 1, -(((archRect.y + archRect.h / 2) / vh) * 2 - 1));
}
function clipStage(open) {
  if (!archRect) return;
  const sw = stage.clientWidth, sh = stage.clientHeight, e = ease(open);
  const t = archRect.y * (1 - e), l = archRect.x * (1 - e), r = (sw - archRect.x - archRect.w) * (1 - e), b = Math.max(0, sh - archRect.y - archRect.h) * (1 - e);
  const rad = (archRect.w / 2) * (1 - e);
  stage.style.clipPath = open >= 0.999 ? 'none' : `inset(${t.toFixed(1)}px ${r.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${rad.toFixed(1)}px ${rad.toFixed(1)}px 0 0)`;
}

/* ---------- boucle : progression, en-tête, chapitres ---------- */
const tones = qsa('[data-tone]');
let toneMarks = [];
const BG = { jardins: 'olive', methode: 'paper', saisons: 'bottle', contact: 'orange' };
function measureTones() { toneMarks = tones.filter((el) => el !== header).map((el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, tone: el.dataset.tone, bg: BG[el.id] || 'forest' }; }); }
let lastActive = -1, visible = true;
function frame() {
  const y = lenis ? lenis.animatedScroll : scrollY;
  p = clamp((y - storyTop) / vh, 0, 3);
  if (garden && visible) { garden.setProgress(p); garden.render(); }
  clipStage(reduced ? 1 : smooth(0, 0.5, p));
  root.style.setProperty('--p', p.toFixed(4));
  const active = Math.round(p);
  if (active !== lastActive && Math.abs(p - active) < 0.3) { chapters.forEach((c, i) => c.classList.toggle('is-active', i === active)); lastActive = active; story.dataset.chapter = active; }
  frameHeader(y);
  requestAnimationFrame(frame);
}
// ton de l'en-tête selon ce qui passe dessous
function frameHeader(y) {
  const noteH = note ? Math.max(0, note.offsetHeight - y) : 0;
  header.style.transform = `translateY(${noteH}px)`;
  let tone = 'light', bg = '';
  if (y < storyTop + 3 * vh + vh * 0.5) bg = p > 0.55 && p < 2.45 ? 'paper' : '';
  else { const probe = y + 40; for (const m of toneMarks) if (probe >= m.top && probe < m.bottom) { tone = m.tone; bg = m.bg; break; } }
  if (header.dataset.tone !== tone) header.dataset.tone = tone;
  if (bg) { header.dataset.bg = bg; header.classList.add('is-solid'); } else header.classList.remove('is-solid');
}

/* ---------- la scène 3D ---------- */
function startGarden() {
  const ok = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch (e) { return false; } })();
  if (!ok) { root.classList.add('no-webgl'); return; }
  const low = matchMedia('(pointer: coarse)').matches || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
  import('./garden.js').then(({ createGarden }) => {
    garden = createGarden({
      canvas, low,
      labels: { strata: qsa('.strata-label'), layers: qsa('.layer-label'), ruler: qs('.ruler') },
    });
    window.__strateGarden = garden;
    measureArch(); garden.setProgress(p); garden.render();
    if (QA !== null) { root.classList.add('garden-ready'); window.__strateQA(); document.title += ' [qa-ready]'; return; }
    requestAnimationFrame(() => root.classList.add('garden-ready'));
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '200px' }).observe(stage);
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect(); garden.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    }, { passive: true });
  }).catch(() => root.classList.add('no-webgl'));
}

/* ---------- révélations (une seule fois) ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -18% 0px' });
qsa('[data-reveal]').forEach((el) => io.observe(el));

/* ---------- les jardins : un plan à la fois, qui se dessine ---------- */
const tabs = qsa('[data-plan-tab]');
tabs.forEach((btn) => btn.addEventListener('click', () => {
  const id = btn.dataset.planTab;
  tabs.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
  qsa('[data-plan]').forEach((fig) => {
    const on = fig.dataset.plan === id; fig.hidden = !on;
    if (on) { fig.classList.remove('is-in'); void fig.offsetWidth; fig.classList.add('is-in'); }
  });
}));
tabs.forEach((btn, i) => btn.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault(); const n = tabs[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); n.click();
}));

/* ---------- le calendrier : l'aiguille sur aujourd'hui ---------- */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const NOW = [
  'On taille les fruitiers et on dessine les plans du printemps.',
  'Dernière fenêtre pour planter à racines nues avant la reprise.',
  'Les vivaces entrent en terre, le sol se réchauffe.',
  'On sème les prairies et on paille les massifs.',
  'Les jeunes plantations demandent un arrosage suivi.',
  'La citerne travaille : on arrose tôt le matin, au pied.',
  'Taille légère des haies, le jardin se repose.',
  'On repère les zones sèches pour corriger le plan.',
  'Le meilleur mois pour planter des vivaces : la terre est encore chaude.',
  'Bulbes, prairies d’automne et premières haies.',
  'Le meilleur moment pour planter un arbre : il passe l’hiver à faire des racines.',
  'On plante tant que le sol ne gèle pas.',
];
const ring = qs('.ring');
if (ring) {
  const d = new Date(), m = d.getMonth(), frac = (m + (d.getDate() - 1) / 31) / 12;
  const hand = qs('.ring__hand', ring); if (hand) hand.style.setProperty('--a', `${(frac * 360).toFixed(1)}deg`);
  const mEl = qs('[data-now-month]'), tEl = qs('[data-now-text]');
  if (mEl) mEl.textContent = MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1);
  if (tEl) tEl.textContent = NOW[m];
  qsa('li[data-task]').forEach((li) => {
    const on = li.dataset.months.split(',').map(Number).includes(m);
    li.classList.toggle('is-now', on);
    if (on) { const sm = qs('small', li); if (sm) sm.textContent += ', en ce moment'; }
    li.addEventListener('mouseenter', () => ring.dataset.focus = li.dataset.task);
    li.addEventListener('mouseleave', () => delete ring.dataset.focus);
    li.addEventListener('focusin', () => ring.dataset.focus = li.dataset.task);
    li.addEventListener('focusout', () => delete ring.dataset.focus);
  });
}

/* ---------- formulaire de démonstration ---------- */
const form = qs('.visit-form');
if (form) form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const out = qs('.visit-form__done', form); out.hidden = false; out.focus();
});

/* ---------- contrôle visuel (?qa=0..3) : une image fixe d'un chapitre, sans boucle ---------- */
const QA = new URLSearchParams(location.search).get('qa');
if (QA !== null) {
  root.classList.add('qa');
  const q = clamp(parseFloat(QA) || 0, 0, 3);
  window.__strateQA = () => {
    relayout(); const at = new URLSearchParams(location.search).get('at'), el = at && document.getElementById(at);
    const y = el ? el.getBoundingClientRect().top + scrollY + 1 : q <= 0 ? 0 : storyTop + q * vh;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
    const pl = new URLSearchParams(location.search).get('plan'); if (pl) qs('[data-plan-tab="' + pl + '"]')?.click();
    p = q; chapters.forEach((c, i) => c.classList.toggle('is-active', i === Math.round(q)));
    clipStage(smooth(0, 0.5, q)); measureTones(); frameHeader(y); qsa('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    if (garden) { if (q >= 0.8) garden.growNow(); garden.setProgress(q); for (let k = 0; k < 3; k++) garden.render(); }
    return 'ok';
  };
}

/* ---------- démarrage ---------- */
function relayout() { measure(); measureArch(); measureTones(); if (garden) garden.resize(); }
new ResizeObserver(relayout).observe(document.body);
addEventListener('resize', relayout);
document.fonts?.ready.then(relayout);
startGarden();
measureTones(); measureArch();
if (QA === null) requestAnimationFrame(frame);
if (location.hash) { const ch = chapters.findIndex((c) => `#${c.id}` === location.hash); if (ch > 0) setTimeout(() => goChapter(ch, true), 60); }
