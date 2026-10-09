# M&S Design — agence de design web à Bruxelles

Site de l’agence M&S Design (ouverture prévue en 2027). Maquette en ligne :
**https://michprk.github.io/msdesign.be/** (non indexée tant que l’agence n’est pas ouverte).

## L’idée

**Le héros** : comme une photo de produit prise dans l’atelier. Un MacBook argent est posé sur une
table en chêne, devant une verrière floue ouverte sur un jardin, avec un nuancier, une tasse et un
carnet. Le décor est **entièrement modélisé et peint dans le code** (Three.js, aucune photo ni
fichier 3D) :

- coque en aluminium microbillé avec de vrais reflets ;
- clavier **AZERTY belge** rétroéclairé, où la touche **« & »**, notre logo, brille en olive ;
- pavé tactile, grilles des haut-parleurs, ports, charnière, dalle à encoche ;
- **&** poli miroir sur le capot.

1. À l’arrivée, le capot se soulève : un doigt l’entrouvre, puis il s’ouvre en douceur.
2. L’écran s’allume (& blanc, barre de progression), puis le bureau apparaît, et Safari s’ouvre
   sur msdesign.be.
3. Le curseur du Mac montre les onglets tout seul.
4. Ensuite, **la souris du visiteur devient le curseur du Mac**. Survoler un onglet (Services,
   Réalisations, Méthode, Tarifs, Contact) ou une icône du Dock affiche l’aperçu de cette partie
   du site sur l’écran. **Un clic fait plonger la caméra dans l’écran**, et le vrai site prend le
   relais à la bonne section.
5. Au doigt ou au clavier, une barre d’onglets en bas du héros fait la même chose.

- Pendant la visite, l’ouverture ne se rejoue pas. « Revoir l’ouverture du Mac » est dans le pied
  de page.
- `?intro=1` force l’ouverture et `?intro=0` la saute.
- Sans WebGL, ou avec les animations réduites, une image fixe du Mac ouvert prend le relais
  (`assets/img/mac-poster-*.webp`).

## Pensé pour la conversion (B2B)

- Promesse en 3 secondes : « Des sites qui vous ramènent *des clients.* ».
- Un seul bouton principal, **Demander un devis**, partout : en-tête, héros, tarifs, pied de page,
  barre mobile.
- Réassurance immédiate : réponse sous 24 h, prix fixe, en ligne en 3 semaines. Puis les
  engagements : propriété du site, interlocuteur unique, RGPD inclus, retouches comprises.
- **Tarifs transparents** : Essentiel 500 €, Signature 750 € (recommandée), Premium 2 200 € HTVA,
  et Entretien & hébergement 15 €/mois.
- Formulaire de devis avec **acompte et solde calculés en direct** selon la formule choisie.
- **Réalisations** : cinq concepts réels (Rose Noire, Hani Kanaftchian, Studio 124, Greentage,
  Poppymood), cliquables, chacun marqué « Concept 2026 ».

## Direction artistique

| Rôle | Couleur |
|---|---|
| Écru | `#f4f0e6` |
| Papier | `#fbf9f3` |
| Sable | `#e9e3d4` |
| Encre | `#1d1f17` |
| Olive (texte) | `#5c6a35` |
| Olive profond (boutons, sections sombres) | `#2e3a20` |
| Sauge (accent sur fond sombre) | `#c9d09c` |

Typographies :

- **Instrument Sans** pour les titres et le texte ;
- **Instrument Serif** en italique pour les accents et le « & » ;
- **Inria Serif** pour les petites étiquettes.

Le style s’inspire de la référence fournie (Seed) : produit posé sur une table près d’une fenêtre,
titre sobre à gauche, bouton vert profond.

## Fichiers

