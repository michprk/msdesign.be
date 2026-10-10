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
- un fond crème, des titres en Fraunces, des étiquettes en JetBrains Mono, le bleu électrique pour les actions.

**Le héros**, direction artistique éditoriale (crème #F5F1E9, noir doux #171717, bleu électrique
#155EEF, vert sauge #DCE5D7) : une étiquette en JetBrains Mono, le titre en Fraunces sur trois
lignes (« Votre prochain site. Une vraie présence. Un design qui marque. », la dernière en bleu),
deux boutons bleus, et à droite trois projets en fenêtres de navigateur (Greentage, Le Fournil,
Atelier Véritas) avec une pastille « Design web Bruxelles ». Dessous, la bande des expertises,
puis « Du beau. Du clair. Du pensé. » : un projet à la fois, 01 / 03, avec flèches.
Le Fournil et Atelier Véritas sont des projets conceptuels dessinés au trait (outil `#concepts`).

**Projets.** Une rangée de cartes (une barre de titre blanche, puis l’image) qui défile au doigt
ou se fait glisser à la souris : Greentage (projet conceptuel), le projet Premium flouté, et
« Votre projet ». Les titres de section sont en deux tons, l’étiquette à gauche.

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
