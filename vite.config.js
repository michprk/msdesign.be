// =============================================================================
// Configuration de Vite pour le site de M&S Design.
//
//   npm run dev      → serveur local, la page se met à jour dès qu'on enregistre
//                      (adresse affichée dans le terminal, finit par /msdesign.be/)
//   npm run build    → fabrique la version finale du site dans dist/
//                      (JavaScript et CSS compactés, noms de fichiers uniques)
//   npm run preview  → montre dist/ comme sur GitHub Pages, pour vérifier avant de publier
//
// En ligne, c'est GitHub Actions qui lance « npm run build » à chaque envoi sur
// la branche main et publie dist/ (voir .github/workflows/deploy.yml).
// =============================================================================
import { defineConfig } from 'vite';
import { globSync } from 'node:fs';
import { msdesign } from './scripts/vite-msdesign.js';

// Toutes les pages du site : chaque fichier .html devient une page construite par Vite.
// On ignore les dossiers qui ne sont pas des pages (blocs communs, fichiers publics, outils…).
// Chaque page reçoit un nom lisible (ex. « experience-index ») : on le retrouve dans le nom
// de son fichier JavaScript dans dist/assets/.
const IGNORES = /^(node_modules|dist|dist-hostinger|public|partials|scripts|api|_lab|\.git|\.github)$/;
const pages = Object.fromEntries(
  globSync('**/*.html', { exclude: (dossier) => IGNORES.test(dossier) })
    .map((fichier) => fichier.replace(/\\/g, '/'))
    .map((fichier) => [fichier.replace(/\.html$/, '').replace(/\//g, '-'), fichier]),
);

export default defineConfig({
  // Sur GitHub Pages, le site vit à l'adresse michprk.github.io/msdesign.be/ : toutes les
  // adresses commencent donc par /msdesign.be/. Dans le code, on écrit simplement « /… » ;
  // Vite (et notre plugin pour les liens) ajoute ce préfixe. Le jour où le site passe sur
  // son propre domaine (msdesign.be), il suffira d'écrire base: '/'.
  base: '/msdesign.be/',

  // Les fichiers de public/ sont copiés tels quels, à la même adresse (icônes, robots.txt,
  // vidéos, licences…) : à utiliser pour ce qui doit garder un nom fixe.
  publicDir: 'public',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: pages,
      // (Les licences de Three.js et de Lenis sont publiées dans public/licenses/,
      //  avec un lien dans le pied de page : le code compacté n'a pas besoin de les répéter.)
    },
    // Les modèles 3D (.json, .bin) restent toujours des fichiers séparés. Sans cette règle,
    // Vite colle les fichiers de moins de 4 Ko dans le code (en « data: »), et notre
    // politique de sécurité (CSP) interdit de télécharger ce genre d'adresse.
    assetsInlineLimit: (fichier) => (/\.(json|bin)$/.test(fichier) ? false : undefined),
    // Tous les navigateurs actuels savent précharger les modules : pas besoin du petit
    // programme de secours (« polyfill ») que Vite ajoute sinon, une requête de moins.
    modulePreload: { polyfill: false },
    // Three.js pèse à lui seul ~525 Ko (≈ 133 Ko compressé) : c'est normal pour la 3D, et il
    // n'est chargé que par les pages qui en ont besoin. On relève donc le seuil d'alerte.
    chunkSizeWarningLimit: 600,
  },

  plugins: [msdesign()],
});
