// =============================================================================
// Une suite d'images (un « film » image par image) chargée intelligemment :
// d'abord 1 image sur 8 (on peut déjà tout parcourir), puis 1 sur 4, 1 sur 2,
// puis toutes. Tant qu'une image manque, on affiche la plus proche déjà chargée.
// =============================================================================

export class Sequence {
  /** urls : la liste des adresses, dans l'ordre du film. pas : 2 = une image sur deux (appareils modestes). */
  constructor(urls, pas = 1) {
    this.urls = urls;
    this.pas = pas;
    this.images = new Array(urls.length).fill(null);
    this.total = Math.ceil(urls.length / pas);
    this.charges = 0;                 // images tentées (réussies ou non)
    this.ok = 0;                      // images réellement chargées
    this.arrete = false;
  }

  /** L'ordre de chargement : grossier d'abord, puis de plus en plus fin. */
  ordre() {
    const vu = new Set(), liste = [];
    for (const etape of [8, 4, 2, 1]) {
      const e = Math.max(etape, this.pas);
      for (let i = 0; i < this.urls.length; i += e) if (!vu.has(i)) { vu.add(i); liste.push(i); }
    }
    if (!vu.has(this.urls.length - 1)) liste.push(this.urls.length - 1);   // la dernière image compte toujours
    return liste;
  }

  /** Charge tout. onProgres(part chargée de 0 à 1). Résout quand la première passe (1 sur 8) est prête. */
  charger(onProgres = () => {}) {
    const ordre = this.ordre();
    const premiere = ordre.filter((i) => i % 8 === 0 || i === this.urls.length - 1).length;
    let pret, suivant = 0, enCours = 0;
    const premierePasse = new Promise((r) => { pret = r; });
    const lancer = () => {
      while (enCours < 6 && suivant < ordre.length && !this.arrete) {
        const i = ordre[suivant++]; enCours++;
        const img = new Image();
        img.decoding = 'async';
        img.src = this.urls[i];
        img.decode().then(() => { this.images[i] = img; this.ok++; }, () => {}).finally(() => {
          enCours--; this.charges++;
          onProgres(Math.min(1, this.charges / premiere), this.charges / ordre.length);
          if (this.charges >= premiere) pret();
          lancer();
        });
      }
    };
    lancer();
    return premierePasse;
  }

  /** L'image chargée la plus proche de l'indice i (cherche des deux côtés). */
  proche(i) {
    i = Math.max(0, Math.min(this.urls.length - 1, Math.round(i)));
    for (let d = 0; d < this.urls.length; d++) {
      if (this.images[i - d]) return this.images[i - d];
      if (this.images[i + d]) return this.images[i + d];
    }
    return null;
  }

  /** Les deux images qui encadrent la position (fractionnaire) i, et le mélange entre elles. */
  encadre(i) {
    const n = this.urls.length - 1;
    i = Math.max(0, Math.min(n, i));
    let a = Math.floor(i), b = Math.min(n, a + 1);
    while (a > 0 && !this.images[a]) a--;
    while (b < n && !this.images[b]) b++;
    const A = this.images[a] || this.proche(i), B = this.images[b] || A;
    const t = b > a ? (i - a) / (b - a) : 0;
    return [A, B, Math.max(0, Math.min(1, t))];
  }
}
