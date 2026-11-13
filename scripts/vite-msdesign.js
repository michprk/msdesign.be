// =============================================================================
// Les « petits plus » du site M&S Design, branchés sur Vite.
// (Un plugin Vite, c'est un objet avec des fonctions que Vite appelle à certains
//  moments : quand il lit une page HTML, quand il a fini d'écrire dist/…)
//
// Ils remplacent l'ancien scripts/build.sh :
//  1. BLOCS COMMUNS — dans une page, <!--#include header--> est remplacé par le
//     contenu de partials/header.html (en-tête, pied de page, cookies, icônes…).
//     Le lien de la page courante reçoit aria-current="page".
//  2. SCRIPTS COLLÉS — <!--#inline assets/js/boot.js--> devient <script>…</script>
//     avec le contenu du fichier : il s'exécute avant le premier affichage, sans
//     requête en plus.
//  3. LIENS DU SITE — sur GitHub Pages, le site vit dans /msdesign.be/. Vite ajoute
//     ce préfixe tout seul aux fichiers (CSS, JS, images) ; ce plugin l'ajoute aux
//     liens <a href="/…"> et <form action="/…">, que Vite ne touche pas.
//  4. POLITIQUE DE SÉCURITÉ (CSP) — calculée à la fin, avec l'empreinte SHA-256 de
//     chaque script collé (le navigateur refuse tout script en ligne qui n'est pas
//     dans la liste). Écrite dans les pages, dans _headers (Netlify, Cloudflare) et
//     dans .htaccess (Apache).
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// La politique de sécurité commune à toutes les pages du site principal.
// « HASHES » est remplacé par les empreintes des scripts collés dans la page.
// Une page peut garder sa propre politique (ex. experience/) : il suffit qu'elle
// écrive la sienne dans <meta http-equiv="Content-Security-Policy" content="…">.
// Si le content est vide (""), c'est celle-ci qui est utilisée.
const CSP = [
  "default-src 'self'",
  "script-src 'self' HASHES https://www.googletagmanager.com",           // Google Analytics, après accord
  "style-src 'self'",
  "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
  "font-src 'self'",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.workers.dev",   // formulaires (Cloudflare Workers)
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
// En plus, quand la politique est envoyée par le serveur (et pas dans la page).
const CSP_SERVEUR_EN_PLUS = "; frame-ancestors 'none'; upgrade-insecure-requests";

// Lit un fichier texte en uniformisant les fins de ligne (Windows écrit \r\n, Linux \n) :
// ainsi l'empreinte d'un script collé est la même sur ce PC et sur GitHub.
const lire = (fichier) => fs.readFileSync(fichier, 'utf8').replace(/\r\n/g, '\n');

// Empreinte SHA-256 d'un script, au format attendu par la CSP.
const empreinte = (code) => "'sha256-" + crypto.createHash('sha256').update(code, 'utf8').digest('base64') + "'";

export function msdesign() {
  let racine = process.cwd();
  let base = '/';
  let sortie = 'dist';                      // le dossier où Vite écrit le site construit
  let construction = false;                 // vrai pendant « npm run build », faux pendant « npm run dev »
  const toutesLesEmpreintes = new Set();   // pour _headers et .htaccess (valables pour tout le site)

  // Vite accepte une liste de plugins : un qui travaille AVANT Vite sur chaque page, un APRÈS.
  return [{
    name: 'msdesign:pages',

    // Vite nous donne sa configuration finale : on retient le dossier du projet, le préfixe
    // et ce qu'on est en train de faire (construire ou développer).
    configResolved(config) {
      racine = config.root;
      base = config.base;
      construction = config.command === 'build';
      sortie = path.resolve(config.root, config.build.outDir);
    },

    // Pendant « npm run dev » : si un bloc commun ou un script collé change, on recharge la page.
    configureServer(server) {
      server.watcher.add(path.join(racine, 'partials'));
      server.watcher.on('change', (fichier) => {
        const f = fichier.replace(/\\/g, '/');
        if (f.includes('/partials/') || /\/assets\/js\/(boot|journey-boot)\.js$/.test(f)) server.ws.send({ type: 'full-reload' });
      });
    },

    // Avant que Vite ne lise la page (order: 'pre') : blocs communs, scripts collés, liens.
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // 1. blocs communs
        html = html.replace(/<!--#include ([a-z-]+)-->/g, (_, nom) => lire(path.join(racine, 'partials', nom + '.html')).trimEnd());
        const page = /<html[^>]*\bdata-page="([^"]+)"/.exec(html)?.[1];
        if (page) html = html.replaceAll(`data-page-link="${page}"`, `data-page-link="${page}" aria-current="page"`);

        // 2. scripts collés
        html = html.replace(/<!--#inline ([^ ]+?)-->/g, (_, fichier) => {
          const code = lire(path.join(racine, fichier)).trim();
          if (/<\/script/i.test(code)) throw new Error(`${fichier} ne doit pas contenir « </script »`);
          return `<script>${code}</script>`;
        });

        // 3. liens du site : « /etudes/ » devient « /msdesign.be/etudes/ » (mais pas « //exemple.com »)
        html = html.replace(/(<a\b[^>]*?\shref=")\/(?!\/)/g, `$1${base}`);
        html = html.replace(/(<form\b[^>]*?\saction=")\/(?!\/)/g, `$1${base}`);
        return html;
      },
    },
  }, {
    name: 'msdesign:securite',

    // 4. après Vite (order: 'post') : la page est finie, on calcule sa politique de sécurité.
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const meta = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(">\n?)/;
        // Avec « npm run dev », Vite ajoute ses propres outils (styles d'erreur, rechargement) :
        // on enlève la CSP pour ne pas les bloquer. Elle est bien là dans la version finale.
        if (ctx.server) return html.replace(meta, '');

        // 5. ordre de chargement : Vite place son CSS et ses scripts tout en bas du <head>, donc
        // après les gros modèles 3D préchargés (plus d'1 Mo). Sur un téléphone, le CSS attendait
        // alors derrière eux. On remonte les balises de Vite juste avant le premier modèle
        // préchargé (ou avant le premier script collé) : le CSS et le code passent en premier.
        const deVite = /^[ \t]*<(?:script type="module" crossorigin src="[^"]+"><\/script>|link rel="(?:modulepreload|stylesheet)" crossorigin href="[^"]+">)\n/gm;
        const balises = html.slice(0, html.indexOf('</head>')).match(deVite) || [];
        balises.sort((a, b) => /stylesheet/.test(b) - /stylesheet/.test(a));   // le CSS d'abord
        const repere = /<link rel="preload"[^>]*\sas="fetch"|<script>/.exec(html);
        if (balises.length && repere && repere.index < html.indexOf('</head>')) {
          html = html.replace(deVite, '');
          const ici = html.search(/<link rel="preload"[^>]*\sas="fetch"|<script>/);
          html = html.slice(0, ici) + balises.map((b) => b.trimStart()).join('') + html.slice(ici);
        }

        // Les scripts écrits dans la page (pas ceux chargés avec src="…", ni les données JSON-LD).
        const empreintes = [];
        for (const [, attributs, code] of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
          if (/\ssrc=/.test(attributs || '') || /application\/ld\+json/.test(attributs || '')) continue;
          empreintes.push(empreinte(code));
        }
        empreintes.forEach((e) => toutesLesEmpreintes.add(e));

        return html.replace(meta, (tout, debut, contenu, fin) => {
          if (contenu === '') return debut + CSP.replace('HASHES', empreintes.join(' ')).replace('  ', ' ') + fin;
          if (empreintes.length === 0) return tout;
          return debut + contenu.replace(/script-src ([^;]*)/, (s, sources) => `script-src ${sources} ${empreintes.join(' ')}`) + fin;
        });
      },
    },

    // Une fois dist/ écrit : la même politique dans _headers et .htaccess (copiés depuis public/).
    closeBundle() {
      if (!construction) return;            // Vite appelle aussi cette fonction quand on arrête « npm run dev »
      const politique = CSP.replace('HASHES', [...toutesLesEmpreintes].join(' ')).replace('  ', ' ') + CSP_SERVEUR_EN_PLUS;
      const remplacer = (fichier, motif, remplacement) => {
        const f = path.join(sortie, fichier);
        if (fs.existsSync(f)) fs.writeFileSync(f, lire(f).replace(motif, remplacement));
      };
      remplacer('_headers', /^(\s*Content-Security-Policy: ).*$/m, (_, debut) => debut + politique);
      remplacer('.htaccess', /(Header always set Content-Security-Policy ")[^"]*(")/, (_, debut, fin) => debut + politique + fin);
    },
  }];
}
