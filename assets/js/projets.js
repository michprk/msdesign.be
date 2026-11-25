/* ==========================================================================
   Les projets de la sphère « Mettez le désordre. On remet de l'ordre. »
   Douze identités visuelles imaginées par le studio pour des commerces fictifs (des concepts : aucune n'est un client).
   Chaque identité est une planche (public/assets/img/identites/<id>-{1440,2880}.webp, 16:10, faite par
   _msdesign-src/perf/identites/capture.mjs à partir de planche.html) : l'affiche à gauche ; à droite l'en-tête, le
   logo, deux couleurs, la typographie, la carte de visite, l'icône.
   Sur la sphère, chaque projet est un îlot de quatre cases (l'affiche, le logo, la carte, l'icône) ; il a sa couleur
   (la lumière au survol) et son geste (son mouvement au survol), qui parle de son métier.
   Le groupe « client » est prévu pour les vraies réalisations : il reste vide tant qu'aucune n'est validée.
   ========================================================================== */

// les cases d'une planche, en fractions (u vers la droite, v vers le bas)
export const CASES = {
  affiche: [0, 0, 0.5, 1],
  logo: [0.5, 0.08, 1, 0.42],
  couleurs: [0.5, 0.42, 0.75, 0.72],
  typo: [0.75, 0.42, 1, 0.72],
  carte: [0.5, 0.72, 0.8, 1],
  icone: [0.8, 0.72, 1, 1],
};
// les cases qui vont sur la sphère (là où l'on voit le logo), et leurs noms dans la fiche
export const SUR_LA_SPHERE = ['affiche', 'logo', 'carte', 'icone'];
// l'îlot (sur la sphère, et en miniature dans la fiche) : où va chaque case, en hauteur de planche (x vers la droite,
// y vers le bas) : l'affiche à gauche ; à droite, le logo au-dessus, la carte et l'icône en dessous, la colonne centrée
export const JOINT = 0.035;
export const ILOT = (() => {
  const g = {}, colX = 0.8 + JOINT;
  const ht = 0.34 + JOINT + 0.28, haut = (1 - ht) / 2;
  g.affiche = [0, 0, 0.8, 1];
  g.logo = [colX, haut, colX + 0.8, haut + 0.34];
  g.carte = [colX, haut + 0.34 + JOINT, colX + 0.48, haut + 0.34 + JOINT + 0.28];
  g.icone = [colX + 0.48 + JOINT, haut + 0.34 + JOINT, colX + 0.48 + JOINT + 0.32, haut + 0.34 + JOINT + 0.28];
  return { cases: g, largeur: colX + 0.835, centre: [(colX + 0.835) / 2, 0.5] };
})();
export const NOMS_CASES = { affiche: 'L’affiche', logo: 'Le logo', couleurs: 'Les couleurs', typo: 'La typographie', carte: 'La carte de visite', icone: 'L’icône' };

const p = (id, nom, metier, lieu, couleur, geste, police, couleurs, intro, idee, direction) => ({
  id, groupe: 'concept', nom, metier, lieu, couleur, geste, police, couleurs, intro, idee, direction,
});

