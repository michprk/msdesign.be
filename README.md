# M&S Design — studio de design web à Bruxelles

Site du studio M&S Design (ouverture prévue en 2027). Maquette en ligne :
**https://michprk.github.io/msdesign.be/**. Elle n’est pas indexée tant que le studio n’est pas
ouvert.

## L’idée

Une direction artistique éditoriale, reprise de la maquette validée : crème #F5F1E9, noir doux
#171717, bleu électrique #155EEF pour les actions, vert sauge #DCE5D7 en accent.

- **Fraunces** pour les titres ;
- **Archivo** (gras, très large) pour les capitales du titre de l’accueil ;
- **Instrument Sans** pour les textes et les étiquettes (capitales espacées, en bleu) ;
- l’italique d’**Instrument Serif** pour les « ??? » du projet secret.

**Le héros** : l’étiquette « Studio web indépendant · Bruxelles », le titre « Des sites qui vous
ramènent des clients. » en bleu, comme une affiche (capitales très larges en Archivo, puis « des
clients. » en Fraunces fin), deux boutons (« Voir les
réalisations », « Demander un devis ») et trois atouts (design sur mesure, responsive, prix fixe).
À droite, trois exemples de sites en fenêtres de navigateur (Verdane, Le Fournil, Atelier Véritas),
cliquables, des feuilles, des fleurs bleues et la pastille « Design web Bruxelles ». Ensuite,
« Nos réalisations » : cinq exemples (Strate en premier), un à la fois, 01 / 05, avec flèches et « Voir le site ».

**M&S Studio** (`#le-studio`, juste après le héros, esprit « studio de mouvement ») : un extrait muet du **film M&S**
(`assets/video/reel-studio.mp4`, en boucle, chargé seulement à l’écran) ; un clic ouvre le film complet avec le son
(`assets/video/msdesign-film.mp4`, 34 s, 1080p) dans un lecteur plein écran. Le film, façon publicité Apple : un MacBook
argent sur un bureau laqué noir, on appuie sur M puis S, le logo s’illumine en bleu électrique, BAM, nos sites jaillissent
de l’écran et la caméra tourne autour ; puis les services (sans aucun prix) et la signature « Votre vision. Notre
création. ». Palette #080A0F, blanc, argent #C0C0C0, anthracite #252830, bleu #2563EB. Tout est rendu image par image et
le son est synthétisé : `_msdesign-src/film2/film2.html?render=1&w=3840&h=2160` (master 4K dans
`_msdesign-src/video/out/msdesign-film-4k.mp4`, planche d’essai `?sheet=…`). À côté, le texte dont les mots
montent un à un, le bouton pastille « Notre méthode » et, derrière, **une ficelle bleue en vraie 3D**
(`assets/js/ribbon.js`, Three.js chargé seulement à l’approche) : elle se dessine, ondule, s’écarte de la souris et
frémit au défilement, et se rembobine quand on remonte la page ; sur téléphone, sa boucle se pose à droite du bouton. Lien « Rencontrer l’équipe ». Partout : le texte des boutons et du
menu roule vers le haut au survol, la flèche ↗ sort par le coin et revient.

