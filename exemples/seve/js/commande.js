/* ==========================================================================
   Sève — la commande (simulée).
   Le panier, le mode de livraison (retrait à l'atelier ou livraison en Belgique), les totaux, puis « Valider la
   commande d'exemple » : un numéro d'exemple s'affiche et le panier se vide. Aucun champ personnel, aucun champ de
   paiement : c'est une boutique d'exemple, rien n'est envoyé nulle part.
   ========================================================================== */
import { panier, lignePanier, noteLivraison, LIVRAISON, OFFERTE_DES } from './panier.js';
import { euros } from './produits.js';
import './commun.js';

const $ = (s) => document.querySelector(s);
const etape = $('[data-etape]'), merci = $('[data-merci]'), videBloc = $('[data-vide]');
const liste = $('[data-liste]');
let mode = 'atelier';

const fraisDe = (total) => (mode === 'atelier' || total >= OFFERTE_DES ? 0 : LIVRAISON);
function dessiner() {
  const ls = panier.lignes();
  if (!merci.hidden) return;
  videBloc.hidden = ls.length > 0;
  etape.hidden = ls.length === 0;
  liste.replaceChildren(...ls.map(lignePanier));
  const total = panier.total(), frais = fraisDe(total);
  $('[data-sous-total]').textContent = euros(total);
  $('[data-frais]').textContent = frais ? euros(frais) : 'offerte';
  $('[data-total]').textContent = euros(total + frais);
  $('[data-note]').textContent = mode === 'domicile' ? noteLivraison(total) : 'Retrait gratuit à l’atelier, du mardi au samedi.';
  $('[data-frais-domicile]').textContent = total >= OFFERTE_DES ? 'offerte' : euros(LIVRAISON);
}
document.querySelectorAll('input[name="livraison"]').forEach((r) => r.addEventListener('change', () => { mode = r.value; dessiner(); }));
panier.surChange(dessiner);
dessiner();

$('[data-valider]').addEventListener('click', () => {
  const ls = panier.lignes(); if (!ls.length) return;
  const total = panier.total(), frais = fraisDe(total);
  $('[data-numero]').textContent = 'SV-EXEMPLE-' + String(Math.floor(1000 + Math.random() * 9000));
  $('[data-recap]').textContent = `${panier.nombre()} article${panier.nombre() > 1 ? 's' : ''}, ${euros(total + frais)}, ${mode === 'atelier' ? 'à retirer à l’atelier' : 'livré à domicile'}.`;
  etape.hidden = true; videBloc.hidden = true; merci.hidden = false;
  document.querySelectorAll('[data-pas]').forEach((s) => s.classList.toggle('est-actif', s.dataset.pas === '3'));
  panier.vider();
  $('[data-merci-titre]').focus();
  scrollTo({ top: 0, behavior: 'smooth' });
});
