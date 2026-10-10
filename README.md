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
« Nos réalisations » : quatre exemples, un à la fois, 01 / 04, avec flèches et « Voir le site ».

**Tarifs** : trois cartes en verre dépoli (Essentiel, Signature « Recommandé », Premium), prix en
italique bleu, devant une grande pervenche bleue modélisée en 3D (`_msdesign-src/flower-lab.html`,
`flower.js`). **Fin de page** : « Parlons de votre projet. » avec la photo du Mac et du carnet bleu
(`_msdesign-src/contact-photo.html`), le bloc bleu et le formulaire, le plan stylisé de Bruxelles
(outil `#map`), puis le bandeau « Prêt à démarrer ? » (`#ftrleaves`) et le pied de page.

**Exemples de sites** (`exemples/`) : quatre petits sites autonomes, des commerces fictifs à
Bruxelles, chacun avec un bandeau « Exemple de site fictif » et un lien de retour :

- `exemples/verdane/` : boutique de plantes (crème, vert sapin, terracotta) ;
- `exemples/le-fournil/` : boulangerie au levain (serif gras, terracotta) ;
- `exemples/atelier-veritas/` : bureau d’architecture (serif fin, grandes photos) ;
- `exemples/studio-bascule/` : studio de graphisme (lettres larges bleues, fond sable).

Une seule feuille de style (`exemples/exemples.css`), pas de JavaScript. Les captures des fenêtres
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
- **FAQ** de 5 questions, avec liens internes vers la promesse, les tarifs, les conditions et
  les études.
- **Liens internes** partout : services vers études de cas et tarifs, FAQ, études entre elles,
  pied de page en plan du site.
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
