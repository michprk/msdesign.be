/* ==========================================================================
   M&S Design — l’écran du MacBook (dessiné en 2D dans un canvas)
   Démarrage (logo & + barre de progression), bureau aux collines olive,
   barre des menus avec l’encoche, fenêtre Safari à onglets — un onglet par
   partie du site, dont l’aperçu s’affiche au survol — et un Dock dont chaque
   icône ouvre aussi une partie du site.
   setCustom() affiche le site d’un client à la place (photos des études de cas).
   Le module ne fait que dessiner et dire « qu’y a-t-il sous ce point » :
   la 3D (mac3d.js) s’occupe du reste.
   ========================================================================== */
import { AMP } from './amp.js?v=d1c9c220b3';

export const CW = 2048;
export const CH = 1330;

export const TABS = [
  { title: 'M&S Design', target: 'promesse' },
  { title: 'Études de cas', target: 'etudes' },
  { title: 'Services', target: 'services' },
  { title: 'Méthode', target: 'methode' },
  { title: 'Tarifs', target: 'tarifs' },
  { title: 'Contact', target: 'contact' }
];

export const DOCK = [
  { icon: 'folder', label: 'Études de cas', tab: 1 },
  { icon: 'brand', label: 'M&S Design', tab: 0 },
  { icon: 'notes', label: 'Services', tab: 2 },
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
  bg: '#fbfaf6', tint: '#f3f0e8', line: 'rgba(29,29,27,.1)',
  ink: '#1d1d1b', ink2: '#45453f', mute: '#6f6e66', olive: '#4f5c2c', deep: '#2b3520', night: '#171a13', sage: '#c5cc9c'
};
const SANS = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';
const SERIF = '"Inria Serif", Georgia, serif';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const ampPath = new Path2D(AMP.d);

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
function text(x, str, X, Y, font, color, ls, align) {
  x.font = font;
  x.fillStyle = color;
  spacing(x, ls || '0px');
  x.textAlign = align || 'left';
  x.fillText(str, X, Y);
  spacing(x, '0px');
  x.textAlign = 'left';
  return x.measureText(str).width;
}
function para(x, str, X, Y, maxW, lh, font, color, align) {
  x.font = font;
  x.fillStyle = color;
  x.textAlign = align || 'left';
  const lines = [];
  let line = '';
  str.split(' ').forEach((w) => {
    const test = line ? line + ' ' + w : w;
    if (x.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  lines.forEach((l, i) => x.fillText(l, X, Y + i * lh));
  x.textAlign = 'left';
  return Y + (lines.length - 1) * lh;
}
function cover(x, img, X, Y, w, h, r, fy) {
  x.save();
  rr(x, X, Y, w, h, r);
  x.clip();
  if (img) {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    x.drawImage(img, X + (w - iw) / 2, Y + (h - ih) * (fy == null ? 0 : fy), iw, ih);
  } else {
    x.fillStyle = '#e6e1d5';
    x.fillRect(X, Y, w, h);
  }
  x.restore();
}
function pill(x, X, Y, w, h, bg, fg, label, size, border) {
  rr(x, X, Y, w, h, h / 2);
  if (bg) { x.fillStyle = bg; x.fill(); }
  if (border) { x.strokeStyle = border; x.lineWidth = 1.2; x.stroke(); }
  x.font = '500 ' + size + 'px ' + SANS;
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.fillText(label, X + w / 2, Y + h / 2 + size * 0.36);
  x.textAlign = 'left';
}
// Le « & » du logo (tracé vectoriel), posé sur sa ligne de base
export function ampersand(x, cx, baseline, size, color) {
  const s = size / AMP.h;
  x.save();
  x.translate(cx - AMP.w * s / 2, baseline - size * 0.84);
  x.scale(s, s);
  x.fillStyle = color;
  x.fill(ampPath, 'evenodd');
  x.restore();
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
    brand: grad(x, X, Y, s, '#5d6b37', '#2b3520'),
    notes: '#fbfaf6',
    calendar: '#fbfaf6',
    calc: grad(x, X, Y, s, '#3a3a3a', '#1b1b1b'),
    bubble: grad(x, X, Y, s, '#8fd47a', '#3fae4a'),
    mail: grad(x, X, Y, s, '#7fc1ff', '#2a7de8')
  }[kind];
  rr(x, X, Y, s, s, s * 0.225);
  x.fillStyle = base;
  x.fill();
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
  } else if (kind === 'brand') {
    ampersand(x, X + s / 2, Y + 80 * u, 64 * u, '#f3f0e8');
  } else if (kind === 'notes') {
    x.fillStyle = grad(x, X, Y, 28 * u, '#f8d877', '#efc24c');
    x.fillRect(X, Y, s, 26 * u);
    x.strokeStyle = 'rgba(0,0,0,.14)';
    x.lineWidth = 2 * u;
    for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(X + 14 * u, Y + (40 + i * 12) * u); x.lineTo(X + 86 * u, Y + (40 + i * 12) * u); x.stroke(); }
  } else if (kind === 'calendar') {
    const now = new Date();
    const months = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];
    text(x, months[now.getMonth()], X + s / 2, Y + 27 * u, '600 ' + Math.round(17 * u) + 'px ' + SANS, '#e5483d', '0px', 'center');
    text(x, String(now.getDate()), X + s / 2, Y + 82 * u, '400 ' + Math.round(58 * u) + 'px ' + SANS, '#222', '0px', 'center');
  } else if (kind === 'calc') {
    const cols = ['#5d5d5d', '#5d5d5d', '#5d5d5d', '#f39b2f'];
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
      x.fillStyle = r === 0 && q < 3 ? '#a5a5a5' : cols[q];
      x.beginPath(); x.arc(X + (23 + q * 18) * u, Y + (28 + r * 16) * u, 6.5 * u, 0, Math.PI * 2); x.fill();
    }
    text(x, '€', X + 77 * u, Y + 76.5 * u, '600 ' + Math.round(13 * u) + 'px ' + SANS, '#fff', '0px', 'center');
  } else if (kind === 'bubble') {
    x.fillStyle = '#fff';
    x.beginPath(); x.ellipse(X + 50 * u, Y + 48 * u, 32 * u, 27 * u, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(X + 28 * u, Y + 64 * u); x.lineTo(X + 22 * u, Y + 80 * u); x.lineTo(X + 42 * u, Y + 72 * u); x.fill();
    text(x, '?', X + 50 * u, Y + 60 * u, '700 ' + Math.round(34 * u) + 'px ' + SANS, '#3fae4a', '0px', 'center');
  } else if (kind === 'mail') {
    x.fillStyle = '#fff';
    rr(x, X + 18 * u, Y + 30 * u, 64 * u, 42 * u, 5 * u); x.fill();
    x.strokeStyle = '#4f97ef';
    x.lineWidth = 3 * u;
    x.beginPath(); x.moveTo(X + 20 * u, Y + 33 * u); x.lineTo(X + 50 * u, Y + 55 * u); x.lineTo(X + 80 * u, Y + 33 * u); x.stroke();
  }
  const sh = x.createLinearGradient(X, Y, X, Y + s);
  sh.addColorStop(0, 'rgba(255,255,255,.18)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  x.fillStyle = sh;
  x.fillRect(X, Y, s, s);
  x.restore();
}

/* ---------- Aperçus des parties du site (coordonnées « page » 1440 px) ---------- */
function miniHeader(x) {
  x.fillStyle = 'rgba(251,250,246,.96)';
  x.fillRect(0, 0, PAGE_W, 56);
  x.fillStyle = C.line;
  x.fillRect(0, 55, PAGE_W, 1);
  text(x, 'M', 56, 36, '600 20px ' + SANS, C.ink);
  ampersand(x, 84, 37, 23, C.olive);
  text(x, 'S', 93, 36, '600 20px ' + SANS, C.ink);
  text(x, 'Design', 113, 36, '400 17px ' + SANS, C.mute);
  let ox = 520;
  ['Études de cas', 'Services', 'Méthode', 'Tarifs', 'FAQ'].forEach((l) => { ox += text(x, l, ox, 34, '400 14px ' + SANS, C.ink2) + 36; });
  pill(x, 1262, 13, 130, 30, C.deep, '#fbfaf6', 'Devis gratuit', 13);
}
function head(x, label, title, lead, dark, y) {
  const Y = y || 150;
  text(x, label, PAGE_W / 2, Y, '500 16px ' + SANS, dark ? C.sage : C.olive, '0px', 'center');
  const lines = title.split('\n');
  lines.forEach((l, i) => text(x, l, PAGE_W / 2, Y + 72 + i * 66, '300 62px ' + SERIF, dark ? '#f3f0e8' : C.ink, '-1px', 'center'));
  if (lead) para(x, lead, PAGE_W / 2, Y + 72 + lines.length * 66 + 6, 760, 30, '400 20px ' + SERIF, dark ? 'rgba(243,240,232,.72)' : C.mute, 'center');
}

function pageAccueil(x, img) {
  const g = x.createRadialGradient(PAGE_W / 2, 200, 0, PAGE_W / 2, 200, 900);
  g.addColorStop(0, '#fdfcf9');
  g.addColorStop(1, '#ebe6da');
  x.fillStyle = g;
  x.fillRect(0, 0, PAGE_W, 760);
  text(x, 'Studio de design web · Bruxelles', PAGE_W / 2, 150, '500 16px ' + SANS, C.olive, '0px', 'center');
  text(x, 'Un site qui vous apporte', PAGE_W / 2, 232, '300 74px ' + SERIF, C.ink, '-1.5px', 'center');
  text(x, 'des clients.', PAGE_W / 2, 310, '300 74px ' + SERIF, C.ink, '-1.5px', 'center');
  para(x, 'Conçu sur mesure, rapide et élégant. En ligne en 21 jours, c’est promis.', PAGE_W / 2, 366, 700, 30, '400 21px ' + SERIF, C.mute, 'center');
  pill(x, 520, 408, 190, 48, C.deep, '#fbfaf6', 'Demander un devis', 16);
  text(x, 'Voir les études de cas  ›', 742, 438, '500 16px ' + SANS, C.olive);
  [img.ombelle, img.brachet, img.cave].forEach((im, i) => {
    x.save();
    x.shadowColor = 'rgba(30,30,20,.18)';
    x.shadowBlur = 30;
    x.shadowOffsetY = 14;
    rr(x, 170 + i * 374, 506, 350, 219, 12);
    x.fillStyle = '#fff';
    x.fill();
    x.restore();
    cover(x, im, 170 + i * 374, 506, 350, 219, 12);
  });
}
function pageEtudes(x, img) {
  x.fillStyle = C.bg;
  x.fillRect(0, 0, PAGE_W, 760);
  head(x, 'Études de cas', 'Des sites qui travaillent\npour de vrais métiers.', null, false, 136);
  rr(x, 96, 330, 1248, 300, 28);
  x.fillStyle = C.tint;
  x.fill();
  cover(x, img.ombelle, 640, 360, 640, 400, 14);
  text(x, 'Atelier Ombelle', 150, 420, '300 40px ' + SERIF, C.ink);
  para(x, 'Architecture d’intérieur, Ixelles. Matériauthèque en ligne et prise de rendez-vous.', 150, 462, 420, 28, '400 18px ' + SERIF, C.mute);
  text(x, 'Lire l’étude de cas  ›', 150, 560, '500 16px ' + SANS, C.olive);
  [[img.brachet, 'Brachet Avocats'], [img.cave, 'Cave Sauvage']].forEach(([im, n], i) => {
    rr(x, 96 + i * 636, 654, 612, 200, 28);
    x.fillStyle = C.tint;
    x.fill();
    text(x, n, 140 + i * 636, 712, '300 32px ' + SERIF, C.ink);
    cover(x, im, 380 + i * 636, 690, 300, 190, 10);
  });
}
function pageServices(x) {
  x.fillStyle = C.tint;
  x.fillRect(0, 0, PAGE_W, 760);
  head(x, 'Services', 'Ce que nous faisons.', 'Un seul partenaire pour votre image en ligne, de la première maquette à l’entretien.', false, 136);
  [['Sites sur mesure', 'Dessinés et codés à la main, pensés pour vos clients.'], ['Identité visuelle', 'Logo, couleurs et typographies cohérents partout.'], ['Référencement local', 'Être trouvé à Bruxelles quand on vous cherche.'], ['Entretien & hébergement', 'Sécurité, sauvegardes et retouches chaque mois.']].forEach(([a, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const X = 210 + col * 520, Y = 360 + row * 200;
    rr(x, X, Y, 500, 184, 26);
    x.fillStyle = '#fff';
    x.fill();
    text(x, a, X + 40, Y + 68, '300 34px ' + SERIF, C.ink);
    para(x, b, X + 40, Y + 108, 400, 27, '400 18px ' + SERIF, C.mute);
    text(x, 'En savoir plus  ›', X + 40, Y + 158, '500 15px ' + SANS, C.olive);
  });
}
function pageMethode(x) {
  x.fillStyle = C.bg;
  x.fillRect(0, 0, PAGE_W, 760);
  head(x, 'Méthode', 'Comment nous travaillons.', 'Quatre étapes, un seul interlocuteur, et une date de mise en ligne inscrite dans le devis.', false, 136);
  x.fillStyle = C.line;
  x.fillRect(200, 452, 1040, 2);
  [['Jour 1', 'Un appel de 30 minutes'], ['Jour 5', 'La maquette et le prix'], ['Jours 6 à 20', 'La conception'], ['Jour 21', 'La mise en ligne']].forEach(([a, b], i) => {
    const X = 200 + i * 346;
    x.beginPath(); x.arc(X, 453, 9, 0, Math.PI * 2); x.fillStyle = i === 3 ? C.olive : '#fff'; x.fill();
    x.strokeStyle = C.olive; x.lineWidth = 2; x.stroke();
    text(x, a, X, 520, '500 16px ' + SANS, C.olive, '0px', 'center');
    text(x, b, X, 562, '300 28px ' + SERIF, C.ink, '0px', 'center');
  });
}
function pageTarifs(x) {
  x.fillStyle = C.tint;
  x.fillRect(0, 0, PAGE_W, 760);
  head(x, 'Tarifs', 'Des prix fixes, annoncés d’avance.', null, false, 136);
  [['Essentiel', '500 €', 'Une page sur mesure'], ['Signature', '750 €', 'Jusqu’à six pages'], ['Premium', '2 200 €', 'Multilingue, boutique']].forEach(([a, b, c], i) => {
    const X = 150 + i * 390, Y = 300;
    rr(x, X, Y, 370, 420, 28);
    x.fillStyle = '#fff';
    x.fill();
    if (i === 1) text(x, 'Notre conseil', X + 185, Y + 52, '500 15px ' + SANS, C.olive, '0px', 'center');
    text(x, a, X + 185, Y + 108, '300 40px ' + SERIF, C.ink, '0px', 'center');
    text(x, c, X + 185, Y + 146, '400 18px ' + SERIF, C.mute, '0px', 'center');
    text(x, b, X + 185, Y + 250, '300 64px ' + SERIF, C.ink, '-1px', 'center');
    text(x, 'HTVA', X + 185, Y + 282, '500 13px ' + SANS, C.mute, '1px', 'center');
    pill(x, X + 95, Y + 330, 180, 46, i === 1 ? C.deep : null, i === 1 ? '#fbfaf6' : C.deep, 'Choisir', 15, i === 1 ? null : C.deep);
  });
}
function pageContact(x) {
  x.fillStyle = C.night;
  x.fillRect(0, 0, PAGE_W, 760);
  head(x, 'Contact', 'Parlons de votre projet.', 'Un appel de 30 minutes, gratuit et sans engagement. Réponse sous 24 h ouvrées.', true, 136);
  rr(x, 330, 340, 780, 420, 28);
  x.fillStyle = '#fbfaf6';
  x.fill();
  [['Nom', 380, 400], ['E-mail', 740, 400], ['Votre projet', 380, 500]].forEach(([l, X, Y]) => {
    text(x, l, X, Y, '500 14px ' + SANS, C.mute);
    rr(x, X, Y + 14, l === 'Votre projet' ? 680 : 320, l === 'Votre projet' ? 110 : 50, 12);
    x.fillStyle = '#fff'; x.fill();
    x.strokeStyle = 'rgba(29,29,27,.18)'; x.stroke();
  });
  pill(x, 380, 660, 220, 50, C.deep, '#fbfaf6', 'Envoyer ma demande', 16);
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
  let custom = null;               // { url, title, page } : le site d’un client

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
    if (custom) {
      const im = custom.page;
      const s = (CONTENT.w * S) / im.width;
      px.drawImage(im, 0, 0, im.width * s, im.height * s);
      pageTab = -2;
      return;
    }
    px.setTransform(K * S, 0, 0, K * S, 0, 0);
    [pageAccueil, pageEtudes, pageServices, pageMethode, pageTarifs, pageContact][tab](px, img);
    miniHeader(px);
    pageTab = tab;
  }

  function menuBar() {
    x.fillStyle = 'rgba(246,242,232,.62)';
    x.fillRect(0, 0, CW, MENU_H);
    ampersand(x, 40, 34, 26, '#1b1b1b');
    text(x, 'Safari', 76, 30, '700 19px ' + SANS, '#1b1b1b');
    let mx = 158;
    ['Fichier', 'Édition', 'Présentation', 'Historique', 'Signets', 'Fenêtre', 'Aide'].forEach((m) => {
      mx += text(x, m, mx, 30, '500 19px ' + SANS, '#1b1b1b') + 30;
    });
    const now = new Date();
    const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    text(x, days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()] + '  ' + hh, CW - 30, 30, '500 19px ' + SANS, '#1b1b1b', '0px', 'right');
    x.fillStyle = '#1b1b1b';
    x.strokeStyle = '#1b1b1b';
    const bx = CW - 330;
    rr(x, bx, 16, 34, 16, 4); x.lineWidth = 1.6; x.stroke();
    rr(x, bx + 3, 19, 24, 10, 2); x.fill();
    x.fillRect(bx + 35, 21, 2.5, 6);
    x.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(CW - 372, 32, 5 + i * 5.5, Math.PI * 1.25, Math.PI * 1.75); x.stroke(); }
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

  function favicon(X, Y, s, letter) {
    rr(x, X, Y, s, s, s * 0.27);
    x.fillStyle = custom ? custom.color || '#333' : C.deep;
    x.fill();
    if (custom) text(x, letter, X + s / 2, Y + s * 0.74, '600 ' + Math.round(s * 0.62) + 'px ' + SANS, '#fff', '0px', 'center');
    else ampersand(x, X + s / 2, Y + s * 0.86, s * 0.72, '#f3f0e8');
  }

  function safari() {
    const { x: X, y: Y, w, h, r } = WIN;
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
    const label = custom ? custom.url : 'msdesign.be';
    const lw = x.measureText(label).width;
    const lx = ax + (aw - lw) / 2 + 12;
    x.fillStyle = '#3a3a37';
    x.fillText(label, lx, Y + 42);
    x.strokeStyle = '#6d6b66';
    x.lineWidth = 2;
    rr(x, lx - 30, Y + 31, 15, 12, 2.5); x.fillStyle = '#6d6b66'; x.fill();
    x.beginPath(); x.arc(lx - 22.5, Y + 31, 5, Math.PI, 0); x.stroke();
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
    const titles = custom ? [custom.title] : TABS.map((t) => t.title);
    const tw = (WIN.w - 16) / (custom ? 3 : TABS.length);
    const active = custom ? 0 : state.tab;
    titles.forEach((title, i) => {
      const t = { x: WIN.x + 8 + i * tw, y: WIN.y + TOOL_H, w: tw, h: TABS_H };
      const on = i === active;
      const hov = !custom && i === state.hoverTab && !on;
      if (on || hov) {
        rr(x, t.x + 3, t.y + 7, t.w - 6, t.h - 13, 9);
        x.fillStyle = on ? '#fbfaf6' : 'rgba(255,255,255,.45)';
        x.fill();
        if (on) { x.strokeStyle = 'rgba(0,0,0,.06)'; x.lineWidth = 1; x.stroke(); }
      } else if (i > 0 && i - 1 !== active && i !== state.hoverTab + 1) {
        x.fillStyle = 'rgba(0,0,0,.14)';
        x.fillRect(t.x, t.y + 16, 1.5, t.h - 30);
      }
      x.font = (on ? '600 ' : '500 ') + '19px ' + SANS;
      const tww = x.measureText(title).width;
      const cx = t.x + (t.w - tww - 34) / 2;
      favicon(cx, t.y + 15, 22, title[0]);
      x.font = (on ? '600 ' : '500 ') + '19px ' + SANS;
      x.fillStyle = on ? '#1b1b1b' : '#55534d';
      x.fillText(title, cx + 34, t.y + 33);
    });
    // contenu de l’onglet
    if (pageTab !== (custom ? -2 : active)) renderPage(active);
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
    const hov = state.hoverDock;
    DOCK.forEach((d, i) => {
      const r = dockRects[i];
      const dist = hov < 0 ? 9 : Math.abs(i - hov);
      const s = dist === 0 ? 1.28 : dist === 1 ? 1.1 : 1;
      const size = ICON * s;
      drawIcon(x, d.icon, r.x + (ICON - size) / 2, r.y + ICON - size, size);
      if ((d.tab != null && d.tab === state.tab && !custom) || i === 1) {
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
      x.globalAlpha = ease(state.boot * 2.2) * (1 - state.desk);
      ampersand(x, CW / 2, CH / 2 + 90, 230, '#f2f2f2');
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
    if (custom || state.phase !== 'desktop' || state.win < 1) return null;
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

  function setCustom(cfg) { custom = cfg; pageTab = -1; }

  return { canvas: c, state, draw, hitTest, setHover, targetOf, centerOf, renderPage, setCustom };
}