**Sous la surface** (`experience/`, page plein écran autonome, v31) : une expérience en 3D (`experience/dive.js`, Three.js).
**Tout ce qui vit dans l’eau est modélisé dans Blender** (connecteur MCP for Blender, `_msdesign-src/blender/lotus.blend`) : le
lotus (pétale large et creusé, bord ondulé, deux niveaux de détail, cœur avec ses 20 graines, feuille ronde nervurée) et
**trois carpes koï** (corps, yeux, barbillons, nageoires fines). Export dans un format maison (`experience/models/lotus.bin`
+ `lotus.json` : sommets entrelacés position/normale/uv, index ; repère Blender x, y, z → three.js x, z, −y ; le JSON contient
aussi le contour exact du pétale). **L’entrée, façon ORYZO (Lusion)** : dans le noir, un dessin technique du lotus vu de
dessus se trace au rythme du chargement (axes et cercles de construction, contour de chaque pétale en pointillés, poignées de
Bézier bleues, cotes et étiquettes) ; ce dessin est en vraie 3D, posé exactement sur la fleur ; les pétales se remplissent
comme une jauge, puis le dessin se remplit de réalité (dévoilement circulaire) et devient le lotus. « Entrer avec le son » :
la fleur s’ouvre, la caméra plonge dans son cœur, traverse les pétales, et l’eau apparaît autour (brouillard qui s’éclaircit,
bulles) jusqu’à la vue d’ensemble. **La tige** : chaîne physique à pas fixe (1/120 s, images interpolées), main lissée, tête
sans inertie quand on la tient, poussée de la souris sans à-coup ; mesure (`probe-v31.mjs jitter`) : tremblement moyen
0,03 px contre 0,89 px en v30. **Les jeux** : attraper la fleur, un clic dessus = elle souffle un **anneau de bulles** qui
monte crever la surface, **double-clic dans l’eau = granulés** que les carpes viennent manger, souris immobile = une carpe
curieuse s’approche, clic dans l’eau = onde (les carpes fuient), clic sur le sable = une graine pousse, geste brusque près
d’elle = elle se referme, bouton « Nuit ». Une seule astuce à la fois (en bas), elle change quand on l’a essayée. **Le son**
(`experience/dive-sound.js`, tout synthétisé, façon motion design) : souffle inversé, whoosh qui traverse les pétales,
plongeon grave, accord de cloches de verre (FM) à l’arrivée, nappe chaude et cloches rares avec écho ping-pong, gouttes et
bulles réalistes (résonance de Minnaert), saturation douce et compresseur. Fin de l’accueil : section noire « Continuez à
descendre. », compteur 000 → 100, puis une ligne de construction en pointillés traverse le noir et la page du lotus s’ouvre.
Sous l’eau, on continue à descendre (ou on maintient le cercle) : **la page Équipe** (`sessionStorage ms_from_dive`).
**v32** : le décor aussi vient de Blender (`experience/models/decor.bin` + `decor.json`) : quatre rochers « taillés » par des plans puis usés, un galet, avec l’occlusion ambiante cuite dans chaque sommet (rangée dans le canal uv avec la courbure : creux plus sombres, arêtes plus claires, mousse dessus, sable au pied) et trois sortes de touffes d’herbier (feuilles vrillées et pliées sur leur nervure). Fleur moins « néon » (bleu plus doux, moins de lueur), dessin d’entrée épuré (deux couronnes seulement), plongée en deux plans raccordés par un éclair de lumière chaude (on plonge dans le cœur doré, on ressort sous la fleur en regardant la tige, puis on recule vers la fleur), shaders du décor préparés pendant le dessin (plus de gel quand l’eau apparaît), axes pointillés affichés dès le chargement, modèles préchargés, mode allégé automatique si l’appareil peine (ombres et flou coupés), sons adoucis (cloches moins métalliques et plus rares, nappe avec chorus et souffle, bulles variées).
Tests : `_msdesign-src/probe-v31.mjs [base] [w] [h] [intro|live|jitter|all]`, `probe-dive-audio.mjs`, `probe-dive.mjs`.

**La promesse** (`#promesse`) : sur fond bleu, « En ligne en 21 jours. » et un planning en semaines façon
diagramme (Avant / Semaine 1 / 2 / 3), barres beige qui s’allongent à l’arrivée : Maquette, Conception, Mise en ligne.

