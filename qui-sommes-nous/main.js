// =============================================================================
// M&S Design — « Qui sommes-nous » : le scénario de l'expérience (version photos IA, montée comme un film).
//
//   chargement → VOL (un film d'une quinzaine de secondes qui se joue tout seul : nuages → Manhattan →
//   la tour ; un cran de molette ou un glissé avance ou recule d'un bon bout) → devant la FENÊTRE allumée
//   (survol : elle s'illumine ; clic, molette ou Entrée : on plonge dedans) → la TERRASSE, portes ouvertes →
//   STUDIO (objets cliquables + menu) ⇄ CHAPITRE (on s'approche de l'objet, le texte apparaît) →
//   SORTIR (on ressort par la terrasse et la fenêtre).
//
// Version texte (sans effets) si « Réduire les animations » est activé ou si WebGL manque.
// =============================================================================
import { Ecran } from './js/ecran.js';
import { creerSon } from './js/son.js';
import { VOL, FONDU, VIE, BAIE, TERRASSE, STUDIO, OBJETS, ORDRE, photo } from './js/donnees.js';

const html = document.documentElement, body = document.body;
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const lerp = (a, b, t) => a + (b - a) * t;
const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bosse = (a, b, x) => Math.sin(Math.PI * lisse(a, b, x));                // 0 → 1 → 0 entre a et b
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const charger = (nom) => { const img = new Image(); img.decoding = 'async'; img.src = photo(nom); return img.decode().then(() => img); };

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
function versionTexte() {
  body.classList.add('qs--texte');
  html.style.overflow = '';
  const a = $('[data-affiche]'); a.src = photo(VOL[VOL.length - 1].image);
  a.alt = 'La tour M&S Design au crépuscule à Manhattan, une seule fenêtre allumée.';
}

if (html.classList.contains('reduced') || !webglOk()) versionTexte();
else {
  try { demarrer(); } catch (err) { console.warn('[qs]', err); versionTexte(); }
}

