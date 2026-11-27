/* ==========================================================================
   M&S Design — interactions du site
   Le héros : le MacBook s’ouvre ; chaque onglet (ou icône du Dock) de son
   écran ouvre une partie du site — la caméra plonge dans l’écran, un voile
   de la couleur de la section prend le relais, et le site est là.
   Ensuite : défilement amorti, apparitions, chiffres, FAQ, formulaire de
   devis (validation, anti-spam, API ou e-mail), cookies et mesure
   d’audience après accord, barre d’action mobile, page 404.
   Chaque bloc est isolé : si l’un échoue, le reste du site fonctionne.
   ========================================================================== */
import Lenis from 'lenis';   // défilement amorti (paquet npm « lenis »)

(() => {
  'use strict';
  const d = document.documentElement;
  const reduced = d.classList.contains('reduced');
  const PAGE = d.dataset.page || '';
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const safe = (name, fn) => { try { fn(); } catch (error) { console.warn('[ms] ' + name, error); } };
  const EMAIL = 'mck.honorable@msdesign.be';
  const PHONE = '+32 486 61 11 59';
  const KEY = 'ms_';
  const euro = (n) => new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 2 }).format(n) + ' €';

  /* ---------- Mesure d’audience (Google Analytics 4, uniquement après accord) ---------- */
  const GA_ID = (d.dataset.ga || '').trim();
  function track(name, params) {
    if (window.gtag && window.__msGa) window.gtag('event', name, params || {});
  }
  function loadAnalytics() {
    if (!GA_ID || window.__msGa) return;
    window.__msGa = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }
  function clearAnalyticsCookies() {
    const host = location.hostname.split('.');
    document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => /^_ga/.test(n)).forEach((n) => {
      for (let i = 0; i < host.length; i++) document.cookie = n + '=; Max-Age=0; path=/; domain=' + host.slice(i).join('.');
      document.cookie = n + '=; Max-Age=0; path=/';
    });
  }
  // Le choix est redemandé après 6 mois (durée annoncée dans la politique de confidentialité)
  function readConsent() {
    try {
      const c = JSON.parse(localStorage.getItem(KEY + 'consent') || 'null');
      if (c && c.date && Date.now() - Date.parse(c.date) > 182 * 864e5) return null;
      return c;
    } catch (e) { return null; }
  }
  safe('cookies', () => {
    const box = $('[data-cookie]');
    const main = box && $('[data-cookie-main]', box);
    const prefs = box && $('[data-cookie-prefs]', box);
    const toggle = box && $('[data-consent-analytics]', box);
    const consent = readConsent();
    if (consent && consent.analytics) loadAnalytics();
    if (!box) return;
    const open = (showPrefs) => {
      const c = readConsent();
      if (toggle) toggle.checked = !!(c && c.analytics);
      box.hidden = false;
      main.hidden = !!showPrefs;
      prefs.hidden = !showPrefs;
      const btn = $('[data-consent="customize"]', box);
      if (btn) btn.setAttribute('aria-expanded', String(!!showPrefs));
    };
    const save = (analytics) => {
      try { localStorage.setItem(KEY + 'consent', JSON.stringify({ analytics, date: new Date().toISOString().slice(0, 10), v: 1 })); } catch (e) { /* navigation privée */ }
      box.hidden = true;
      if (analytics) loadAnalytics();
      else {
        if (window.gtag && window.__msGa) window.gtag('consent', 'update', { analytics_storage: 'denied' });
        clearAnalyticsCookies();
      }
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-consent]');
      if (!b) return;
      const action = b.dataset.consent;
      if (action === 'accept') save(true);
      else if (action === 'refuse') save(false);
      else if (action === 'customize') open(true);
      else if (action === 'save') save(!!(toggle && toggle.checked));
    });
    $$('[data-cookie-open]').forEach((b) => b.addEventListener('click', () => open(true)));
    // le bandeau ne gâche pas la première impression : il arrive au premier défilement (ou après 14 s)
    if (!consent) {
      let shown = false;
      const later = () => { if (shown) return; shown = true; window.removeEventListener('scroll', onScroll); if (!readConsent()) open(false); };
      const onScroll = () => { if (window.scrollY > 120) setTimeout(later, 600); };
      window.addEventListener('scroll', onScroll, { passive: true });
      setTimeout(later, PAGE === 'index' ? 14000 : 1400);
    }
  });

  // Clics suivis (boutons d’action, téléphone, WhatsApp, e-mail, projets…)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (el) track(el.dataset.track, { link_url: el.getAttribute('href') || '', page: PAGE });
  });
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Défilement amorti (Lenis) ----------
     En haut de page, le Mac intercepte les gestes (heroInput) : le site s’ouvre depuis son écran. */
  const heroInput = { wheel: null, touch: null };
  let lenis = null;
  safe('lenis', () => {
    if (reduced || typeof Lenis !== 'function') return;
    lenis = new Lenis({
      lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: true, respectReducedMotion: false,
      virtualScroll: (data) => {
        const ev = data.event;
        const fn = ev.type.indexOf('wheel') > -1 ? heroInput.wheel : ev.type.indexOf('touch') > -1 ? heroInput.touch : null;
        if (fn && fn(data.deltaX, data.deltaY, ev)) { if (ev.cancelable) ev.preventDefault(); return false; }
        return true;
      }
    });
    window.__msLenis = lenis; // accès pratique pour le débogage
  });
  // un défilement lancé par le site (menu, ancre, bouton) : on le note, pour que les scènes ne le « rattrapent » pas
  let navigationJusqua = 0;
  function scrollToY(y, duration) {
    navigationJusqua = performance.now() + (duration || 1.3) * 1000 + 300;
    if (lenis) lenis.scrollTo(y, { duration: duration || 1.3, easing: easeInOut, force: true });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }
  function jumpToY(y) {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }
  const header = $('[data-header]');
  const hdrH = () => (header ? header.offsetHeight : 0);
  const targetY = (el) => (el.id === 'top' ? 0 : el.getBoundingClientRect().top + window.scrollY - (el.classList.contains('sec') ? 0 : hdrH()) + 1);

  /* ---------- En-tête : voilé dès qu’on quitte le haut de page ---------- */
  const hero = $('[data-hero]');
  safe('header', () => {
    if (!header) return;
    // sur l’accueil, le haut de page est un écran à part : le menu n’apparaît qu’une fois le héros passé
    const update = () => {
      header.classList.toggle('is-solid', window.scrollY > 8 || !hero);
      if (hero) d.classList.toggle('sans-menu', window.scrollY < hero.offsetHeight * 0.55);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    const links = $$('.hdr__nav a[data-nav]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    const map = new Map(links.map((a) => [a.dataset.nav, a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const link = map.get(entry.target.id);
        if (!link) return;
        if (entry.isIntersecting) { links.forEach((a) => a.classList.remove('is-active')); link.classList.add('is-active'); }
        else link.classList.remove('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  });

  /* ---------- Menu mobile ---------- */
  safe('menu', () => {
    const btn = $('[data-menu-toggle]');
    const menu = $('[data-menu]');
    if (!btn || !menu) return;
    const label = $('.sr-only', btn);
    const set = (open) => {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
      d.classList.toggle('menu-open', open);
      if (lenis) { if (open) lenis.stop(); else lenis.start(); }
      if (open) { const first = $('a', menu); if (first) first.focus({ preventScroll: true }); }
    };
    btn.addEventListener('click', () => set(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') { set(false); btn.focus(); }
      if (e.key === 'Tab') {
        const items = [btn, ...$$('a, button', menu)];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 1180 && !menu.hidden) set(false); });
  });

  /* ==========================================================================
     Le héros et les projets
     ========================================================================== */
  /* ---------- L’ouverture : écran bleu, petit chargement, le nom s’allume, le point du « i » tombe, puis la page s’ouvre ---------- */
  let ouverture = Promise.resolve();
  safe('ouverture', () => {
    const o = $('[data-ouverture]');
    if (!o) return;
    if (!d.classList.contains('intro-on')) { o.remove(); return; }
    if (lenis) lenis.stop();
    const pct = $('[data-ouverture-pct]', o), barre = $('[data-ouverture-barre]', o);
    const CHARGE = 2100, t0 = performance.now();
    const tic = (t) => {
      const k = Math.min(1, (t - t0) / CHARGE), e = 1 - Math.pow(1 - k, 3);
      pct.textContent = String(Math.round(e * 100)).padStart(3, '0');
      barre.style.transform = 'scaleX(' + e.toFixed(3) + ')';
      if (k < 1) requestAnimationFrame(tic);
    };
    requestAnimationFrame(tic);
    ouverture = new Promise((pret) => {
      setTimeout(() => o.classList.add('is-allume'), CHARGE);            // le nom s’allume
      setTimeout(() => o.classList.add('is-point'), CHARGE + 350);       // le point tombe sur le « i » et rebondit
      setTimeout(() => { o.classList.add('is-part'); pret(); }, 4700);   // pshou : l’écran file vers le haut
      setTimeout(() => {
        d.classList.remove('intro-on'); o.remove();
        if (lenis) lenis.start();
        try { sessionStorage.setItem('ms_intro', 'seen'); } catch (err) { /* navigation privée */ }
      }, 5700);
    });
  });

  // le titre apparaît ligne par ligne (après l’ouverture, s’il y en a une)
  safe('hero-in', () => {
    if (!hero) return;
    ouverture.then(() => requestAnimationFrame(() => setTimeout(() => d.classList.add('hero-in'), reduced ? 0 : 80)));
  });

  /* ---------- L’anneau de logos : il tourne lentement en 3D, on peut le faire tourner à la main ----------
     Les cartes sont posées sur l’intérieur d’un grand cylindre : celles des bords se rapprochent
     et se tournent vers le centre. En sortant d’un côté, une carte revient de l’autre. */
  safe('anneau', () => {
    const el = $('[data-anneau]');
    if (!el) return;
    const cartes = $$('.anneau__carte', el), N = cartes.length;
    if (!N) return;
    let base = 0, vit = 0, tire = false, x0 = 0, b0 = 0, dernier = 0, R = 800, pas = 14, L = 180, visible = false, tourne = false;
    const mesurer = () => {
      const W = el.clientWidth;
      L = Math.max(118, Math.min(210, W * 0.13)); R = Math.max(300, W * 0.55);     // rayon plus serré sur téléphone : l’anneau y reste bien courbé
      pas = (L * 1.12 / R) * 180 / Math.PI;
      el.style.setProperty('--l', L.toFixed(1) + 'px');
    };
    const placer = () => {
      const arc = N * pas;
      cartes.forEach((c, i) => {
        const a = ((((i * pas + base) % arc) + arc) % arc) - arc / 2, r = a * Math.PI / 180;
        const x = Math.sin(r) * R, z = (1 - Math.cos(r)) * R * 0.85;
        c.style.transform = 'translate3d(' + x.toFixed(1) + 'px, 0, ' + z.toFixed(1) + 'px) rotateY(' + (-a).toFixed(2) + 'deg)';
        c.style.opacity = Math.abs(a) > Math.min(arc / 2 - pas * 0.6, 78) ? '0' : '1';
        c.style.setProperty('--ombre', (0.42 * Math.pow(Math.min(1, Math.abs(a) / 78), 1.4)).toFixed(3));
      });
    };
    const boucle = (t) => {
      const dt = Math.min(0.05, dernier ? (t - dernier) / 1000 : 0.016); dernier = t;
      if (!tire) { vit += ((reduced ? 0 : 3.4) - vit) * Math.min(1, dt * 1.6); base += vit * dt; }
      placer();
      if (visible) requestAnimationFrame(boucle); else { tourne = false; dernier = 0; }
    };
    mesurer(); placer();
    new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      if (visible && !tourne) { tourne = true; requestAnimationFrame(boucle); }
    }).observe(el);
    window.addEventListener('resize', () => { mesurer(); placer(); });
    el.addEventListener('pointerdown', (ev) => { tire = true; x0 = ev.clientX; b0 = base; vit = 0; el.setPointerCapture(ev.pointerId); el.classList.add('is-tire'); });
    el.addEventListener('pointermove', (ev) => { if (!tire) return; const nb = b0 + (ev.clientX - x0) * (pas / L) * 0.9; vit = (nb - base) / 0.016; base = nb; });
    const lacher = () => { if (!tire) return; tire = false; el.classList.remove('is-tire'); vit = Math.max(-70, Math.min(70, vit)); };
    el.addEventListener('pointerup', lacher); el.addEventListener('pointercancel', lacher);
  });

  /* ---------- Le champ de points : le paysage se lève, puis on plonge vers nos projets ----------
     Déclenché, pas étiré : en arrivant par le haut (en descendant), la page se pose au début de la piste le temps
     que les points se lèvent ; au cran suivant vers le bas (ou au clic sur « Voir nos projets » / un nom de site),
     la caméra plonge dans la vallée, l’écran passe au bleu nuit et l’on arrive sur « Nos projets ».
     En remontant, rien ne bloque. Le dessin (WebGL) se charge dès que la page est prête. */
  safe('champ', () => {
    const el = $('[data-champ]');
    if (!el) return;
    const piste = $('.champ__piste', el), toile = $('.champ__toile', el), salle = $('[data-salle]');
    let champ = null, vAvant = 0, dernierY = window.scrollY, parti = false, plonge = false, verrouille = false, tVerrou = 0;
    if (!reduced) el.classList.add('is-attente');
    const avance = () => { const r = piste.getBoundingClientRect(), h = r.height - window.innerHeight; return h > 0 ? Math.min(1, Math.max(0, -r.top / h)) : 0; };
    // le défilement en pause (souris : Lenis s’arrête ; sinon la page ne bouge plus) ; par sécurité, jamais plus de 4 s
    const verrouiller = (oui) => {
      if (oui === verrouille) return;
      verrouille = oui; clearTimeout(tVerrou);
      if (lenis) { if (oui) lenis.stop(); else lenis.start(); }
      else d.style.overflow = oui ? 'hidden' : '';
      if (oui) tVerrou = setTimeout(() => verrouiller(false), 4000);
    };
    let ne = false;
    const naitre = () => { if (ne) return; ne = true; el.classList.remove('is-attente'); el.classList.add('is-ne'); if (champ) champ.naitre(); };
    const voile = document.createElement('div');
    voile.className = 'passage'; voile.setAttribute('aria-hidden', 'true');
    document.body.appendChild(voile);
    // où arriver dans « Nos projets » : le premier site, ou celui qu’on a choisi
    const cibleSalle = (j) => {
      const p = $('.salle__piste', salle), n = $$('.salle__ecran', salle).length || 1;
      if (j == null || !p) return salle.getBoundingClientRect().top + window.scrollY + 1;
      const r = p.getBoundingClientRect();
      return r.top + window.scrollY + (r.height - window.innerHeight) * ((j + 0.5) / n);
    };
    // bam : la caméra plonge dans la vallée, les points filent, l’écran passe au bleu nuit, on est dans les projets
    const plonger = (j) => {
      if (plonge || !salle) return;
      plonge = true; parti = true;
      if (reduced || !champ) { plonge = false; scrollToY(cibleSalle(j), 1.1); return; }
      verrouiller(true);
      el.classList.add('is-plonge');
      setTimeout(() => voile.classList.add('is-on'), 760);
      let fini = false;
      const arriver = () => {
        if (fini) return;
        fini = true;
        navigationJusqua = performance.now() + 900;
        jumpToY(cibleSalle(j));
        el.classList.remove('is-plonge');
        champ.reposer();
        verrouiller(false);
        plonge = false;
        requestAnimationFrame(() => requestAnimationFrame(() => voile.classList.remove('is-on')));
      };
      champ.plonger(arriver);
      setTimeout(arriver, 1500);                           // par sécurité : même si le dessin s’arrête, on arrive
    };
    const maj = () => {
      const y = window.scrollY, bas = y >= dernierY; dernierY = y;
      const v = avance(), venuDuHaut = vAvant <= 0.06, assis = vAvant >= 0.04 && vAvant <= 0.4; vAvant = v;
      if (v < 0.03) parti = false;                         // revenu au début : le prochain cran replongera
      // le paysage se lève quand il couvre l’écran (en arrivant par le haut, c’est au moment où l’on se pose)
      if (!ne && (reduced || piste.getBoundingClientRect().top <= 1)) naitre();
      if (plonge || verrouille || reduced) return;
      const libre = performance.now() > navigationJusqua;
      // on arrive par le haut : on se pose au début de la piste, le paysage se lève (1,6 s sans bouger)
      if (v > 0.06 && bas && venuDuHaut && !parti && v < 0.6 && libre) {
        const r = piste.getBoundingClientRect(), cible = r.top + window.scrollY + (r.height - window.innerHeight) * 0.1;
        if (lenis) lenis.scrollTo(cible, { immediate: true, force: true }); else window.scrollTo(0, cible);
        vAvant = 0.1;
        naitre();
        verrouiller(true);
        setTimeout(() => verrouiller(false), 1600);
        return;
      }
      // un cran de plus vers le bas : on plonge (seulement si l’on était posé sur le paysage : un saut d’un coup
      // par-dessus la section, avec la barre de défilement par exemple, ne déclenche rien)
      if (v > 0.18 && v < 0.95 && assis && bas && !parti && libre) plonger(null);
      else if (v >= 0.95 && bas) parti = true;
    };
    window.addEventListener('scroll', maj, { passive: true });
    maj();
    $$('[data-champ-aller]', el).forEach((a) => a.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const j = a.dataset.champAller;
      plonger(j === '' ? null : Number(j));
    }));
    const charger = () => import('./points.js').then((m) => {
      champ = m.createChamp(toile, { reduced });
      if (!champ) return;
      el.classList.add('has-gl');
      if (el.classList.contains('is-ne')) champ.naitre();
      new IntersectionObserver((es) => champ.visible(es[es.length - 1].isIntersecting)).observe(el);
      window.addEventListener('resize', () => champ.taille());
      if (fine && !reduced) {
        el.addEventListener('pointermove', (ev) => { const r = toile.getBoundingClientRect(); champ.souris((ev.clientX - r.left) / r.width - 0.5, (ev.clientY - r.top) / r.height - 0.5); });
        el.addEventListener('pointerleave', () => champ.quitte());
      }
    }).catch((err) => { console.warn('[ms] champ', err); });
    if (document.readyState === 'complete') setTimeout(charger, 300);
    else window.addEventListener('load', () => setTimeout(charger, 300), { once: true });
  });

  /* ---------- Le ciel : il apparaît quand on arrive au contact (et repart si l’on remonte au-dessus) ---------- */
  safe('ciel', () => {
    const el = $('[data-ciel]');
    if (!el) return;
    // il reste allumé quand on descend dans le pied de page : en remontant, pas de clignotement
    new IntersectionObserver((es) => { const e = es[es.length - 1]; el.classList.toggle('is-visible', e.isIntersecting || e.boundingClientRect.top < 0); }, { rootMargin: '0px 0px -35% 0px' }).observe(el);
  });

  /* ---------- Nos réalisations : la salle de projection ----------
     La piste est haute ; à chaque palier de défilement, l'écran de devant s'envole et le suivant s'avance.
     Survoler (ou parcourir au clavier) un nom de la liste montre son écran tout de suite. La pile suit un peu la souris. */
  safe('salle', () => {
    const el = $('[data-salle]');
    if (!el) return;
    const piste = $('.salle__piste', el), pile = $('[data-salle-pile]', el), liste = $('.salle__liste', el), scene = $('.salle__scene', el);
    const liens = $$('[data-salle-lien]', el), ecrans = $$('.salle__ecran', el), N = ecrans.length;
    const num = $('[data-salle-n]', el), texte = $('[data-salle-texte]', el), doigt = $('.salle__doigt', el);
    if (!N) return;
    let actif = -1, survol = null, tTexte = 0;
    // le doigt de Michel-Ange vient se placer devant le numéro du site affiché (le bout de l’index est à 44 % de la hauteur de l’image)
    const viserDoigt = () => {
      if (!doigt || actif < 0 || !doigt.offsetWidth) return;
      const s = scene.getBoundingClientRect(), a = liens[actif].getBoundingClientRect(), n = $('.salle__num', liens[actif]).getBoundingClientRect();
      doigt.style.setProperty('--dx', (n.left - s.left - doigt.offsetWidth - 12).toFixed(1) + 'px');
      doigt.style.setProperty('--dy', (a.top + a.height / 2 - s.top - doigt.offsetHeight * 0.44).toFixed(1) + 'px');
      doigt.classList.add('is-la');
    };
    const poser = (i) => {
      if (i === actif) return;
      actif = i;
      ecrans.forEach((e, j) => {
        const k = j - i;
        e.style.setProperty('--k', String(k));
        e.classList.toggle('is-devant', k === 0);
        e.classList.toggle('is-parti', k < 0);
        e.classList.toggle('is-loin', k > 3);
      });
      liens.forEach((a, j) => a.setAttribute('aria-current', j === i ? 'true' : 'false'));
      viserDoigt();
      if (num) num.textContent = String(i + 1).padStart(2, '0');
      if (texte) {
        texte.classList.add('is-change'); clearTimeout(tTexte);
        tTexte = setTimeout(() => { texte.textContent = liens[i].dataset.texte || ''; texte.classList.remove('is-change'); }, reduced ? 0 : 260);
      }
    };
    const palier = () => {
      const r = piste.getBoundingClientRect(), h = r.height - window.innerHeight;
      const p = h > 0 ? Math.min(0.9999, Math.max(0, -r.top / h)) : 0;
      return Math.floor(p * N);
    };
    const maj = () => { if (survol === null) poser(palier()); };
    window.addEventListener('scroll', maj, { passive: true });
    window.addEventListener('resize', () => { maj(); viserDoigt(); });
    maj();
    if (doigt) { if (doigt.complete) viserDoigt(); else doigt.addEventListener('load', viserDoigt, { once: true }); }
    liens.forEach((a, j) => {
      a.addEventListener('pointerenter', () => { survol = j; poser(j); });
      a.addEventListener('focus', () => { survol = j; poser(j); });
      a.addEventListener('blur', () => { survol = null; maj(); });
      // un clic sur un nom ramène à ce site (le site lui-même s’ouvre depuis son écran) ; Ctrl/⌘ + clic l’ouvre quand même
      a.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        survol = null;
        const r = piste.getBoundingClientRect(), h = r.height - window.innerHeight;
        scrollToY(r.top + window.scrollY + h * ((j + 0.5) / N), 1.1);
      });
    });
    if (liste) liste.addEventListener('pointerleave', () => { survol = null; maj(); });
    // le fond : de grands plis de lumière que la souris remue sans se voir (« boule invisible ») ; chargé à l’approche
    const toile = $('.salle__fond', el);
    if (toile) {
      new IntersectionObserver((es, io) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        import('./fond-salle.js').then((m) => {
          const fond = m.createFond(toile, { reduced });
          if (!fond) return;
          new IntersectionObserver((es) => fond.visible(es[es.length - 1].isIntersecting)).observe(el);
          scene.addEventListener('pointermove', (ev) => {
            const r = scene.getBoundingClientRect();
            fond.souris((ev.clientX - r.left) / r.width, 1 - (ev.clientY - r.top) / r.height);
          });
          scene.addEventListener('pointerleave', () => fond.sortie());
        }).catch((err) => console.warn('[ms] fond', err));
      }, { rootMargin: '100% 0px' }).observe(el);
    }
    if (!fine || reduced) return;
    // la pile s’incline doucement vers la souris
    if (pile) {
      let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
      const boucle = () => {
        x += (tx - x) * 0.08; y += (ty - y) * 0.08;
        pile.style.setProperty('--ry', (x * 7).toFixed(2) + 'deg');
        pile.style.setProperty('--rx', (-y * 4.5).toFixed(2) + 'deg');
        raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(boucle) : 0;
      };
      const viser = () => { if (!raf) raf = requestAnimationFrame(boucle); };
      el.addEventListener('pointermove', (e) => {
        const r = pile.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
        ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
        viser();
      });
      el.addEventListener('pointerleave', () => { tx = 0; ty = 0; viser(); });
    }
  });

  /* ---------- La demande en une phrase : des idées qui s’écrivent toutes seules, puis le formulaire ---------- */
  safe('demande', () => {
    const f = $('[data-demande]');
    if (!f) return;
    const champ = $('input', f);
    const idees = ['Un site pour mon salon de thé à Ixelles…', 'Un logo pour ma boulangerie…', 'Refaire le site de mon cabinet d’architecte…', 'Une boutique en ligne pour mes céramiques…'];
    if (!reduced) {
      let i = 0, n = 0, sens = 1;
      const ecrire = () => {
        if (document.activeElement === champ || champ.value) { setTimeout(ecrire, 700); return; }
        const t = idees[i]; n += sens; champ.placeholder = t.slice(0, Math.max(0, n));
        if (n >= t.length) { sens = -1; setTimeout(ecrire, 1900); return; }
        if (n <= 0) { sens = 1; i = (i + 1) % idees.length; }
        setTimeout(ecrire, sens > 0 ? 42 : 16);
      };
      ouverture.then(() => setTimeout(ecrire, 1600));
    }
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const txt = champ.value.trim(), msg = $('#f-message'), cible = document.getElementById('contact');
      if (msg && txt) msg.value = txt;
      track('demande_hero', { rempli: Boolean(txt) });
      if (!cible) return;
      history.replaceState(null, '', '#contact');
      scrollToY(targetY(cible), 1.4);
      setTimeout(() => { const n = $('#contact-form [name="name"]'); if (n && fine) n.focus({ preventScroll: true }); }, reduced ? 0 : 1400);
    });
  });

  /* ---------- Ancres douces + présélection du formulaire ---------- */
  const formApi = {};
  safe('anchors', () => {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href*="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      // la formule choisie suit le visiteur jusqu’au formulaire, même depuis une autre page
      if (a.dataset.plan) { try { sessionStorage.setItem(KEY + 'plan', a.dataset.plan); } catch (err) { /* navigation privée */ } }
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.pathname.replace(/index\.html$/, '') !== location.pathname.replace(/index\.html$/, '') || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      if (a.dataset.plan && formApi.preset) formApi.preset(a.dataset.plan);
      if (a.dataset.projet && formApi.projet) formApi.projet(a.dataset.projet);
      history.replaceState(null, '', url.hash);
      openReperes(target);
      scrollToY(targetY(target), 1.4);
      if (target.id === 'contact') setTimeout(() => { const f = $('#contact-form [name="name"]'); if (f && fine) f.focus({ preventScroll: true }); }, reduced ? 0 : 1400);
    });
  });

  /* ---------- Titres : lignes qui montent derrière un masque ---------- */
  safe('lines', () => {
    $$('[data-lines]').forEach((el) => {
      // (pas d’attribut style dans le HTML injecté : la politique de sécurité CSP l’interdit)
      const parts = el.innerHTML.split(/<br\s*\/?>/i);
      el.innerHTML = parts.map((html) => '<span class="ml-line"><span class="ml-line__inner">' + html.trim() + '</span></span>').join('');
      $$('.ml-line__inner', el).forEach((s, i) => s.style.setProperty('--ml-delay', (i * 0.1).toFixed(2) + 's'));
    });
  });

  /* ---------- Tarifs : les repères de prix, repliés derrière un bouton ---------- */
  function openReperes(target, open = true) {
    const box = $('[data-reperes]'), btn = $('[data-reperes-toggle]');
    if (!box || !btn || (target && !box.contains(target))) return false;
    if (box.hidden !== open) return false;
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Masquer les repères de prix' : 'Voir nos repères de prix';
    if (lenis) lenis.resize();
    return true;
  }
  safe('reperes', () => {
    const box = $('[data-reperes]'), btn = $('[data-reperes-toggle]');
    if (!box || !btn) return;
    btn.addEventListener('click', () => {
      const open = box.hidden;
      openReperes(null, open);
      if (open) setTimeout(() => scrollToY(targetY(box), 1.3), 60);
      else { const r = btn.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) jumpToY(r.top + window.scrollY - window.innerHeight * 0.55); }
      track('reperes_toggle', { open });
    });
    // arrivée directe sur une ancre des repères (#a-la-carte…)
    const hashEl = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (hashEl && box.contains(hashEl)) { openReperes(hashEl); setTimeout(() => jumpToY(targetY(hashEl)), 120); }
  });

  /* ---------- Tarifs : un site se construit en 3D, étape par étape, jusqu’au devis ---------- */
  safe('devis3d', () => {
    const root = $('[data-devis]'), stage = $('[data-devis-stage]');
    if (!root || !stage) return;
    const steps = $$('[data-devis-steps] li'), cap = $('[data-devis-caption]'), replay = $('[data-devis-replay]');
    const names = steps.map((li) => (li.querySelector('b') || li).textContent.trim());
    let api = null, wantPlay = false, seen = false, onScreen = false;
    const setStep = (i) => {
      steps.forEach((li, k) => {
        li.classList.toggle('is-done', k < i);
        if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      if (cap) cap.textContent = (i + 1) + ' / ' + steps.length + ' · ' + names[i];
    };
    const playing = (on) => { root.classList.toggle('is-playing', on); if (replay) replay.hidden = on || reduced; };
    const start = (from) => { if (!api) { wantPlay = true; return; } playing(true); api.play(from); };
    if (!('IntersectionObserver' in window)) return;
    const loader = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      loader.disconnect();
      import('./devis3d.js').then(async (m) => {
        steps.forEach((li, i) => li.style.setProperty('--dur', ((m.STEPS[i + 1] || m.END) - m.STEPS[i]).toFixed(2) + 's'));
        api = await m.createDevis3D(stage, {
          reduced,
          onStep: setStep,
          onReady: () => stage.classList.add('is-live'),
          onEnd: () => playing(false),
        });
        if (!api) return;
        window.__msDevis = api;
        api.setVisible(onScreen);
        if (reduced) { setStep(steps.length - 1); return; }
        if (wantPlay) start(0);
      }).catch((err) => console.warn('[ms] devis3d', err));
    }, { rootMargin: '700px 0px' });
    loader.observe(stage);
    // un seul geste suffit : l’animation se lance d’elle-même quand la scène est bien à l’écran
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      onScreen = e.isIntersecting;
      if (api) api.setVisible(onScreen);
      if (e.intersectionRatio >= 0.45 && !seen) { seen = true; start(0); }
    }), { threshold: [0, 0.45] });
    io.observe(stage);
    steps.forEach((li, i) => li.querySelector('button').addEventListener('click', () => {
      seen = true; setStep(i);
      if (!api) { wantPlay = true; return; }
      if (reduced) return;
      playing(true); api.jump(i);
    }));
    if (replay) replay.addEventListener('click', () => start(0));
  });

  /* ---------- Texte du studio : les mots montent un à un ---------- */
  safe('words', () => {
    $$('[data-words]').forEach((el) => {
      const words = el.textContent.trim().split(/ +/);
      el.setAttribute('aria-label', el.textContent.trim());
      el.textContent = '';
      words.forEach((w, i) => {
        const outer = document.createElement('span'), inner = document.createElement('span');
        outer.className = 'w'; outer.setAttribute('aria-hidden', 'true');
        inner.textContent = w; inner.style.setProperty('--wd', (i * 0.022).toFixed(3) + 's');
        outer.appendChild(inner); el.appendChild(outer);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });
  });

  /* ---------- Boutons et menu : le texte roule vers le haut au survol ---------- */
  safe('roll', () => {
    $$('a.btn, .hdr__nav a').forEach((a) => {
      const node = Array.from(a.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
      if (!node) return;
      const text = node.textContent.trim();
      const roll = document.createElement('span'), one = document.createElement('span'), two = document.createElement('span');
      roll.className = 'roll'; one.textContent = text; two.textContent = text; two.setAttribute('aria-hidden', 'true');
      roll.append(one, two);
      a.replaceChild(roll, node);
    });
  });

  /* ---------- La mini-vidéo : ne se charge et ne joue que lorsqu’elle est à l’écran ---------- */
  safe('reel', () => {
    const v = $('[data-reel-video]');
    if (!v || reduced || !('IntersectionObserver' in window)) return;
    v.muted = true;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); } const p = v.play(); if (p) p.catch(() => {}); }
      else v.pause();
    }), { rootMargin: '120px 0px', threshold: 0.05 });
    io.observe(v);
  });

  /* ---------- Le film M&S : la carte ouvre le film complet, avec le son ---------- */
  safe('film', () => {
    const dlg = $('[data-film]'), open = $('[data-film-open]');
    if (!dlg || !open || typeof dlg.showModal !== 'function') return;     // sans <dialog> : le lien ouvre la vidéo
    const v = $('[data-film-video]', dlg);
    open.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      dlg.showModal();
      if (lenis) lenis.stop();
      v.currentTime = 0;
      const p = v.play(); if (p) p.catch(() => {});
      track('film_play');
    });
    const close = () => { if (dlg.open) dlg.close(); };
    $('[data-film-close]', dlg).addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });       // clic sur le fond
    dlg.addEventListener('close', () => { v.pause(); if (lenis) lenis.start(); open.focus({ preventScroll: true }); });
    v.addEventListener('ended', close);
  });

  /* ---------- « Mettez le désordre. On remet de l’ordre. » ----------
     Le bleu de la bande « En ligne en 21 jours » continue sur la section ; en descendant, quand son haut passe aux
     2/5 de l’écran, il se défait en points depuis la planche, la main en lignes bleues arrive, le doigt touche et les
     tuiles de nos identités visuelles se rangent en sphère (assets/js/sphere3d.js). Le défilement n’est jamais mis en
     pause. On fait tourner la sphère ; un clic sur une tuile ouvre la planche de sa marque, un clic (ou Échap) la referme.
     Si la section repart sous l’écran (on remonte), tout rejouera ; arrivé autrement (menu, par le bas), c’est en ordre. */
  safe('ordre', () => {
    const sec = $('[data-ordre]');
    if (!sec) return;
    const toile = $('.ordre__toile', sec), piste = $('.ordre__piste', sec);
    let objet = null, ouvert = false, profond = false, dernierY = window.scrollY, hautAvant = 1, verrouille = false, tVerrou = 0;
    const avance = () => { const r = piste.getBoundingClientRect(), h = r.height - window.innerHeight; return h > 0 ? Math.min(1, Math.max(0, -r.top / h)) : 0; };
    // le défilement en pause le temps d’entrer (jamais plus de 3 s)
    const verrouiller = (oui) => {
      if (oui === verrouille) return;
      verrouille = oui; clearTimeout(tVerrou);
      if (lenis) { if (oui) lenis.stop(); else lenis.start(); }
      else d.style.overflow = oui ? 'hidden' : '';
      if (oui) tVerrou = setTimeout(() => verrouiller(false), 3000);
    };
    // deux états : l’univers est ouvert (la sphère), ou fermé (le voile de points bleus le recouvre)
    // - on l’ouvre en descendant : en arrivant par le haut, on se pose et il s’ouvre ; si l’on y redescend sans être
    //   ressorti, il se rouvre sans se poser ;
    // - on le ferme en remontant, dans le premier tiers de la piste : les points se referment bien avant que le bord
    //   de la section n’apparaisse ; on ne se pose pas ;
    // - arrivé par le bas, ou par un lien, au-delà du premier tiers : il est déjà ouvert.
    // Entre « fermer en remontant » (avance < 0,3) et « rouvrir sans descendre » (avance ≥ 0,3) il n’y a aucun
    // chevauchement : pas d’aller-retour possible.
    const fermer = (instant) => {
      if (!ouvert) return;
      ouvert = false; sec.classList.remove('is-ordre');
      if (instant) objet.recouvrir(); else objet.couvrir();
    };
    const verifier = () => {
      const y = window.scrollY, dy = y - dernierY, descend = dy > 0, monte = dy < 0; dernierY = y;
      const r = piste.getBoundingClientRect(), h = window.innerHeight, v = avance();
      const venuDuHaut = hautAvant > 0; hautAvant = r.top;
      if (!objet) return;
      if (r.top >= h || r.bottom <= 0) { if (r.top >= h) fermer(true); return; }   // la section n’est pas à l’écran
      if (ouvert) {
        if (Math.abs(dy) < 400) objet.elan(dy);                   // dans l’univers, le défilement fait tourner la sphère
        if (v >= 0.3) profond = true;
        // on referme en remontant pour de vrai (pas sur un frémissement de quelques pixels) : bien avant le bord si l’on
        // était descendu dans l’univers, ou dès qu’on repasse au-dessus de son début
        if (monte && dy < -3 && ((profond && v < 0.3) || r.top > 0)) fermer(false);
        return;
      }
      if (verrouille) return;
      const libre = performance.now() > navigationJusqua;
      if (descend && r.top <= 0 && v < 0.3) {
        ouvert = true; profond = false;
        if (venuDuHaut && libre && !reduced) {                     // on arrive par le haut : on se pose, on entre
          const cible = r.top + window.scrollY;
          if (lenis) lenis.scrollTo(cible, { immediate: true, force: true }); else window.scrollTo(0, cible);
          verrouiller(true);
          setTimeout(() => verrouiller(false), 2300);
        }
        if (reduced) objet.montrer(); else objet.jouer();
        return;
      }
      if (v >= 0.3) { ouvert = true; profond = true; objet.montrer(); }   // arrivé par le bas, ou par un lien
    };
    window.addEventListener('scroll', verifier, { passive: true });
    const charger = () => Promise.all([import('./sphere3d.js'), import('./projets.js')]).then(([m, donnees]) => {
      const { PROJETS, CASES, NOMS_CASES, SUR_LA_SPHERE, ILOT, planche } = donnees;
      const grand = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) > 1500;
      // une planche ouverte en double densité sur les écrans fins (Retina, 4K) ; la sphère se contente de la 1440
      const fin = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) > 2000;
      const base = import.meta.env.BASE_URL;
      const projets = PROJETS.map((p) => ({ ...p, image: planche(base, p.id, false), grande: fin ? planche(base, p.id, true) : null }));
      const fiche = $('[data-fiche]', sec), panneau = $('.fiche', fiche), etiquette = $('[data-etiquette]', sec), index = $('[data-ordre-index]', sec);
      const champ = (n) => $('[data-f="' + n + '"]', fiche);
      let courant = -1, retour = null;

      /* ---- la fiche d'un projet : remplie depuis projets.js ---- */
      const remplir = (pi) => {
        const p = projets[pi];
        champ('nom').textContent = p.nom;
        champ('metier').textContent = p.metier + ', ' + p.lieu;
        champ('intro').textContent = p.intro;
        champ('idee').textContent = p.idee;
        champ('direction').textContent = p.direction;
        champ('rang').textContent = (pi + 1) + ' / ' + projets.length;
        const couleurs = champ('couleurs');
        couleurs.textContent = '';
        for (const [nom, valeur] of p.couleurs) {
          const li = document.createElement('li'), pastille = document.createElement('i'), texte = document.createElement('span'), code = document.createElement('small');
          pastille.style.setProperty('--c', valeur);
          texte.textContent = nom;
          code.textContent = valeur.startsWith('#') ? valeur.toUpperCase() : 'Dégradé';
          texte.append(code); li.append(pastille, texte); couleurs.append(li);
        }
        // la typographie, dans sa propre police (chargée seulement ici)
        const aa = champ('aa'), police = p.police;
        aa.style.fontFamily = police.famille; aa.style.fontWeight = String(police.graisse);
        aa.style.fontStyle = police.italique ? 'italic' : 'normal'; aa.style.fontStretch = police.largeur || 'normal';
        aa.textContent = police.majuscules ? 'AA' : 'Aa';
        champ('police').textContent = police.nom;
        // les visuels : l'îlot en miniature ; une vignette touchée est mise en avant dans la planche
        const visuels = champ('visuels');
        visuels.textContent = '';
        for (const nom of SUR_LA_SPHERE) {
          const [x0, y0, x1, y1] = ILOT.cases[nom], [u0, v0, u1, v1] = CASES[nom];
          const li = document.createElement('li'), b = document.createElement('button'), vignette = document.createElement('span');
          li.style.setProperty('--l', (x0 / ILOT.largeur) * 100 + '%'); li.style.setProperty('--t', y0 * 100 + '%');
          li.style.setProperty('--w', ((x1 - x0) / ILOT.largeur) * 100 + '%'); li.style.setProperty('--h', (y1 - y0) * 100 + '%');
          b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', NOMS_CASES[nom] + ' de ' + p.nom);
          vignette.className = 'fiche__vignette';
          vignette.style.setProperty('--img', 'url("' + p.image + '")');
          vignette.style.setProperty('--bs', (100 / (u1 - u0)) + '% ' + (100 / (v1 - v0)) + '%');
          vignette.style.setProperty('--bp', (u0 / (1 - (u1 - u0))) * 100 + '% ' + (v0 / (1 - (v1 - v0))) * 100 + '%');
          b.addEventListener('click', () => {
            const oui = b.getAttribute('aria-pressed') !== 'true';
            visuels.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
            b.setAttribute('aria-pressed', oui ? 'true' : 'false');
            if (objet) objet.cellule(oui ? nom : null);
          });
          b.append(vignette); li.append(b); visuels.append(li);
        }
        const img = $('[data-fiche-image]', fiche);
        img.alt = 'La planche d’identité de ' + p.nom + ' : affiche, logo, couleurs, typographie, carte de visite et icône.';
        if (sec.classList.contains('sans-gl')) img.src = p.image;
      };
      const montrerFiche = (pi) => {
        const deja = courant >= 0;
        remplir(pi);
        courant = pi;
        sec.classList.add('is-ouverte');
        d.classList.add('fiche-ouverte');
        if (!deja) {
          retour = document.activeElement;
          fiche.hidden = false;
          void fiche.offsetWidth;                          // pour que l'entrée soit animée
          fiche.classList.add('is-on');
          if (lenis) lenis.stop();
          setTimeout(() => { if (courant >= 0) champ('nom').focus({ preventScroll: true }); }, 80);
        } else {
          panneau.classList.remove('is-change'); void panneau.offsetWidth; panneau.classList.add('is-change');
          panneau.scrollTop = 0;
        }
      };
      const cacherFiche = () => {
        if (courant < 0) return;
        courant = -1;
        fiche.classList.remove('is-on');
        sec.classList.remove('is-ouverte');
        d.classList.remove('fiche-ouverte');
        if (lenis) lenis.start();
        setTimeout(() => { if (courant < 0) fiche.hidden = true; }, 450);
        if (retour && retour.isConnected && retour !== document.body && fiche.contains(document.activeElement)) retour.focus({ preventScroll: true });
        retour = null;
      };
      const fermerFiche = () => { if (objet) objet.fermer(); else cacherFiche(); };
      const changer = (dd) => { if (courant < 0) return; if (objet) objet.suivant(dd); else montrerFiche((courant + dd + projets.length) % projets.length); };
      $('[data-fiche-fermer]', fiche).addEventListener('click', fermerFiche);
      $('[data-fiche-prec]', fiche).addEventListener('click', () => changer(-1));
      $('[data-fiche-suiv]', fiche).addEventListener('click', () => changer(1));
      $('[data-fiche-contact]', fiche).addEventListener('click', (ev) => {
        ev.preventDefault();
        fermerFiche();
        const c = document.getElementById('contact');
        setTimeout(() => { if (lenis) lenis.scrollTo(c); else c.scrollIntoView({ behavior: 'smooth' }); }, 80);
      });
      // au clavier, dans la fiche : flèches = autre projet ; Tab reste dans la fiche
      fiche.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight') { changer(1); ev.preventDefault(); }
        else if (ev.key === 'ArrowLeft') { changer(-1); ev.preventDefault(); }
        else if (ev.key === 'Tab') {
          const els = [...fiche.querySelectorAll('button, a[href]')].filter((e) => e.offsetParent !== null);
          if (!els.length) return;
          const premier = els[0], dernier = els[els.length - 1];
          if (ev.shiftKey && (document.activeElement === premier || !fiche.contains(document.activeElement) || document.activeElement === champ('nom'))) { dernier.focus(); ev.preventDefault(); }
          else if (!ev.shiftKey && document.activeElement === dernier) { premier.focus(); ev.preventDefault(); }
        }
      });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && courant >= 0) fermerFiche(); });

      /* ---- le nom du projet survolé, au-dessus de son îlot ---- */
      const eNom = $('[data-e="nom"]', etiquette), eMetier = $('[data-e="metier"]', etiquette);
      let eCourant = -1;
      const onEtiquette = (pi, x, y, a) => {
        if (pi < 0) { etiquette.classList.remove('is-on'); eCourant = -1; return; }
        if (pi !== eCourant) { eCourant = pi; eNom.textContent = projets[pi].nom; eMetier.textContent = projets[pi].metier; }
        const l = toile.clientWidth;
        etiquette.style.setProperty('--x', Math.max(120, Math.min(l - 120, x)).toFixed(1) + 'px');
        etiquette.style.setProperty('--y', Math.max(150, y).toFixed(1) + 'px');
        etiquette.style.setProperty('--a', Math.min(1, a * 1.4).toFixed(3));
        etiquette.classList.add('is-on');
      };

      objet = m.createSphere(toile, {
        reduced,
        main: base + 'assets/img/poire/main-' + (grand ? 2720 : 1400) + '.webp',
        projets,
        // le bas du titre (la sphère se place en dessous, entière)
        haut: () => { const t = $('.ordre__texte', sec); return t ? t.getBoundingClientRect().bottom - toile.getBoundingClientRect().top + 26 : 0; },
        onContact: () => sec.classList.add('is-ordre'),
        onOuvre: (pi) => { if (pi >= 0) montrerFiche(pi); else cacherFiche(); },
        onEtiquette,
      });

      /* ---- les projets en liste : au clavier (la sphère se tourne vers celui qui a le focus), ou sans 3D ---- */
      projets.forEach((p, pi) => {
        const li = document.createElement('li'), b = document.createElement('button'), img = document.createElement('img');
        const nom = document.createElement('span'), metier = document.createElement('span');
        b.type = 'button';
        img.alt = ''; img.width = 1440; img.height = 900; img.loading = 'lazy'; img.decoding = 'async';
        if (!objet) img.src = p.image;
        nom.className = 'ordre__index-nom'; nom.textContent = p.nom;
        metier.className = 'ordre__index-metier'; metier.textContent = p.metier;
        b.append(img, nom, metier); li.append(b); index.append(li);
        b.addEventListener('click', () => { if (objet) { if (!ouvert) { ouvert = true; profond = true; } objet.ouvrir(pi); } else montrerFiche(pi); });
        b.addEventListener('focus', () => { if (objet) { if (!ouvert) { ouvert = true; profond = true; } objet.viser(pi); } etiquette.classList.add('is-clavier'); });
      });
      index.addEventListener('focusout', (ev) => { if (!index.contains(ev.relatedTarget)) { if (objet) objet.viser(-1); etiquette.classList.remove('is-clavier'); } });

      // pas de WebGL 2 : la liste en vignettes ; la fiche s'ouvre en fenêtre (un clic à côté la referme)
      if (!objet) {
        sec.classList.add('sans-gl');
        $('[data-fiche-fermer]', fiche).firstChild.textContent = 'Fermer';
        fiche.addEventListener('click', (ev) => { if (ev.target === fiche) cacherFiche(); });
        return;
      }
      if (import.meta.env.DEV) window.__msSphere = objet;
      sec.classList.add('has-gl');
      // un saut dans la page peut livrer plusieurs changements d’un coup : seul le dernier dit si la section est à l’écran
      new IntersectionObserver((es) => objet.visible(es[es.length - 1].isIntersecting)).observe(sec);
      window.addEventListener('resize', () => objet.taille());
      dernierY = window.scrollY + 1;                     // déjà sur la section au chargement : directement rangée
      verifier();
      // la souris : survoler (le projet se soulève, son nom apparaît), faire tourner la sphère (appuyer et glisser),
      // cliquer un projet ; rien de tout ça sur la fiche elle-même
      const ici = (ev) => { const r = toile.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
      const surFiche = (ev) => !!ev.target.closest('.fiche, [data-ordre-index]');
      const curseur = (x, y) => { sec.dataset.sous = objet.sous(x, y); };
      // à la souris, le curseur devient une main holographique bleue (dessinée dans la toile) ; le vrai est caché
      // (main.css, .is-main) ; il revient sur la fiche, la liste et hors de la section
      sec.addEventListener('pointermove', (ev) => {
        if (surFiche(ev)) { objet.souris(-9999, -9999, false); delete sec.dataset.sous; return; }
        const souris = ev.pointerType === 'mouse';
        sec.classList.toggle('is-main', souris);
        const [x, y] = ici(ev); objet.souris(x, y, souris || ev.buttons > 0, souris); curseur(x, y);
      });
      sec.addEventListener('pointerdown', (ev) => { if (surFiche(ev)) return; const [x, y] = ici(ev); objet.appui(x, y); sec.classList.add('is-appui'); });
      window.addEventListener('pointerup', () => { objet.lache(); sec.classList.remove('is-appui'); });
      window.addEventListener('pointercancel', () => { objet.lache(); sec.classList.remove('is-appui'); });
      sec.addEventListener('pointerleave', () => { objet.souris(-9999, -9999, false); delete sec.dataset.sous; });
      sec.addEventListener('click', (ev) => { if (surFiche(ev)) return; const [x, y] = ici(ev); objet.clic(x, y); curseur(x, y); });
    }).catch((err) => { console.warn('[ms] ordre', err); });
    new IntersectionObserver((es, o) => { if (es.some((v) => v.isIntersecting)) { o.disconnect(); charger(); } }, { rootMargin: '200% 0px' }).observe(sec);
  });

  /* ---------- La ficelle 3D : Three.js n’est chargé qu’à l’approche de la section ---------- */
  safe('ribbon', () => {
    const host = $('[data-ribbon]');
    if (!host || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      import('./ribbon.js')
        .then((m) => { window.__msRibbon = m.createRibbon(host, { reduced, grid: $('[data-ribbon-grid]', host), lenis: () => lenis }); })
        .catch((err) => console.warn('[ms] ribbon', err));
    }, { rootMargin: '500px 0px' });
    io.observe(host);
  });

  /* ---------- Apparitions à l’entrée dans l’écran ----------
     Un élément apparaît quand son haut passe au-dessus de la ligne (88 % de la hauteur d’écran).
     Quand on remonte la page et qu’il repasse sous cette ligne, il s’efface ; dès qu’on
     redescend, il réapparaît aussitôt. Ceux qu’on a dépassés vers le bas restent affichés. */
  safe('reveal', () => {
    const groups = new Map();
    $$('[data-reveal]').forEach((el) => {
      const p = el.parentElement;
      const n = groups.get(p) || 0;
      groups.set(p, n + 1);
      if (n) el.style.setProperty('--d', Math.min(0.42, n * 0.08).toFixed(2) + 's');
    });
    const targets = $$('[data-reveal], [data-lines], [data-words]');
    if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-in');
        else if (entry.boundingClientRect.top > 0) entry.target.classList.remove('is-in');   // reparti sous la ligne : on remonte
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    targets.forEach((el) => io.observe(el));
  });

  /* ---------- Chiffres qui comptent ---------- */
  safe('counters', () => {
    const nums = $$('[data-count]');
    if (!nums.length || reduced || !('IntersectionObserver' in window)) return;
    const fmt = (el, v) => {
      const dec = Number(el.dataset.dec || 0);
      return new Intl.NumberFormat('fr-BE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
    };
    const run = (el) => {
      const to = Number(el.dataset.count);
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / 1600, 0, 1);
        el.textContent = fmt(el, to * easeOut(t));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      run(e.target);
      io.unobserve(e.target);
    }), { threshold: 0.6 });
    nums.forEach((el) => io.observe(el));
  });

  /* ---------- Questions fréquentes : une seule ouverte à la fois ---------- */
  safe('faq', () => {
    const root = $('[data-faq]');
    if (!root) return;
    const items = $$('details', root);
    items.forEach((det) => {
      det.addEventListener('toggle', () => {
        if (!det.open) return;
        items.forEach((o) => { if (o !== det) o.open = false; });
        track('faq_open', { question: ($('.faq__q', det) || $('summary', det)).textContent.trim().slice(0, 80) });
      });
    });
  });

  /* ---------- Devis : formulaire ---------- */
  const PROJETS = { vitrine: 'Site vitrine', refonte: 'Refonte de site', identite: 'Identité visuelle', seo: 'Référencement', automatisation: 'Automatisation', autre: 'Autre demande' };
  const PLANS = {
    essentiel: { name: 'Essentiel', price: 500, detail: 'Site une page sur mesure, formulaire, référencement de base, en ligne en 2 semaines.' },
    signature: { name: 'Signature', price: 1290, detail: 'Jusqu’à 6 pages, animations premium, SEO local et fiche Google, en ligne en 3 semaines.' },
    premium: { name: 'Premium', price: 3900, detail: 'Design d’exception haut de gamme, animations sur mesure, trois langues, réservation ou boutique, identité visuelle et textes, 3 mois de suivi, en ligne en 6 semaines.' }
  };
  safe('form', () => {
    const form = $('[data-form]');
    if (!form) return;
    const status = $('[data-status]', form);
    const est = $('[data-estimate]', form);
    const submit = $('button[type="submit"]', form);
    const startedAt = Date.now();
    const val = (n) => (form.elements[n] ? String(form.elements[n].value || '').trim() : '');
    const fileInput = form.elements.fichier;
    const fileName = () => (fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0].name.slice(0, 120) : '');

    // Formule choisie : prix, acompte et solde, tout de suite
    function estimate() {
      const p = PLANS[val('formule')];
      if (!est) return;
      if (!p) { est.hidden = true; est.innerHTML = ''; return; }
      est.hidden = false;
      est.innerHTML = '<strong>' + p.name + ' · ' + euro(p.price) + ' HTVA</strong> — acompte ' + euro(p.price / 2) + ', solde ' + euro(p.price / 2) + ' à la mise en ligne.<small>' + p.detail + '</small>';
    }
    form.addEventListener('change', (e) => {
      if (e.target.name === 'formule') estimate();
      if (e.target.name === 'fichier') { const l = $('[data-file-label]', form); if (l) l.textContent = fileName() || 'Joindre un fichier'; }
      if (e.target.name === 'projet') { const box = $('#err-projet', form); if (box) { box.hidden = true; box.textContent = ''; } }
    });
    formApi.preset = (plan) => {
      const sel = form.elements.formule;
      if (sel && PLANS[plan]) { sel.value = plan; estimate(); }
      const pj = form.elements.projet;
      if (pj && !val('projet')) pj.value = 'vitrine';
      form.dispatchEvent(new Event('change'));
    };
    formApi.projet = (p) => {
      const pj = form.elements.projet;
      if (pj && PROJETS[p]) { pj.value = p; const box = $('#err-projet', form); if (box) { box.hidden = true; box.textContent = ''; } }
    };
    try {
      const plan = sessionStorage.getItem(KEY + 'plan');
      sessionStorage.removeItem(KEY + 'plan');
      if (plan && location.hash === '#contact') formApi.preset(plan);
    } catch (e) { /* navigation privée */ }

    /* ----- Validation ----- */
    const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
    const PHONE_RE = /^\+?[0-9 ()./-]{8,20}$/;
    const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
    const TYPOS = { 'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.fr': 'gmail.com', 'gamil.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.co': 'outlook.com', 'yahoo.co': 'yahoo.com', 'skynet.b': 'skynet.be', 'telenet.b': 'telenet.be', 'proximus.b': 'proximus.be' };
    function setStatus(kind, html) {
      status.className = 'form__status' + (kind ? ' is-' + kind : '');
      status.innerHTML = html || '';
    }
    function clearErrors() {
      $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      $$('.field__error', form).forEach((el) => { el.textContent = ''; el.hidden = true; });
      setStatus('', '');
    }
    function showError(name, message, html) {
      const input = form.elements[name];
      const box = $('#err-' + name, form);
      if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
      if (box) { if (html) box.innerHTML = html; else box.textContent = message; box.hidden = false; }
    }
    form.addEventListener('input', (e) => {
      const n = e.target.name;
      if (!n || e.target.getAttribute('aria-invalid') !== 'true') return;
      e.target.removeAttribute('aria-invalid');
      const box = $('#err-' + n, form);
      if (box) { box.textContent = ''; box.hidden = true; }
    });
    ['email', 'phone', 'site'].forEach((n) => {
      const el = form.elements[n];
      if (!el) return;
      el.addEventListener('blur', () => {
        const v = el.value.trim();
        if (!v) return;
        if (n === 'email' && !EMAIL_RE.test(v)) showError('email', 'Cette adresse e-mail ne semble pas valide.');
        if (n === 'phone' && !PHONE_RE.test(v)) showError('phone', 'Ce numéro ne semble pas valide.');
        if (n === 'site' && !URL_RE.test(v)) showError('site', 'Cette adresse ne semble pas valide (exemple : monsite.be).');
      });
    });

    function collect() {
      return {
        form: 'devis', projet: val('projet'), formule: val('formule') || 'conseil',
        name: val('name'), societe: val('societe'), email: val('email'), phone: val('phone'), site: val('site'), message: val('message'),
        fichier: fileName(), website: val('website'), elapsed: Date.now() - startedAt
      };
    }
    function validate(data) {
      const errors = {};
      if (!data.projet) errors.projet = 'Choisissez le type de projet.';
      if (data.name.length < 2) errors.name = 'Indiquez votre nom.';
      if (!data.email) errors.email = 'Indiquez votre adresse e-mail.';
      else if (!EMAIL_RE.test(data.email)) errors.email = 'Cette adresse e-mail ne semble pas valide.';
      if (data.phone && !PHONE_RE.test(data.phone)) errors.phone = 'Ce numéro ne semble pas valide.';
      if (data.site && !URL_RE.test(data.site)) errors.site = 'Cette adresse ne semble pas valide (exemple : monsite.be).';
      if (data.message.length < 10) errors.message = 'Décrivez votre projet en quelques mots (10 caractères minimum).';
      else if ((data.message.match(/https?:\/\/|www\./gi) || []).length > 1) errors.message = 'Un seul lien maximum dans le message, s’il vous plaît.';
      if (fileInput && fileInput.files && fileInput.files[0] && fileInput.files[0].size > 10 * 1024 * 1024) errors.fichier = 'Ce fichier est trop lourd (10 Mo maximum).';
      return errors;
    }
    function typoHint(email) {
      const at = email.lastIndexOf('@');
      if (at < 1) return '';
      const domain = email.slice(at + 1).toLowerCase();
      return TYPOS[domain] ? email.slice(0, at + 1) + TYPOS[domain] : '';
    }
    function summary(data) {
      const p = PLANS[data.formule];
      const lines = ['Demande de devis — ' + (PROJETS[data.projet] || '')];
      lines.push('Formule : ' + (p ? p.name + ' (' + euro(p.price) + ' HTVA)' : 'à conseiller'));
      lines.push('', 'Nom : ' + data.name);
      if (data.societe) lines.push('Entreprise : ' + data.societe);
      lines.push('E-mail : ' + data.email);
      if (data.phone) lines.push('Téléphone : ' + data.phone);
      if (data.site) lines.push('Site actuel : ' + data.site);
      if (data.fichier) lines.push('Fichier : ' + data.fichier + ' (à joindre à cet e-mail)');
      lines.push('', data.message);
      return lines.join('\n');
    }
    function mailto(data) {
      const subject = 'Devis ' + (PROJETS[data.projet] || '') + ' — ' + data.name + (data.societe ? ' (' + data.societe + ')' : '');
      return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(summary(data));
    }
    // Page de remerciement : le prénom passe par le stockage de session, jamais par l’adresse
    function success(data, viaMail) {
      const first = data.name.split(' ')[0].replace(/[<>&"]/g, '').slice(0, 40);
      try {
        localStorage.setItem(KEY + 'last_submit', String(Date.now()));
        sessionStorage.setItem(KEY + 'merci', JSON.stringify({ name: first, via: viaMail ? 'mail' : 'api' }));
      } catch (e) { /* navigation privée */ }
      const p = PLANS[data.formule];
      track('generate_lead', { form_type: 'devis', projet: data.projet, value: p ? p.price : 0, currency: 'EUR', method: viaMail ? 'mailto' : 'api' });
      const enveloppe = form.classList.contains('lettre') && !reduced;      // la lettre se range, se scelle et s’envole
      if (enveloppe) form.classList.add('is-envoi');
      if (!viaMail && !enveloppe) form.reset();
      setTimeout(() => { window.location.href = form.getAttribute('action') || (import.meta.env.BASE_URL + 'merci.html'); }, enveloppe ? 3300 : viaMail ? 900 : 0);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();
      const data = collect();
      // Anti-spam 1 : champ piège rempli par un robot → on fait comme si tout allait bien
      if (data.website) { success(data, false); return; }
      const errors = validate(data);
      const keys = Object.keys(errors);
      if (keys.length) {
        keys.forEach((k) => showError(k, errors[k]));
        setStatus('error', keys.length > 1 ? 'Merci de corriger les ' + keys.length + ' champs indiqués.' : 'Merci de corriger le champ indiqué.');
        const firstBad = (errors.projet && $('[name="projet"]', form)) || $('[aria-invalid="true"]', form);
        if (firstBad) firstBad.focus();
        track('form_error', { fields: keys.join(',') });
        return;
      }
      const hint = typoHint(data.email);
      if (hint && !form.dataset.typoChecked) {
        form.dataset.typoChecked = '1';
        showError('email', '', 'Vouliez-vous dire <button type="button" class="link-btn" data-fix-email>' + hint.replace(/[<>&"]/g, '') + '</button>&nbsp;?');
        const fix = $('[data-fix-email]', form);
        if (fix) fix.addEventListener('click', () => { form.elements.email.value = hint; form.elements.email.removeAttribute('aria-invalid'); const b = $('#err-email', form); b.textContent = ''; b.hidden = true; });
        return;
      }
      if (data.site && !/^https?:\/\//i.test(data.site)) data.site = 'https://' + data.site;
      // Anti-spam 2 : envoi trop rapide pour un humain
      if (data.elapsed < 3000) { setStatus('error', 'Un instant… réessayez dans quelques secondes.'); return; }
      // Anti-spam 3 : une demande par minute depuis ce navigateur
      let last = 0;
      try { last = Number(localStorage.getItem(KEY + 'last_submit') || 0); } catch (err) { last = 0; }
      if (Date.now() - last < 60000) { setStatus('error', 'Votre demande vient d’être envoyée. Patientez une minute avant d’en envoyer une autre.'); return; }

      const api = (d.dataset.api || '').trim().replace(/\/$/, '');
      if (!api) {
        // Sans API (maquette, hébergement statique) : la messagerie du visiteur prend le relais
        window.location.href = mailto(data);
        success(data, true);
        return;
      }
      form.classList.add('is-sending');
      submit.setAttribute('aria-busy', 'true');
      const controller = 'AbortController' in window ? new AbortController() : null;
      const timer = setTimeout(() => controller && controller.abort(), 12000);
      try {
        const res = await fetch(api + '/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
          signal: controller ? controller.signal : undefined
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) { success(data, false); return; }
        if (json.fields) Object.keys(json.fields).forEach((k) => showError(k, json.fields[k]));
        setStatus('error', (json.error || 'Envoi impossible pour le moment.').replace(/[<>&]/g, ''));
      } catch (err) {
        setStatus('error', 'Connexion impossible. <a href="' + mailto(data).replace(/"/g, '&quot;') + '">Envoyer la demande par e-mail</a> ou appelez le ' + PHONE.replace(/ /g, '&nbsp;') + '.');
      } finally {
        clearTimeout(timer);
        form.classList.remove('is-sending');
        submit.removeAttribute('aria-busy');
      }
    });
    estimate();
  });

  /* ---------- Contact : la lettre ----------
     La date du jour, des blancs qui prennent la largeur de ce qu'on y écrit, une feuille de papier
     ligné qui s'allonge, et la signature qui s'écrit toute seule avec le nom. L'envoi (validation,
     anti-spam, API ou messagerie) reste celui du formulaire ci-dessus. */
  safe('lettre', () => {
    const form = $('form.lettre');
    if (!form) return;
    const date = $('[data-date]', form), signature = $('[data-signature]', form), nom = form.elements.name, texte = form.elements.message;
    if (date) date.textContent = 'Bruxelles, le ' + new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });
    const mesure = document.createElement('canvas').getContext('2d');
    const largeur = (el) => {
      const cs = getComputedStyle(el);
      mesure.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      const t = el.tagName === 'SELECT' ? (el.options[el.selectedIndex] || {}).text || '' : el.value || el.placeholder || '';
      return Math.ceil(mesure.measureText(t).width) + (el.tagName === 'SELECT' ? 36 : 8);
    };
    const ajuster = () => {
      $$('.champ input, .champ select', form).forEach((el) => {
        el.style.width = Math.max(48, largeur(el)) + 'px';
        if (el.tagName === 'SELECT') el.classList.toggle('is-vide', !el.value);
      });
      if (texte) { texte.style.height = 'auto'; texte.style.height = texte.scrollHeight + 'px'; }
    };
    let tSigne = 0;
    const signer = () => {
      if (!signature || !nom) return;
      const v = nom.value.trim();
      clearTimeout(tSigne);
      if (v.length < 2) { signature.classList.remove('is-signee'); return; }
      if (signature.textContent === v && signature.classList.contains('is-signee')) return;
      signature.classList.remove('is-signee');
      tSigne = setTimeout(() => { signature.textContent = v; void signature.offsetWidth; signature.classList.add('is-signee'); }, 250);
    };
    form.addEventListener('input', ajuster);
    form.addEventListener('change', () => { ajuster(); signer(); });
    if (nom) nom.addEventListener('blur', signer);
    window.addEventListener('resize', ajuster);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajuster);
    // les valeurs posées par le héros (« Décrivez votre projet ») ou un lien de formule : on remet la lettre à jour en arrivant
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { if (e[0].isIntersecting) { ajuster(); signer(); } }).observe(form);
    ajuster();
  });

  /* ---------- Barre d’action mobile : après le héros, cachée près du formulaire ---------- */
  safe('dock', () => {
    const dock = $('[data-dock]');
    if (!dock) return;
    const contact = $('#contact');
    const footer = $('.ftr');
    let near = false;
    if ('IntersectionObserver' in window) {
      const seen = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
        near = seen.size > 0;
        update();
      }, { threshold: 0.05 });
      if (contact) io.observe(contact);
      if (footer) io.observe(footer);
    }
    // sur l’accueil, après le bouton du héros ; ailleurs, dès qu’on commence à lire
    function update() {
      if (PAGE === 'merci') return;
      const after = window.scrollY > (hero ? hero.offsetHeight * 0.55 : 160);
      dock.classList.toggle('is-on', after && !near);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
  });

  /* ---------- Animations : réduire / réactiver ---------- */
  safe('motion', () => {
    $$('[data-motion-toggle]').forEach((b) => {
      b.textContent = reduced ? 'Réactiver les animations' : 'Réduire les animations';
      b.addEventListener('click', () => {
        try { localStorage.setItem(KEY + 'motion', reduced ? 'full' : 'reduce'); } catch (e) { /* rien */ }
        const url = new URL(location.href);
        url.searchParams.delete('motion');
        location.replace(url.toString());
      });
    });
  });

  /* ---------- Page de remerciement : prénom et suite selon l’envoi ---------- */
  safe('merci', () => {
    if (PAGE !== 'merci') return;
    let info = null;
    try { info = JSON.parse(sessionStorage.getItem(KEY + 'merci') || 'null'); } catch (e) { info = null; }
    const name = $('[data-merci-name]');
    if (name && info && info.name) name.textContent = ', ' + info.name;
    const mail = $('[data-merci-mail]');
    if (mail) mail.hidden = !(info && info.via === 'mail');
    track('thank_you_view', { via: info ? info.via : 'direct' });
  });

  /* ---------- Page 404 : retrouver la bonne partie du site ---------- */
  safe('404', () => {
    if (PAGE !== '404') return;
    track('page_404', { path: location.pathname });
    const path = decodeURIComponent(location.pathname.toLowerCase());
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');   // « /msdesign.be », donné par Vite (réglage base)
    const code = $('[data-path]');
    if (code) code.textContent = location.host + location.pathname;
    const guesses = [
      [/service|site|vitrine|identit|logo|seo|referencement|hebergement|entretien/, '/#promesse', 'Notre méthode'],
      [/greentage|verdane|plante|fleur|vintage|fournil|pain|veritas|architect|bascule|graphis/, '/etudes/', 'Nos exemples de sites'],
      [/premium|mystere|secret|bientot/, '/etudes/#premium', 'Notre prochain site Premium'],
      [/etude|exemple|cas|realisation|portfolio|projet|reference|client|work/, '/etudes/', 'Nos exemples de sites'],
      [/delai|promesse|garantie/, '/#promesse', 'Notre promesse de délai'],
      [/methode|process|etape/, '/#promesse', 'Notre méthode'],
      [/tarif|prix|offre|formule|devis-gratuit|pricing/, '/#contact', 'Nous contacter'],
      [/faq|question|aide/, '/#contact', 'Nous poser une question'],
      [/contact|devis|rendez-vous|rdv/, '/#contact', 'Le formulaire de contact'],
      [/confidentialit|privacy|rgpd|cookie|politique/, '/confidentialite.html', 'La politique de confidentialité'],
      [/cgv|cgu|mention|condition|legal/, '/cgu.html', 'Les conditions et mentions légales']
    ];
    const hit = guesses.find((g) => g[0].test(path));
    const box = $('[data-guess]');
    if (hit && box) {
      box.innerHTML = 'Vous cherchiez peut-être&nbsp;: <a href="' + base + hit[1] + '">' + hit[2] + '</a>.';
      box.hidden = false;
    }
  });

  d.classList.add('js-ready');
})();
