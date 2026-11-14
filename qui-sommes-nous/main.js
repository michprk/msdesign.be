// =============================================================================
// M&S Design — « Qui sommes-nous » : le scénario de l'expérience (version photos IA).
//
//   chargement → VOL (le défilement plonge d'une photo à l'autre : nuages → Manhattan → la tour,
//   et remonter fait le chemin inverse) → devant la FENÊTRE allumée (survol : elle s'illumine ;
//   clic : on plonge dedans) → STUDIO (objets cliquables + menu) ⇄ CHAPITRE (on s'approche de
//   l'objet, le texte apparaît) → SORTIR (on ressort par la fenêtre).
//
// Version texte (sans effets) si « Réduire les animations » est activé ou si WebGL manque.
// =============================================================================
import Lenis from 'lenis';
import { Ecran } from './js/ecran.js';
import { creerSon } from './js/son.js';
import { VOL, BAIE, STUDIO, OBJETS, ORDRE, photo } from './js/donnees.js';

const html = document.documentElement, body = document.body;
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const lerp = (a, b, t) => a + (b - a) * t;
const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const charger = (nom) => { const img = new Image(); img.decoding = 'async'; img.src = photo(nom); return img.decode().then(() => img); };

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
function versionTexte() {
  body.classList.add('qs--texte');
  const a = $('[data-affiche]'); a.src = photo(VOL[VOL.length - 1].image);
  a.alt = 'La tour M&S Design au crépuscule à Manhattan, une seule fenêtre allumée.';
}

if (html.classList.contains('reduced') || !webglOk()) versionTexte();
else {
  try { demarrer(); } catch (err) { console.warn('[qs]', err); versionTexte(); }
}

