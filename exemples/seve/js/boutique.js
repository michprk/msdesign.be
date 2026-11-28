/* ==========================================================================
   Sève — la boutique : les produits, à filtrer par catégorie (Visage, Corps, Lèvres) et par type de peau, et à trier.
   Les filtres sont gardés dans l'adresse (?categorie=visage&peau=sensible) : on peut partager une sélection.
   ========================================================================== */
import { PRODUITS, carte } from './panier.js';
import { CATEGORIES, BESOINS } from './produits.js';
import './commun.js';

const grille = document.querySelector('[data-grille]');
const compte = document.querySelector('[data-compte]');
const tri = document.querySelector('[data-tri]');
const vide = document.querySelector('[data-vide]');
const params = new URLSearchParams(location.search);
const choix = { categorie: params.get('categorie') || '', peau: params.get('peau') || '' };
if (!CATEGORIES[choix.categorie]) choix.categorie = '';
if (!BESOINS[choix.peau]) choix.peau = '';
if (params.get('tri') && tri.querySelector(`option[value="${params.get('tri')}"]`)) tri.value = params.get('tri');

// les boutons de filtre (un groupe = un choix ; « Tout » efface le choix)
const groupes = document.querySelectorAll('[data-filtre]');
const dessinerFiltres = () => groupes.forEach((g) => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valeur === choix[g.dataset.filtre]))));
groupes.forEach((g) => g.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  choix[g.dataset.filtre] = b.dataset.valeur;
  dessiner();
}));
tri.addEventListener('change', () => dessiner());

function dessiner() {
  let liste = PRODUITS.filter((p) => (!choix.categorie || p.categorie === choix.categorie) && (!choix.peau || p.besoins.includes(choix.peau)));
  if (tri.value === 'prix-croissant') liste = [...liste].sort((a, b) => a.formats[0].prix - b.formats[0].prix);
  if (tri.value === 'prix-decroissant') liste = [...liste].sort((a, b) => b.formats[0].prix - a.formats[0].prix);
  grille.replaceChildren(...liste.map((p) => carte(p, { taille: '(max-width: 700px) 46vw, (max-width: 1100px) 30vw, 22vw' })));
  compte.textContent = liste.length === 1 ? '1 produit' : `${liste.length} produits`;
  vide.hidden = liste.length > 0;
  dessinerFiltres();
  const q = new URLSearchParams();
  if (choix.categorie) q.set('categorie', choix.categorie);
  if (choix.peau) q.set('peau', choix.peau);
  if (tri.value !== 'selection') q.set('tri', tri.value);
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
}
document.querySelector('[data-effacer]').addEventListener('click', () => { choix.categorie = ''; choix.peau = ''; dessiner(); });
dessiner();
