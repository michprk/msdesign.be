/* ==========================================================================
   M&S Design — mise en place du « & » en volume du héros
   Le module Three.js n’est chargé que si l’écran sait faire de la 3D (WebGL)
   et si les animations ne sont pas réduites ; sinon l’image fixe du & reste.
   En portrait, le & se pose dans l’espace libre entre le titre et le texte.
   ========================================================================== */
const d = document.documentElement;
const stage = document.querySelector('[data-stage]');
const hero = document.querySelector('[data-hero]');
let api = null;

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

function place() {
  if (!stage || !hero) return;
  const title = hero.querySelector('.hero__title');
  const aside = hero.querySelector('.hero__aside');
  const still = hero.querySelector('.hero__still');
  const H = hero.clientHeight, W = hero.clientWidth;
  const portrait = W / H < 0.9 || W <= 700;
  ['fx', 'fy', 'fh'].forEach((k) => { delete stage.dataset[k]; });
  if (still) ['--ax', '--ay', '--aw'].forEach((k) => still.style.removeProperty(k));
  if (portrait && title && aside) {
    const r = hero.getBoundingClientRect();
    const top = title.getBoundingClientRect().bottom - r.top;
    const bottom = aside.getBoundingClientRect().top - r.top;
    const free = Math.max(80, bottom - top);
    const fy = (top + free / 2) / H, fh = (free * 0.9) / H;
    Object.assign(stage.dataset, { fx: '0.6', fy: fy.toFixed(3), fh: fh.toFixed(3) });
    if (still) {
      still.style.setProperty('--ax', '60%');
      still.style.setProperty('--ay', (fy * 100).toFixed(1) + '%');
      still.style.setProperty('--aw', ((fh * H) / 0.86).toFixed(0) + 'px');
    }
  }
  if (api) api.resize();
}

place();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
let t = 0;
window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(place, 120); });

if (stage) {
  if (d.classList.contains('reduced') || !webgl()) d.classList.add('no-3d');
  else {
    import('./amp3d.js?v=afd2890d03').then(({ createAmp3D }) => createAmp3D(stage)).then((a) => {
      api = a;
      window.__msAmp = a; // accès pratique pour le débogage
      place();
      requestAnimationFrame(() => d.classList.add('amp-ready'));
    }).catch((e) => {
      console.warn('[ms] 3D indisponible', e);
      d.classList.add('no-3d');
    });
  }
}