**L’équipe** (`equipe.html`, page plein écran autonome) : un voyage en 3D dans un Japon d’hiver.
**Depuis la v33, les grands éléments sont modélisés dans Blender** (connecteur MCP for Blender, scripts reproductibles
`_msdesign-src/blender/jp_lib.py` + `jp_torii.py`, `jp_toro.py`, `jp_pont.py`, `jp_pagode.py`, `jp_maison.py`, `jp_rochers.py`,
tout relancer : `jp_all.py`) : le **torii** (piliers galbés et inclinés, cales, linteaux courbes biseautés, plaque dorée « M & S »,
corde de paille torsadée, papiers pliés), la **lanterne de pierre** hexagonale (kasuga-dōrō : volutes aux angles, joyau, treillis),
la **lanterne de papier** (cerceaux de bambou, anneaux laqués, gland), le **pont en arc** (84 planches, poteaux à pommeaux de
bronze, trois lisses, piles contreventées), la **pagode à cinq étages** (consoles, chevrons à bouts blancs, fenêtres à barreaux
verts, balcons, tuiles d’égout, clochettes, flèche de bronze à neuf anneaux ; un quart seulement est stocké, le site le répète
quatre fois), la **maison de thé** (toit de chaume à quatre pans, faîtage à bois croisés, glaçons, cloisons de papier à
croisillons, véranda, fenêtre ronde, bassin de pierre, bûches) et trois **rochers** taillés. Chaque modèle porte sa neige
(bourrelets irréguliers) et, par sommet, **l’occlusion ambiante cuite** (ombres de contact) et **l’exposition au ciel** (la
neige teinte seulement ce que le ciel voit : rien sous les avant-toits). Export compact `assets/models/japon.bin` + `japon.json`
(positions sur 16 bits, normales et occlusion sur 8 bits, index sur 16 bits : 1,5 Mo, ≈ 0,75 Mo compressé), lu par
`journey.js` qui range les pièces dans ses lots par matière ; si le fichier manque, l’ancien décor dessiné par le code prend
le relais (`_msdesign-src/dbg-jr-fallback.mjs`). Les lanternes de papier se balancent au vent, la flamme des lanternes de
pierre vacille. Le reste est construit dans `assets/js/journey.js` (Three.js) : neige qui tombe et pétales roses, cerisiers en
fleurs (branches générées, bouquets de fleurs en instances), pins taillés sous la neige, lanternes de pierre et de
papier allumées. Au loin, un vrai relief calculé au chargement (lancer de rayons sur un terrain, crêtes, neige selon
la pente et l’altitude, ombres du soleil, forêts en contrebas, brume selon la distance, grand mont façon Fuji) et une
forêt de 3 600 sapins enneigés dessinés branche par branche, avec des bancs de brume. On avance **sur le
côté, comme en voiture** : un cran de molette (ou flèche, glisser, clic sur la route) = un trajet avec accélération
franche, **flou de vitesse selon la profondeur** (le premier plan file, le lointain reste net), virage de la caméra, puis
arrêt net avec un petit rebond. Cinq arrêts : l’entrée sous le torii, **Mamoudou** (le grand cerisier et ses lanternes
rouges), **Michal** (la pagode, le mont derrière), **Adam** (le pont rouge sur l’étang gelé, avec un vrai reflet :
monde retourné rendu sous la glace), la maison de thé illuminée (contact). Écran d’entrée (chargement, « Entrer avec le son / sans le son »), bandes de cinéma pendant les trajets, prénom
géant en filigrane, textes qui entrent et sortent dans le sens du trajet. Rendu : halo lumineux (bloom), aberration
chromatique à la vitesse, étalonnage, paillettes sur la neige, fleurs lissées ; montagnes préparées une fois
(`equipe.html?bakepano` → `assets/img/equipe-montagnes.webp`), ombres recalculées seulement quand on avance, résolution
qui baisse toute seule si l’appareil peine. Son de motion design synthétisé (`assets/js/journey-sound.js`) : koto et
nappe très doux, vent, whoosh qui traverse l’image, impact grave à l’arrêt, « tic » par lettre, swish, survols, « Réduire les animations »
respecté (fondus au lieu des trajets). Réalisme : mise au point photographique (le premier plan est flou, le flou déborde des silhouettes), grain du bois et de la pierre calculé dans les matières, rochers et pierres de chemin arrondis, touffes d’aiguilles enneigées sur les pins, corde sacrée et papiers pliés sur le torii, pagode détaillée (panneaux de plâtre, rambardes, arêtes de toit, clochettes). Test : `_msdesign-src/probe-jr.mjs [base] [w] [h] [arrêts]` et
`probe-jr-wheel.mjs`. Lien dans le menu (« Équipe ») et le pied de page.