function demarrer() {
  const ecran = new Ecran($('[data-gl]'));
  ecran.u.uBaie.value.set(BAIE.gauche, BAIE.bas, BAIE.droite, BAIE.haut);
  const son = creerSon();
  const lenis = new Lenis({ lerp: 0.07, smoothWheel: true, syncTouch: true, autoRaf: false });

  // ---------- l'état ----------
  let etat = 'chargement';
  let vol = [];                        // les photos du vol, chargées
  let studio = null, gros = {};        // la photo du studio et les gros plans (quand ils existent)
  let anim = null;                     // animation en cours (entrée, sortie, chapitre)
  let plongee = 0;                     // 0 → 1 : on plonge dans la fenêtre / dans un objet
  let chapitre = null;
  let lueur = 0, lueurCible = 0, halo = 0, haloCible = 0, survol = null;
  let derniereP = 0, vitesse = 0;

  const fenetre = $('[data-fenetre]'), objets = $('[data-objets]'), menu = $('[data-menu]'), bientot = $('[data-bientot]');
  const titres = $$('[data-titre]').map((el) => { const [a, b] = el.dataset.titre.split(' ').map(Number); return { el, a, b }; });
  const classes = (...noms) => { body.classList.remove('is-vol', 'is-heros', 'is-entree', 'is-studio', 'is-chapitre'); noms.forEach((n) => body.classList.add(n)); };

  function animer(duree, maj, fin) {
    const t0 = performance.now();
    const a = { finie: false, tick(t) { const k = Math.min(1, (t - t0) / duree); maj(ease(k)); if (k >= 1) this.fin(); },
      fin() { if (this.finie) return; this.finie = true; maj(1); anim = null; fin && fin(); } };
    anim = a; return a;
  }

  // ---------- chargement : les photos du vol d'abord, le studio ensuite ----------
  const pourcent = $('[data-pourcent]'), barre = $('[data-barre]');
  let faites = 0;
  Promise.all(VOL.map((v) => charger(v.image).then((img) => {
    faites++; pourcent.textContent = Math.round((faites / VOL.length) * 100); barre.style.width = (faites / VOL.length) * 100 + '%';
    return img;
  }))).then((imgs) => {
    vol = imgs; body.classList.add('is-pret'); etat = 'vol'; classes('is-vol');
    if (STUDIO.image) charger(STUDIO.image).then((img) => { studio = img; }, () => {});
    for (const k of ORDRE) if (OBJETS[k].image) charger(OBJETS[k].image).then((img) => { gros[k] = img; }, () => {});
  }, (err) => { console.warn('[qs] photos', err); versionTexte(); });

  // ---------- le vol : avancement du défilement → ce que voit la caméra ----------
  const SEG = VOL.length - 1, FIN_VOL = 0.93, ZOOM_ARRIVEE = 1.12;
  function vueVol(p) {
    const q = Math.min(p / FIN_VOL, 1) * SEG;
    if (q >= SEG) {                                          // arrivé devant la tour : on s'arrête
      const img = vol[SEG], c = ecran.borne(img, VOL[SEG].point[0], VOL[SEG].point[1], ZOOM_ARRIVEE);
      return { A: { img, centre: c, zoom: ZOOM_ARRIVEE }, mix: 0, flou: 0 };
    }
    const s = Math.floor(q), t = q - s, a = VOL[s], imgA = vol[s];
    const z0 = s === 0 ? 1 : ZOOM_ARRIVEE;
    const zA = z0 * lerp(1, a.zoom, Math.pow(lisse(0, 1, t), 1.7));            // la plongée accélère
    const cA = ecran.borne(imgA, lerp(0.5, a.point[0], lisse(0, 0.7, t)), lerp(0.5, a.point[1], lisse(0, 0.7, t)), zA);
    const mix = lisse(0.62, 0.93, t);
    const zB = lerp(1, ZOOM_ARRIVEE, lisse(0.62, 1, t));
    const imgB = vol[s + 1], cB = ecran.borne(imgB, 0.5, 0.5, zB);
    return { A: { img: imgA, centre: cA, zoom: zA }, B: { img: imgB, centre: cB, zoom: zB }, mix, flou: Math.sin(Math.PI * lisse(0.45, 0.98, t)) };
  }

  // ---------- la fenêtre : survol et clic ----------
  fenetre.addEventListener('pointerenter', () => { lueurCible = 1; });
  fenetre.addEventListener('pointerleave', () => { lueurCible = etat === 'vol' ? 0.45 : 0; });
  fenetre.addEventListener('focus', () => { lueurCible = 1; });
  fenetre.addEventListener('blur', () => { lueurCible = etat === 'vol' ? 0.45 : 0; });
  fenetre.addEventListener('click', entrer);

  function entrer() {
    if (etat !== 'vol' || !body.classList.contains('is-heros')) return;
    etat = 'entree'; classes('is-entree'); body.classList.add('is-verrou'); lenis.stop(); fenetre.disabled = true; lueurCible = 0;
    son.demarrer(); son.entrer();
    animer(2600, (k) => { plongee = k; }, () => {
      if (studio) { etat = 'studio'; classes('is-studio'); objets.hidden = false; menu.hidden = false; $('[data-aller]', menu).focus({ preventScroll: true }); }
      else { etat = 'bientot'; bientot.hidden = false; $('button', bientot).focus({ preventScroll: true }); }
    });
  }

  function sortir() {
    if (anim) return;
    if (etat === 'chapitre') return fermer(sortir);
    if (etat !== 'studio' && etat !== 'bientot') return;
    etat = 'sortie'; classes('is-entree'); objets.hidden = true; menu.hidden = true; bientot.hidden = true; son.sortir();
    animer(2200, (k) => { plongee = 1 - k; }, () => {
      etat = 'vol'; classes('is-vol'); body.classList.remove('is-verrou');
      lenis.resize(); lenis.scrollTo(lenis.limit, { immediate: true, force: true }); lenis.start();
      fenetre.focus({ preventScroll: true });
    });
  }

  // La plongée dans la fenêtre : zoom très fort vers la fenêtre, éclair chaud, puis le studio apparaît.
  function vueEntree() {
    const tour = vueVol(1).A, bx = (BAIE.gauche + BAIE.droite) / 2, by = (BAIE.haut + BAIE.bas) / 2;
    const k = plongee, zA = tour.zoom * lerp(1, 9, Math.pow(lisse(0, 0.85, k), 2));
    const cA = ecran.borne(tour.img, lerp(tour.centre[0], bx, lisse(0, 0.5, k)), lerp(tour.centre[1], by, lisse(0, 0.5, k)), zA);
    const chaud = Math.sin(Math.PI * lisse(0.45, 1, k)) * 0.85 + (studio ? 0 : lisse(0.8, 1, k) * 0.15);
    if (!studio) return { A: { img: tour.img, centre: cA, zoom: zA }, mix: 0, flou: lisse(0.2, 0.8, k), chaud: Math.max(chaud, lisse(0.7, 1, k) * 0.92) };
    const zB = lerp(1.18, 1, lisse(0.6, 1, k));
    return { A: { img: tour.img, centre: cA, zoom: zA }, B: { img: studio, centre: ecran.borne(studio, 0.5, 0.5, zB), zoom: zB }, mix: lisse(0.66, 0.8, k), flou: Math.sin(Math.PI * lisse(0.2, 1, k)), chaud };
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
    const g = chapitre && gros[chapitre];
    if (!g) return { A: { img: studio, centre: cA, zoom: zA }, mix: 0, flou: Math.sin(Math.PI * k) * 0.5 };
    const zB = lerp(1.15, 1.02, lisse(0.55, 1, k));
    return { A: { img: studio, centre: cA, zoom: zA }, B: { img: g, centre: ecran.borne(g, 0.5, 0.5, zB), zoom: zB }, mix: lisse(0.55, 0.85, k), flou: Math.sin(Math.PI * lisse(0.2, 1, k)) * 0.8 };
  }

  // ---------- passer, son, clavier ----------
  $('[data-passer]').addEventListener('click', () => {
    son.demarrer();
    if (etat === 'vol') lenis.scrollTo(lenis.limit, { duration: 1.8 });
    else if (anim) anim.fin();
  });
  const bSon = $('[data-son]');
  bSon.textContent = son.actif ? 'Couper le son' : 'Activer le son';
  bSon.addEventListener('click', () => { son.demarrer(); bSon.textContent = son.basculer() ? 'Couper le son' : 'Activer le son'; });
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => son.demarrer(), { once: true, passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (etat === 'chapitre') fermer(); else if (etat === 'studio' || etat === 'bientot') sortir(); }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && (etat === 'studio' || etat === 'chapitre')) {
      const i = Math.max(0, ORDRE.indexOf(chapitre)), n = (i + (e.key === 'ArrowRight' ? (chapitre ? 1 : 0) : ORDRE.length - 1)) % ORDRE.length;
      ouvrir(ORDRE[n]);
    }
  });
  window.addEventListener('resize', () => ecran.taille());

  // ---------- la boucle d'affichage ----------
  function boucle(t) {
    lenis.raf(t);
    if (anim) anim.tick(t);
    let vue = null;
    if (etat === 'vol' || etat === 'chargement') {
      if (vol.length) {
        const p = lenis.limit > 0 ? lenis.scroll / lenis.limit : 0;
        vitesse = vitesse * 0.85 + (p - derniereP) * 1000 * 0.15; derniereP = p;
        son.vol(p, vitesse);
        vue = vueVol(p);
        const heros = p > 0.985;
        body.classList.toggle('is-heros', heros); fenetre.disabled = !heros;
        if (!heros) lueurCible = 0;                          // la lueur n'existe que devant la tour
        else if (lueurCible === 0) lueurCible = 0.45;
        for (const ti of titres) ti.el.style.setProperty('--o', ((ti.a <= 0 ? 1 : lisse(ti.a - 0.03, ti.a + 0.03, p)) * (1 - lisse(ti.b - 0.03, ti.b + 0.03, p))).toFixed(3));
        if (heros) {                                         // le bouton invisible suit la fenêtre (avec une marge pour viser facilement)
          const A = vue.A, [x0, y0] = ecran.versEcran(A.img, A.centre, A.zoom, BAIE.gauche, BAIE.haut), [x1, y1] = ecran.versEcran(A.img, A.centre, A.zoom, BAIE.droite, BAIE.bas);
          const m = 28;
          Object.assign(fenetre.style, { left: (x0 - m) + 'px', top: (y0 - m) + 'px', width: (x1 - x0 + 2 * m) + 'px', height: (y1 - y0 + 2 * m) + 'px' });
        }
      }
    } else if (etat === 'entree' || etat === 'sortie' || etat === 'bientot') vue = vueEntree();
    else if (studio) vue = vueStudio();
    if (vue) {
      ecran.montrer(vue.A, vue.B, vue.mix);
      ecran.u.uFlou.value = vue.flou || 0; ecran.u.uChaud.value = vue.chaud || 0;
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
  window.__qs = { get etat() { return etat; }, entrer, ouvrir, fermer, sortir, lenis };
}
