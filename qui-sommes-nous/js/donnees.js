// =============================================================================
// Les données du film : où sont les images, et où se trouvent la baie allumée et
// les objets du studio dans l'image (calculé dans Blender, en fractions de l'image :
// x de 0 à 1 vers la droite, y de 0 à 1 vers le haut).
// Quand on refait les images dans Blender, il suffit de changer VERSION ici.
// =============================================================================

export const VERSION = '1';
export const DOSSIER = import.meta.env.BASE_URL + 'qui-sommes-nous/images/';
export const IMAGE = { largeur: 1280, hauteur: 720 };

// Le film principal : images 1 → 240 = la descente (pilotée par le défilement),
// image 240 = devant la baie (on clique), images 241 → 312 = l'entrée dans le studio.
export const FILM = { dossier: 'vol', debut: 1, fin: 312, heros: 240 };

// La baie du studio dans l'image 240 (coin haut gauche, coin bas droit).
export const BAIE = { gauche: 0.4055, haut: 0.659, droite: 0.596, bas: 0.336 };

// Les objets du studio dans la dernière image (vue d'ensemble), un par chapitre.
export const OBJETS = {
  carnet: { x: 0.782, y: 0.4725, titre: 'L’idée' },
  ordinateur: { x: 0.07, y: 0.6, titre: 'Fait main' },
  tasse: { x: 0.657, y: 0.4965, titre: 'La méthode' },
  plante: { x: 0.81, y: 0.75, titre: 'Demain' },
};
export const ORDRE = ['carnet', 'ordinateur', 'tasse', 'plante'];

// Les plans « vers l'objet » (rendus dans Blender) : s'ils sont absents, on zoome dans l'image.
export const PLANS = {
  carnet: { dossier: 'chapitres/carnet', images: 40 },
  ordinateur: { dossier: 'chapitres/ordinateur', images: 40 },
  tasse: { dossier: 'chapitres/tasse', images: 40 },
  plante: { dossier: 'chapitres/plante', images: 40 },
};

// La petite boucle du studio (respiration, frappe au clavier) : 0 = pas de boucle, image fixe.
export const BOUCLE = { dossier: 'boucle', images: 0, ips: 24 };

// Adresse d'une image : « vol/0042.webp »
export const adresse = (dossier, n) => `${DOSSIER}${dossier}/${String(n).padStart(4, '0')}.webp?v=${VERSION}`;
