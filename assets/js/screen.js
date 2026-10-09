/* ==========================================================================
   M&S Design — l’écran du MacBook (dessiné en 2D dans un canvas)
   Démarrage (logo & + barre de progression), bureau aux collines olive,
   barre des menus avec l’encoche, fenêtre Safari à onglets — un onglet par
   partie du site, dont l’aperçu s’affiche au survol — et un Dock dont chaque
   icône ouvre aussi une partie du site.
   Le module ne fait que dessiner et dire « qu’y a-t-il sous ce point » :
   la 3D (mac3d.js) s’occupe du reste.
   ========================================================================== */

export const CW = 2048;
export const CH = 1330;

export const TABS = [
  { title: 'M&S Design', target: 'manifeste' },
  { title: 'Services', target: 'services' },
  { title: 'Réalisations', target: 'realisations' },
  { title: 'Méthode', target: 'methode' },
  { title: 'Tarifs', target: 'tarifs' },
  { title: 'Contact', target: 'contact' }
];

export const DOCK = [
  { icon: 'folder', label: 'Réalisations', tab: 2 },
  { icon: 'brand', label: 'M&S Design', tab: 0 },
  { icon: 'notes', label: 'Services', tab: 1 },
  { icon: 'calendar', label: 'Méthode', tab: 3 },
  { icon: 'calc', label: 'Tarifs', tab: 4 },
  { icon: 'bubble', label: 'Questions', target: 'faq' },
  { icon: 'mail', label: 'Contact', tab: 5 }
];

const MENU_H = 44;
const NOTCH_W = 200;
export const WIN = { x: 92, y: 72, w: 1864, h: 1102, r: 22 };
const TOOL_H = 70;
const TABS_H = 52;
export const CONTENT = { x: WIN.x, y: WIN.y + TOOL_H + TABS_H, w: WIN.w, h: WIN.h - TOOL_H - TABS_H };
const ICON = 92, GAP = 16, DOCK_PAD = 14;
const DOCK_W = DOCK.length * ICON + (DOCK.length - 1) * GAP + DOCK_PAD * 2;
const DOCK_X = (CW - DOCK_W) / 2;
const DOCK_Y = 1190;
const PAGE_W = 1440;               // l’aperçu imite la page affichée à 1440 px de large
const K = CONTENT.w / PAGE_W;

const C = {
  ecru: '#f4f0e6', paper: '#fbf9f3', sand: '#e9e3d4', line: 'rgba(29,31,23,.12)',
  ink: '#1d1f17', mute: '#5d6052', olive: '#5c6a35', oliveDeep: '#2e3a20', oliveMid: '#46542b',
  sage: '#c9d09c', clay: '#b4683f'
};
const SANS = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';
const LABEL = '"Inria Serif", Georgia, serif';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function rr(x, X, Y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  x.beginPath();
  x.moveTo(X + rad, Y);
  x.arcTo(X + w, Y, X + w, Y + h, rad);
  x.arcTo(X + w, Y + h, X, Y + h, rad);
  x.arcTo(X, Y + h, X, Y, rad);
  x.arcTo(X, Y, X + w, Y, rad);
  x.closePath();
}
function spacing(x, v) { if ('letterSpacing' in x) x.letterSpacing = v; }

// Texte riche : les passages entre *astérisques* passent en italique Instrument Serif, couleur d’accent
function rich(x, str, X, Y, size, color, accent, weight) {
  const parts = str.split('*');
  let cx = X;
  parts.forEach((p, i) => {
    if (!p) return;
    if (i % 2) {
      x.font = 'italic ' + Math.round(size * 1.1) + 'px ' + SERIF;
      x.fillStyle = accent;
      spacing(x, '0px');
    } else {
      x.font = (weight || 500) + ' ' + size + 'px ' + SANS;
      x.fillStyle = color;
      spacing(x, (-size * 0.035).toFixed(1) + 'px');
    }
    x.fillText(p, cx, Y);
    cx += x.measureText(p).width;
  });
  spacing(x, '0px');
  return cx;
}
function text(x, str, X, Y, font, color, ls) {
  x.font = font;
  x.fillStyle = color;
  spacing(x, ls || '0px');
  x.fillText(str, X, Y);
  spacing(x, '0px');
}
// Paragraphe sur plusieurs lignes (retour à la ligne automatique)
function para(x, str, X, Y, maxW, lh, font, color) {
  x.font = font;
  x.fillStyle = color;
  const words = str.split(' ');
  let line = '', y = Y;
  words.forEach((w) => {
    const test = line ? line + ' ' + w : w;
    if (x.measureText(test).width > maxW && line) { x.fillText(line, X, y); line = w; y += lh; }
    else line = test;
  });
  if (line) x.fillText(line, X, y);
  return y;
}
function cover(x, img, X, Y, w, h, r, focusY) {
  x.save();
  rr(x, X, Y, w, h, r);
  x.clip();
  if (img) {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    x.drawImage(img, X + (w - iw) / 2, Y + (h - ih) * (focusY == null ? 0 : focusY), iw, ih);
  } else {
    x.fillStyle = C.sand;
    x.fillRect(X, Y, w, h);
  }
  x.restore();
}
function pill(x, X, Y, w, h, bg, fg, label, size) {
  rr(x, X, Y, w, h, h / 2);
  x.fillStyle = bg;
  x.fill();
  x.font = '600 ' + size + 'px ' + SANS;
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.fillText(label, X + w / 2, Y + h / 2 + size * 0.36);
  x.textAlign = 'left';
}
function ampersand(x, X, Y, size, color) {
  x.font = 'italic ' + size + 'px ' + SERIF;
  x.fillStyle = color;
  x.textAlign = 'center';
  x.fillText('&', X, Y);
  x.textAlign = 'left';
}

