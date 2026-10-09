# M&S Design — studio de design web à Bruxelles

Site du studio M&S Design (ouverture prévue en 2027). Maquette en ligne :
**https://michprk.github.io/msdesign.be/**. Elle n’est pas indexée tant que le studio n’est pas
ouvert.

## L’idée

Une page produit à la manière d’Apple, chic et aérée :

- **Instrument Sans** pour les titres et les textes ;
- **Inria Serif** pour les petites phrases : étiquettes, sous-titres, légendes, notes ;
- l’italique d’**Instrument Serif** pour l’accent du héros (« des clients. ») ;
- beaucoup d’air, des sections centrées, des tuiles douces ;
- une palette olive, écru et encre.

**Le héros.** La promesse est à gauche : « Des sites qui vous ramènent des clients. ». À droite,
un MacBook argent est posé sur une table en chêne, devant une photo floutée de studio (peinte
dans le code par `assets/js/scenery.js`). Le décor est **modélisé dans le code** (Three.js,
aucune photo, aucun fichier 3D) :

- aluminium avec de vrais reflets ;
- clavier AZERTY belge rétroéclairé, avec la touche « & », notre logo, en olive ;
- « & » poli sur le capot.

Le déroulé :

1. On commence sur le Mac : fermé, centré, tout près. Le capot s’ouvre, l’écran s’allume (& puis
   bureau), Safari affiche le site, et le portable glisse à droite pendant que la promesse arrive.
2. **Le site s’ouvre depuis le Mac.** Le premier geste vers le bas (molette, doigt, ↓, Espace)
   fait plonger la caméra dans l’écran ; l’écran montre la vraie première section, recopiée du
   DOM à la taille de la fenêtre (`snapshot()` dans `screen.js`), si bien qu’à la fin de la
   plongée la page et l’écran coïncident et le site prend le relais sans rien qui saute.
3. En remontant au début du site, on rentre dans le Mac : la caméra part de la page plein écran
   et recule jusqu’au portable.
4. Le curseur du Mac montre les onglets ; ensuite la souris du visiteur devient le curseur.
   Survoler un onglet ou une icône du Dock affiche l’aperçu, un clic plonge vers cette partie.
5. Au doigt ou au clavier, une barre d’onglets fait la même chose.

Réalisme : éclairage de studio (fenêtre, boîte à lumière, bandeaux au plafond) pour les reflets
de l’aluminium microbillé, ombres douces de fenêtre, liseré d’ombre au contact de la table, reflet
sur le verre de l’écran, tasse en grès émaillé moucheté (paroi épaisse, pied brut, anse aplatie,
café). Outils : `../_msdesign-src/render.html` (vues rapprochées), `qa-flow.html` (plongée et
retour), `qa-go.html` (onglets).

Paramètres d’adresse : `?intro=1` rejoue l’ouverture, `?intro=0` la saute.

## Pensé pour la conversion

- Un bouton principal, **Demander un devis**, partout : en-tête, héros, tarifs, études de cas,
  pied de page et **barre d’action mobile** (appeler + devis).
- **Promesse de délai** : en ligne 21 jours après la maquette validée, ou 10 % remboursés par
  semaine de retard. Elle est détaillée dans `cgu.html#delais`.
- **Études de cas** : une page de liste et l’étude Greentage, avec fil d’Ariane, faits clés,
  point de départ, réalisation, captures, état du projet, étude suivante et appel à l’action.
- **Tarifs fixes** : 500 €, 750 € et 2 200 € HTVA, plus l’entretien à 15 €/mois.
- **FAQ** de 5 questions, avec liens internes vers la promesse, les tarifs, les conditions et
  les études.
- **Liens internes** partout : services vers études de cas et tarifs, FAQ, études entre elles,
  pied de page en plan du site.
- **Page de remerciement** (`merci.html`) après l’envoi du formulaire.
  - Elle reprend le prénom de la personne (stockage de session, jamais dans l’adresse).
  - Elle annonce les étapes suivantes et propose les études de cas.

## Les études de cas

Deux sites, deux formules :

