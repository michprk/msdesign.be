// =============================================================================
// Vérifie la version construite du site (dist/) : aucun lien ne doit mener à une
// page, une image, une police ou un script absent, et chaque ancre (#contact)
// doit exister dans la page visée.
//   npm run check                          → construit le site puis vérifie
//   node scripts/check-links.mjs           → vérifie dist/ tel qu'il est
//   node scripts/check-links.mjs --web     → vérifie aussi les liens externes (connexion requise)
// Les réseaux sociaux bloquent souvent les robots : ils sont signalés à part.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const BASE = '/msdesign.be/';                       // même préfixe que « base » dans vite.config.js
const SITE = 'https://michprk.github.io' + BASE;    // adresse publique du site
const WEB = process.argv.includes('--web');

if (!fs.existsSync(DIST)) { console.error('dist/ introuvable : lancez d’abord « npm run build ».'); process.exit(1); }

let erreurs = 0;
const externes = new Map();                          // lien externe → première page qui le cite
const erreur = (page, url, raison) => { console.log(`  ✗ ${page} → ${url} (${raison})`); erreurs++; };

// Toutes les pages HTML de dist/ (chemins avec des « / », même sous Windows).
const pages = fs.globSync('**/*.html', { cwd: DIST }).map((f) => f.replace(/\\/g, '/'));

// Adresse (« /msdesign.be/etudes/ ») → fichier dans dist/ (« etudes/index.html »).
function fichierDe(chemin) {
  let f = decodeURIComponent(chemin.slice(BASE.length));
  if (f === '' || f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(path.join(DIST, f)) && !path.extname(f) && fs.existsSync(path.join(DIST, f + '.html'))) f += '.html';
  return f;
}

// Les ancres (id="…") de chaque page, lues une seule fois.
const ancres = new Map();
const idsDe = (f) => {
  if (!ancres.has(f)) ancres.set(f, new Set([...fs.readFileSync(path.join(DIST, f), 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return ancres.get(f);
};

function verifier(page, brut) {
  const url = brut.replace(/&amp;/g, '&').trim();
  if (!url || /^(mailto:|tel:|data:|blob:|javascript:)/.test(url)) return;
  if (/^https?:\/\//.test(url) && !url.startsWith(SITE)) { if (!externes.has(url)) externes.set(url, page); return; }

  // Adresse complète du lien, comme le navigateur la calcule depuis la page.
  const depuis = new URL(BASE + page, 'https://site.test');
  const cible = new URL(url.startsWith(SITE) ? url.slice(SITE.length - BASE.length) : url, depuis);
  if (!cible.pathname.startsWith(BASE)) { erreur(page, url, `l’adresse doit commencer par ${BASE}`); return; }

  const fichier = fichierDe(cible.pathname);
  if (!fs.existsSync(path.join(DIST, fichier))) { erreur(page, url, `fichier introuvable : ${fichier}`); return; }
  const ancre = decodeURIComponent(cible.hash.slice(1));
  if (ancre && fichier.endsWith('.html') && !idsDe(fichier).has(ancre)) erreur(page, url, `ancre #${ancre} absente de ${fichier}`);
}

for (const page of pages) {
  const html = fs.readFileSync(path.join(DIST, page), 'utf8');
  for (const [, url] of html.matchAll(/\s(?:href|src|poster|action|data-full)="([^"]+)"/g)) verifier(page, url);
  for (const [, liste] of html.matchAll(/\s(?:srcset|imagesrcset)="([^"]+)"/g)) liste.split(',').forEach((x) => verifier(page, x.trim().split(/\s+/)[0]));
}

// Les fichiers cités dans le CSS (polices, images de fond).
for (const css of fs.globSync('assets/*.css', { cwd: DIST }).map((f) => f.replace(/\\/g, '/'))) {
  // (on enlève d'abord les images « data: » écrites dans le CSS : elles contiennent leurs propres url(#…))
  const texte = fs.readFileSync(path.join(DIST, css), 'utf8').replace(/"data:[^"]*"|'data:[^']*'/g, '""');
  for (const [, url] of texte.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) verifier(css, url);
}

// Les pages et images citées dans le plan du site.
if (fs.existsSync(path.join(DIST, 'sitemap.xml'))) {
  for (const [, url] of fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8').matchAll(/<(?:image:)?loc>([^<]+)</g)) verifier('sitemap.xml', url);
}

if (WEB) {
  console.log('Liens externes :');
  for (const [url, page] of externes) {
    let code = 0;
    try { code = (await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (link check)' } })).status; } catch { /* hors ligne ou refusé */ }
    if (code >= 200 && code < 400) console.log(`  ✓ ${code} ${url}`);
    else if (/instagram|facebook|wa\.me|google\.com\/maps|googletagmanager|linkedin/.test(url)) console.log(`  ~ ${code} ${url} (bloque les robots, à vérifier à la main)`);
    else erreur(page, url, `réponse ${code}`);
  }
}

console.log(`${pages.length} pages vérifiées.`);
if (erreurs) { console.log(`${erreurs} lien(s) à réparer.`); process.exit(1); }
console.log('Aucun lien cassé.');