```
index.html            accueil (héros MacBook + toutes les sections)
cgu.html              mentions légales, conditions d’utilisation et de prestation
confidentialite.html  RGPD + cookies
404.html              « Cette page s’est égarée » (boîte de dialogue façon macOS), retrouve la bonne section
partials/             blocs communs (head, en-tête, pied de page, cookies, icônes)
assets/js/mac3d.js    le MacBook, la table, les objets, la lumière, l’ouverture et la plongée
assets/js/screen.js   l’écran du Mac : démarrage, bureau, Safari à onglets, Dock (canvas 2D)
assets/js/scenery.js  le studio flou et le chêne (utilisé par l’outil d’images, pas en ligne)
assets/js/hero3d.js   charge la 3D seulement si possible (sinon image fixe)
assets/js/app.js      héros, voile de transition, formulaire, cookies, compteurs, FAQ, 404…
assets/js/sound.js    souffle et accord synthétisés (Web Audio), très discrets
assets/js/boot.js     script en ligne du <head> (HTTPS, préférences, ouverture)
api/                  réception du formulaire : contact.php (Hostinger) ou Cloudflare Worker
scripts/              build.sh, check-links.sh, export-hostinger.sh
```

Les images (studio flou, chêne, captures des projets, icônes, `og.jpg`, image fixe du Mac) sont
produites par `../_msdesign-src/assets-tool.html`. Lancez le serveur `_msdesign-src/serve.ps1`, puis
ouvrez `http://localhost:8105/_msdesign-src/assets-tool.html#room,wood,shots,icons,poster,og`.

## Après chaque modification

```bash
bash scripts/build.sh        # blocs communs, empreinte CSP, versions ?v=
bash scripts/check-links.sh  # aucun lien ni fichier cassé (--web pour les liens externes)
```

## Mise en ligne sur le domaine

```bash
bash scripts/export-hostinger.sh   # → dist/msdesign-hostinger.zip, à extraire dans public_html
```

Le zip :

- retire le « noindex » et la mention « maquette de démonstration » ;
- branche le formulaire sur `api/contact.php` ;
- active les redirections courantes (`/tarifs`, `/contact`…).

**À compléter avant l’ouverture** (signalé en jaune dans les pages légales) :

- forme juridique, adresse du siège, numéro BCE, régime TVA ;
- accord des commerces pour montrer leurs concepts dans les réalisations ;
- identifiant Google Analytics (`data-ga`), si souhaité.

## Checklist en place

- **HTTPS forcé** : script de tête, `.htaccess` et HSTS. Politique de sécurité stricte (CSP sans
  `unsafe-inline`), anti-iframe, `security.txt`.
- **Bandeau cookies** conforme : refuser aussi simple qu’accepter, préférences modifiables,
  choix redemandé après 6 mois. Il n’apparaît qu’au premier défilement, pour ne pas gâcher
  l’ouverture. Google Analytics 4 n’est chargé qu’après accord.
- **SEO** :
  - balises title et description ;
  - données structurées (ProfessionalService, offres, FAQ) ;
  - Open Graph et `og.jpg` 1200×630 ;
  - `sitemap.xml` avec images, `robots.txt`, balise canonical.
- **Icônes** : favicon SVG (le & vectorisé), ICO et PNG, icône iOS, icônes Android (dont
  « maskable »), manifeste.
- **Images** : WebP compressées, `srcset`, chargement différé, dimensions fixées, textes
  alternatifs descriptifs.
- **Vitesse** : polices et scripts hébergés sur le site. Three.js n’est chargé qu’avec WebGL. La
  3D ne se dessine que lorsque quelque chose bouge, et plus du tout hors de l’écran.
- **Contraste & accessibilité** :
  - textes AA, focus visibles, lien d’évitement ;
  - onglets du Mac utilisables au clavier ;
  - bouton « Réduire les animations », lien « Couper le son ».
- **Formulaire validé** dans le navigateur et sur le serveur.
  - Anti-spam : champ piège, délai minimal, 1 envoi par minute, 5 demandes par 10 min et par IP
    côté serveur.
  - Correction des fautes de frappe dans les e-mails.
  - Sans API, un e-mail prérempli prend le relais.
- **Page 404 personnalisée**, avec suggestions de section et redirections.
- **Responsive** : téléphone, tablette, ordinateur (le Mac se place dans l’espace libre à côté du
  texte).
