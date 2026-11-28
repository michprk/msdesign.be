/* ==========================================================================
   Sève — les produits (marque fictive, exemple de site M&S Design ; rien n'est vendu).
   Chaque produit : son nom, une ligne de présentation, sa catégorie, les peaux à qui il convient, ses formats
   (avec leur prix), sa description, son utilisation, ses ingrédients et ses photos.
   Les adresses des photos sont écrites en entier (new URL) pour que Vite les copie dans le site final.
   ========================================================================== */

const img = (nom) => ({
  petite: new URL(`../img/${nom}-640.webp`, import.meta.url).href,
  grande: new URL(`../img/${nom}-1100.webp`, import.meta.url).href,
  large: new URL(`../img/${nom}-large-1600.webp`, import.meta.url).href,
});

export const CATEGORIES = { visage: 'Visage', corps: 'Corps', levres: 'Lèvres' };
export const BESOINS = { seche: 'Peau sèche', sensible: 'Peau sensible', mixte: 'Peau mixte', toutes: 'Toutes peaux' };

export const PRODUITS = [
  {
    id: 'huile-visage',
    nom: 'Huile visage',
    ligne: 'Jojoba, cameline et calendula',
    categorie: 'visage',
    besoins: ['sensible', 'seche', 'toutes'],
    formats: [{ nom: '30 ml', prix: 38 }, { nom: '50 ml', prix: 54 }],
    note: 'Notre premier soin',
    description: 'Une huile légère qui pénètre en quelques secondes. Le jojoba équilibre, la cameline nourrit, le calendula calme les rougeurs : la peau reste souple toute la nuit, sans briller.',
    utilisation: 'Le soir, sur une peau propre et encore humide, déposez trois gouttes dans vos paumes, réchauffez-les et appuyez doucement sur le visage, sans frotter.',
    ingredients: 'Simmondsia Chinensis Seed Oil, Camelina Sativa Seed Oil, Calendula Officinalis Flower Extract, Chamomilla Recutita Flower Extract, Tocopherol, Helianthus Annuus Seed Oil.',
    photos: img('huile-visage'),
    scenes: [
      new URL('../img/scene-serre-1400.webp', import.meta.url).href,
      new URL('../img/scene-main-1400.webp', import.meta.url).href,
      new URL('../img/scene-goutte-1400.webp', import.meta.url).href,
      new URL('../img/scene-ruisseau-1400.webp', import.meta.url).href,
    ],
  },
  {
    id: 'creme-jour',
    nom: 'Crème de jour',
    ligne: 'Aloe vera, karité léger et thé vert',
    categorie: 'visage',
    besoins: ['mixte', 'toutes'],
    formats: [{ nom: '50 ml', prix: 32 }],
    description: 'Une crème fraîche qui hydrate sans alourdir et se fait oublier sous le maquillage. Le thé vert protège la peau de la journée en ville.',
    utilisation: 'Le matin, une noisette sur le visage et le cou, en remontant vers les tempes.',
    ingredients: 'Aqua, Aloe Barbadensis Leaf Juice, Butyrospermum Parkii Butter, Caprylic/Capric Triglyceride, Camellia Sinensis Leaf Extract, Glycerin, Cetearyl Alcohol, Glyceryl Stearate, Xanthan Gum, Tocopherol.',
    photos: img('creme'),
  },
  {
    id: 'baume-demaquillant',
    nom: 'Baume démaquillant',
    ligne: 'Tournesol et cire de riz',
    categorie: 'visage',
    besoins: ['sensible', 'toutes'],
    formats: [{ nom: '100 ml', prix: 29 }],
    description: 'Un baume solide qui fond en huile au contact de la peau et emporte le maquillage, même le mascara. Il se rince en lait, sans laisser de film.',
    utilisation: 'Sur peau sèche, massez une petite quantité du bout des doigts, puis émulsionnez avec un peu d’eau tiède et rincez.',
    ingredients: 'Helianthus Annuus Seed Oil, Oryza Sativa Bran Wax, Polyglyceryl-4 Oleate, Prunus Amygdalus Dulcis Oil, Tocopherol.',
    photos: img('baume'),
  },
  {
    id: 'brume-florale',
    nom: 'Brume florale',
    ligne: 'Eau de rose de Damas et bleuet',
    categorie: 'visage',
    besoins: ['sensible', 'toutes'],
    formats: [{ nom: '100 ml', prix: 22 }],
    description: 'Une eau florale pure, distillée à la vapeur, qui rafraîchit la peau et prépare à l’huile visage. Un parfum de rose très léger, qui s’efface vite.',
    utilisation: 'Vaporisez à vingt centimètres du visage, yeux fermés, avant votre soin ou dans la journée.',
    ingredients: 'Rosa Damascena Flower Water, Centaurea Cyanus Flower Water, Glycerin, Sodium Levulinate, Sodium Anisate.',
    photos: img('brume'),
  },
  {
    id: 'huile-corps',
    nom: 'Huile corps',
    ligne: 'Amande douce et sésame, à l’orange douce',
    categorie: 'corps',
    besoins: ['seche'],
    formats: [{ nom: '100 ml', prix: 34 }],
    description: 'Une huile sèche pour tout le corps, à appliquer en sortant de la douche. L’orange douce laisse une odeur discrète et ensoleillée.',
    utilisation: 'Sur une peau encore humide, une à deux pressions par zone, en massant jusqu’à pénétration.',
    ingredients: 'Prunus Amygdalus Dulcis Oil, Sesamum Indicum Seed Oil, Caprylic/Capric Triglyceride, Citrus Aurantium Dulcis Peel Oil, Tocopherol, Limonene.',
    photos: img('huile-corps'),
  },
  {
    id: 'savon-argile',
    nom: 'Savon à l’argile verte',
    ligne: 'Saponifié à froid, huile d’olive',
    categorie: 'corps',
    besoins: ['mixte', 'toutes'],
    formats: [{ nom: '100 g', prix: 9 }],
    description: 'Un savon fait à froid à l’atelier et séché six semaines. L’argile verte nettoie en douceur les peaux mixtes, l’huile d’olive garde la peau souple.',
    utilisation: 'Faites mousser entre les mains humides, appliquez, rincez. Laissez-le sécher sur un porte-savon entre deux usages.',
    ingredients: 'Sodium Olivate, Sodium Cocoate, Aqua, Montmorillonite, Glycerin, Butyrospermum Parkii Butter.',
    photos: img('savon'),
  },
  {
    id: 'baume-levres',
    nom: 'Baume à lèvres',
    ligne: 'Cire d’abeille belge et beurre de cacao',
    categorie: 'levres',
    besoins: ['seche'],
    formats: [{ nom: '15 ml', prix: 8 }],
    description: 'Un baume nourrissant pour les lèvres et les cuticules, dans une boîte en laiton qui se glisse partout. Sans parfum.',
    utilisation: 'Du bout du doigt, aussi souvent que nécessaire.',
    ingredients: 'Ricinus Communis Seed Oil, Cera Alba, Theobroma Cacao Seed Butter, Prunus Amygdalus Dulcis Oil, Tocopherol.',
    photos: img('levres'),
  },
];

export const parId = (id) => PRODUITS.find((p) => p.id === id);
export const prixDe = (p, format) => (p.formats.find((f) => f.nom === format) || p.formats[0]).prix;
export const euros = (n) => n.toLocaleString('fr-BE', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
export const ficheDe = (p) => 'produit.html?p=' + encodeURIComponent(p.id);
