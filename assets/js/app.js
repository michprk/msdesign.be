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
  const EMAIL = 'mck.honorable@gmail.com';
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

  /* ---------- Défilement amorti (Lenis) ---------- */
  let lenis = null;
  safe('lenis', () => {
    if (reduced || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: true, respectReducedMotion: false });
    window.__msLenis = lenis; // accès pratique pour le débogage
  });
  function scrollToY(y, duration) {
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
    const update = () => header.classList.toggle('is-solid', window.scrollY > 8 || !hero);
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
     Le MacBook du héros
     ========================================================================== */
  let mac = null;
  const veil = $('[data-veil]');
  const hint = $('[data-mac-hint]');
  let zooming = false;
  let hintDone = false;

  // la promesse apparaît tout de suite ; le Mac s’ouvre à son rythme
  safe('hero-in', () => {
    if (!hero) return;
    const show = () => d.classList.add('hero-in');
    if (reduced) show();
    else requestAnimationFrame(() => setTimeout(show, d.classList.contains('intro-on') ? 380 : 60));
  });

  function placeHint() {
    if (!hint || !mac || !mac.anchor) return;
    const a = mac.anchor();
    if (!a) return;
    const r = hero.getBoundingClientRect();
    hint.style.setProperty('--hx', (a.x - r.left).toFixed(0) + 'px');
    hint.style.setProperty('--hy', Math.max(a.y - r.top, hdrH() + 70).toFixed(0) + 'px');
  }
  function showHint() {
    if (!hint || hintDone || zooming) return;
    placeHint();
    hint.classList.add('is-on');
  }
  function hideHint() {
    if (!hint) return;
    hintDone = true;
    hint.classList.remove('is-on');
  }

  function goSection(id, viaMac) {
    const target = document.getElementById(id);
    if (!target) return;
    if (viaMac && mac && !reduced && window.scrollY < 40 && mac.go(id)) return;
    scrollToY(targetY(target), 1.4);
  }

  safe('mac', () => {
    if (!hero) return;
    window.addEventListener('ms:mac-ready', (e) => {
      mac = e.detail && e.detail.api;
      if (!mac) return;
      if (d.classList.contains('intro-on')) setTimeout(() => mac.open(), 420);
      else mac.skip();
      try { sessionStorage.setItem(KEY + 'intro', 'seen'); } catch (err) { /* navigation privée */ }
    });
    window.addEventListener('ms:mac-demo-end', () => setTimeout(showHint, 300));
    window.addEventListener('ms:mac-hover', () => setTimeout(hideHint, 900));
    const replace = () => requestAnimationFrame(() => { if (hint && hint.classList.contains('is-on')) placeHint(); });
    if ('ResizeObserver' in window) new ResizeObserver(replace).observe(hero);
    window.addEventListener('resize', replace);
    window.addEventListener('scroll', () => { if (window.scrollY > 80) hideHint(); }, { passive: true });

    // la caméra plonge dans l’écran…
    window.addEventListener('ms:mac-zoom', (e) => {
      zooming = true;
      hideHint();
      d.classList.add('is-zooming');
      if (lenis) lenis.stop();
      track('mac_tab', { target: e.detail && e.detail.target });
    });
    // … et le site prend le relais, sous un voile de la couleur de la section
    window.addEventListener('ms:mac-go', (e) => {
      const id = e.detail && e.detail.target;
      const section = document.getElementById(id);
      if (!section || !veil) { finish(); return; }
      let bg = getComputedStyle(section).backgroundColor;
      if (!bg || bg === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(bg)) bg = getComputedStyle(document.body).backgroundColor;
      veil.style.setProperty('--veil', bg);
      veil.classList.remove('is-out');
      veil.classList.add('is-on');
      setTimeout(() => {
        if (lenis) lenis.start();
        jumpToY(targetY(section));
        history.replaceState(null, '', '#' + id);
        finish();
        requestAnimationFrame(() => {
          veil.classList.add('is-out');
          veil.classList.remove('is-on');
          const h = $('h2', section);
          if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
        });
      }, 230);
      function finish() {
        if (mac) mac.home();
        d.classList.remove('is-zooming');
        zooming = false;
      }
    });

    // onglets en boutons (doigt, clavier, et repli sans 3D)
    $$('[data-mac-go]').forEach((b) => b.addEventListener('click', () => { hideHint(); goSection(b.dataset.macGo, true); }));

    // l’arrière-plan suit doucement la souris (profondeur)
    if (fine && !reduced) {
      const bg = $('.hero__bg', hero);
      let raf = 0, px = 0, py = 0;
      if (bg) window.addEventListener('pointermove', (e) => {
        if (window.scrollY > window.innerHeight) return;
        px = (e.clientX / window.innerWidth - 0.5) * -14;
        py = (e.clientY / window.innerHeight - 0.5) * -8;
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; bg.style.setProperty('--px', px.toFixed(1) + 'px'); bg.style.setProperty('--py', py.toFixed(1) + 'px'); });
      }, { passive: true });
    }

    // revoir l’ouverture
    $$('[data-intro-replay]').forEach((b) => {
      if (reduced) { b.hidden = true; return; }
      b.addEventListener('click', () => {
        jumpToY(0);
        if (!mac) return;
        hintDone = false;
        mac.reset();
        setTimeout(() => mac.open(), 500);
      });
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
      history.replaceState(null, '', url.hash);
      scrollToY(targetY(target), 1.4);
      if (target.id === 'contact') setTimeout(() => { const f = $('#contact-form input[name="projet"]'); if (f && fine) f.focus({ preventScroll: true }); }, reduced ? 0 : 1400);
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

  /* ---------- Apparitions à l’entrée dans l’écran ---------- */
  safe('reveal', () => {
    const groups = new Map();
    $$('[data-reveal]').forEach((el) => {
      const p = el.parentElement;
      const n = groups.get(p) || 0;
      groups.set(p, n + 1);
      if (n) el.style.setProperty('--d', Math.min(0.42, n * 0.08).toFixed(2) + 's');
    });
    const targets = $$('[data-reveal], [data-lines]');
    if (!('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
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
        track('faq_open', { question: $('summary', det).textContent.trim().slice(0, 80) });
      });
    });
  });

  /* ---------- Devis : formulaire ---------- */
  const PROJETS = { vitrine: 'Site vitrine', refonte: 'Refonte de site', identite: 'Identité visuelle', seo: 'Référencement', autre: 'Autre demande' };
  const PLANS = {
    essentiel: { name: 'Essentiel', price: 500, detail: 'Site une page sur mesure, formulaire, référencement de base, en ligne en 2 semaines.' },
    signature: { name: 'Signature', price: 750, detail: 'Jusqu’à 6 pages, animations premium, SEO local et fiche Google, en ligne en 3 semaines.' },
    premium: { name: 'Premium', price: 2200, detail: 'Multilingue, réservation ou boutique, identité visuelle et contenus, 3 mois de suivi.' }
  };
  safe('form', () => {
    const form = $('[data-form]');
    if (!form) return;
    const status = $('[data-status]', form);
    const est = $('[data-estimate]', form);
    const submit = $('button[type="submit"]', form);
    const startedAt = Date.now();
    const val = (n) => (form.elements[n] ? String(form.elements[n].value || '').trim() : '');
    const radio = (n) => (form.querySelector('input[name="' + n + '"]:checked') || {}).value || '';
    const checked = (n) => !!(form.elements[n] && form.elements[n].checked);

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
      if (e.target.name === 'projet') { const box = $('#err-projet', form); if (box) { box.hidden = true; box.textContent = ''; } }
    });
    formApi.preset = (plan) => {
      const sel = form.elements.formule;
      if (sel && PLANS[plan]) { sel.value = plan; estimate(); }
      const r = form.querySelector('input[name="projet"][value="vitrine"]');
      if (r && !radio('projet')) r.checked = true;
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
        form: 'devis', projet: radio('projet'), formule: val('formule'),
        name: val('name'), societe: val('societe'), email: val('email'), phone: val('phone'), site: val('site'), message: val('message'),
        consent: checked('consent'), website: val('website'), elapsed: Date.now() - startedAt
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
      if (!data.consent) errors.consent = 'Cochez la case pour que nous puissions vous répondre.';
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
      if (!viaMail) form.reset();
      setTimeout(() => { window.location.href = form.getAttribute('action') || ((d.dataset.base || '') + '/merci.html'); }, viaMail ? 900 : 0);
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
        const firstBad = (errors.projet && $('input[name="projet"]', form)) || $('[aria-invalid="true"]', form);
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
    const base = d.dataset.base || '';
    const code = $('[data-path]');
    if (code) code.textContent = location.host + location.pathname;
    const guesses = [
      [/service|site|vitrine|identit|logo|seo|referencement|hebergement|entretien/, '/#services', 'Nos services'],
      [/greentage|plante|fleur|vintage/, '/etudes/greentage.html', 'L’étude de cas Greentage'],
      [/premium|mystere|secret|bientot/, '/etudes/#premium', 'Notre prochain site Premium'],
      [/etude|cas|realisation|portfolio|projet|reference|client|work/, '/etudes/', 'Nos études de cas'],
      [/delai|promesse|garantie/, '/#promesse', 'Notre promesse de délai'],
      [/methode|process|etape/, '/#methode', 'Notre méthode'],
      [/tarif|prix|offre|formule|devis-gratuit|pricing/, '/#tarifs', 'Les tarifs'],
      [/faq|question|aide/, '/#faq', 'Les questions fréquentes'],
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
