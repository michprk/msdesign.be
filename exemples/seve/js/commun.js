/* Sève — ce qui est commun à toutes les pages : le panier (tiroir), et l'en-tête qui prend un fond dès qu'on défile. */
import './panier.js';

const entete = document.querySelector('.entete');
if (entete) {
  const maj = () => entete.classList.toggle('est-defile', scrollY > 8);
  addEventListener('scroll', maj, { passive: true });
  maj();
}
