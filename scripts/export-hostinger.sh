#!/usr/bin/env bash
# ==========================================================================
# Prépare la version « nom de domaine » du site, prête à téléverser chez
# Hostinger (ou tout hébergeur Apache / LiteSpeed avec PHP).
#
#   bash scripts/export-hostinger.sh                 # pour https://www.msdesign.be
#   bash scripts/export-hostinger.sh autre.be        # pour un autre domaine
#
# Résultat : dist-hostinger/msdesign-hostinger.zip, à extraire dans public_html.
# Vite construit le site pour la racine du domaine (base « / » au lieu de
# « /msdesign.be/ ») : il écrit lui-même les bonnes adresses des fichiers et des liens.
# Ce que le script change en plus par rapport à la version GitHub Pages :
#   - https://michprk.github.io/msdesign.be → https://domaine (et /msdesign.be/ dans public/)
#   - le site devient visible sur Google (plus de « noindex », sauf la page 404)
#   - les mentions « maquette de démonstration » disparaissent
#   - les formulaires envoient les demandes à api/contact.php (e-mail côté serveur)
# ==========================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
DOMAIN="${1:-www.msdesign.be}"
OUT="dist-hostinger/public_html"
ZIP="dist-hostinger/msdesign-hostinger.zip"

# 1. construire le site pour la racine du domaine
rm -rf dist-hostinger
# (MSYS_NO_PATHCONV : sous Windows, Git Bash transformerait sinon « / » en « C:/Program Files/Git/ »)
MSYS_NO_PATHCONV=1 npx vite build --base=/ --outDir "$OUT" --emptyOutDir --logLevel warn
# 2. la réception du formulaire (PHP), qui n’existe pas sur GitHub Pages
mkdir -p "$OUT/api"
cp api/contact.php api/.htaccess "$OUT/api/"

# 3. adresses du domaine, site visible sur Google, plus de mentions de démonstration
export DOMAIN
find "$OUT" -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' -o -name '*.webmanifest' -o -name '*.js' -o -name '*.css' \) -print0 |
  xargs -0 perl -0pi -e '
    s{https://michprk\.github.io/msdesign.be}{__SITE__}g;
    s{/msdesign.be/}{/}g;
    s{__SITE__}{https://$ENV{DOMAIN}}g;
    s{\n<!-- Maquette de démonstration[^\n]*-->}{}g;
    s{\n<meta name="robots" content="noindex, nofollow">}{}g unless $ARGV =~ m{404\.html$};
    s{data-api=""}{data-api="/api"}g;
    s{\s*<p class="note">Maquette de démonstration.*?</p>}{}gs;
    s{\s*<p class="demo-note">.*?</p>}{}gs;
    s{GitHub Pages — GitHub, Inc\., 88 Colin P\. Kelly Jr\. Street, San Francisco, CA 94107, États-Unis \(phase de démonstration\)\.}{Hostinger International Ltd., 61 Lordou Vironos Street, 6023 Larnaca, Chypre.}g;
    s{GitHub Pages pendant la phase de démonstration, puis l’hébergeur du nom de domaine}{Hostinger International Ltd., Chypre}g;
  '

# Contrôles : plus aucune trace de l’adresse GitHub ni du mode démonstration
# (la page 404 garde volontairement son « noindex »)
if grep -rIl -e "michprk" -e "Maquette de démonstration" "$OUT" ||
   grep -rIlP "(?<![/.a-z])/msdesign.be/" "$OUT" ||
   grep -rIl --exclude=404.html "noindex" "$OUT" ; then
  echo "✗ Il reste des adresses GitHub ou des mentions de démonstration (fichiers ci-dessus)." >&2
  exit 1
fi
TODO=$(grep -rIo "à compléter\|à confirmer" "$OUT" --include=*.html | wc -l)
[ "$TODO" -gt 0 ] && echo "⚠ $TODO mention(s) « à compléter » restent dans les pages légales (conception du site…)."

# Archive .zip (fichiers directement à la racine, fichiers cachés compris)
WIN_OUT=$(cygpath -w "$PWD/$OUT" 2>/dev/null || echo "$OUT")
WIN_ZIP=$(cygpath -w "$PWD/$ZIP" 2>/dev/null || echo "$ZIP")
powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('$WIN_OUT', '$WIN_ZIP')"

echo "Prêt : $ZIP ($(du -h "$ZIP" | cut -f1)) pour https://$DOMAIN"
echo "À extraire dans le dossier public_html de l’hébergement."
