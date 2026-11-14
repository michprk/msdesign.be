// =============================================================================
// M&S Design — « Qui sommes-nous » : le scénario de l'expérience.
//
//   chargement → VOL (le défilement fait descendre des nuages jusqu'à la tour, et remonter)
//   → devant la BAIE allumée (survol : elle s'illumine ; clic : on entre)
//   → ENTRÉE (par-dessus la terrasse, à travers les portes-fenêtres)
//   → STUDIO (objets cliquables + menu des chapitres) ⇄ CHAPITRE (on s'approche de l'objet, le texte apparaît)
//   → SORTIR (on ressort par la fenêtre, retour devant la tour)
//
// Version texte (sans 3D) si « Réduire les animations » est activé ou si WebGL manque.
// =============================================================================
import Lenis from 'lenis';
import { Sequence } from './js/sequence.js';
import { Ecran } from './js/ecran.js';
import { creerSon } from './js/son.js';
import { FILM, IMAGE, BAIE, OBJETS, ORDRE, PLANS, BOUCLE, adresse } from './js/donnees.js';

const html = document.documentElement, body = document.body;
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- version texte ----------
function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
function versionTexte() {
  body.classList.add('qs--texte');
  $('[data-affiche]').src = adresse(FILM.dossier, FILM.heros);
  $('[data-affiche]').alt = 'La tour M&S Design au crépuscule, une seule fenêtre allumée au 25e étage.';
}

if (html.classList.contains('reduced') || !webglOk()) versionTexte();
else {
  try { demarrer(); } catch (err) { console.warn('[qs]', err); versionTexte(); }
}

