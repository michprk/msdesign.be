// =============================================================================
// Les photos de l'expérience (générées par IA, photoréalistes), montées comme un film.
// Les positions sont en fractions de la photo : x de 0 (gauche) à 1 (droite), y de 0 (bas) à 1 (haut).
// Pour remplacer une photo : même nom de fichier dans public/qui-sommes-nous/scenes/,
// puis changer VERSION ici (les navigateurs rechargent alors la nouvelle).
// =============================================================================

export const VERSION = '2';
const DOSSIER = import.meta.env.BASE_URL + 'qui-sommes-nous/scenes/';
export const photo = (nom) => `${DOSSIER}${nom}?v=${VERSION}`;

// Ce qui bouge dans chaque photo, pour qu'elle vive comme une vidéo :
//   rien · nuages (ils dérivent, la ville scintille dessous) · ciel (il glisse derrière les tours) · studio (la vapeur du café)
export const VIE = { rien: 0, nuages: 1, ciel: 2, studio: 3 };

// Le vol : un film qui se joue tout seul. Chaque plan apparaît en fondu pendant que le précédent
// plonge encore, puis avance à son tour : la caméra ne s'arrête qu'à la fenêtre.
//   point : là où va la caméra ; zoom : jusqu'où elle s'approche à la fin du plan ;
//   duree : temps à l'écran, en secondes, fondus compris.
export const FONDU = 1.6;
export const VOL = [
  { image: 'nuages.webp', point: [0.5, 0.26], zoom: 3.2, duree: 6.6, vie: VIE.nuages },     // la trouée dans les nuages, au-dessus de Manhattan
  { image: 'manhattan.webp', point: [0.5015, 0.498], zoom: 3.6, duree: 6.6, vie: VIE.ciel }, // la seule fenêtre allumée de la tour M&S
  { image: 'tour.webp', point: [0.503, 0.495], zoom: 1.5, duree: 4.4, vie: VIE.ciel },       // la tour de près : on ralentit devant la fenêtre
];

// La fenêtre allumée dans la dernière photo du vol (gauche, haut, droite, bas).
export const BAIE = { gauche: 0.485, haut: 0.515, droite: 0.5215, bas: 0.476 };

// Derrière la fenêtre : la terrasse, portes ouvertes ; on passe entre les deux battants.
export const TERRASSE = { image: 'terrasse.webp', point: [0.5, 0.43], zoom: 2.9 };

// Le studio et ses objets (un par chapitre). image : null tant que la photo n'existe pas encore.
// x, y : où se trouve l'objet dans la photo du studio (même repère que plus haut).
// tasse : le bord de la tasse, d'où monte la vapeur.
export const STUDIO = { image: 'studio.webp', tasse: [0.7325, 0.293] };
export const OBJETS = {
  carnet: { x: 0.67, y: 0.19, image: 'carnet.webp' },   // le carnet de croquis ouvert sur la grande table
  ordinateur: { x: 0.155, y: 0.43, image: 'ordinateur.webp' },       // l'écran avec le code, sur le bureau à gauche
  tasse: { x: 0.73, y: 0.27, image: 'tasse.webp' },             // la tasse de café sur la table
  plante: { x: 0.665, y: 0.58, image: null },           // le figuier, au fond
};
export const ORDRE = ['carnet', 'ordinateur', 'tasse', 'plante'];
