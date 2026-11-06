/* Strate — la page Jardins : quatre vrais jardins de Bruxelles.
   Les photos se dévoilent au défilement ; au survol, la commune apparaît ;
   au clic, la photo s'ouvre en plein écran, un cadre de repérage se trace quelques secondes,
   puis la fiche du lieu glisse depuis la droite. */
const root = document.documentElement;
const qs = (s, el = document) => el.querySelector(s), qsa = (s, el = document) => [...el.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';

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
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-in')));

/* les photos se dévoilent une fois, au défilement */
const places = qsa('.place');
const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-seen'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
places.forEach((p) => {
  io.observe(p);
  const btn = qs('.place__open', p);
  btn.setAttribute('aria-label', `Voir le jardin : ${qs('.place__name', p).textContent}, ${qs('.place__where', p).textContent}`);
  btn.addEventListener('click', () => open(p, btn));
});

/* la vue d'un lieu */
const pv = qs('#placeview'), pvPhoto = qs('.pv__photo', pv), pvImg = qs('.pv__photo img', pv), marks = qs('.pv__marks', pv), panel = qs('.pv__panel', pv);
let opener = null, openRect = null, timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, reduced ? 0 : ms));
function insetFor(r) { const w = innerWidth, h = innerHeight; return `inset(${Math.max(0, r.top).toFixed(1)}px ${Math.max(0, w - r.right).toFixed(1)}px ${Math.max(0, h - r.bottom).toFixed(1)}px ${Math.max(0, r.left).toFixed(1)}px)`; }
function drawMarks(coord) {
  marks.textContent = '';
  const w = innerWidth, h = innerHeight, m = Math.min(56, w * 0.06), L = Math.min(46, w * 0.05);
  marks.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const path = (d, i) => { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); p.setAttribute('pathLength', '1'); p.style.setProperty('--i', i); marks.append(p); };
  const panelW = w > 960 ? Math.min(460, w * 0.36) : 0, right = w - panelW - m;
  path(`M${m} ${m + L}V${m}H${m + L}`, 0); path(`M${right - L} ${m}H${right}V${m + L}`, 1);
  path(`M${m} ${h - m - L}V${h - m}H${m + L}`, 2); path(`M${right - L} ${h - m}H${right}V${h - m - L}`, 3);
  const cx = (m + right) / 2, cy = h / 2; path(`M${cx - 18} ${cy}H${cx + 18}M${cx} ${cy - 18}V${cy + 18}`, 4);
  path(`M${m} ${h - m - 70}h120M${m} ${h - m - 76}v12M${m + 60} ${h - m - 74}v8M${m + 120} ${h - m - 76}v12`, 5);
  const t = document.createElementNS(SVGNS, 'text'); t.setAttribute('x', m); t.setAttribute('y', h - m - 86); t.textContent = coord; marks.append(t);
}
function open(place, btn) {
  timers.forEach(clearTimeout); timers = [];
  opener = btn; const img = qs('img', btn); openRect = img.getBoundingClientRect();
  pvImg.src = img.currentSrc || img.src; pvImg.alt = img.alt;
  qs('[data-pv-commune]', pv).textContent = qs('.place__where', place).textContent;
  qs('[data-pv-title]', pv).textContent = qs('.place__name', place).textContent;
  qs('[data-pv-line]', pv).textContent = qs('.place__line', place).textContent;
  const sheet = qs('[data-pv-sheet]', pv); sheet.textContent = ''; sheet.append(qs('.place__sheet', place).cloneNode(true));
  const coord = place.dataset.coord; qs('[data-pv-coord]', pv).textContent = coord;
  const [lat, lon] = coord.match(/[\d,]+/g).map((v) => parseFloat(v.replace(',', '.')));
  qs('[data-pv-map]', pv).href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  drawMarks(coord);
  pv.hidden = false; root.classList.add('pv-open'); pv.classList.remove('is-open', 'is-marked', 'is-panel', 'is-unmarked');
  pvPhoto.style.clipPath = reduced ? 'inset(0)' : insetFor(openRect);
  requestAnimationFrame(() => requestAnimationFrame(() => { pv.classList.add('is-open'); pvPhoto.style.clipPath = 'inset(0px 0px 0px 0px)'; }));
  later(() => pv.classList.add('is-marked'), 650);
  later(() => { pv.classList.add('is-panel'); qs('.pv__close', pv).focus({ preventScroll: true }); }, 1100);
  later(() => pv.classList.add('is-unmarked'), 3600);
  if (reduced) qs('.pv__close', pv).focus({ preventScroll: true });
}
function close() {
  if (pv.hidden) return;
  timers.forEach(clearTimeout); timers = [];
  pv.classList.remove('is-panel', 'is-marked');
  const r = opener ? qs('img', opener).getBoundingClientRect() : null;
  const onScreen = r && r.bottom > 0 && r.top < innerHeight;
  setTimeout(() => {
    if (onScreen && !reduced) pvPhoto.style.clipPath = insetFor(r); else pv.classList.remove('is-open');
    setTimeout(() => { pv.hidden = true; pv.classList.remove('is-open', 'is-unmarked'); root.classList.remove('pv-open'); if (opener) opener.focus({ preventScroll: true }); }, reduced ? 0 : 700);
  }, reduced ? 0 : 300);
}
qs('.pv__close', pv).addEventListener('click', close);
pvPhoto.addEventListener('click', close);
pv.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key !== 'Tab') return;
  const f = qsa('button, a[href]', pv).filter((el) => el.offsetParent !== null), first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
addEventListener('resize', () => { if (!pv.hidden) drawMarks(qs('[data-pv-coord]', pv).textContent); });

/* contrôle visuel : ?qa=open:N ouvre le lieu N */
const qa = params.get('qa');
if (qa) {
  places.forEach((p) => p.classList.add('is-seen'));
  const m = qa.match(/open:(\d)/);
  if (m) setTimeout(() => { const p = places[+m[1]]; p.scrollIntoView(); open(p, qs('.place__open', p)); }, 300);
  setTimeout(() => { document.title += ' [qa-ready]'; }, 4200);
}