/* ---------- Fond d’écran : collines olive dans une brume chaude ---------- */
function wallpaper() {
  const w = CW / 2, h = CH / 2;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#efe8d6');
  g.addColorStop(0.5, '#e4dcc2');
  g.addColorStop(1, '#cdc59f');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  g = x.createRadialGradient(w * 0.7, h * 0.26, 0, w * 0.7, h * 0.26, h * 0.7);
  g.addColorStop(0, 'rgba(255,250,236,.95)');
  g.addColorStop(1, 'rgba(255,250,236,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  const hill = (y0, amp, f, ph, top, bottom) => {
    x.beginPath();
    x.moveTo(0, h);
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const y = y0 + amp * (Math.sin(u * Math.PI * 2 * f + ph) * 0.62 + Math.sin(u * Math.PI * 2 * f * 2.3 + ph * 1.7) * 0.38);
      x.lineTo(u * w, y * h);
    }
    x.lineTo(w, h);
    x.closePath();
    const gg = x.createLinearGradient(0, (y0 - amp) * h, 0, h);
    gg.addColorStop(0, top);
    gg.addColorStop(1, bottom);
    x.fillStyle = gg;
    x.fill();
  };
  hill(0.5, 0.05, 0.8, 0.6, '#cfcca7', '#b8b78c');
  hill(0.6, 0.06, 1.1, 2.1, '#aeb27c', '#8f9660');
  hill(0.7, 0.05, 0.9, 4.2, '#818a50', '#626c3a');
  hill(0.8, 0.045, 1.3, 1.1, '#56612f', '#3e4725');
  hill(0.9, 0.03, 0.7, 3.3, '#3a4322', '#2b321b');
  const out = canvas(CW, CH);
  const o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  o.drawImage(c, 0, 0, CW, CH);
  return out;
}

/* ---------- Icônes du Dock ---------- */
function squircle(x, X, Y, s, fill) {
  rr(x, X, Y, s, s, s * 0.225);
  x.fillStyle = fill;
  x.fill();
}
function grad(x, X, Y, s, a, b) {
  const g = x.createLinearGradient(X, Y, X, Y + s);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}
