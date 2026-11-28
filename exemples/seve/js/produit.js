/* ==========================================================================
   Sève — la fiche d'un produit (produit.html?p=huile-visage).
   Les photos (la grande et ses vignettes), le nom, le prix selon le format choisi, la quantité, « Ajouter au panier »,
   puis la description, l'utilisation et les ingrédients (à déplier), et trois soins à associer.
   ========================================================================== */
import { PRODUITS, panier, carte, ouvrirTiroir } from './panier.js';
import { parId, prixDe, euros, CATEGORIES, BESOINS } from './produits.js';
import './commun.js';

const $ = (s) => document.querySelector(s);
const p = parId(new URLSearchParams(location.search).get('p') || '') || null;
const fiche = $('[data-fiche]');

if (!p) {
  fiche.hidden = true;
  $('[data-introuvable]').hidden = false;
} else {
  document.title = `${p.nom}, Sève (exemple de boutique M&S Design)`;
  $('[data-fil-categorie]').textContent = CATEGORIES[p.categorie];
  $('[data-fil-categorie]').href = `boutique.html?categorie=${p.categorie}`;
  $('[data-fil-nom]').textContent = p.nom;
  $('[data-nom]').textContent = p.nom;
  $('[data-ligne]').textContent = p.ligne;
  $('[data-description]').textContent = p.description;
  $('[data-utilisation]').textContent = p.utilisation;
  $('[data-ingredients]').textContent = p.ingredients;
  $('[data-peaux]').textContent = p.besoins.map((b) => BESOINS[b]).join(', ');
  const note = $('[data-note]');
  if (p.note) note.textContent = p.note; else note.remove();

  // les photos : la grande, et les vignettes pour changer
  const grande = $('[data-photo]');
  const photos = [
    { src: p.photos.grande, srcset: `${p.photos.petite} 640w, ${p.photos.grande} 1100w`, alt: `${p.nom} Sève, ${p.formats[0].nom}, posé sur la pierre`, format: 'portrait' },
    { src: p.photos.large, alt: `${p.nom} Sève dans la lumière de l’atelier`, format: 'paysage' },
    ...(p.scenes || []).map((src, i) => ({ src, alt: ['Le flacon dans une serre, sous un rayon de soleil', 'Le flacon posé dans une main ouverte', 'Une goutte d’huile tombe de la pipette', 'Le flacon sur une pierre moussue, dans un ruisseau'][i] || '', format: 'paysage' })),
  ];
  const vignettes = $('[data-vignettes]');
  const choisir = (i) => {
    const ph = photos[i];
    grande.src = ph.src; grande.srcset = ph.srcset || ''; grande.alt = ph.alt;
    grande.closest('.galerie__grande').dataset.format = ph.format;
    vignettes.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  };
  photos.forEach((ph, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'galerie__vignette'; b.setAttribute('aria-label', `Photo ${i + 1} sur ${photos.length} : ${ph.alt}`);
    const im = document.createElement('img'); im.src = ph.src; im.alt = ''; im.loading = 'lazy'; im.width = 120; im.height = 150;
    b.append(im);
    b.addEventListener('click', () => choisir(i));
    vignettes.append(b);
  });
  if (photos.length < 2) vignettes.remove();
  choisir(0);

  // le format (s'il y en a plusieurs), la quantité, le prix
  let format = p.formats[0].nom, qte = 1;
  const prix = $('[data-prix]');
  const majPrix = () => { prix.textContent = euros(prixDe(p, format) * qte); $('[data-qte]').textContent = String(qte); };
  const formats = $('[data-formats]');
  if (p.formats.length > 1) {
    p.formats.forEach((f, i) => {
      const lab = document.createElement('label'); lab.className = 'format';
      const r = document.createElement('input'); r.type = 'radio'; r.name = 'format'; r.value = f.nom; r.checked = i === 0;
      r.addEventListener('change', () => { format = f.nom; majPrix(); });
      const t = document.createElement('span'); t.textContent = `${f.nom} — ${euros(f.prix)}`;
      lab.append(r, t); formats.append(lab);
    });
  } else {
    formats.replaceWith(Object.assign(document.createElement('p'), { className: 'fiche__format', textContent: p.formats[0].nom }));
  }
  $('[data-moins]').addEventListener('click', () => { qte = Math.max(1, qte - 1); majPrix(); });
  $('[data-plus]').addEventListener('click', () => { qte = Math.min(20, qte + 1); majPrix(); });
  majPrix();
  const ajouter = $('[data-ajouter]');
  ajouter.addEventListener('click', () => { panier.ajouter(p.id, format, qte); ouvrirTiroir(ajouter); });

  // à associer : d'abord la même catégorie
  const autres = PRODUITS.filter((x) => x.id !== p.id).sort((a, b) => (b.categorie === p.categorie) - (a.categorie === p.categorie)).slice(0, 3);
  $('[data-associer]').append(...autres.map((x) => carte(x, { taille: '(max-width: 700px) 46vw, 30vw' })));
}
