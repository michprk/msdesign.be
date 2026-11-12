/* M&S Design — « Sous la surface » : avant le premier affichage.
   Si l’on arrive du bas de l’accueil (chargement terminé), pas d’écran d’entrée : tout reste noir jusqu’au passage « espace-temps ». */
try { if (sessionStorage.getItem('ms_to_dive') === '1') document.documentElement.classList.add('dv-from-home'); } catch (e) { /* rien */ }