function demarrer() {
  html.style.overflow = 'hidden';                                   // tout se joue dans un seul écran : pas de défilement
  const ecran = new Ecran($('[data-gl]'));
  ecran.u.uBaie.value.set(BAIE.gauche, BAIE.bas, BAIE.droite, BAIE.haut);
  ecran.u.uTasse.value.set(STUDIO.tasse[0], STUDIO.tasse[1]);
  const son = creerSon();

  // ---------- le montage du vol : quand chaque plan commence, et la durée totale ----------
  const DEBUTS = [];
  VOL.reduce((t, v, i) => { DEBUTS[i] = t; return t + v.duree - FONDU; }, 0);
  const DUREE = DEBUTS[VOL.length - 1] + VOL[VOL.length - 1].duree;

  // ---------- l'état ----------
  let etat = 'chargement';
  let vol = [];                        // les photos du vol, chargées
  let terrasse = null, studio = null, gros = {};   // la terrasse, le studio et les gros plans (quand ils existent)
  let anim = null;                     // animation en cours (entrée, sortie, chapitre)
  let plongee = 0;                     // 0 → 1 : on plonge dans la fenêtre ; 1 → 2 : dans un objet
  let chapitre = null;
  let lueur = 0, lueurCible = 0, halo = 0, haloCible = 0, survol = null;
  let film = -0.6;                     // le temps du film, en secondes (un court noir avant la première image)
  let elan = 0, elanFin = 0;           // avance ou recul rapide (molette, glissé, « Passer »)
  let pause = false, dernier = 0;

  const fenetre = $('[data-fenetre]'), objets = $('[data-objets]'), menu = $('[data-menu]'), bientot = $('[data-bientot]');
  const titres = $$('[data-titre]').map((el) => { const [a, b] = el.dataset.titre.split(' ').map(Number); return { el, a, b }; });
  const classes = (...noms) => { body.classList.remove('is-vol', 'is-heros', 'is-entree', 'is-studio', 'is-chapitre'); noms.forEach((n) => body.classList.add(n)); };

  function animer(duree, maj, fin) {
    const t0 = performance.now();
    const a = { finie: false, tick(t) { const k = Math.min(1, (t - t0) / duree); maj(ease(k)); if (k >= 1) this.fin(); },
      fin() { if (this.finie) return; this.finie = true; maj(1); anim = null; fin && fin(); } };
    anim = a; return a;
  }

  // ---------- chargement : les photos du vol d'abord, le reste ensuite ----------
  const pourcent = $('[data-pourcent]'), barre = $('[data-barre]');
  let faites = 0;
  Promise.all(VOL.map((v) => charger(v.image).then((img) => {
    faites++; pourcent.textContent = Math.round((faites / VOL.length) * 100); barre.style.width = (faites / VOL.length) * 100 + '%';
    return img;
  }))).then((imgs) => {
    vol = imgs; body.classList.add('is-pret'); etat = 'vol'; classes('is-vol');
    charger(TERRASSE.image).then((img) => { terrasse = img; }, () => {});
    if (STUDIO.image) charger(STUDIO.image).then((img) => { studio = img; }, () => {});
    for (const k of ORDRE) if (OBJETS[k].image) charger(OBJETS[k].image).then((img) => { gros[k] = img; }, () => {});
  }, (err) => { console.warn('[qs] photos', err); versionTexte(); });

  // ---------- le vol : à un instant du film → ce que voit la caméra ----------
  // Un plan : la caméra avance (zoom en échelle logarithmique, donc à vitesse régulière à l'œil)
  // vers son point. Le premier part de l'arrêt, celui du milieu file, le dernier freine jusqu'à la fenêtre.
  function plan(i, t) {
    const v = VOL[i], img = vol[i], u = Math.min(1, Math.max(0, (t - DEBUTS[i]) / v.duree));
    const f = i === 0 ? Math.pow(u, 1.8) : i === VOL.length - 1 ? 1 - (1 - u) * (1 - u) : 0.3 * u + 0.7 * u * u;
    const zoom = Math.exp(Math.log(v.zoom) * f);
    const k = i === VOL.length - 1 ? lisse(0, 0.85, u) : lisse(0, 0.7, u);
    const centre = ecran.borne(img, lerp(0.5, v.point[0], k), lerp(0.5, v.point[1], k), zoom);
    // vitesse d'avancée (pour le flou de mouvement) : dérivée du zoom logarithmique
    const df = i === 0 ? 1.8 * Math.pow(Math.max(u, 1e-4), 0.8) : i === VOL.length - 1 ? 2 * (1 - u) : 0.3 + 1.4 * u;
    return { img, centre, zoom, vie: v.vie, vitesse: u >= 1 ? 0 : Math.log(v.zoom) * df / v.duree };
  }
  function vueVol(t) {
    t = Math.min(Math.max(t, 0), DUREE);
    let i = 0; while (i < VOL.length - 1 && t >= DEBUTS[i + 1]) i++;
    if (i > 0 && t < DEBUTS[i] + FONDU) {                     // fondu : le plan précédent plonge encore, le suivant avance déjà
      const A = plan(i - 1, t), B = plan(i, t);
      return { A, B, mix: lisse(0, 1, (t - DEBUTS[i]) / FONDU), flou: lisse(0.12, 0.34, A.vitesse) * 0.9, flouB: lisse(0.12, 0.34, B.vitesse) * 0.9 };
    }
    const A = plan(i, t);
    return { A, mix: 0, flou: lisse(0.14, 0.34, A.vitesse) * 0.9 };
  }

  // ---------- la fenêtre : survol et clic ----------
  fenetre.addEventListener('pointerenter', () => { lueurCible = 1; });
  fenetre.addEventListener('pointerleave', () => { lueurCible = etat === 'vol' ? 0.45 : 0; });
  fenetre.addEventListener('focus', () => { lueurCible = 1; });
  fenetre.addEventListener('blur', () => { lueurCible = etat === 'vol' ? 0.45 : 0; });
  fenetre.addEventListener('click', entrer);

  function entrer() {
    if (etat !== 'vol' || !body.classList.contains('is-heros')) return;
    etat = 'entree'; classes('is-entree'); fenetre.disabled = true; lueurCible = 0;
    son.demarrer(); son.entrer();
    animer(studio && terrasse ? 5200 : 2600, (k) => { plongee = k; }, () => {
      if (studio) { etat = 'studio'; classes('is-studio'); objets.hidden = false; menu.hidden = false; $('[data-aller]', menu).focus({ preventScroll: true }); }
      else { etat = 'bientot'; bientot.hidden = false; $('button', bientot).focus({ preventScroll: true }); }
    });
  }

  function sortir() {
    if (anim) return;
    if (etat === 'chapitre') return fermer(sortir);
    if (etat !== 'studio' && etat !== 'bientot') return;
    etat = 'sortie'; classes('is-entree'); objets.hidden = true; menu.hidden = true; bientot.hidden = true; son.sortir();
    animer(studio && terrasse ? 3800 : 2200, (k) => { plongee = 1 - k; }, () => {
      etat = 'vol'; classes('is-vol'); film = DUREE; pause = false;
      fenetre.focus({ preventScroll: true });
    });
  }

  // L'entrée, comme un plan-séquence : on plonge dans la fenêtre, on se retrouve sur la terrasse devant
  // les portes ouvertes, on avance entre les deux battants, et le studio s'ouvre devant nous.
  function vueEntree() {
    const tour = vueVol(DUREE).A, bx = (BAIE.gauche + BAIE.droite) / 2, by = (BAIE.haut + BAIE.bas) / 2;
    const k = plongee;
    if (!studio || !terrasse) {                                // ancienne entrée (photos pas encore là) : éclair chaud
      const zA = tour.zoom * lerp(1, 9, Math.pow(lisse(0, 0.85, k), 2));
      const cA = ecran.borne(tour.img, lerp(tour.centre[0], bx, lisse(0, 0.5, k)), lerp(tour.centre[1], by, lisse(0, 0.5, k)), zA);
      const chaud = bosse(0.45, 1, k) * 0.85;
      if (!studio) return { A: { img: tour.img, centre: cA, zoom: zA, vie: VIE.ciel }, mix: 0, flou: lisse(0.2, 0.8, k), chaud: Math.max(chaud, lisse(0.7, 1, k) * 0.92) };
      const zB = lerp(1.18, 1, lisse(0.6, 1, k));
      return { A: { img: tour.img, centre: cA, zoom: zA }, B: { img: studio, centre: ecran.borne(studio, 0.5, 0.5, zB), zoom: zB, vie: VIE.studio }, mix: lisse(0.66, 0.8, k), flou: bosse(0.2, 1, k), chaud };
    }
    // 1. la fenêtre grossit jusqu'à remplir l'écran
    const zT = tour.zoom * Math.exp(Math.log(9) * Math.pow(lisse(0, 0.42, k), 1.5));
    const cT = ecran.borne(tour.img, lerp(tour.centre[0], bx, lisse(0, 0.28, k)), lerp(tour.centre[1], by, lisse(0, 0.28, k)), zT);
    // 2. la terrasse : on avance vers l'ouverture des portes
    const kt = Math.min(1, Math.max(0, (k - 0.3) / 0.6));
    const zP = Math.exp(Math.log(TERRASSE.zoom) * (0.25 * kt + 0.75 * kt * kt));
    const cP = ecran.borne(terrasse, lerp(0.5, TERRASSE.point[0], lisse(0, 0.5, kt)), lerp(0.5, TERRASSE.point[1], lisse(0, 0.5, kt)), zP);
    // 3. le studio, vu depuis le seuil
    const respire = 1 + 0.015 * Math.sin(performance.now() / 4000);
    const S = { img: studio, centre: ecran.borne(studio, 0.5, 0.5, respire), zoom: respire, vie: VIE.studio };
    const T = { img: tour.img, centre: cT, zoom: zT, vie: VIE.ciel }, P = { img: terrasse, centre: cP, zoom: zP, vie: VIE.rien };
    const flou = Math.max(bosse(0.18, 0.48, k), bosse(0.66, 0.94, k) * 0.85);
    const chaud = bosse(0.3, 0.46, k) * 0.32 + bosse(0.74, 0.92, k) * 0.22;
    if (k < 0.42) return { A: T, B: P, mix: lisse(0.3, 0.42, k), flou, chaud };
    if (k < 0.9) return { A: P, B: S, mix: lisse(0.78, 0.9, k), flou, chaud };
    return { A: S, mix: 0, flou, chaud };
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
  for (const b of $$('[data-sortir]')) b.addEventListener('click', sortir);

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
    animer(1500, (t) => { plongee = 1 + t; }, () => { texte(k); son.note(); });
  }
  function fermer(ensuite) {
    if (etat !== 'chapitre') return ensuite && ensuite();
    texte(null);
    animer(1100, (t) => { plongee = 2 - t; }, () => { etat = 'studio'; chapitre = null; classes('is-studio'); ensuite && ensuite(); });
  }
  // Dans le studio, plongee va de 1 (vue d'ensemble) à 2 (gros plan sur l'objet du chapitre).
  function vueStudio() {
    const k = Math.max(0, plongee - 1), o = chapitre ? OBJETS[chapitre] : null, respire = 1 + 0.015 * Math.sin(performance.now() / 4000);
    const zA = respire * lerp(1, 2.4, Math.pow(lisse(0, 0.9, k), 1.6));
    const cA = o ? ecran.borne(studio, lerp(0.5, o.x, lisse(0, 0.6, k)), lerp(0.5, o.y, lisse(0, 0.6, k)), zA) : ecran.borne(studio, 0.5, 0.5, zA);
    const A = { img: studio, centre: cA, zoom: zA, vie: VIE.studio };
    const g = chapitre && gros[chapitre];
    if (!g) return { A, mix: 0, flou: bosse(0, 1, k) * 0.5 };
    const zB = lerp(1.15, 1.02, lisse(0.55, 1, k));
    return { A, B: { img: g, centre: ecran.borne(g, 0.5, 0.5, zB), zoom: zB, vie: VIE.rien }, mix: lisse(0.55, 0.85, k), flou: bosse(0.2, 1, k) * 0.8 };
  }

  // ---------- piloter le film : molette, glissé, clavier, « Passer » ----------
  // Un cran (ou un glissé) fait faire un bond au film dans ce sens ; devant la fenêtre, vers le bas = entrer.
  function pousser(sens) {
    if (etat !== 'vol' || !vol.length) return;
    son.demarrer(); pause = false;
    if (sens > 0 && film >= DUREE - 0.05) return entrer();
    const now = performance.now();
    if (now < elanFin && Math.sign(elan) === sens) return;     // une seule poussée par geste (les pavés tactiles envoient des rafales)
    elan = sens * 5; elanFin = now + 650;
  }
  let derniereMolette = 0;
  window.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < 4) return;
    const now = performance.now(); if (now - derniereMolette < 120) { derniereMolette = now; return; }
    derniereMolette = now; pousser(Math.sign(e.deltaY));
  }, { passive: true });
  let y0 = null;
  window.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (y0 === null) return; const dy = y0 - e.changedTouches[0].clientY; y0 = null;
    if (Math.abs(dy) > 40) pousser(Math.sign(dy));
  }, { passive: true });

  $('[data-passer]').addEventListener('click', () => {
    son.demarrer();
    if (etat === 'vol') { pause = false; elan = 9; elanFin = performance.now() + 60000; }   // file jusqu'à la fenêtre
    else if (anim) anim.fin();
  });
  const bSon = $('[data-son]');
  bSon.textContent = son.actif ? 'Couper le son' : 'Activer le son';
  bSon.addEventListener('click', () => { son.demarrer(); bSon.textContent = son.basculer() ? 'Couper le son' : 'Activer le son'; });
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => son.demarrer(), { once: true, passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (etat === 'chapitre') fermer(); else if (etat === 'studio' || etat === 'bientot') sortir(); }
    const libre = !document.activeElement || document.activeElement === body;   // la barre d'espace reste aux boutons qui ont le focus
    if (etat === 'vol' && (['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && libre))) { e.preventDefault(); pousser(1); }
    if (etat === 'vol' && ['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); pousser(-1); }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && (etat === 'studio' || etat === 'chapitre')) {
      const i = Math.max(0, ORDRE.indexOf(chapitre)), n = (i + (e.key === 'ArrowRight' ? (chapitre ? 1 : 0) : ORDRE.length - 1)) % ORDRE.length;
      ouvrir(ORDRE[n]);
    }
  });
  window.addEventListener('resize', () => ecran.taille());

  // ---------- la boucle d'affichage ----------
  function boucle(t) {
    const dt = Math.min(0.05, dernier ? (t - dernier) / 1000 : 0); dernier = t;
    if (anim) anim.tick(t);
    let vue = null;
    if (etat === 'vol' || etat === 'chargement') {
      if (vol.length) {
        if (t > elanFin) elan = 0;
        const vitesseFilm = pause ? 0 : 1 + elan;
        film = Math.min(DUREE, film + dt * vitesseFilm);
        if (vitesseFilm < 0) film = Math.max(0, film);             // en reculant, on s'arrête à la première image
        if (film >= DUREE && elan > 0) elan = 0;
        const p = Math.max(0, film) / DUREE;
        son.vol(p, film >= DUREE ? 0 : vitesseFilm * 28);
        vue = vueVol(film);
        const heros = film >= DUREE - 0.15;
        body.classList.toggle('is-heros', heros); fenetre.disabled = !heros;
        if (!heros) lueurCible = 0;                          // la lueur n'existe que devant la tour
        else if (lueurCible === 0) lueurCible = 0.45;
        for (const ti of titres) ti.el.style.setProperty('--o', ((ti.a <= 0 ? lisse(-0.3, 0.6, film) : lisse(ti.a - 0.03, ti.a + 0.03, p)) * (1 - lisse(ti.b - 0.03, ti.b + 0.03, p))).toFixed(3));
        if (heros) {                                         // le bouton invisible suit la fenêtre (avec une marge pour viser facilement)
          const A = vue.A, [x0, y0] = ecran.versEcran(A.img, A.centre, A.zoom, BAIE.gauche, BAIE.haut), [x1, y1] = ecran.versEcran(A.img, A.centre, A.zoom, BAIE.droite, BAIE.bas);
          const m = 28;
          Object.assign(fenetre.style, { left: (x0 - m) + 'px', top: (y0 - m) + 'px', width: (x1 - x0 + 2 * m) + 'px', height: (y1 - y0 + 2 * m) + 'px' });
        }
      }
    } else if (etat === 'entree' || etat === 'sortie' || etat === 'bientot') vue = vueEntree();
    else if (studio) vue = vueStudio();
    ecran.balancer(t / 1000, etat === 'chapitre' ? 0.5 : 1);
    if (vue) {
      ecran.montrer(vue.A, vue.B, vue.mix);
      ecran.u.uFlou.value = vue.flou || 0; ecran.u.uFlouB.value = vue.flouB ?? vue.flou ?? 0; ecran.u.uChaud.value = vue.chaud || 0;
      ecran.u.uNoir.value = etat === 'vol' && film < 0 ? lisse(0, -0.6, film) : 0;   // l'image sort du noir au début
    }
    if ((etat === 'studio' || etat === 'chapitre') && studio && vue) {
      for (const b of $$('[data-objet]')) {
        const o = OBJETS[b.dataset.objet], [sx, sy] = ecran.versEcran(studio, vue.A.centre, vue.A.zoom, o.x, o.y);
        b.style.left = sx + 'px'; b.style.top = sy + 'px';
      }
    }
    if (etat !== 'vol') lueurCible = 0;
    lueur += (lueurCible - lueur) * 0.08; halo += (haloCible - halo) * 0.1;
    ecran.u.uLueur.value = etat === 'vol' ? lueur : 0; ecran.u.uObjet.value = halo;
    if (survol) ecran.u.uObjetPos.value.set(OBJETS[survol].x, OBJETS[survol].y);
    ecran.rendre(t / 1000);
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);
  // pour les tests : aller(p) fige le film à p (0 → 1), jouer() le relance
  window.__qs = {
    get etat() { return etat; }, get film() { return film; }, DUREE, entrer, ouvrir, fermer, sortir,
    aller(p) { film = p * DUREE; pause = true; elan = 0; }, jouer() { pause = false; },
  };
}
