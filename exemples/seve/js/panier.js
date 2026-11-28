/* ==========================================================================
   Sève — le panier, commun à toutes les pages.
   - Le contenu est gardé dans ce navigateur (localStorage « seve-panier ») ; rien n'est envoyé nulle part.
   - Le tiroir s'ouvre à droite quand on ajoute un produit ou qu'on clique « Panier » dans l'en-tête :
     quantités, retirer, sous-total, ce qui manque pour la livraison offerte, « Commander ».
   - carte(p) fabrique la vignette d'un produit (accueil, boutique, « à associer »).
   ========================================================================== */
import { PRODUITS, parId, prixDe, euros, ficheDe } from './produits.js';

export const LIVRAISON = 4.9;
export const OFFERTE_DES = 50;
const CLE = 'seve-panier';

let lignes = [];
try { lignes = JSON.parse(localStorage.getItem(CLE) || '[]').filter((l) => parId(l.id) && l.qte > 0); } catch (e) { lignes = []; }
const ecouteurs = new Set();
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify(lignes)); } catch (e) { /* navigation privée : le panier vit le temps de la page */ } };
const prevenir = () => { garder(); ecouteurs.forEach((f) => f(lignes)); };

export const panier = {
  lignes: () => lignes.map((l) => ({ ...l, produit: parId(l.id), prix: prixDe(parId(l.id), l.format) })),
  nombre: () => lignes.reduce((n, l) => n + l.qte, 0),
  total: () => lignes.reduce((s, l) => s + prixDe(parId(l.id), l.format) * l.qte, 0),
  ajouter(id, format, qte = 1) {
    const p = parId(id); if (!p) return;
    const f = format || p.formats[0].nom;
    const l = lignes.find((x) => x.id === id && x.format === f);
    if (l) l.qte = Math.min(20, l.qte + qte); else lignes.push({ id, format: f, qte: Math.min(20, qte) });
    prevenir();
    annoncer(`${p.nom} (${f}) ajouté au panier.`);
  },
  changer(i, qte) { if (!lignes[i]) return; if (qte <= 0) lignes.splice(i, 1); else lignes[i].qte = Math.min(20, qte); prevenir(); },
  vider() { lignes = []; prevenir(); },
  surChange(f) { ecouteurs.add(f); return () => ecouteurs.delete(f); },
};

/* ---------- l'annonce pour les lecteurs d'écran ---------- */
const voix = document.createElement('p');
voix.className = 'sr'; voix.setAttribute('aria-live', 'polite');
document.body.append(voix);
const annoncer = (t) => { voix.textContent = ''; requestAnimationFrame(() => { voix.textContent = t; }); };

/* ---------- les éléments ---------- */
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

// la vignette d'un produit
export function carte(p, { taille = '(max-width: 700px) 46vw, 23vw' } = {}) {
  const li = el('li', 'carte');
  const a = el('a', 'carte__lien'); a.href = ficheDe(p);
  const cadre = el('span', 'carte__image');
  const im = el('img');
  im.src = p.photos.petite; im.srcset = `${p.photos.petite} 640w, ${p.photos.grande} 1100w`; im.sizes = taille;
  im.width = 640; im.height = 800; im.loading = 'lazy'; im.decoding = 'async';
  im.alt = `${p.nom} Sève, ${p.formats[0].nom}`;
  cadre.append(im);
  a.append(cadre, el('span', 'carte__nom', p.nom), el('span', 'carte__ligne', p.ligne));
  const bas = el('p', 'carte__bas');
  bas.append(el('span', 'carte__prix', (p.formats.length > 1 ? 'dès ' : '') + euros(p.formats[0].prix)));
  const b = el('button', 'carte__ajouter', 'Ajouter'); b.type = 'button';
  b.setAttribute('aria-label', `Ajouter ${p.nom} (${p.formats[0].nom}) au panier`);
  b.addEventListener('click', () => { panier.ajouter(p.id, p.formats[0].nom); ouvrirTiroir(b); });
  bas.append(b);
  li.append(a, bas);
  return li;
}

/* ---------- le tiroir ---------- */
const tiroir = el('div', 'tiroir'); tiroir.hidden = true; tiroir.dataset.tiroir = '';
tiroir.innerHTML = `
  <div class="tiroir__fond" data-fermer></div>
  <aside class="tiroir__panneau" role="dialog" aria-modal="true" aria-labelledby="tiroir-titre">
    <div class="tiroir__tete"><h2 class="tiroir__titre" id="tiroir-titre">Votre panier</h2><button class="lien" type="button" data-fermer>Fermer</button></div>
    <ul class="tiroir__liste" data-liste></ul>
    <div class="tiroir__vide" data-vide hidden><p>Votre panier est vide.</p><a class="bouton bouton--clair" href="boutique.html">Voir la boutique</a></div>
    <div class="tiroir__pied" data-pied>
      <p class="tiroir__total"><span>Sous-total</span><strong data-total></strong></p>
      <p class="tiroir__note" data-note></p>
      <a class="bouton" href="commande.html">Commander</a>
      <p class="tiroir__exemple">Boutique d’exemple : aucun paiement ne vous sera demandé.</p>
    </div>
  </aside>`;
