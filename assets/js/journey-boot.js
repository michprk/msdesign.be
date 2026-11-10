/* M&S Design — équipe : si l’on arrive de « Sous la surface », pas d’écran d’entrée
   (la classe est posée avant le premier affichage, pour qu’il n’apparaisse pas une fraction de seconde). */
try {
  if (sessionStorage.getItem('ms_from_dive') !== null && !/[?&]at=/.test(location.search)) document.documentElement.classList.add('jr-from-dive');
} catch (e) { /* stockage indisponible : l’écran d’entrée s’affiche normalement */ }
