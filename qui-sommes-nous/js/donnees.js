// =============================================================================
// Les photos de l'expérience (générées par IA, photoréalistes) et, pour chacune,
// le point vers lequel la caméra plonge. Les positions sont en fractions de la
// photo : x de 0 (gauche) à 1 (droite), y de 0 (bas) à 1 (haut).
// Pour remplacer une photo : même nom de fichier dans public/qui-sommes-nous/scenes/,
// puis changer VERSION ici (les navigateurs rechargent alors la nouvelle).
// =============================================================================

export const VERSION = '2';
const DOSSIER = import.meta.env.BASE_URL + 'qui-sommes-nous/scenes/';
export const photo = (nom) => `${DOSSIER}${nom}?v=${VERSION}`;

// Le vol, piloté par le défilement : on plonge dans chaque photo, puis on passe à la suivante.
//   point : là où la caméra plonge ; zoom : jusqu'où elle s'approche avant de passer à la suite.
export const VOL = [
  { image: 'nuages.webp', point: [0.5, 0.26], zoom: 2.6 },          // la trouée dans les nuages, au-dessus de Manhattan
  { image: 'manhattan.webp', point: [0.5015, 0.498], zoom: 3.6 },   // la seule fenêtre allumée de la tour M&S
  { image: 'tour.webp', point: [0.503, 0.495], zoom: 1 },           // la tour de près : on s'arrête devant la fenêtre
];

// La fenêtre allumée dans la dernière photo du vol (gauche, haut, droite, bas).
export const BAIE = { gauche: 0.485, haut: 0.515, droite: 0.5215, bas: 0.476 };

// Le studio et ses objets (un par chapitre). image : null tant que la photo n'existe pas encore.
export const STUDIO = { image: null };
export const OBJETS = {
  carnet: { x: 0.5, y: 0.5, image: null },
  ordinateur: { x: 0.2, y: 0.55, image: null },
  tasse: { x: 0.6, y: 0.45, image: null },
  plante: { x: 0.85, y: 0.6, image: null },
};
export const ORDRE = ['carnet', 'ordinateur', 'tasse', 'plante'];