function demarrer() {
  // appareils modestes ou « économie de données » : une image sur deux
  const lite = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!(navigator.connection && navigator.connection.saveData);
  const film = new Sequence(Array.from({ length: FILM.fin - FILM.debut + 1 }, (_, i) => adresse(FILM.dossier, FILM.debut + i)), lite ? 2 : 1);
  const HEROS = FILM.heros - FILM.debut, FIN = FILM.fin - FILM.debut;    // indices dans le film (à partir de 0)
  const plans = {}, boucle = BOUCLE.images ? new Sequence(Array.from({ length: BOUCLE.images }, (_, i) => adresse(BOUCLE.dossier, i + 1))) : null;
  for (const k of ORDRE) if (PLANS[k].images) plans[k] = new Sequence(Array.from({ length: PLANS[k].images }, (_, i) => adresse(PLANS[k].dossier, i + 1)));

  const ecran = new Ecran($('[data-gl]'), IMAGE);
  ecran.u.uBaie.value.set(BAIE.gauche, BAIE.bas, BAIE.droite, BAIE.haut);
  ecran.u.uTasse.value.set(OBJETS.tasse.x, OBJETS.tasse.y + 0.012);
  const son = creerSon();
  const lenis = new Lenis({ lerp: 0.075, smoothWheel: true, syncTouch: true, autoRaf: false });

  // ---------- l'état de l'expérience ----------
  let etat = 'chargement';
  let pos = 0;                         // position dans le film (indice fractionnaire)
  let chapitre = null, plan = 0, mode = 'zoom';   // chapitre ouvert, position dans son plan, plan filmé ou zoom
  let anim = null;                     // animation en cours (entrée, sortie, chapitre)
  let lueur = 0, lueurCible = 0, halo = 0, haloCible = 0, survol = null;
  let zoom = 1, centre = [0.5, 0.5];
  let derniereP = 0, vitesse = 0, vapeur = 0;

  const fenetre = $('[data-fenetre]'), invite = $('[data-invite]'), objets = $('[data-objets]'), menu = $('[data-menu]');
  const titres = $$('[data-titre]').map((el) => { const [a, b] = el.dataset.titre.split(' ').map(Number); return { el, a, b }; });
  const classes = (...noms) => { body.classList.remove('is-vol', 'is-heros', 'is-entree', 'is-studio', 'is-chapitre'); noms.forEach((n) => body.classList.add(n)); };

  /** Une animation de « de » à « a » en « duree » ms, avec une fin (fin()) qu'on peut forcer. */
  function animer(duree, maj, fin) {
    const t0 = performance.now();
    const a = { finie: false, tick(t) { const k = Math.min(1, (t - t0) / duree); maj(ease(k)); if (k >= 1) this.fin(); },
      fin() { if (this.finie) return; this.finie = true; maj(1); anim = null; fin && fin(); } };
    anim = a; return a;
  }

  // ---------- chargement ----------
  const pourcent = $('[data-pourcent]'), barre = $('[data-barre]');
  film.charger((p) => { pourcent.textContent = Math.round(p * 100); barre.style.width = (p * 100).toFixed(0) + '%'; }).then(() => {
    body.classList.add('is-pret'); etat = 'vol'; classes('is-vol');
  });

  // ---------- la baie : survol et clic ----------
  fenetre.addEventListener('pointerenter', () => { lueurCible = 1; });
  fenetre.addEventListener('pointerleave', () => { lueurCible = etat === 'vol' ? 0.4 : 0; });
  fenetre.addEventListener('focus', () => { lueurCible = 1; });
  fenetre.addEventListener('blur', () => { lueurCible = 0.4; });
  fenetre.addEventListener('click', entrer);

  function entrer() {
    if (etat !== 'vol' || pos < HEROS - 1.5) return;
    etat = 'entree'; classes('is-entree'); body.classList.add('is-verrou'); lenis.stop(); fenetre.disabled = true; lueurCible = 0;
    son.demarrer(); son.entrer();
    const de = pos;
    animer(3400, (k) => { pos = de + (FIN - de) * k; }, () => {
      etat = 'studio'; classes('is-studio'); objets.hidden = false; menu.hidden = false;
      for (const s of Object.values(plans)) s.charger();
      if (boucle) boucle.charger();
      $('[data-aller]', menu).focus({ preventScroll: true });
    });
  }

  // ---------- le studio : objets, menu, chapitres ----------
  for (const b of $$('[data-objet]')) {
    const k = b.dataset.objet;
    b.addEventListener('click', () => ouvrir(k));
    b.addEventListener('pointerenter', () => { survol = k; haloCible = 1; });
    b.addEventListener('pointerleave', () => { survol = null; haloCible = 0; });
    b.addEventListener('focus', () => { survol = k; haloCible = 1; });
    b.addEventListener('blur', () => { survol = null; haloCible = 0; });
  }
  for (const b of $$('[data-aller]')) b.addEventListener('click', () => ouvrir(b.dataset.aller));
  $('[data-sortir]').addEventListener('click', sortir);

  function texte(k) {
    $$('[data-chapitre]').forEach((a) => a.classList.toggle('is-ouvert', a.dataset.chapitre === k));
    $$('[data-aller]').forEach((b) => b.setAttribute('aria-current', b.dataset.aller === k ? 'true' : 'false'));
  }

  function ouvrir(k) {
    if (anim || !OBJETS[k]) return;
    if (etat === 'chapitre' && chapitre === k) return;
    if (etat === 'chapitre') return fermer(() => ouvrir(k));
    if (etat !== 'studio') return;
    etat = 'chapitre'; chapitre = k; classes('is-studio', 'is-chapitre'); haloCible = 0; texte(null);
    const o = OBJETS[k], seq = plans[k];
    mode = seq && seq.ok > 0 ? 'plan' : 'zoom';      // le plan filmé s'il est chargé, sinon un zoom dans l'image
    if (mode === 'plan') {
      animer(1500, (t) => { plan = t * (seq.urls.length - 1); }, () => { texte(k); son.note(); });
    } else {
      const z0 = zoom, c0 = centre.slice(), [cx, cy] = ecran.centre(o.x, o.y, 1.7);
      animer(1300, (t) => { zoom = z0 + (1.7 - z0) * t; centre = [c0[0] + (cx - c0[0]) * t, c0[1] + (cy - c0[1]) * t]; }, () => { texte(k); son.note(); });
    }
  }

  function fermer(ensuite) {
    if (etat !== 'chapitre') return ensuite && ensuite();
    texte(null);
    const fin = () => { etat = 'studio'; chapitre = null; classes('is-studio'); ensuite && ensuite(); };
    if (mode === 'plan') {
      const de = plan; animer(1000, (t) => { plan = de * (1 - t); }, fin);
    } else {
      const z0 = zoom, c0 = centre.slice();
      animer(900, (t) => { zoom = z0 + (1 - z0) * t; centre = [c0[0] + (0.5 - c0[0]) * t, c0[1] + (0.5 - c0[1]) * t]; }, fin);
    }
  }

  function sortir() {
    if (anim) return;
    if (etat === 'chapitre') return fermer(sortir);
    if (etat !== 'studio') return;
    etat = 'sortie'; classes('is-entree'); objets.hidden = true; menu.hidden = true; son.sortir();
    const de = pos;
    animer(2800, (k) => { pos = de + (HEROS - de) * k; }, () => {
      etat = 'vol'; classes('is-vol'); body.classList.remove('is-verrou');
      lenis.resize(); lenis.scrollTo(lenis.limit, { immediate: true, force: true }); lenis.start();
      fenetre.focus({ preventScroll: true });
    });
  }

  // ---------- passer l'animation, son, clavier ----------
  $('[data-passer]').addEventListener('click', () => {
    son.demarrer();
    if (etat === 'vol') lenis.scrollTo(lenis.limit, { duration: 1.6 });
    else if (anim) anim.fin();
  });
  const bSon = $('[data-son]');
  bSon.textContent = son.actif ? 'Couper le son' : 'Activer le son';
  bSon.addEventListener('click', () => { son.demarrer(); bSon.textContent = son.basculer() ? 'Couper le son' : 'Activer le son'; });
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => son.demarrer(), { once: true, passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (etat === 'chapitre') fermer(); else if (etat === 'studio') sortir(); }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && (etat === 'studio' || etat === 'chapitre')) {
      const i = Math.max(0, ORDRE.indexOf(chapitre)), n = (i + (e.key === 'ArrowRight' ? (chapitre ? 1 : 0) : ORDRE.length - 1)) % ORDRE.length;
      ouvrir(ORDRE[n]);
    }
  });
  window.addEventListener('resize', () => ecran.taille());

  // ---------- la boucle d'affichage ----------
  function placer(el, x, y) { const [sx, sy] = ecran.versEcran(x, y); el.style.left = sx + 'px'; el.style.top = sy + 'px'; }

  function image(t) {
    if (etat === 'chapitre' && mode === 'plan') return plans[chapitre].encadre(plan);
    if ((etat === 'studio' || etat === 'chapitre') && boucle && boucle.ok > 0) {
      const i = Math.floor((t / 1000) * BOUCLE.ips) % BOUCLE.images; const img = boucle.proche(i); return [img, img, 0];
    }
    return film.encadre(pos);
  }

  function boucleAffichage(t) {
    lenis.raf(t);
    if (anim) anim.tick(t);
    if (etat === 'vol') {
      const p = lenis.limit > 0 ? lenis.scroll / lenis.limit : 0;
      vitesse = vitesse * 0.85 + (p - derniereP) * 1000 * 0.15; derniereP = p;
      pos = p * HEROS;
      son.vol(p, vitesse);
      const heros = p > 0.985;
      body.classList.toggle('is-heros', heros); fenetre.disabled = !heros;
      if (!heros && lueurCible > 0.4) lueurCible = 0;
      if (heros && lueurCible === 0) lueurCible = 0.4;
      for (const ti of titres) ti.el.style.setProperty('--o', ((ti.a <= 0 ? 1 : lisse(ti.a - 0.03, ti.a + 0.03, p)) * (1 - lisse(ti.b - 0.03, ti.b + 0.03, p))).toFixed(3));
      if (heros) {
        const [x0, y0] = ecran.versEcran(BAIE.gauche, BAIE.haut), [x1, y1] = ecran.versEcran(BAIE.droite, BAIE.bas);
        Object.assign(fenetre.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
      }
    }
    if (etat === 'studio' || etat === 'chapitre') for (const b of $$('[data-objet]')) { const o = OBJETS[b.dataset.objet]; placer(b, o.x, o.y); }
    lueur += (lueurCible - lueur) * 0.08; halo += (haloCible - halo) * 0.1;
    ecran.u.uLueur.value = lueur; ecran.u.uObjet.value = halo;
    vapeur += ((etat === 'studio' ? 1 : 0) - vapeur) * 0.04; ecran.u.uVapeur.value = vapeur;
    if (survol) ecran.u.uObjetPos.value.set(OBJETS[survol].x, OBJETS[survol].y);
    ecran.u.uZoom.value = zoom; ecran.u.uCentre.value.set(centre[0], centre[1]);
    const [A, B, m] = image(t);
    if (A) ecran.images(A, B, m);
    ecran.rendre(t / 1000);
    requestAnimationFrame(boucleAffichage);
  }
  requestAnimationFrame(boucleAffichage);
  window.__qs = { get etat() { return etat; }, get pos() { return pos; }, entrer, ouvrir, fermer, sortir, lenis, film };
}