**Tarifs** : pas de grille affichée d’entrée (« Un prix sur mesure, fixé avant de commencer »). Une scène 3D
(`assets/js/devis3d.js`, Three.js) se lance d’elle-même quand on arrive : un site se construit en cinq étapes, synchronisées
avec la liste à gauche (votre métier, les pages, le design, les fonctions, votre devis) ; à la fin, une feuille de devis
glisse et le tampon « Prix fixe · M&S » s’y pose. On peut cliquer une étape ou « Rejouer ». Image de repli
`assets/img/devis3d-poster.webp` (outil `_msdesign-src/devis-lab.html?poster=1`). Les **repères de prix** (trois cartes
Essentiel, Signature, Premium devant la pervenche bleue en 3D, l’entretien, l’à-la-carte et les conditions) restent sur la
page, repliés derrière « Voir nos repères de prix » ; un lien vers `#a-la-carte` les ouvre tout seul. **Fin de page** : « Parlons de votre projet. » avec la photo du Mac et du carnet bleu
(`_msdesign-src/contact-photo.html`), le bloc bleu et le formulaire, le plan stylisé de Bruxelles
(outil `#map`), puis le bandeau « Prêt à démarrer ? » (`#ftrleaves`) et le pied de page.

**Exemples de sites** (`exemples/`) : cinq sites autonomes, des commerces fictifs à
Bruxelles, chacun avec un bandeau « Exemple de site fictif » et un lien de retour :

- `exemples/verdane/` : plantes d’intérieur, version catalogue (d’après la capture « Botanica » du client) : héros avec
  la photo du caoutchouc (texte effacé : `_msdesign-src/verdane-crops.html`), recherche, favoris, six fiches plantes ;