function drawIcon(x, kind, X, Y, s) {
  x.save();
  x.shadowColor = 'rgba(0,0,0,.28)';
  x.shadowBlur = s * 0.08;
  x.shadowOffsetY = s * 0.03;
  const base = {
    folder: grad(x, X, Y, s, '#f6f2e8', '#e2dccb'),
    brand: grad(x, X, Y, s, '#6d7c3f', '#2f3a20'),
    notes: '#fbfaf6',
    calendar: '#fbfaf6',
    calc: grad(x, X, Y, s, '#3a3a3a', '#1b1b1b'),
    bubble: grad(x, X, Y, s, '#8fd47a', '#3fae4a'),
    mail: grad(x, X, Y, s, '#7fc1ff', '#2a7de8')
  }[kind];
  squircle(x, X, Y, s, base);
  x.restore();
  x.save();
  rr(x, X, Y, s, s, s * 0.225);
  x.clip();
  const u = s / 100;
  if (kind === 'folder') {
    x.fillStyle = '#7f8d48';
    rr(x, X + 16 * u, Y + 26 * u, 30 * u, 14 * u, 4 * u); x.fill();
    x.fillStyle = grad(x, X, Y + 30 * u, 50 * u, '#a6b46a', '#7f8d48');
    rr(x, X + 16 * u, Y + 32 * u, 68 * u, 46 * u, 6 * u); x.fill();
    x.fillStyle = 'rgba(255,255,255,.22)';
    x.fillRect(X + 16 * u, Y + 40 * u, 68 * u, 2 * u);
  } else if (kind === 'brand') {
    ampersand(x, X + s / 2, Y + 76 * u, 82 * u, '#f4f0e6');
  } else if (kind === 'notes') {
    x.fillStyle = grad(x, X, Y, 28 * u, '#f8d877', '#efc24c');
    x.fillRect(X, Y, s, 26 * u);
    x.strokeStyle = 'rgba(0,0,0,.14)';
    x.lineWidth = 2 * u;
    for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(X + 14 * u, Y + (40 + i * 12) * u); x.lineTo(X + 86 * u, Y + (40 + i * 12) * u); x.stroke(); }
  } else if (kind === 'calendar') {
    const now = new Date();
    const months = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];
    x.textAlign = 'center';
    x.font = '600 ' + Math.round(17 * u) + 'px ' + SANS;
    x.fillStyle = '#e5483d';
    x.fillText(months[now.getMonth()], X + s / 2, Y + 27 * u);
    x.font = '400 ' + Math.round(58 * u) + 'px ' + SANS;
    x.fillStyle = '#222';
    x.fillText(String(now.getDate()), X + s / 2, Y + 82 * u);
    x.textAlign = 'left';
  } else if (kind === 'calc') {
    const cols = ['#5d5d5d', '#5d5d5d', '#5d5d5d', '#f39b2f'];
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
      x.fillStyle = r === 0 && q < 3 ? '#a5a5a5' : cols[q];
      x.beginPath(); x.arc(X + (23 + q * 18) * u, Y + (28 + r * 16) * u, 6.5 * u, 0, Math.PI * 2); x.fill();
    }
    x.font = '600 ' + Math.round(13 * u) + 'px ' + SANS;
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.fillText('€', X + 77 * u, Y + 76.5 * u);
    x.textAlign = 'left';
  } else if (kind === 'bubble') {
    x.fillStyle = '#fff';
    x.beginPath(); x.ellipse(X + 50 * u, Y + 48 * u, 32 * u, 27 * u, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(X + 28 * u, Y + 64 * u); x.lineTo(X + 22 * u, Y + 80 * u); x.lineTo(X + 42 * u, Y + 72 * u); x.fill();
    x.font = '700 ' + Math.round(34 * u) + 'px ' + SANS;
    x.fillStyle = '#3fae4a';
    x.textAlign = 'center';
    x.fillText('?', X + 50 * u, Y + 60 * u);
    x.textAlign = 'left';
  } else if (kind === 'mail') {
    x.fillStyle = '#fff';
    rr(x, X + 18 * u, Y + 30 * u, 64 * u, 42 * u, 5 * u); x.fill();
    x.strokeStyle = '#4f97ef';
    x.lineWidth = 3 * u;
    x.beginPath(); x.moveTo(X + 20 * u, Y + 33 * u); x.lineTo(X + 50 * u, Y + 55 * u); x.lineTo(X + 80 * u, Y + 33 * u); x.stroke();
  }
  // reflet doux du haut
  const sh = x.createLinearGradient(X, Y, X, Y + s);
  sh.addColorStop(0, 'rgba(255,255,255,.18)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  x.fillStyle = sh;
  x.fillRect(X, Y, s, s);
  x.restore();
}

/* ---------- Aperçus des parties du site (coordonnées « page » 1440 px) ---------- */
function miniHeader(x, dark) {
  x.fillStyle = dark ? 'rgba(244,240,230,.97)' : 'rgba(244,240,230,.97)';
  x.fillRect(0, 0, PAGE_W, 76);
  x.fillStyle = C.line;
  x.fillRect(0, 75, PAGE_W, 1);
  text(x, 'M', 56, 49, '600 25px ' + SANS, C.ink, '-0.5px');
  ampersand(x, 87, 50, 30, C.olive);
  text(x, 'S', 99, 49, '600 25px ' + SANS, C.ink);
  text(x, 'Design', 124, 49, '400 21px ' + SANS, C.mute);
  ['Services', 'Réalisations', 'Méthode', 'Tarifs', 'FAQ'].forEach((l, i) => text(x, l, 470 + i * 118, 46, '500 16px ' + SANS, C.ink));
  text(x, '+32 486 61 11 59', 1050, 46, '500 15px ' + SANS, C.ink);
  pill(x, 1206, 19, 186, 40, C.oliveDeep, C.ecru, 'Demander un devis', 15);
}
function eyebrow(x, str, X, Y, color) {
  x.fillStyle = color;
  x.fillRect(X, Y - 5, 26, 1.5);
  text(x, str.toUpperCase(), X + 38, Y, '13px ' + LABEL, color, '2.5px');
}

function pageAccueil(x, img) {
  const g = x.createLinearGradient(0, 0, PAGE_W, 760);
  g.addColorStop(0, '#f6f2e8');
  g.addColorStop(1, '#e8e2cf');
  x.fillStyle = g;
  x.fillRect(0, 0, PAGE_W, 760);
  eyebrow(x, 'Agence de design web · Bruxelles', 56, 170, C.olive);
  rich(x, 'Des sites qui', 56, 262, 76, C.ink, C.olive);
  rich(x, 'vous ramènent', 56, 344, 76, C.ink, C.olive);
  rich(x, 'des *clients.*', 56, 426, 76, C.ink, C.olive);
  para(x, 'Des sites sur mesure, rapides et pensés pour transformer chaque visite en demande de devis.', 56, 492, 520, 30, '400 19px ' + SANS, C.mute);
  pill(x, 56, 568, 250, 58, C.oliveDeep, C.ecru, 'Demander un devis gratuit', 17);
  text(x, 'Voir nos réalisations  →', 336, 604, '600 17px ' + SANS, C.ink);
  text(x, '✓ Réponse sous 24 h    ✓ Prix fixe    ✓ En ligne en 3 semaines', 56, 676, '14px ' + LABEL, C.mute);
  // pile de projets
  const cards = [[img.kanaftchian, 820, 190, -5], [img.studio124, 960, 250, 4], [img.rosenoire, 870, 330, -1.5]];
  cards.forEach(([im, X, Y, deg]) => {
    x.save();
    x.translate(X + 240, Y + 150);
    x.rotate(deg * Math.PI / 180);
    x.shadowColor = 'rgba(40,40,20,.28)';
    x.shadowBlur = 40;
    x.shadowOffsetY = 18;
    rr(x, -240, -150, 480, 300, 14);
    x.fillStyle = '#fff';
    x.fill();
    x.shadowColor = 'transparent';
    cover(x, im, -240, -150, 480, 300, 14);
    x.restore();
  });
}
function pageServices(x) {
  x.fillStyle = C.ecru;
  x.fillRect(0, 0, PAGE_W, 760);
  eyebrow(x, 'Services', 56, 160, C.olive);
  rich(x, 'Tout ce qu’il faut', 56, 238, 64, C.ink, C.olive);
  rich(x, 'pour être *choisi.*', 56, 308, 64, C.ink, C.olive);
  para(x, 'Un seul partenaire pour votre image en ligne : on dessine, on développe, on met en ligne et on entretient.', 860, 222, 500, 30, '400 19px ' + SANS, C.mute);
  const items = [
    ['Site vitrine sur mesure', 'Design unique, animations soignées, pensé mobile d’abord.'],
    ['Identité visuelle', 'Logo, couleurs, typographies : une marque cohérente partout.'],
    ['Référencement local', 'Être trouvé à Bruxelles : SEO, fiche Google, vitesse.'],
    ['Entretien & hébergement', 'Sécurité, sauvegardes et petites modifications chaque mois.']
  ];
  items.forEach(([t, d], i) => {
    const X = 56 + i * 337, Y = 372;
    rr(x, X, Y, 321, 316, 22);
    x.fillStyle = C.paper;
    x.fill();
    x.strokeStyle = C.line;
    x.lineWidth = 1;
    x.stroke();
    x.beginPath();
    x.arc(X + 50, Y + 56, 24, 0, Math.PI * 2);
    x.fillStyle = i === 0 ? C.oliveDeep : '#e4e3cf';
    x.fill();
    text(x, '0' + (i + 1), X + 38, Y + 62, '600 16px ' + SANS, i === 0 ? C.ecru : C.olive);
    text(x, t, X + 26, Y + 132, '600 22px ' + SANS, C.ink, '-0.4px');
    para(x, d, X + 26, Y + 172, 268, 26, '400 16px ' + SANS, C.mute);
    text(x, 'En savoir plus  →', X + 26, Y + 282, '600 15px ' + SANS, C.olive);
  });
}
function pageRealisations(x, img) {
  x.fillStyle = C.sand;
  x.fillRect(0, 0, PAGE_W, 760);
  eyebrow(x, 'Réalisations', 56, 160, C.olive);
  rich(x, 'Des sites qui', 56, 238, 64, C.ink, C.olive);
  rich(x, '*travaillent.*', 56, 308, 64, C.ink, C.olive);
  para(x, 'Chaque site est dessiné et codé à la main, sans modèle, pour un commerce bien réel.', 860, 222, 500, 30, '400 19px ' + SANS, C.mute);
  const list = [[img.rosenoire, 'Rose Noire', 'Fleuriste · Ixelles'], [img.kanaftchian, 'Hani Kanaftchian', 'Photographe · Uccle'], [img.studio124, 'Studio 124', 'Studio photo · Schaerbeek']];
  list.forEach(([im, t, s], i) => {
    const X = 56 + i * 449, Y = 372;
    x.save();
    x.shadowColor = 'rgba(40,40,20,.18)';
    x.shadowBlur = 30;
    x.shadowOffsetY = 12;
    rr(x, X, Y, 425, 266, 16);
    x.fillStyle = '#fff';
    x.fill();
    x.restore();
    cover(x, im, X, Y, 425, 266, 16);
    text(x, t, X + 4, Y + 312, '600 21px ' + SANS, C.ink, '-0.3px');
    text(x, s, X + 4, Y + 342, '14px ' + LABEL, C.mute);
  });
}
function pageMethode(x) {
  x.fillStyle = C.oliveDeep;
  x.fillRect(0, 0, PAGE_W, 760);
  eyebrow(x, 'Méthode', 56, 160, C.sage);
  rich(x, '4 étapes.', 56, 238, 64, C.ecru, C.sage);
  rich(x, '*3 semaines.*', 56, 308, 64, C.ecru, C.sage);
  para(x, 'Un parcours simple, des délais tenus et un seul interlocuteur du premier appel à la mise en ligne.', 860, 222, 500, 30, '400 19px ' + SANS, 'rgba(244,240,230,.72)');
  x.fillStyle = 'rgba(244,240,230,.22)';
  x.fillRect(56, 444, 1328, 1.5);
  const steps = [['Appel découverte', '30 min, gratuit'], ['Maquette & prix fixe', 'sous 5 jours'], ['Conception', '2 semaines'], ['Mise en ligne', 'et suivi']];
  steps.forEach(([t, d], i) => {
    const X = 56 + i * 340;
    x.beginPath();
    x.arc(X + 10, 445, 10, 0, Math.PI * 2);
    x.fillStyle = i === 0 ? C.sage : C.oliveDeep;
    x.fill();
    x.strokeStyle = C.sage;
    x.lineWidth = 2;
    x.stroke();
    text(x, '0' + (i + 1), X, 540, 'italic 64px ' + SERIF, C.sage);
    text(x, t, X, 604, '600 23px ' + SANS, C.ecru, '-0.4px');
    text(x, d, X, 640, '15px ' + LABEL, 'rgba(244,240,230,.7)');
  });
}
function pageTarifs(x) {
  x.fillStyle = C.ecru;
  x.fillRect(0, 0, PAGE_W, 760);
  eyebrow(x, 'Tarifs', 56, 160, C.olive);
  rich(x, 'Des prix *clairs,*', 56, 238, 64, C.ink, C.olive);
  rich(x, 'sans surprise.', 56, 308, 64, C.ink, C.olive);
  para(x, 'Un prix fixe, annoncé avant de commencer. Acompte de 50 %, le solde à la mise en ligne.', 860, 222, 500, 30, '400 19px ' + SANS, C.mute);
  const plans = [['Essentiel', '500 €', 'Une présence pro, vite.'], ['Signature', '750 €', 'Le site qui vous démarque.'], ['Premium', '2 200 €', 'Multilingue, boutique, marque.']];
  plans.forEach(([t, p, d], i) => {
    const X = 56 + i * 449, Y = 360, hi = i === 1;
    rr(x, X, Y, 425, 360, 24);
    x.fillStyle = hi ? C.oliveDeep : C.paper;
    x.fill();
    if (!hi) { x.strokeStyle = C.line; x.lineWidth = 1; x.stroke(); }
    const fg = hi ? C.ecru : C.ink;
    text(x, t, X + 34, Y + 62, '600 22px ' + SANS, fg);
    if (hi) pill(x, X + 270, Y + 34, 124, 34, C.sage, C.oliveDeep, 'Recommandé', 13);
    text(x, p, X + 34, Y + 150, '500 60px ' + SANS, fg, '-2px');
    text(x, 'HTVA', X + 40 + x.measureText(p).width, Y + 150, '14px ' + LABEL, hi ? 'rgba(244,240,230,.7)' : C.mute);
    text(x, d, X + 34, Y + 196, '400 17px ' + SANS, hi ? 'rgba(244,240,230,.78)' : C.mute);
    x.fillStyle = hi ? 'rgba(244,240,230,.18)' : C.line;
    x.fillRect(X + 34, Y + 228, 357, 1);
    pill(x, X + 34, Y + 268, 357, 54, hi ? C.ecru : C.oliveDeep, hi ? C.oliveDeep : C.ecru, 'Choisir ' + t, 16);
  });
}
function pageContact(x) {
  x.fillStyle = C.oliveMid;
  x.fillRect(0, 0, PAGE_W, 760);
  eyebrow(x, 'Contact', 56, 160, C.sage);
  rich(x, 'Parlons de', 56, 238, 64, C.ecru, C.sage);
  rich(x, '*votre projet.*', 56, 308, 64, C.ecru, C.sage);
  para(x, 'Un appel de 30 minutes, gratuit et sans engagement. Réponse sous 24 h ouvrées.', 56, 372, 520, 30, '400 19px ' + SANS, 'rgba(244,240,230,.78)');
  [['Téléphone', '+32 486 61 11 59'], ['E-mail', 'mck.honorable@gmail.com'], ['Où', 'Bruxelles · chez vous ou en visio']].forEach(([l, v], i) => {
    text(x, l.toUpperCase(), 56, 480 + i * 74, '12px ' + LABEL, C.sage, '2px');
    text(x, v, 56, 510 + i * 74, '500 21px ' + SANS, C.ecru);
  });
  rr(x, 760, 150, 624, 580, 26);
  x.fillStyle = C.paper;
  x.fill();
  text(x, 'Votre projet', 800, 208, '600 22px ' + SANS, C.ink);
  ['Site vitrine', 'Refonte', 'Identité', 'SEO'].forEach((l, i) => {
    const w = [128, 104, 102, 70][i], X = 800 + [0, 140, 256, 370][i];
    rr(x, X, 232, w, 40, 20);
    x.fillStyle = i === 0 ? C.oliveDeep : 'transparent';
    x.fill();
    x.strokeStyle = i === 0 ? C.oliveDeep : 'rgba(29,31,23,.25)';
    x.stroke();
    text(x, l, X + 18, 258, '500 15px ' + SANS, i === 0 ? C.ecru : C.ink);
  });
  [['Nom', 296], ['E-mail', 386], ['Message', 476]].forEach(([l, Y]) => {
    text(x, l, 800, Y, '500 14px ' + SANS, C.mute);
    rr(x, 800, Y + 12, 544, l === 'Message' ? 110 : 52, 12);
    x.fillStyle = '#fff';
    x.fill();
    x.strokeStyle = 'rgba(29,31,23,.16)';
    x.stroke();
  });
  pill(x, 800, 626, 544, 58, C.oliveDeep, C.ecru, 'Envoyer ma demande  →', 17);
}

/* ==========================================================================
   L’écran
   ========================================================================== */
export function createScreen(images, scale) {
  const img = images || {};
  const S = scale || 1;            // définition réelle du canvas (plus légère sur mobile), coordonnées inchangées
  const c = canvas(Math.round(CW * S), Math.round(CH * S));
  const x = c.getContext('2d');
  const wall = wallpaper();
  const page = canvas(Math.round(CONTENT.w * S), Math.round(CONTENT.h * S));
  const px = page.getContext('2d');
  let pageTab = -1;

  const state = {
    phase: 'off',     // off → boot → desktop
    boot: 0,          // 0..1 : apparition du logo puis progression
    desk: 0,          // 0..1 : fondu du bureau
    win: 0,           // 0..1 : ouverture de la fenêtre Safari
    tab: 0,
    hoverTab: -1,
    hoverDock: -1
  };

  // zones cliquables (coordonnées du canvas)
  const tabW = (WIN.w - 16) / TABS.length;
  const tabRects = TABS.map((t, i) => ({ x: WIN.x + 8 + i * tabW, y: WIN.y + TOOL_H, w: tabW, h: TABS_H }));
  const dockRects = DOCK.map((d, i) => ({ x: DOCK_X + DOCK_PAD + i * (ICON + GAP), y: DOCK_Y + DOCK_PAD, w: ICON, h: ICON }));

  function renderPage(tab) {
    px.setTransform(1, 0, 0, 1, 0, 0);
    px.clearRect(0, 0, page.width, page.height);
    px.setTransform(K * S, 0, 0, K * S, 0, 0);
    [pageAccueil, pageServices, pageRealisations, pageMethode, pageTarifs, pageContact][tab](px, img);
    miniHeader(px);
    pageTab = tab;
  }

  function menuBar() {
    x.fillStyle = 'rgba(246,242,232,.62)';
    x.fillRect(0, 0, CW, MENU_H);
    ampersand(x, 40, 32, 30, '#1b1b1b');
    text(x, 'Safari', 76, 30, '700 19px ' + SANS, '#1b1b1b');
    let mx = 158;
    ['Fichier', 'Édition', 'Présentation', 'Historique', 'Signets', 'Fenêtre', 'Aide'].forEach((m) => {
      text(x, m, mx, 30, '500 19px ' + SANS, '#1b1b1b');
      mx += x.measureText(m).width + 30;
    });
    const now = new Date();
    const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    x.font = '500 19px ' + SANS;
    x.textAlign = 'right';
    x.fillStyle = '#1b1b1b';
    x.fillText(days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()] + '  ' + hh, CW - 30, 30);
    x.textAlign = 'left';
    // icônes d’état : batterie, wi-fi, centre de contrôle
    const bx = CW - 330;
    rr(x, bx, 16, 34, 16, 4); x.strokeStyle = '#1b1b1b'; x.lineWidth = 1.6; x.stroke();
    x.fillStyle = '#1b1b1b'; rr(x, bx + 3, 19, 24, 10, 2); x.fill();
    x.fillRect(bx + 35, 21, 2.5, 6);
    x.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
      x.beginPath(); x.arc(CW - 372, 32, 5 + i * 5.5, Math.PI * 1.25, Math.PI * 1.75); x.stroke();
    }
    x.beginPath(); x.arc(CW - 372, 31, 1.8, 0, Math.PI * 2); x.fill();
    rr(x, CW - 425, 15, 26, 9, 4.5); x.stroke();
    rr(x, CW - 425, 26, 26, 9, 4.5); x.stroke();
    // encoche de la caméra
    x.fillStyle = '#000';
    rr(x, (CW - NOTCH_W) / 2, -20, NOTCH_W, MENU_H + 20, 16);
    x.fill();
    x.fillStyle = '#0d1016';
    x.beginPath(); x.arc(CW / 2, 20, 6, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(80,110,160,.45)';
    x.beginPath(); x.arc(CW / 2 - 1.5, 18.5, 2, 0, Math.PI * 2); x.fill();
  }

  function safari() {
    const { x: X, y: Y, w, h, r } = WIN;
    // ombre portée
    x.save();
    x.shadowColor = 'rgba(20,22,10,.38)';
    x.shadowBlur = 70;
    x.shadowOffsetY = 26;
    rr(x, X, Y, w, h, r);
    x.fillStyle = '#efece5';
    x.fill();
    x.restore();
    x.save();
    rr(x, X, Y, w, h, r);
    x.clip();
    // barre d’outils
    x.fillStyle = '#f2efe8';
    x.fillRect(X, Y, w, TOOL_H);
    [['#ff5f57', '#e0443e'], ['#febc2e', '#dea123'], ['#28c840', '#1aab29']].forEach(([f, s], i) => {
      x.beginPath(); x.arc(X + 32 + i * 28, Y + 35, 8.5, 0, Math.PI * 2);
      x.fillStyle = f; x.fill(); x.strokeStyle = s; x.lineWidth = 1; x.stroke();
    });
    x.strokeStyle = '#6d6b66';
    x.lineWidth = 2.6;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    rr(x, X + 130, Y + 24, 30, 23, 5); x.stroke();
    x.beginPath(); x.moveTo(X + 141, Y + 25); x.lineTo(X + 141, Y + 46); x.stroke();
    x.beginPath(); x.moveTo(X + 200, Y + 26); x.lineTo(X + 190, Y + 35); x.lineTo(X + 200, Y + 44); x.stroke();
    x.strokeStyle = '#b6b3ad';
    x.beginPath(); x.moveTo(X + 228, Y + 26); x.lineTo(X + 238, Y + 35); x.lineTo(X + 228, Y + 44); x.stroke();
    // barre d’adresse
    const aw = 620, ax = X + (w - aw) / 2;
    rr(x, ax, Y + 15, aw, 40, 11);
    x.fillStyle = '#e3e0d8';
    x.fill();
    x.font = '500 20px ' + SANS;
    const label = 'msdesign.be';
    const lw = x.measureText(label).width;
    const lx = ax + (aw - lw) / 2 + 12;
    x.fillStyle = '#3a3a37';
    x.fillText(label, lx, Y + 42);
    x.strokeStyle = '#6d6b66';
    x.lineWidth = 2;
    rr(x, lx - 30, Y + 31, 15, 12, 2.5); x.fillStyle = '#6d6b66'; x.fill();
    x.beginPath(); x.arc(lx - 22.5, Y + 31, 5, Math.PI, 0); x.stroke();
    // icônes de droite : partager, nouvel onglet, aperçu des onglets
    x.strokeStyle = '#6d6b66';
    x.lineWidth = 2.6;
    const rx = X + w - 160;
    x.beginPath(); x.moveTo(rx, Y + 26); x.lineTo(rx, Y + 44); x.moveTo(rx - 7, Y + 32); x.lineTo(rx, Y + 25); x.lineTo(rx + 7, Y + 32); x.stroke();
    x.beginPath(); x.moveTo(rx + 52, Y + 35); x.lineTo(rx + 72, Y + 35); x.moveTo(rx + 62, Y + 25); x.lineTo(rx + 62, Y + 45); x.stroke();
    rr(x, rx + 104, Y + 25, 18, 16, 3); x.stroke();
    rr(x, rx + 110, Y + 30, 18, 16, 3); x.stroke();
    // onglets
    x.fillStyle = '#e4e1d9';
    x.fillRect(X, Y + TOOL_H, w, TABS_H);
    x.fillStyle = 'rgba(0,0,0,.08)';
    x.fillRect(X, Y + TOOL_H, w, 1);
    const active = state.tab;
    tabRects.forEach((t, i) => {
      const on = i === active;
      const hov = i === state.hoverTab && !on;
      if (on || hov) {
        rr(x, t.x + 3, t.y + 7, t.w - 6, t.h - 13, 9);
        x.fillStyle = on ? '#fbfaf6' : 'rgba(255,255,255,.45)';
        x.fill();
        if (on) { x.strokeStyle = 'rgba(0,0,0,.06)'; x.lineWidth = 1; x.stroke(); }
      } else if (i > 0 && i - 1 !== active && i !== state.hoverTab + 1) {
        x.fillStyle = 'rgba(0,0,0,.14)';
        x.fillRect(t.x, t.y + 16, 1.5, t.h - 30);
      }
      // favicon & titre
      const title = TABS[i].title;
      x.font = (on ? '600 ' : '500 ') + '19px ' + SANS;
      const tw = x.measureText(title).width;
      const cx = t.x + (t.w - tw - 34) / 2;
      rr(x, cx, t.y + 15, 22, 22, 6);
      x.fillStyle = C.oliveDeep;
      x.fill();
      ampersand(x, cx + 11, t.y + 33, 20, C.ecru);
      x.font = (on ? '600 ' : '500 ') + '19px ' + SANS;
      x.fillStyle = on ? '#1b1b1b' : '#55534d';
      x.fillText(title, cx + 34, t.y + 33);
    });
    // contenu de l’onglet
    if (pageTab !== active) renderPage(active);
    x.drawImage(page, CONTENT.x, CONTENT.y, CONTENT.w, CONTENT.h);
    x.restore();
    x.strokeStyle = 'rgba(0,0,0,.18)';
    x.lineWidth = 1.2;
    rr(x, X + 0.5, Y + 0.5, w - 1, h - 1, r);
    x.stroke();
  }

  function dock() {
    x.save();
    rr(x, DOCK_X, DOCK_Y, DOCK_W, ICON + DOCK_PAD * 2, 30);
    x.fillStyle = 'rgba(246,242,232,.42)';
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = 1.5;
    x.stroke();
    x.restore();
    // grossissement façon macOS autour de l’icône survolée
    const hov = state.hoverDock;
    DOCK.forEach((d, i) => {
      const r = dockRects[i];
      const dist = hov < 0 ? 9 : Math.abs(i - hov);
      const s = dist === 0 ? 1.28 : dist === 1 ? 1.1 : 1;
      const size = ICON * s;
      const X = r.x + (ICON - size) / 2, Y = r.y + ICON - size;
      drawIcon(x, d.icon, X, Y, size);
      if ((d.tab != null && d.tab === state.tab) || i === 1) {
        x.fillStyle = 'rgba(30,30,30,.7)';
        x.beginPath(); x.arc(r.x + ICON / 2, DOCK_Y + ICON + DOCK_PAD * 2 - 6, 3.2, 0, Math.PI * 2); x.fill();
      }
    });
    if (hov >= 0) {
      const r = dockRects[hov];
      const label = DOCK[hov].label;
      x.font = '500 19px ' + SANS;
      const w = x.measureText(label).width + 30;
      const X = r.x + ICON / 2 - w / 2, Y = DOCK_Y - 58;
      rr(x, X, Y, w, 38, 9);
      x.fillStyle = 'rgba(246,242,232,.96)';
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.12)';
      x.stroke();
      x.fillStyle = '#1b1b1b';
      x.fillText(label, X + 15, Y + 26);
    }
  }

  function draw() {
    x.setTransform(S, 0, 0, S, 0, 0);
    x.globalAlpha = 1;
    x.fillStyle = '#000';
    x.fillRect(0, 0, CW, CH);
    if (state.phase === 'off') return;
    // démarrage : le & blanc puis la barre de progression
    if (state.desk < 1) {
      const a = ease(state.boot * 2.2) * (1 - state.desk);
      x.globalAlpha = a;
      ampersand(x, CW / 2, CH / 2 + 70, 250, '#f2f2f2');
      const p = clamp((state.boot - 0.3) / 0.7, 0, 1);
      rr(x, CW / 2 - 130, CH / 2 + 170, 260, 7, 3.5);
      x.fillStyle = 'rgba(255,255,255,.22)';
      x.fill();
      if (p > 0) { rr(x, CW / 2 - 130, CH / 2 + 170, 260 * p, 7, 3.5); x.fillStyle = '#f2f2f2'; x.fill(); }
      x.globalAlpha = 1;
    }
    if (state.desk <= 0) return;
    x.globalAlpha = state.desk;
    x.drawImage(wall, 0, 0, CW, CH);
    menuBar();
    if (state.win > 0) {
      const t = ease(state.win);
      const s = 0.94 + 0.06 * t;
      x.save();
      x.globalAlpha = state.desk * clamp(state.win * 1.6, 0, 1);
      x.translate(WIN.x + WIN.w / 2, WIN.y + WIN.h / 2 + (1 - t) * 40);
      x.scale(s, s);
      x.translate(-(WIN.x + WIN.w / 2), -(WIN.y + WIN.h / 2));
      safari();
      x.restore();
    }
    x.globalAlpha = state.desk;
    dock();
    x.globalAlpha = 1;
  }

  // Qu’y a-t-il sous ce point du canvas ?
  function hitTest(X, Y) {
    if (state.phase !== 'desktop' || state.win < 1) return null;
    const inside = (r) => X >= r.x && X <= r.x + r.w && Y >= r.y && Y <= r.y + r.h;
    for (let i = 0; i < dockRects.length; i++) {
      const r = dockRects[i];
      if (inside({ x: r.x - GAP / 2, y: r.y - 20, w: r.w + GAP, h: r.h + 34 })) return { kind: 'dock', index: i };
    }
    for (let i = 0; i < tabRects.length; i++) if (inside(tabRects[i])) return { kind: 'tab', index: i };
    if (inside(CONTENT)) return { kind: 'content', index: state.tab };
    if (inside(WIN)) return { kind: 'window' };
    return null;
  }

  // Survol : renvoie true si l’écran doit être redessiné
  function setHover(hit) {
    let tab = state.tab, ht = -1, hd = -1;
    if (hit && hit.kind === 'tab') { ht = hit.index; tab = hit.index; }
    if (hit && hit.kind === 'dock') { hd = hit.index; if (DOCK[hit.index].tab != null) tab = DOCK[hit.index].tab; }
    const changed = tab !== state.tab || ht !== state.hoverTab || hd !== state.hoverDock;
    state.tab = tab; state.hoverTab = ht; state.hoverDock = hd;
    return changed;
  }

  // Partie du site visée par un clic
  function targetOf(hit) {
    if (!hit) return null;
    if (hit.kind === 'tab' || hit.kind === 'content') return TABS[hit.index].target;
    if (hit.kind === 'dock') { const d = DOCK[hit.index]; return d.target || TABS[d.tab].target; }
    return null;
  }

  function centerOf(kind, i) {
    const r = kind === 'dock' ? dockRects[i] : tabRects[i];
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  return { canvas: c, state, draw, hitTest, setHover, targetOf, centerOf, renderPage };
}