- **Greentage** (`etudes/greentage.html`), plantes, fleurs et vintage rue du Noyer : la
  maquette proposée au commerce, en formule **Signature à 750 €**. Captures du vrai site de
  démonstration (`michprk.github.io/greentage.be`), photos de son Instagram.
- **Notre prochain site**, en formule **Premium à 2 200 €** : gardé secret. Sa carte montre une
  capture floutée, trois points d’interrogation, un reflet qui passe et l’étiquette
  « En cours de conception ». Le clic ouvre le formulaire avec la formule Premium choisie.

Les images sont produites par l’outil `../_msdesign-src/assets-tool.html` :

- `#greentage` : les captures de Greentage en WebP ;
- `#mystery` : la page Premium dessinée puis floutée ;
- `#devices,poster,og` : le MacBook qui affiche Greentage, l’image de repli du héros et l’image
  de partage.

**Avant l’ouverture** : obtenir l’accord de Greentage pour la montrer publiquement.

## Fichiers

```
index.html                héros MacBook, promesse, études de cas, services, méthode, tarifs, FAQ, contact
etudes/                   études de cas : index.html + une page par client
merci.html                page de remerciement après le formulaire
cgu.html                  mentions légales, conditions d’utilisation et de prestation (dont la promesse de délai)
confidentialite.html      RGPD + cookies
404.html                  page introuvable, qui propose la bonne section
partials/                 blocs communs (head, en-tête, pied de page, cookies, icônes)
assets/js/mac3d.js        le MacBook, la table, la lumière, l’ouverture et la plongée dans l’écran
assets/js/screen.js       l’écran du Mac : démarrage, bureau, Safari à onglets, Dock
assets/js/amp.js          le « & » du logo, vectorisé
assets/js/app.js          héros, voile de transition, formulaire, merci, cookies, FAQ, barre mobile, 404
assets/js/hero3d.js       charge la 3D seulement si possible (sinon image fixe)
api/                      réception du formulaire : contact.php (Hostinger) ou Cloudflare Worker
scripts/                  build.sh, check-links.sh, export-hostinger.sh
```

## Après chaque modification

```bash
bash scripts/build.sh        # blocs communs, empreinte CSP, versions ?v=
bash scripts/check-links.sh  # aucun lien ni fichier cassé (--web pour les liens externes)
```

## Mise en ligne sur le domaine

```bash
bash scripts/export-hostinger.sh   # → dist/msdesign-hostinger.zip, à extraire dans public_html
```

**À compléter avant l’ouverture** (en jaune dans les pages légales) :

- forme juridique, adresse du siège, numéro BCE, régime TVA ;
- accord de Greentage pour son étude de cas, et le site Premium une fois prêt ;
- identifiant Google Analytics (`data-ga`), si souhaité.

## Checklist en place

- **HTTPS et sécurité** : HTTPS forcé, HSTS, politique de sécurité stricte (CSP sans
  `unsafe-inline`), `security.txt`.
- **Cookies** : bandeau conforme, qui n’apparaît qu’au premier défilement. Refuser est aussi
  simple qu’accepter. Google Analytics n’est chargé qu’après accord.
- **SEO** :
  - title et description sur chaque page ;
  - données structurées (ProfessionalService, offres, FAQ, Article, BreadcrumbList) ;
  - Open Graph et `og.jpg` ;
  - `sitemap.xml` avec images, `robots.txt`, canonical.
- **Icônes** : favicon SVG, ICO et PNG, icônes iOS et Android, manifeste.
- **Images** : WebP compressées, `srcset`, chargement différé, textes alternatifs descriptifs.
- **Vitesse** : polices et scripts hébergés sur le site. La 3D ne se dessine que lorsque quelque
  chose bouge.
- **Accessibilité** : contrastes AA, focus visibles, onglets du Mac utilisables au clavier,
  « Réduire les animations », « Couper le son ».
- **Formulaire** : validé dans le navigateur et sur le serveur, anti-spam, correction des fautes
  de frappe dans les e-mails, puis page de remerciement.
- **Navigation** : fil d’Ariane sur toutes les pages intérieures, page 404 personnalisée,
  responsive du téléphone au grand écran.