- `exemples/le-fournil/` : boulangerie au levain (serif gras, terracotta) ;
- `exemples/atelier-veritas/` : bureau d’architecture (serif fin, grandes photos) ;
- `exemples/studio-bascule/` : studio de graphisme (lettres larges bleues, fond sable) ;
- `exemples/strate/` : **exemple Premium**, paysagiste. Écran d’entrée (avec ou sans son), puis une
  vraie photo en plein écran (« Autumn Joy », Memotions, CC BY 2.0, créditée en pied de page) ; derrière,
  un jardin bruxellois en 3D temps réel (Three.js, `js/garden.js`) ; un cran de molette = un chapitre :
  on descend sous la pelouse (coupe du sol, racines qui poussent), l’eau s’infiltre jusqu’à la nappe,
  puis les étages du jardin s’écartent. Ensuite trois plans au trait, les prix en diagramme de semaines,
  le calendrier des saisons (aiguille sur la date du jour). Page `contact.html` d’après la maquette du
  client : un plan se dessine au crayon et ses lignes deviennent celles du formulaire, puis une pousse
  à l’envoi (photo de cour « courtyard », Serge Melki, CC BY 2.0). Page `saisons.html` : un lieu réel,
  l’étang du Bois de la Cambre, aux quatre saisons (photos Wikimedia Commons, CC BY / CC BY-SA, créditées),
  balayage doux d’une saison à l’autre, un cran de molette par saison, curseur, clavier, glisser ;
  en dessous, les gestes de chaque saison. Page `jardins.html` : quatre vrais jardins publics de Bruxelles
  présentés comme « jardins qui nous inspirent » (Van Buuren, abbaye de la Cambre, Jardin botanique, parc
  Josaphat ; photos Wikimedia créditées) : photos presque plein écran, commune au survol, au clic la photo
  s’ouvre en grand avec un cadre de repérage et la fiche du lieu.
  Sources et outils dans `_msdesign-src/strate/` : `build.mjs` (assemble `index.html` depuis
  `index.src.html` et dessine les plans et le calendrier), `shoot.mjs` (captures figées `?qa=0..3`,
  `&at=section`, `&plan=uccle`, `&gate=1`, `&menu=1`), `export.mjs` (copie autonome publiée dans le
  dépôt [michprk/strate](https://github.com/michprk/strate)). Polices Gloock, Hanken Grotesk, DM Mono (OFL).

Dans le héros, les trois fenêtres sont des images fixes (ni lien, ni mouvement au survol), à la demande du client.
Les quatre premiers partagent une feuille de style (`exemples/exemples.css`), sans JavaScript. Les captures des fenêtres
sont faites par `_msdesign-src/cap-ex.sh <slug>` (1440 × 936) puis rognées par l’outil `#exshots`.
Les photos (plantes, pain, maison, escalier) viennent de captures de sites envoyées par le client
(outil `#excrops`) : **à remplacer par nos propres photos avant l’ouverture**. La photo du contact
(Mac et carnet bleu) est refaite en 3D d’après sa maquette (`_msdesign-src/contact-photo2.html`).

## Pensé pour la conversion

- Un bouton principal, **Demander un devis**, partout : en-tête, héros, tarifs, études de cas,
  pied de page et **barre d’action mobile** (appeler + devis).
- **Promesse de délai** : en ligne 21 jours après la maquette validée, ou 10 % remboursés par
  semaine de retard. Elle est détaillée dans `cgu.html#delais`.
- **Exemples de sites** : une page de liste (`etudes/`) et quatre sites à ouvrir.
- **Tarifs fixes** : 500 €, 1 290 € et 3 900 € HTVA ; entretien 30 €/mois (Essentiel, Signature) ou 60 €/mois (Premium, le design d’exception pour architectes, paysagistes…) ; séance photo sur place 40 €.
- **À la carte** (`#a-la-carte`), sans site complet : audit SEO 150 €, SEO local 490 €, suivi SEO 120 €/mois ;
  une automatisation 290 €, pack de quatre 790 €, suivi 30 €/mois ; identité visuelle 490 €, textes
  90 €/page, séance photo 40 €.
- **FAQ** de 5 questions, avec liens internes vers la promesse, les tarifs, les conditions et
  les études.
- **Liens internes** partout : services vers études de cas et tarifs, FAQ, études entre elles,
  pied de page en plan du site.
- **Formulaire** (comme la maquette du client) : nom, e-mail, téléphone, type de projet, formules en
  cartes à cocher, message, pièce jointe facultative. Sans API, le nom du fichier est écrit dans
  l’e-mail prérempli (à joindre à la main) ; l’envoi de la pièce jointe par l’API reste à brancher.
- **Page de remerciement** (`merci.html`) après l’envoi du formulaire.
  - Elle reprend le prénom de la personne (stockage de session, jamais dans l’adresse).
  - Elle annonce les étapes suivantes et propose les exemples de sites.

## Le projet Premium

**Notre prochain site**, en formule **Premium à 3 900 €** : gardé secret. Sa carte montre une
capture floutée, trois points d’interrogation, un reflet qui passe et l’étiquette
« En cours de conception ». Le clic ouvre le formulaire avec la formule Premium choisie
(outil `#mystery`).

## Fichiers

```
index.html                héros (3 projets en fenêtres), réalisations, promesse, services, méthode, tarifs, FAQ, contact
etudes/                   la liste des exemples de sites (et le projet Premium)
exemples/                 quatre exemples de sites fictifs, autonomes
merci.html                page de remerciement après le formulaire
cgu.html                  mentions légales, conditions d’utilisation et de prestation (dont la promesse de délai)
confidentialite.html      RGPD + cookies
404.html                  page introuvable, qui propose la bonne section
partials/                 blocs communs (head, en-tête, pied de page, cookies, icônes)
assets/js/amp.js          le « & » du logo, vectorisé
assets/js/app.js          héros, voile de transition, formulaire, merci, cookies, FAQ, barre mobile, 404
assets/js/ribbon.js       la ficelle bleue en 3D de la section « Le studio »
assets/js/devis3d.js      la scène 3D « Un prix sur mesure » de la section Tarifs
assets/js/journey.js      le voyage 3D de la page Équipe (Japon d’hiver)
equipe.html               l’équipe (Michal, Mamoudou, Adam)
experience/               « Sous la surface », la plongée 3D et sa fleur (page autonome)
assets/video/             le film M&S (msdesign-film.mp4) et son extrait en boucle (reel-studio.mp4)
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
- nos propres photos pour les exemples de sites, et le site Premium une fois prêt ;
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