document.body.append(tiroir);
const liste = tiroir.querySelector('[data-liste]'), vide = tiroir.querySelector('[data-vide]'), pied = tiroir.querySelector('[data-pied]');
let retour = null;

export function ouvrirTiroir(depuis) {
  retour = depuis || document.activeElement;
  tiroir.hidden = false;
  document.documentElement.classList.add('tiroir-ouvert');
  requestAnimationFrame(() => { tiroir.classList.add('est-ouvert'); tiroir.querySelector('.tiroir__titre').focus({ preventScroll: true }); });
}
export function fermerTiroir() {
  tiroir.classList.remove('est-ouvert');
  document.documentElement.classList.remove('tiroir-ouvert');
  setTimeout(() => { tiroir.hidden = true; }, 420);
  if (retour && retour.focus) retour.focus({ preventScroll: true });
}
tiroir.querySelector('.tiroir__titre').tabIndex = -1;
tiroir.addEventListener('click', (e) => { if (e.target.closest('[data-fermer]')) fermerTiroir(); });
document.addEventListener('keydown', (e) => {
  if (tiroir.hidden) return;
  if (e.key === 'Escape') { fermerTiroir(); return; }
  if (e.key === 'Tab') {
    const f = [...tiroir.querySelectorAll('a[href], button:not([disabled])')].filter((x) => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

// une ligne du panier (tiroir et page de commande)
export function lignePanier(l, i) {
  const li = el('li', 'ligne');
  const im = el('img', 'ligne__image'); im.src = l.produit.photos.petite; im.alt = ''; im.width = 64; im.height = 80;
  const txt = el('div', 'ligne__texte');
  const nom = el('a', 'ligne__nom', l.produit.nom); nom.href = ficheDe(l.produit);
  txt.append(nom, el('span', 'ligne__format', l.format));
  const qte = el('div', 'quantite');
  const moins = el('button', 'quantite__b', '−'); moins.type = 'button'; moins.setAttribute('aria-label', `Retirer un ${l.produit.nom}`);
  const n = el('span', 'quantite__n', String(l.qte)); n.setAttribute('aria-label', `Quantité : ${l.qte}`);
  const plus = el('button', 'quantite__b', '+'); plus.type = 'button'; plus.setAttribute('aria-label', `Ajouter un ${l.produit.nom}`);
  moins.addEventListener('click', () => panier.changer(i, l.qte - 1));
  plus.addEventListener('click', () => panier.changer(i, l.qte + 1));
  qte.append(moins, n, plus);
  const retirer = el('button', 'lien ligne__retirer', 'Retirer'); retirer.type = 'button';
  retirer.addEventListener('click', () => panier.changer(i, 0));
  txt.append(qte);
  li.append(im, txt, el('span', 'ligne__prix', euros(l.prix * l.qte)), retirer);
  return li;
}

export const noteLivraison = (total) => total >= OFFERTE_DES ? 'La livraison est offerte.' : `Plus que ${euros(OFFERTE_DES - total)} pour la livraison offerte en Belgique.`;

const dessiner = () => {
  const ls = panier.lignes();
  liste.replaceChildren(...ls.map(lignePanier));
  vide.hidden = ls.length > 0; pied.hidden = ls.length === 0; liste.hidden = ls.length === 0;
  tiroir.querySelector('[data-total]').textContent = euros(panier.total());
  tiroir.querySelector('[data-note]').textContent = noteLivraison(panier.total());
  // l'en-tête : « Panier (3) »
  document.querySelectorAll('[data-nombre]').forEach((s) => { s.textContent = panier.nombre() ? `(${panier.nombre()})` : ''; });
};
panier.surChange(dessiner);
dessiner();
document.addEventListener('click', (e) => { const b = e.target.closest('[data-panier]'); if (b) { e.preventDefault(); ouvrirTiroir(b); } });

// ailleurs dans le site (un autre onglet) : le panier suit
window.addEventListener('storage', (e) => { if (e.key !== CLE) return; try { lignes = JSON.parse(e.newValue || '[]'); } catch (x) { lignes = []; } dessiner(); });

export { PRODUITS };
