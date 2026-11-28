/* ==========================================================================
   Sève — l'accueil.
   Les décors : le flacon d'huile visage photographié dans quatre décors (la serre, la main, la goutte, le ruisseau).
   La scène reste en place (position: sticky) pendant que la piste défile ; chaque palier de la piste montre un décor.
   À la molette, un cran = un décor entier (l'animation se joue d'un coup, comme une page de produit d'Apple) ;
   au doigt et au clavier, le défilement normal passe d'un décor à l'autre. Avant le premier et après le dernier
   décor, la page défile normalement.
   Puis : la boutique (les sept soins) et l'atelier.
   ========================================================================== */
import { PRODUITS, panier, carte, ouvrirTiroir } from './panier.js';
import './commun.js';

const racine = document.documentElement;
const piste = document.querySelector('[data-scenes]');
const scenes = [...document.querySelectorAll('[data-scene]')];
const reperes = [...document.querySelectorAll('[data-repere]')];
const N = scenes.length;
let actif = -1;

const montrer = (i) => {
  if (i === actif) return;
  const avant = actif;
  actif = i;
  scenes.forEach((s, j) => {
    s.classList.toggle('est-la', j === i);
    s.classList.toggle('est-passee', j < i);
    s.setAttribute('aria-hidden', j === i ? 'false' : 'true');
    s.inert = j !== i;
  });
  reperes.forEach((r, j) => r.classList.toggle('est-actif', j === i));
  piste.dataset.sens = avant < i ? 'avant' : 'arriere';
  majTon();
};

// où en est la piste (0 → 1) ; le décor correspondant
const etat = () => {
  const r = piste.getBoundingClientRect(), h = r.height - innerHeight;
  return { r, h, p: h > 0 ? Math.min(0.9999, Math.max(0, -r.top / h)) : 0 };
};
// l'en-tête : transparent sur les décors (clair sur les sombres), avec un fond ensuite
const majTon = () => {
  const { r } = etat();
  const surScene = r.top <= 60 && r.bottom >= 60;
  racine.classList.toggle('sur-scene', surScene);
  racine.dataset.ton = surScene && actif >= 0 ? scenes[actif].dataset.ton : 'clair';
};
const maj = () => { montrer(Math.floor(etat().p * N)); majTon(); };
addEventListener('scroll', maj, { passive: true });
addEventListener('resize', maj);
maj();

// la molette : un cran = un décor
let verrou = 0;
const allerA = (i) => {
  const { r, h } = etat();
  scrollTo({ top: r.top + scrollY + h * ((i + 0.5) / N), behavior: 'instant' });
  montrer(i);
};
addEventListener('wheel', (e) => {
  if (e.ctrlKey || Math.abs(e.deltaY) < 3) return;
  const { r } = etat();
  if (r.top > 1 || r.bottom < innerHeight - 1) return;          // la scène n'est pas en place
  const cible = actif + Math.sign(e.deltaY);
  if (cible < 0 || cible >= N) return;                           // avant le premier, après le dernier : défilement normal
  e.preventDefault();
  const t = performance.now();
  if (t < verrou) return;
  verrou = t + 950;
  allerA(cible);
}, { passive: false });

// le dernier décor : « Ajouter au panier »
document.querySelectorAll('[data-ajouter]').forEach((b) => b.addEventListener('click', () => {
  panier.ajouter(b.dataset.ajouter, b.dataset.format);
  ouvrirTiroir(b);
}));

// la boutique : les sept soins
const grille = document.querySelector('[data-grille]');
if (grille) grille.append(...PRODUITS.map((p) => carte(p)));
