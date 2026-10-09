/* ==========================================================================
   M&S Design — mise en place du MacBook 3D du héros
   Le module Three.js n’est chargé que si l’écran sait faire de la 3D (WebGL)
   et si les animations ne sont pas réduites ; sinon une image fixe du
   MacBook ouvert prend le relais (et les onglets restent des boutons).
   ========================================================================== */
const d = document.documentElement;
const stage = document.querySelector('[data-stage]');
const base = d.dataset.base || '';

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

function fallback() {
  d.classList.add('no-3d');
  window.dispatchEvent(new CustomEvent('ms:mac-ready', { detail: { api: null } }));
}

if (stage) {
  if (d.classList.contains('reduced') || !webgl()) fallback();
  else {
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const shot = (n) => base + '/assets/img/site-' + n + '-' + (small ? 720 : 1440) + '.webp';
    import('./mac3d.js?v=4ae891781b').then(async ({ createMac3D }) => {
      const api = await createMac3D(stage, {
        woodSrc: base + '/assets/img/chene-' + (small ? 1024 : 2048) + '.webp',
        shots: { greentage: shot('greentage-accueil'), mystere: shot('mystere') }
      });
      // le premier rendu a déjà eu lieu : le capot fermé apparaît en fondu, puis s’ouvre
      window.__msMac = api;
      d.classList.add('mac-ready');
      window.dispatchEvent(new CustomEvent('ms:mac-ready', { detail: { api } }));
    }).catch((e) => {
      console.warn('[ms] 3D indisponible', e);
      fallback();
    });
  }
}
