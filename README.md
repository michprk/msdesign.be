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

**Sous la surface** (`experience/`, page plein écran autonome) : une plongée en 3D (`experience/dive.js`, Three.js, aucun
modèle ni image). Écran d’entrée « Plonger avec le son / sans le son » ; on arrive juste sous la surface (gouttes qui
tombent, ronds vus d’en dessous, nénuphars), on descend, et au fond une **fleur de lotus bleue** s’ouvre : 34 pétales
modélisés un à un (creux, veines, lumière qui les traverse), étamines, tige, rosette de feuilles. Sa tige est une chaîne
physique : on **attrape la fleur** et on la tire jusqu’au sable, on la pousse en approchant la souris, un clic dans
l’eau envoie une onde, un clic sur la fleur la fait « respirer » ; l’eau la freine et elle revient toujours. Autour :
sable ridé, caustiques, rayons de lumière, herbiers qui suivent le courant, rochers, bulles, particules, profondeur de
champ. Son synthétisé (`experience/dive-sound.js`) : gouttes, plongeon, bulles, grondement de l’eau, nappe douce.
Enchaînement façon Lusion : tout en bas de l’accueil, une section plein écran montre la fleur en vidéo
(`assets/video/plongee.mp4`, 10 s en boucle, enregistrée par `experience/?rec=1`) ; on continue à descendre (une dizaine
de crans), un cercle se remplit, et on plonge. Sous l’eau, on continue encore à descendre (ou on maintient le cercle,
sur téléphone) : on remonte vers la lumière et **la page Équipe** s’ouvre directement, sans écran d’entrée
(`sessionStorage ms_from_dive`, `assets/js/journey-boot.js`). Liens : sous la vidéo de « M&S Studio », menu, pied de
page. Tests : `_msdesign-src/probe-dive.mjs [base] [w] [h] [gate|live|all]`, `probe-dive-audio.mjs`, `probe-next.mjs`.

**La promesse** (`#promesse`) : sur fond bleu, « En ligne en 21 jours. » et un planning en semaines façon
diagramme (Avant / Semaine 1 / 2 / 3), barres beige qui s’allongent à l’arrivée : Maquette, Conception, Mise en ligne.

**L’équipe** (`equipe.html`, page plein écran autonome) : un voyage en 3D dans un Japon d’hiver, entièrement
modélisé dans `assets/js/journey.js` (Three.js, aucun modèle ni image) : neige qui tombe et pétales roses, cerisiers en
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