export const PROJETS = [
  p('ferment', 'Ferment', 'Bar à vins nature', 'Saint-Gilles', '#c41e2e', 'bulles',
    { nom: 'Fraunces', famille: '"Fraunces", serif', graisse: 600 },
    [['Cerise', '#c41e2e'], ['Bordeaux', '#4d0c19'], ['Crème', '#f4f0ea']],
    'Une cave le jour, un bar le soir : une identité pour un bar à vins nature à Saint-Gilles.',
    'Le vin nature est vivant, un peu imprévisible. Il fallait une marque chaleureuse et gourmande, sans tomber dans le rustique des étiquettes de terroir.',
    'Une cerise photographiée comme un bijou, des bulles qui remontent, un serif généreux sur un fond crème : le fruit avant le discours.'),
  p('halde', 'Halde', 'Salle d’escalade', 'Bloc et voies, ouvert 7/7', '#6f45e6', 'relief',
    { nom: 'Barlow Condensed', famille: '"Barlow Condensed", sans-serif', graisse: 800, majuscules: true },
    [['Violet prise', '#6f45e6'], ['Béton', '#e6dfd3'], ['Noir', '#111111']],
    'Une salle d’escalade en ville, avec du bloc et des voies, ouverte tous les jours.',
    'Sortir des codes « montagne » habituels pour parler aux grimpeurs qui s’entraînent après le travail, en plein Bruxelles.',
    'Le béton et l’architecture comme terrain de jeu, une seule couleur vive, celle des prises, et un nom en capitales étroites, massif comme un mur.'),
  p('ondine', 'Ondine', 'Atelier céramique', 'Pièces tournées main, cours', '#c9653a', 'tour',
    { nom: 'Instrument Serif italique', famille: '"Instrument Serif", serif', graisse: 400, italique: true },
    [['Terre cuite', '#c9653a'], ['Biscuit', '#ecdcc9'], ['Vert d’eau', '#33666a']],
    'Un atelier de céramique : des pièces tournées à la main et des cours pour apprendre.',
    'Rendre l’artisanat désirable comme une marque de beauté, sans perdre la trace de la main.',
    'Un italique souple comme une forme qu’on tourne, un vert d’eau profond, la terre cuite en accent, et un portrait éditorial en affiche.'),
  p('prisme', 'Prisme', 'Lunettes de créateurs', 'Opticien, Ixelles', '#9fdcff', 'spectre',
    { nom: 'Archivo', famille: '"Archivo", sans-serif', graisse: 700 },
    [['Encre', '#111111'], ['Irisé', 'linear-gradient(160deg, #9fdcff, #f3a6d6 55%, #ffe8a8)'], ['Blanc', '#f7f7f4']],
    'Un opticien d’Ixelles spécialisé dans les montures de créateurs.',
    'Un opticien vend aussi de la lumière : l’identité devait rester nette, presque technique, tout en jouant avec les reflets.',
    'Un nom en minuscules très serré, des reflets irisés sur verre en affiche, et une palette réduite à l’encre et à la lumière décomposée.'),
  p('carmin', 'Carmin', 'Institut de beauté', 'Soins et maquillage, Ixelles', '#a3192f', 'ecrin',
    { nom: 'Archivo étendu', famille: '"Archivo", sans-serif', graisse: 300, largeur: '125%', majuscules: true },
    [['Carmin', '#a3192f'], ['Poudre', '#e9d3c4'], ['Brun nuit', '#1b1513']],
    'Un institut de beauté à Ixelles : soins du visage et maquillage.',
    'Une adresse haut de gamme qui doit rassurer sans paraître froide.',
    'Des capitales larges et très espacées, un rouge carmin unique sur un brun presque noir, et des portraits en lumière douce.'),
  p('rayon', 'Rayon', 'Atelier vélo', 'Réparation et montage, sur rendez-vous', '#f3c22f', 'oblique',
    { nom: 'Archivo', famille: '"Archivo", sans-serif', graisse: 500, largeur: '90%' },
    [['Jaune rayon', '#f3c22f'], ['Bleu de travail', '#1d2a6b'], ['Bleu canard', '#0b8194']],
    'Un atelier vélo : réparation et montage, sur rendez-vous.',
    'Un atelier technique qui veut parler à une clientèle urbaine et soignée, pas seulement aux passionnés de mécanique.',
    'La barre oblique du nom, comme un rayon de roue, du jaune signalétique, un bleu de travail, et une affiche de mode plutôt qu’une photo de garage.'),
  p('eve', 'Maison Ève', 'Créatrice de mode', 'Prêt-à-porter, Saint-Gilles', '#3c8a4c', 'drape',
    { nom: 'Fraunces', famille: '"Fraunces", serif', graisse: 500 },
    [['Vert soie', '#3c8a4c'], ['Rouge pomme', '#b4321f'], ['Bleu nuit', '#262947']],
    'Une marque de prêt-à-porter pour une créatrice installée à Saint-Gilles.',
    'Donner à une petite marque la tenue d’une maison de couture, avec une pointe d’humour.',
    '« Maison » en petites capitales au-dessus d’un serif élégant, un È comme monogramme, et le vert de la soie face au rouge de la pomme.'),
  p('sillon', 'Sillon', 'Disquaire', 'Disques et platines, Bruxelles', '#c9c9c9', 'sillon',
    { nom: 'Archivo noir élargi', famille: '"Archivo", sans-serif', graisse: 800, largeur: '112%' },
    [['Chrome', 'linear-gradient(160deg, #f7f7f7, #8d8d8d 45%, #e9e9e9 70%, #6a6a6a)'], ['Vinyle', '#1c1c1c'], ['Blanc', '#f5f5f3']],
    'Un disquaire bruxellois : vinyles neufs et d’occasion, platines.',
    'Un magasin de disques doit faire entendre la musique avant même qu’on pousse la porte.',
    'Un nom gras et large comme un logo de label, le noir du vinyle, le chrome liquide des platines en affiche.'),
  p('nord', 'Nord', 'Menuiserie sur mesure', 'Atelier bois, Anderlecht', '#c08a52', 'assemblage',
    { nom: 'Archivo étendu', famille: '"Archivo", sans-serif', graisse: 800, largeur: '125%', majuscules: true },
    [['Chêne', '#c08a52'], ['Sapin', '#2f4a3c'], ['Nuit', '#1e2421']],
    'Une menuiserie sur mesure installée à Anderlecht.',
    'Un artisan du bois qui veut signer des projets d’architecte, et qui doit le montrer dès la première image.',
    'Des capitales larges et solides, une affiche en lames de chêne, le chêne et le sapin comme seules couleurs.'),
  p('lueur', 'Lueur', 'Bougies coulées main', 'Cire végétale, Etterbeek', '#f2a65a', 'flamme',
    { nom: 'Fraunces italique', famille: '"Fraunces", serif', graisse: 500, italique: true },
    [['Ambre', '#f2a65a'], ['Prune', '#2a1430'], ['Cire', '#f6ead8']],
    'Des bougies coulées à la main à Etterbeek, en cire végétale.',
    'Une bougie se choisit pour une ambiance : l’identité devait être chaude, calme, un peu secrète.',
    'Un italique en minuscules qui ondule comme une flamme, une seule bougie allumée en affiche, l’ambre sur un prune profond.'),
  p('kiosque', 'Kiosque', 'Café et journaux', 'Place Flagey, tous les matins', '#f4e04d', 'pages',
    { nom: 'Barlow Condensed', famille: '"Barlow Condensed", sans-serif', graisse: 800, majuscules: true },
    [['Jaune presse', '#f4e04d'], ['Rouge tampon', '#e2463a'], ['Bleu kiosque', '#1f3fbf']],
    'Un café-kiosque place Flagey : un café et le journal, tous les matins.',
    'Retrouver l’énergie des kiosques à journaux sans faire rétro.',
    'Des capitales étroites de une de journal, un damier, un bleu franc, le jaune presse et une pastille rouge comme un tampon.'),
  p('atoll', 'Atoll', 'Bains et piscine', 'Nage libre, cours, sauna', '#ff7a59', 'onde',
    { nom: 'Instrument Sans', famille: '"Instrument Sans", sans-serif', graisse: 600 },
    [['Lagon', '#9fe0d8'], ['Corail', '#ff7a59'], ['Bleu bassin', '#0f6e7a']],
    'Une piscine de quartier : nage libre, cours et sauna.',
    'Rendre une piscine publique aussi désirable qu’un club, sans perdre son côté accessible.',
    'Un nom en minuscules arrondies, des cercles comme des ondes à la surface de l’eau, le lagon et une pointe de corail.'),
];

// le dossier des planches ; la grande version (2880 px) seulement sur les écrans fins
export const planche = (base, id, grande) => base + 'assets/img/identites/' + id + (grande ? '-2880' : '-1440') + '.webp';
