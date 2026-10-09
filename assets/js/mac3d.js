/* ==========================================================================
   M&S Design — le MacBook du héros, en 3D (Three.js, aucun fichier 3D)
   Un portable 14 pouces d’aujourd’hui modélisé dans le code : coque en
   aluminium microbillé, clavier AZERTY belge rétroéclairé (la touche « & »,
   notre logo, brille en olive), pavé tactile en verre, grilles des
   haut-parleurs, ports MagSafe / USB-C / HDMI, charnière, dalle Retina à
   encoche derrière un verre noir, & poli miroir sur le capot.
   Il est posé sur une table en chêne dans la lumière d’une verrière, avec
   un nuancier, une tasse et un carnet ; le fond flou est l’image CSS du héros
   (le canvas est transparent là où la table s’efface).

   open()  : le capot se soulève, l’écran s’allume (& puis bureau), Safari
             s’ouvre, et le curseur montre les onglets.
   go(id)  : la caméra plonge dans l’écran jusqu’à ce que l’onglet remplisse
             la fenêtre, puis « ms:mac-go » laisse le site prendre le relais.
   ========================================================================== */
import * as THREE from '../vendor/three.module.min.js?v=38b8324a59';
import { createScreen, snapshot, ampersand, CW, CH, CONTENT, TABS } from './screen.js?v=38b8324a59';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out3 = (t) => 1 - Math.pow(1 - t, 3);
const sine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const DEG = Math.PI / 180;

/* ---------- Dimensions (en centimètres) ---------- */
const W = 31.2, D = 22.1, TB = 0.7, TL = 0.47, R = 1.15, BEV = 0.11, FEET = 0.08;
const TOP = FEET + TB;                         // dessus du repose-poignets
const ZB = 0.38;                               // axe de la charnière, en retrait du bord arrière
const PIVOT = new THREE.Vector3(0, TOP + 0.015, -D / 2 + ZB);
const DISP_W = 29.5, DISP_H = DISP_W / 1.54;
const DISP_TOP = D - ZB - 0.5;
const DISP_C = DISP_TOP - DISP_H / 2;
const OPEN = 107 * DEG;
const KP = 1.85, KG = 0.27, KPAD = 0.15;       // pas des touches, espace entre touches
const KB_W = 14.5 * KP + KPAD * 2, KB_D = 6 * KP + KPAD * 2;
const KB_X0 = -KB_W / 2, KB_Z0 = -D / 2 + 1.0;
const KB_ZC = KB_Z0 + KB_D / 2;
const TP_W = 13.4, TP_D = 7.9, TP_Z0 = KB_Z0 + KB_D + 0.8;

/* ---------- Géométrie ---------- */
function rrect(w, h, r, cx, cy) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  const ox = cx || 0, oy = cy || 0;
  const s = new THREE.Shape();
  const x0 = ox - w / 2, x1 = ox + w / 2, y0 = oy - h / 2, y1 = oy + h / 2;
  s.moveTo(x0 + bl, y0);
  s.lineTo(x1 - br, y0);
  if (br) s.absarc(x1 - br, y0 + br, br, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - tr);
  if (tr) s.absarc(x1 - tr, y1 - tr, tr, 0, Math.PI / 2, false);
  s.lineTo(x0 + tl, y1);
  if (tl) s.absarc(x0 + tl, y1 - tl, tl, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + bl);
  if (bl) s.absarc(x0 + bl, y0 + bl, bl, Math.PI, Math.PI * 1.5, false);
  return s;
}

// Normales lissées sous un angle de pli : reflets continus sur les arrondis
function crease(geo, angle) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const pos = geo.attributes.position, n = pos.count;
  const cos = Math.cos(angle || Math.PI / 3.2);
  const fw = new Float32Array(n * 3), fu = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    c.sub(b); a.sub(b); c.cross(a);
    const len = c.length() || 1;
    for (let k = 0; k < 3; k++) {
      fw.set([c.x, c.y, c.z], (i + k) * 3);
      fu.set([c.x / len, c.y / len, c.z / len], (i + k) * 3);
    }
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos.getX(i) * 1e3) + '|' + Math.round(pos.getY(i) * 1e3) + '|' + Math.round(pos.getZ(i) * 1e3);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(i);
  }
  const outN = new Float32Array(n * 3);
  for (const list of groups.values()) {
    for (const i of list) {
      let sx = 0, sy = 0, sz = 0;
      const ux = fu[i * 3], uy = fu[i * 3 + 1], uz = fu[i * 3 + 2];
      for (const j of list) {
        if (ux * fu[j * 3] + uy * fu[j * 3 + 1] + uz * fu[j * 3 + 2] >= cos) { sx += fw[j * 3]; sy += fw[j * 3 + 1]; sz += fw[j * 3 + 2]; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      outN[i * 3] = sx / l; outN[i * 3 + 1] = sy / l; outN[i * 3 + 2] = sz / l;
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(outN, 3));
  return geo;
}

// Dalle extrudée, couchée à plat : épaisseur selon +Y (de 0 à t), le +Y de la forme vers -Z
function flatSlab(shape, t, bevel, segs, curve) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, t - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: segs || 4, curveSegments: curve || 20
  });
  g.translate(0, 0, bevel);
  g.rotateX(-Math.PI / 2);
  return g;
}

// Plan découpé dans une forme, tourné vers le bas (-Y) ; UV normalisés sur w × h
function facePlane(shape, w, h, down) {
  const g = new THREE.ShapeGeometry(shape, 24);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  g.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
  return g;
}

function merge(geos) {
  let n = 0;
  geos.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  geos.forEach((g) => {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += c;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

function canvasTex(w, h, draw, srgb) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

function waitFonts(ms) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('500 40px "Instrument Sans"'),
    document.fonts.load('600 40px "Instrument Sans"'),
    document.fonts.load('italic 40px "Inria Serif"'),
    document.fonts.load('400 40px "Inria Serif"'),
    document.fonts.load('italic 40px "Instrument Serif"')
  ]).catch(() => {});
  return Promise.race([loads, new Promise((r) => setTimeout(r, ms))]);
}

/* ---------- Lumière : la pièce et ses fenêtres, pour les reflets ----------
   Comme dans un studio photo : des murs mats assez sombres et quelques grandes sources
   très claires. L’aluminium et le verre y trouvent des dégradés et des filets de lumière,
   au lieu d’un gris uniforme. */
function roomEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(900, 500, 900), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8d8578).multiplyScalar(0.62), side: THREE.BackSide })));
  const glass = canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#f4f5ec');
    g.addColorStop(0.62, '#b9c18e');
    g.addColorStop(1, '#5d6b34');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#16180f';
    for (let i = 1; i < 4; i++) x.fillRect(i * w / 4 - 5, 0, 10, h);
    x.fillRect(0, h * 0.34, w, 7);
  });
  const soft = canvasTex(256, 256, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, '#f4f1ea');
    g.addColorStop(1, '#8d8578');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
  const panel = (w, h, k, pos, map, color, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color || 0xffffff).multiplyScalar(k), map: map || null, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...(look || [0, 30, 0]));
    env.add(m);
  };
  panel(360, 260, 7.5, [400, 170, 40], glass);             // la grande fenêtre (lumière principale, à droite)
  panel(460, 240, 3.4, [280, 150, -300], glass);           // la verrière derrière le portable
  panel(300, 180, 2.6, [-200, 150, 330], soft);            // une boîte à lumière côté photographe
  panel(520, 40, 5.5, [0, 330, -60], null, 0xfff4e2);      // bandeau lumineux au plafond
  panel(520, 40, 4.2, [0, 330, 160], null, 0xfff4e2);
  panel(900, 900, 0.32, [0, -60, 0], null, 0x7a5a3c);      // plancher chaud
  panel(260, 300, 0.12, [-420, 120, -60], null, 0x2b2620); // bibliothèque sombre à gauche
  panel(200, 260, 0.18, [-120, 120, -430], null, 0x3a3328);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02, 1, 2000);
  pmrem.dispose();
  return rt.texture;
}

// Bruit fin (aluminium microbillé, argile) : une carte de rugosité ou de relief
function noiseTex(size, base, amp, seed) {
  let n = (seed || 7) >>> 0;
  const rnd = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296);
  const t = canvasTex(size, size, (x, w, h) => {
    const im = x.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = Math.max(0, Math.min(255, Math.round((base + (rnd() - 0.5) * amp) * 255)));
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Ombre de contact (occlusion douce sous les objets)
function softShadow(w, h, round, opacity) {
  const t = canvasTex(256, 256, (x, cw, ch) => {
    if (round) {
      const g = x.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw / 2);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, cw, ch);
    } else {
      x.filter = 'blur(18px)';
      x.fillStyle = '#000';
      x.fillRect(cw * 0.16, ch * 0.16, cw * 0.68, ch * 0.68);
      x.filter = 'none';
    }
  }, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x1a120a, alphaMap: t, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}
function contactShadow(w, h, r, opacity) {
  const t = canvasTex(512, 512, (x, cw, ch) => {
    x.filter = 'blur(7px)';
    x.fillStyle = '#000';
    rr(x, cw * 0.07, ch * 0.07, cw * 0.86, ch * 0.86, r * cw);
    x.fill();
    x.filter = 'none';
  }, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x120c06, alphaMap: t, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

/* ---------- Le clavier AZERTY belge ---------- */
const FKEYS = Array.from({ length: 12 }, (_, i) => ['F' + (i + 1), 1, 'f']);
const ROWS = [
  [['esc', 1.5, 'mod'], ...FKEYS, ['', 1, 'touch']],
  [['@ #', 1], ['&', 1, 'amp'], ['é 2', 1], ['" 3', 1], ['\' 4', 1], ['( 5', 1], ['§ 6', 1], ['è 7', 1], ['! 8', 1], ['ç 9', 1], ['à 0', 1], [') °', 1], ['- _', 1], ['⌫', 1.5, 'mod']],
  [['⇥', 1.5, 'mod'], ...'AZERTYUIOP'.split('').map((l) => [l, 1]), ['^ ¨', 1], ['$ *', 1], ['↩', 1, 'enterTop']],
  [['⇪', 1.75, 'mod'], ...'QSDFGHJKLM'.split('').map((l) => [l, 1]), ['ù %', 1], ['µ £', 1], ['', 0.75, 'enterBottom']],
  [['⇧', 1.25, 'mod'], ['< >', 1], ...'WXCVBN'.split('').map((l) => [l, 1]), [', ?', 1], ['; .', 1], [': /', 1], ['= +', 1], ['⇧', 2.25, 'modR']],
  [['fn', 1, 'fn'], ['control', 1, 'word', '⌃'], ['option', 1, 'word', '⌥'], ['command', 1.25, 'word', '⌘'], ['', 5, 'space'], ['command', 1.25, 'word', '⌘'], ['option', 1, 'word', '⌥'], ['', 3, 'arrows']]
];

function keyLayout() {
  const keys = [];
  const d = KP - KG;
  ROWS.forEach((row, ri) => {
    let u = 0;
    row.forEach(([label, units, kind, sym]) => {
      const x = KPAD + u * KP + KG / 2, z = KPAD + ri * KP + KG / 2;
      const w = units * KP - KG;
      if (kind === 'arrows') {
        const half = d / 2 - 0.03;
        keys.push({ x, z: z + d - half, w: KP - KG, d: half, label: '◀', kind: 'arrow' });
        keys.push({ x: x + KP, z, w: KP - KG, d: half, label: '▲', kind: 'arrow' });
        keys.push({ x: x + KP, z: z + d - half, w: KP - KG, d: half, label: '▼', kind: 'arrow' });
        keys.push({ x: x + KP * 2, z: z + d - half, w: KP - KG, d: half, label: '▶', kind: 'arrow' });
      } else if (kind === 'enterTop') {
        keys.push({ x, z, w, d: d + KG + 0.02, label, kind: 'mod' });
      } else if (kind === 'enterBottom') {
        keys.push({ x, z: z - 0.02, w, d: d + 0.02, label: '', kind: 'blank', low: true });
      } else {
        keys.push({ x, z, w, d, label, kind: kind || 'char', sym });
      }
      u += units;
    });
  });
  return keys;
}

function keyboardTextures(keys) {
  const S = 2048 / KB_W;
  const w = 2048, h = Math.round(KB_D * S);
  const draw = (x, glow) => {
    x.fillStyle = glow ? '#000' : '#0d0d0e';
    x.fillRect(0, 0, w, h);
    keys.forEach((k) => {
      const X = k.x * S, Y = k.z * S, kw = k.w * S, kd = k.d * S;
      if (!glow) {
        const g = x.createLinearGradient(0, Y, 0, Y + kd);
        g.addColorStop(0, '#1d1d20');
        g.addColorStop(1, '#151517');
        x.fillStyle = g;
        rr(x, X, Y, kw, kd, 0.17 * S);
        x.fill();
      }
      const ink = glow ? '#ffffff' : '#d4d4d8';
      x.fillStyle = ink;
      x.textBaseline = 'alphabetic';
      const font = (px, weight) => (weight || 400) + ' ' + Math.round(px * S) + 'px "Helvetica Neue", Arial, sans-serif';
      if (k.kind === 'amp') {
        x.fillStyle = glow ? '#c9e07a' : '#a9bd62';
        ampersand(x, X + kw / 2, Y + kd * 0.76, 0.72 * S, glow ? '#c9e07a' : '#a9bd62');
        x.textAlign = 'center';
        x.font = font(0.27);
        x.fillStyle = ink;
        x.fillText('1', X + kw * 0.78, Y + kd * 0.3);
      } else if (k.kind === 'char') {
        const parts = k.label.split(' ');
        x.textAlign = 'center';
        if (parts.length === 1) {
          x.font = font(0.42);
          x.fillText(parts[0], X + kw / 2, Y + kd * 0.64);
        } else {
          x.font = font(0.3);
          x.fillText(parts[1], X + kw / 2, Y + kd * 0.4);
          x.fillText(parts[0], X + kw / 2, Y + kd * 0.8);
        }
      } else if (k.kind === 'f') {
        x.textAlign = 'center';
        x.font = font(0.2);
        x.fillText(k.label, X + kw / 2, Y + kd * 0.82);
      } else if (k.kind === 'mod' || k.kind === 'fn') {
        x.textAlign = 'left';
        x.font = font(k.label.length > 1 ? 0.24 : 0.36);
        x.fillText(k.label, X + 0.16 * S, Y + kd - 0.2 * S);
      } else if (k.kind === 'modR') {
        x.textAlign = 'right';
        x.font = font(0.36);
        x.fillText(k.label, X + kw - 0.16 * S, Y + kd - 0.2 * S);
      } else if (k.kind === 'word') {
        x.textAlign = 'right';
        x.font = font(0.3);
        x.fillText(k.sym, X + kw - 0.16 * S, Y + 0.42 * S);
        x.textAlign = 'center';
        x.font = font(0.19);
        x.fillText(k.label, X + kw / 2, Y + kd - 0.2 * S);
      } else if (k.kind === 'arrow') {
        x.textAlign = 'center';
        x.font = font(0.2);
        x.fillText(k.label, X + kw / 2, Y + kd * 0.7);
      } else if (k.kind === 'touch' && !glow) {
        x.strokeStyle = 'rgba(180,180,186,.35)';
        x.lineWidth = 0.04 * S;
        rr(x, X + 0.08 * S, Y + 0.08 * S, kw - 0.16 * S, kd - 0.16 * S, 0.14 * S);
        x.stroke();
      }
    });
    x.textAlign = 'left';
  };
  const map = canvasTex(w, h, (x) => draw(x, false));
  const glow = canvasTex(w, h, (x) => draw(x, true));
  return { map, glow };
}

function keyboardGeometry(keys) {
  const geos = keys.map((k) => {
    const kb = 0.025;
    const g = flatSlab(rrect(k.w - kb * 2, k.d - kb * 2, 0.15), 0.17 - (k.low ? 0.0006 : 0), kb, 2, 4);
    g.translate(KB_X0 + k.x + k.w / 2, TOP - 0.19, KB_Z0 + k.z + k.d / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - KB_X0) / KB_W, 1 - (p.getZ(i) - KB_Z0) / KB_D);
    return g;
  });
  return merge(geos);
}

/* ---------- Le repose-poignets : grilles, pavé tactile, encoche d’ouverture ---------- */
function deckTexture() {
  const S = 2048 / W;
  const w = 2048, h = Math.round(D * S);
  return canvasTex(w, h, (x) => {
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, h);
    const X = (v) => (v + W / 2) * S, Z = (v) => (v + D / 2) * S;
    // grilles des haut-parleurs de part et d’autre du clavier
    x.fillStyle = 'rgba(40,40,44,.55)';
    [-1, 1].forEach((side) => {
      const cx = side * (KB_W / 2 + 1.0);
      for (let gz = KB_Z0 + 0.2; gz < KB_Z0 + KB_D - 0.2; gz += 0.17) {
        for (let gx = cx - 0.5; gx <= cx + 0.5; gx += 0.17) {
          x.beginPath();
          x.arc(X(gx + ((Math.round((gz - KB_Z0) / 0.17) % 2) * 0.085)), Z(gz), 0.042 * S, 0, Math.PI * 2);
          x.fill();
        }
      }
    });
    // pavé tactile : un liseré fin
    rr(x, X(-TP_W / 2), Z(TP_Z0), TP_W * S, TP_D * S, 0.6 * S);
    x.strokeStyle = 'rgba(0,0,0,.32)';
    x.lineWidth = 2.2;
    x.stroke();
    rr(x, X(-TP_W / 2) + 2, Z(TP_Z0) + 2, TP_W * S - 4, TP_D * S - 4, 0.6 * S - 2);
    x.strokeStyle = 'rgba(255,255,255,.7)';
    x.lineWidth = 1.2;
    x.stroke();
    // encoche d’ouverture, à l’avant
    const g = x.createRadialGradient(X(0), Z(D / 2), 0, X(0), Z(D / 2), 3.6 * S);
    g.addColorStop(0, 'rgba(0,0,0,.2)');
    g.addColorStop(0.35, 'rgba(0,0,0,.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save();
    x.translate(0, Z(D / 2));
    x.scale(1, 0.24);
    x.translate(0, -Z(D / 2));
    x.fillStyle = g;
    x.fillRect(X(-4), Z(D / 2) - 4 * S, 8 * S, 8 * S);
    x.restore();
  });
}

function glyphTexture() {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#000';
    x.fillRect(0, 0, w, h);
    ampersand(x, w / 2, h * 0.86, 400, '#fff');
  }, false);
}

function cursorTexture(hand) {
  return canvasTex(128, 128, (x) => {
    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.shadowColor = 'rgba(0,0,0,.35)';
    x.shadowBlur = 6;
    x.shadowOffsetY = 3;
    x.beginPath();
    if (!hand) {
      // flèche macOS
      x.moveTo(8, 6); x.lineTo(8, 92); x.lineTo(28, 73); x.lineTo(41, 104); x.lineTo(56, 98); x.lineTo(43, 68); x.lineTo(70, 68);
      x.closePath();
    } else {
      // main qui pointe
      x.moveTo(34, 8); x.quadraticCurveTo(44, 6, 45, 16); x.lineTo(45, 46); x.lineTo(50, 40); x.quadraticCurveTo(58, 36, 61, 44);
      x.lineTo(66, 41); x.quadraticCurveTo(74, 39, 76, 48); x.lineTo(81, 46); x.quadraticCurveTo(90, 46, 90, 56);
      x.lineTo(90, 82); x.quadraticCurveTo(88, 104, 66, 108); x.lineTo(48, 108); x.quadraticCurveTo(36, 106, 28, 92);
      x.lineTo(12, 64); x.quadraticCurveTo(10, 55, 19, 54); x.quadraticCurveTo(25, 54, 28, 60); x.lineTo(28, 16); x.quadraticCurveTo(28, 8, 34, 8);
    }
    x.fillStyle = hand ? '#ffffff' : '#111111';
    x.fill();
    x.shadowColor = 'transparent';
    x.strokeStyle = hand ? '#111111' : '#ffffff';
    x.lineWidth = 5;
    x.stroke();
  });
}

/* ---------- Le portable ---------- */
function buildMac(screenTex) {
  const mac = new THREE.Group();
  const bead = noiseTex(256, 0.86, 0.22, 11);
  bead.repeat.set(9, 9);
  const alu = new THREE.MeshStandardMaterial({ color: 0xe9e9e7, metalness: 1, roughness: 0.36, roughnessMap: bead, envMapIntensity: 1.12 });
  const deck = alu.clone();
  const deckTex = deckTexture();
  deckTex.repeat.set(1 / W, 1 / D);
  deckTex.offset.set(0.5, 0.5);
  deckTex.anisotropy = 8;
  deck.map = deckTex;
  const black = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.7, metalness: 0.1 });
  const darkAlu = new THREE.MeshStandardMaterial({ color: 0x2a2a2d, metalness: 0.8, roughness: 0.38 });

  // coque inférieure, percée du puits du clavier
  const outer = rrect(W - BEV * 2, D - BEV * 2, R - BEV);
  outer.holes.push(rrect(KB_W, KB_D, 0.42, 0, -KB_ZC));
  const baseGeo = crease(flatSlab(outer, TB, BEV, 5, 22));
  const base = new THREE.Mesh(baseGeo, [deck, alu]);
  base.position.y = FEET;
  base.castShadow = true;
  base.receiveShadow = true;
  mac.add(base);

  // fond du puits et touches
  const well = new THREE.Mesh(new THREE.PlaneGeometry(KB_W, KB_D), black);
  well.rotation.x = -Math.PI / 2;
  well.position.set(0, TOP - 0.2, KB_ZC);
  mac.add(well);
  const keys = keyLayout();
  const kt = keyboardTextures(keys);
  kt.map.anisotropy = 8;
  const keyMat = new THREE.MeshStandardMaterial({ map: kt.map, emissiveMap: kt.glow, emissive: 0xfff6ea, emissiveIntensity: 0, roughness: 0.5, metalness: 0, envMapIntensity: 0.6 });
  const keyboard = new THREE.Mesh(keyboardGeometry(keys), keyMat);
  keyboard.receiveShadow = true;
  mac.add(keyboard);

  // pavé tactile en verre, à peine plus satiné que l’aluminium
  const pad = new THREE.Mesh(facePlane(rrect(TP_W - 0.08, TP_D - 0.08, 0.56), TP_W, TP_D, false), new THREE.MeshPhysicalMaterial({ color: 0xe2e2e0, metalness: 0.9, roughness: 0.3, roughnessMap: bead, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 1.1 }));
  pad.position.set(0, TOP + 0.012, TP_Z0 + TP_D / 2);
  mac.add(pad);

  // ports : MagSafe, USB-C et prise casque à gauche ; HDMI, USB-C et SD à droite
  const port = (len, h, side, z) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, len), black);
    g.position.set(side * (W / 2 - 0.005), FEET + TB / 2, z);
    mac.add(g);
  };
  port(1.5, 0.2, -1, -7.4); port(0.86, 0.3, -1, -4.9); port(0.86, 0.3, -1, -3.5); port(0.36, 0.36, -1, 4.2);
  port(1.45, 0.3, 1, -6.2); port(0.86, 0.3, 1, -4.4); port(2.3, 0.14, 1, 4.6);
  // patins
  [[-12.5, -8.6], [12.5, -8.6], [-12.5, 8.6], [12.5, 8.6]].forEach(([fx, fz]) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, FEET, 32), black);
    f.position.set(fx, FEET / 2, fz);
    mac.add(f);
  });
  // charnière
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, W * 0.84, 48), darkAlu);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.copy(PIVOT).add(new THREE.Vector3(0, -0.02, 0.02));
  mac.add(hinge);

  // capot
  const lid = new THREE.Group();
  lid.position.copy(PIVOT);
  mac.add(lid);
  const shellGeo = crease(flatSlab(rrect(W - 0.2, D - 0.2, R - 0.1), TL, 0.1, 5, 22));
  shellGeo.translate(0, 0, D / 2 - ZB);
  const shell = new THREE.Mesh(shellGeo, alu);
  shell.castShadow = true;
  lid.add(shell);
  // verre noir du cadre
  const bezel = new THREE.Mesh(facePlane(rrect(W - 0.32, D - 0.32, R - 0.14), W, D, true), new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }));
  bezel.position.set(0, -0.006, D / 2 - ZB);
  lid.add(bezel);
  // dalle (l’image de l’écran est émise, non éclairée : couleurs exactes)
  const dispMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0, roughness: 0.07, metalness: 0, envMapIntensity: 0.5, toneMapped: false });
  const display = new THREE.Mesh(facePlane(rrect(DISP_W, DISP_H, [0.5, 0.5, 0.1, 0.1]), DISP_W, DISP_H, true), dispMat);
  display.position.set(0, -0.018, DISP_C);
  lid.add(display);
  const sheenTex = canvasTex(512, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h * 0.8);
    g.addColorStop(0, 'rgba(255,255,255,.05)');
    g.addColorStop(0.36, 'rgba(255,255,255,0)');
    g.addColorStop(0.47, 'rgba(255,255,255,.75)');
    g.addColorStop(0.6, 'rgba(255,255,255,.18)');
    g.addColorStop(0.74, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  }, false);
  const sheen = new THREE.Mesh(display.geometry, new THREE.MeshBasicMaterial({ map: sheenTex, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sheen.position.set(0, -0.03, DISP_C);
  sheen.renderOrder = 2;
  lid.add(sheen);
  // & poli miroir sur le capot (lisible capot fermé, vu de face)
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), new THREE.MeshStandardMaterial({ color: 0xb4b5b2, metalness: 1, roughness: 0.05, alphaMap: glyphTexture(), transparent: true, depthWrite: false }));
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, TL + 0.014, D / 2 - ZB + 0.6);
  lid.add(logo);
  // curseur de la souris, posé sur la dalle
  const arrowTex = cursorTexture(false), handTex = cursorTexture(true);
  const cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false, toneMapped: false }));
  cursor.rotation.x = Math.PI / 2;
  cursor.visible = false;
  cursor.renderOrder = 3;
  lid.add(cursor);

  return { mac, lid, display, dispMat, keyMat, cursor, arrowTex, handTex, sheen };
}

/* ---------- Les objets du bureau ---------- */
const SWATCHES = [
  ['Olive', ['#5c6a35', '#7d8a52', '#a3ab78', '#c9cda9']],
  ['Sauge', ['#8f9a6a', '#a8b285', '#c3caa6', '#dfe3cc']],
  ['Écru', ['#cdbf9c', '#ddd2b6', '#ebe3cf', '#f6f1e5']],
  ['Terre', ['#8e4a2b', '#b4683f', '#cf9168', '#e6c2a4']],
  ['Encre', ['#1d1f17', '#3a3d30', '#62655a', '#9a9c90']],
  ['Moutarde', ['#a77e2a', '#c99c3f', '#ddbe74', '#eedcae']]
];
function swatchCard(name, colors, n) {
  return canvasTex(240, 784, (x, w, h) => {
    x.fillStyle = '#f7f4ec';
    x.fillRect(0, 0, w, h);
    colors.forEach((c, i) => {
      x.fillStyle = c;
      x.fillRect(14, 14 + i * 150, w - 28, 112);
      x.fillStyle = '#4a4a42';
      x.font = '600 15px "Instrument Sans", Arial, sans-serif';
      x.fillText('M&S ' + String(n * 4 + i + 1).padStart(2, '0') + '-' + (100 + i * 37), 16, 146 + i * 150);
    });
    x.font = 'italic 34px "Inria Serif", Georgia, serif';
    x.fillStyle = '#1d1f17';
    x.fillText(name, 16, 660);
    x.font = '600 12px "Instrument Sans", Arial, sans-serif';
    x.fillText('M&S DESIGN · NUANCIER', 16, 690);
    x.fillStyle = '#d8d2c2';
    x.beginPath(); x.arc(w / 2, h - 46, 14, 0, Math.PI * 2); x.fill();
  });
}

function buildProps() {
  const g = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.85 });

  // nuancier en éventail
  const fan = new THREE.Group();
  SWATCHES.forEach(([name, cols], i) => {
    const card = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.035, 15), [paper, paper, new THREE.MeshStandardMaterial({ map: swatchCard(name, cols, i), roughness: 0.78 }), paper, paper, paper]);
    const arm = new THREE.Group();
    card.position.set(0, 0.03 + i * 0.04, -6.4);
    card.castShadow = true;
    card.receiveShadow = true;
    arm.add(card);
    arm.rotation.y = 0.62 - i * 0.2;
    fan.add(arm);
  });
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.34, 24), new THREE.MeshStandardMaterial({ color: 0xc9c3b4, metalness: 1, roughness: 0.3 }));
  rivet.position.y = 0.17;
  fan.add(rivet);
  const fanShadow = softShadow(16, 16, true, 0.18);
  fanShadow.position.set(-3, 0.015, -5);
  fan.add(fanShadow);
  fan.position.set(-25, 0, 15);
  fan.rotation.y = 0.35;
  g.add(fan);

  // tasse en grès émaillé : paroi de 4 mm, lèvre arrondie, pied brut, anse aplatie, café crémeux
  const mug = new THREE.Group();
  const speckle = canvasTex(1024, 512, (x, w, h) => {
    x.fillStyle = '#f2ece0';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {      // nuages d’émail, à peine visibles
      const cx = Math.random() * w, cy = Math.random() * h, r = 20 + Math.random() * 70;
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, Math.random() > 0.5 ? 'rgba(226,214,192,.14)' : 'rgba(250,247,240,.18)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg;
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    for (let i = 0; i < 520; i++) {     // mouchetures de fer, discrètes
      const r = Math.random() < 0.9 ? 0.35 + Math.random() * 0.6 : 0.9 + Math.random() * 0.9;
      x.fillStyle = Math.random() > 0.3 ? 'rgba(110,78,48,' + (0.2 + Math.random() * 0.35) + ')' : 'rgba(52,36,22,' + (0.25 + Math.random() * 0.35) + ')';
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2); x.fill();
    }
  });
  speckle.wrapS = THREE.RepeatWrapping;
  const glaze = new THREE.MeshPhysicalMaterial({ map: speckle, vertexColors: true, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.95 });
  const clay = new THREE.MeshStandardMaterial({ color: 0xc7b394, roughness: 0.92, roughnessMap: noiseTex(128, 0.9, 0.2, 5) });
  const V = (a, b) => new THREE.Vector2(a, b);
  // le profil : pied brut, puis paroi émaillée jusqu’à la lèvre, et l’intérieur
  const footP = [V(0, 0.02), V(3.3, 0.02), V(3.62, 0.0), V(3.82, 0.05), V(3.95, 0.18), V(4.02, 0.38), V(4.05, 0.5)];
  const bodyP = [V(4.05, 0.5), V(4.1, 0.75), V(4.15, 1.4), V(4.18, 3), V(4.2, 6), V(4.21, 8.6), V(4.19, 8.92), V(4.13, 9.1), V(4.03, 9.2), V(3.92, 9.2), V(3.84, 9.12), V(3.8, 8.95), V(3.79, 8.6), V(3.77, 6), V(3.74, 2), V(3.62, 1.1), V(3.3, 0.86), V(0, 0.82)];
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyP, 160), glaze);
  // l’émail s’amincit sur la lèvre : on y devine la terre
  const bp = body.geometry.attributes.position;
  const col = new Float32Array(bp.count * 3);
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i), r = Math.hypot(bp.getX(i), bp.getZ(i));
    let k = 1;
    if (y > 8.98) k = 0.9;
    if (y < 0.9 && r > 3.9) k = 0.93;
    col[i * 3] = k; col[i * 3 + 1] = k * 0.985; col[i * 3 + 2] = k * 0.96;
  }
  body.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  body.castShadow = true;
  body.receiveShadow = true;
  mug.add(body);
  const foot = new THREE.Mesh(new THREE.LatheGeometry(footP, 160), clay);
  foot.castShadow = true;
  mug.add(foot);
  // le café : une surface brillante, plus claire près de la paroi (la crème)
  const crema = canvasTex(512, 512, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#2a1409');
    g.addColorStop(0.62, '#3b1e0e');
    g.addColorStop(0.86, '#6e4223');
    g.addColorStop(0.96, '#9a6a3f');
    g.addColorStop(1, '#5a341a');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2, d = (0.75 + Math.random() * 0.23) * w / 2;
      x.fillStyle = 'rgba(190,140,90,' + (0.1 + Math.random() * 0.2) + ')';
      x.beginPath(); x.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 1 + Math.random() * 3, 0, Math.PI * 2); x.fill();
    }
  });
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(3.76, 96), new THREE.MeshPhysicalMaterial({ map: crema, color: 0x806a5c, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 0.12 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 7.85;
  mug.add(coffee);
  // l’anse : une boucle aplatie, collée à la paroi
  const loop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.7, 7.75, 0), new THREE.Vector3(5.2, 8.05, 0), new THREE.Vector3(6.7, 7.45, 0), new THREE.Vector3(7.25, 5.8, 0),
    new THREE.Vector3(6.85, 4.0, 0), new THREE.Vector3(5.5, 2.75, 0), new THREE.Vector3(3.7, 2.45, 0)
  ], false, 'catmullrom', 0.5);
  const handleGeo = new THREE.TubeGeometry(loop, 96, 0.43, 24, false);
  handleGeo.scale(1, 1, 1.55);
  const handle = new THREE.Mesh(handleGeo, glaze);
  const hc = new Float32Array(handleGeo.attributes.position.count * 3).fill(1);
  handleGeo.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  handle.castShadow = true;
  mug.add(handle);
  const mugShadow = softShadow(15, 15, true, 0.42);
  mugShadow.position.set(-0.6, 0.015, 0.3);
  mug.add(mugShadow);
  const mugAO = contactShadow(9.2, 9.2, 0.5, 0.55);
  mugAO.position.y = 0.017;
  mug.add(mugAO);
  mug.position.set(24, 0, -13);
  mug.rotation.y = -0.6;
  g.add(mug);

  // carnet de croquis et crayon
  const book = new THREE.Group();
  const linen = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#4c5a2f';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)';
      x.fillRect(Math.random() * w, Math.random() * h, Math.random() > 0.5 ? 6 : 1, Math.random() > 0.5 ? 1 : 6);
    }
    ampersand(x, w / 2, h * 0.4, 52, 'rgba(0,0,0,.18)');
  });
  const pages = new THREE.MeshStandardMaterial({ color: 0xefe8d6, roughness: 0.9 });
  const cover = new THREE.MeshStandardMaterial({ map: linen, roughness: 0.85 });
  const nb = new THREE.Mesh(new THREE.BoxGeometry(14.8, 1.25, 21), [pages, pages, cover, cover, pages, pages]);
  nb.position.y = 0.63;
  nb.castShadow = true;
  nb.receiveShadow = true;
  book.add(nb);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.29, 21.06), new THREE.MeshStandardMaterial({ color: 0x1d1f17, roughness: 0.6 }));
  band.position.set(5.6, 0.63, 0);
  book.add(band);
  const pencil = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 15.5, 6), new THREE.MeshStandardMaterial({ color: 0x1f241a, roughness: 0.35 }));
  pencil.add(wood);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xd9b98c, roughness: 0.7 }));
  cone.position.y = -8.5;
  cone.rotation.x = Math.PI;
  pencil.add(cone);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 12), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4, metalness: 0.3 }));
  lead.position.y = -9.1;
  lead.rotation.x = Math.PI;
  pencil.add(lead);
  pencil.rotation.set(Math.PI / 2, 0, 0.5);
  pencil.position.set(-1, 1.62, 1);
  pencil.traverse((o) => { o.castShadow = true; });
  book.add(pencil);
  const bookShadow = softShadow(19, 25, false, 0.42);
  bookShadow.position.y = 0.012;
  book.add(bookShadow);
  book.position.set(25, 0, 14);
  book.rotation.y = 0.32;
  g.add(book);

  return g;
}

/* ---------- La table : flou de profondeur et fondu vers l’arrière-plan ---------- */
function tableMaterial(woodTex) {
  const m = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.44, metalness: 0, transparent: true, envMapIntensity: 0.75 });
  const u = { uFocus: { value: 100 }, uDof: { value: 0.055 }, uFwd: { value: new THREE.Vector2(0, -1) }, uFade: { value: new THREE.Vector2(30, 135) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uFocus;\nuniform float uDof;\nuniform vec2 uFwd;\nuniform vec2 uFade;')
      .replace('#include <map_fragment>', [
        '#ifdef USE_MAP',
        '  float dofBias = clamp(abs(length(vViewPosition) - uFocus) * uDof - 0.2, 0.0, 5.5);',
        '  vec4 sampledDiffuseColor = texture2D(map, vMapUv, dofBias);',
        '  diffuseColor *= sampledDiffuseColor;',
        '#endif',
        '  diffuseColor.a *= 1.0 - smoothstep(uFade.x, uFade.y, dot(vWPos.xz, uFwd));'
      ].join('\n'));
  };
  m.userData.u = u;
  return m;
}

/* ==========================================================================
   Mise en scène
   ========================================================================== */
export async function createMac3D(container, options) {
  const opts = Object.assign({ shots: {}, woodSrc: '', onFirstFrame: null, still: false }, options);
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  const shotEntries = Object.entries(opts.shots || {});
  const [, wood, ...shotImgs] = await Promise.all([waitFonts(1800), loadImage(opts.woodSrc), ...shotEntries.map(([, src]) => loadImage(src))]);
  const shots = {};
  shotEntries.forEach(([k], i) => { shots[k] = shotImgs[i]; });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  canvas.className = 'mac3d';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.environment = roomEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(24, 1, 5, 2000);

  const sun = new THREE.DirectionalLight(0xfff1df, 2.9);
  sun.position.set(95, 120, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 20, far: 400 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 7;
  sun.shadow.blurSamples = 18;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xfff8ee, 0.32);
  fill.position.set(-60, 40, 120);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xf5f1e8, 0x6b4f35, 0.36));

  // l’écran
  const screen = createScreen(shots, mobile ? 0.75 : 1);
  const screenTex = new THREE.CanvasTexture(screen.canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = maxAniso;
  screen.draw();

  const parts = buildMac(screenTex);
  const { mac, lid, display, dispMat, keyMat, cursor } = parts;
  scene.add(mac);
  const macShadow = softShadow(40, 30, false, 0.45);
  macShadow.position.set(0, 0.012, 0.4);
  scene.add(macShadow);
  const macAO = contactShadow(W + 1.4, D + 1.4, 0.05, 0.62);
  macAO.position.set(0, 0.014, 0);
  scene.add(macAO);
  const props = buildProps();
  scene.add(props);

  // table
  let woodTex = null;
  if (wood) {
    woodTex = new THREE.Texture(wood);
    woodTex.colorSpace = THREE.SRGBColorSpace;
    woodTex.wrapS = woodTex.wrapT = THREE.MirroredRepeatWrapping;
    woodTex.repeat.set(280 / 120, 220 / 60);
    woodTex.anisotropy = maxAniso;
    woodTex.needsUpdate = true;
  }
  const tableMat = tableMaterial(woodTex);
  if (!woodTex) tableMat.color.set(0xb08a62);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(280, 220), tableMat);
  table.rotation.x = -Math.PI / 2;
  table.position.set(0, 0, -30);
  table.receiveShadow = true;
  table.renderOrder = 1;
  scene.add(table);

  /* ----- Cadrage ----- */
  let VW = 1, VH = 1;
  const TARGET_Y = 8.5;
  const REST = { az: -0.3, el: 0.235 };
  const START = { az: -0.16, el: 0.55 };
  const view = { sx: 0.66, sy: 0.57, dist: 100 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const tanH = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  function frame() {
    const aspect = VW / VH;
    const portrait = aspect < 0.9;
    const s = container.dataset;
    let sx, sy, fw, fh;
    if (portrait || VW <= 700) { sx = 0.5; sy = 0.735; fw = 0.88; fh = 0.32; }
    else {
      // le Mac occupe l’espace libre à droite du texte (même calcul que la CSS du héros)
      const pad = clamp(VW * 0.045, 20, 64);
      const safe = (pad + Math.min(590, VW * 0.46) + 24) / VW;
      const zone = 0.975 - safe;
      fw = Math.min(0.5, zone * 0.94);
      sx = safe + zone / 2 + 0.01;
      sy = 0.58;
      fh = 0.62;
    }
    if (s.sx) sx = Number(s.sx);
    if (s.sy) sy = Number(s.sy);
    if (s.fw) fw = Number(s.fw);
    if (s.fh) fh = Number(s.fh);
    const t = tanH();
    const byW = 35 / (fw * 2 * t * aspect);
    const byH = 27 / (fh * 2 * t);
    Object.assign(view, { sx, sy, dist: Math.max(byW, byH) });
  }

  function resize() {
    const r = container.getBoundingClientRect();
    VW = Math.max(1, r.width); VH = Math.max(1, r.height);
    renderer.setSize(VW, VH, false);
    camera.aspect = VW / VH;
    camera.updateProjectionMatrix();
    frame();
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
  }

  /* ----- État ----- */
  let mode = 'closed';     // closed → opening → rest → zoom
  let t0 = 0;
  let openT = 0;           // temps écoulé dans l’ouverture (ms)
  let zoom = null;         // { t0, from, to, target }
  let demo = null;
  let dirty = true, running = false, visible = true, first = true;
  let userTook = false;
  let clockFn = null;
  const debug = { cam: null };   // outils : caméra imposée (render.html)
  const now = () => (clockFn ? clockFn() : performance.now());
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);

  function restPose(k) {
    // k : 0 = départ (capot fermé, vu de haut), 1 = repos
    // dès le début on est sur le Mac : centré et tout près, puis il glisse à sa place
    const e = inOut(clamp(k, 0, 1));
    const c = inOut(clamp((k - 0.3) / 0.7, 0, 1));
    const az = lerp(START.az, REST.az, e) + pointer.x * 0.045 * e;
    const el = lerp(START.el, REST.el, e) - pointer.y * 0.03 * e;
    const dist = view.dist * lerp(0.78, 1, c);
    const ty = lerp(3, TARGET_Y, e);
    const pos = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(new THREE.Vector3(0, ty, 0));
    return { pos, tgt: new THREE.Vector3(0, ty, 0), up: new THREE.Vector3(0, 1, 0), ox: -(view.sx - 0.5) * VW * c, oy: -(view.sy - 0.5) * VH * c };
  }

  function screenPose() {
    mac.updateMatrixWorld(true);
    const cu = (CONTENT.x + CONTENT.w / 2) / CW, cv = 1 - (CONTENT.y + CONTENT.h / 2) / CH;
    const P = new THREE.Vector3((cu - 0.5) * DISP_W, -0.018, DISP_C + (cv - 0.5) * DISP_H).applyMatrix4(lid.matrixWorld);
    const N = new THREE.Vector3(0, -1, 0).transformDirection(lid.matrixWorld);
    const Up = new THREE.Vector3(0, 0, 1).transformDirection(lid.matrixWorld);
    const wC = CONTENT.w / CW * DISP_W, hC = CONTENT.h / CH * DISP_H;
    const t = tanH();
    const d = Math.min(hC / (2 * t), wC / (2 * t * (VW / VH))) * 0.997;
    return { pos: P.clone().addScaledVector(N, d), tgt: P, up: Up, ox: 0, oy: 0 };
  }

  function applyCamera() {
    let k = mode === 'closed' ? 0 : mode === 'opening' ? clamp(openT / 2500, 0, 1) : 1;
    let p = restPose(k);
    if (zoom) {
      let z = inOut(clamp((now() - zoom.t0) / zoom.dur, 0, 1));
      if (zoom.back) z = 1 - z;          // on ressort de l’écran
      // les reflets s’effacent et les coins de la fenêtre s’ouvrent : à la fin, c’est la page
      dispMat.envMapIntensity = 0.5 * (1 - z);
      parts.sheen.material.opacity = 0.075 * (1 - z);
      const flat = z > 0.55;
      if (screen.state.flat !== flat) { screen.state.flat = flat; redrawScreen(); }
      const q = zoom.to;
      p = {
        pos: p.pos.clone().lerp(q.pos, z), tgt: p.tgt.clone().lerp(q.tgt, z),
        up: p.up.clone().lerp(q.up, z).normalize(), ox: lerp(p.ox, 0, z), oy: lerp(p.oy, 0, z)
      };
    }
    if (debug.cam) p = { pos: new THREE.Vector3(...debug.cam.pos), tgt: new THREE.Vector3(...debug.cam.tgt), up: new THREE.Vector3(0, 1, 0), ox: 0, oy: 0 };
    camPos.copy(p.pos); camTgt.copy(p.tgt); camUp.copy(p.up);
    camera.position.copy(camPos);
    camera.up.copy(camUp);
    camera.lookAt(camTgt);
    camera.setViewOffset(VW, VH, p.ox, p.oy, VW, VH);
    camera.updateMatrixWorld();
    // mise au point sur le portable, fondu de la table derrière lui
    const u = tableMat.userData.u;
    u.uFocus.value = camPos.distanceTo(new THREE.Vector3(0, 4, 0));
    const f = new THREE.Vector2(-Math.sin(REST.az), -Math.cos(REST.az));
    u.uFwd.value.copy(f);
  }

  /* ----- L’ouverture ----- */
  const OPEN_END = 2900;
  function lidAngle(t) {
    if (t < 380) return 7 * DEG * out3(t / 380);
    if (t < 560) return 7 * DEG;
    if (t < 2150) return 7 * DEG + (OPEN + 2 * DEG - 7 * DEG) * sine((t - 560) / 1590);
    if (t < 2550) return OPEN + 2 * DEG * (1 - out3((t - 2150) / 400));
    return OPEN;
  }
  function setScreen(t) {
    const st = screen.state;
    const wasOff = st.phase === 'off';
    const before = st.phase + st.boot.toFixed(3) + st.desk.toFixed(3) + st.win.toFixed(3);
    st.phase = t < 1050 ? 'off' : t < 2050 ? 'boot' : 'desktop';
    st.boot = clamp((t - 1100) / 1050, 0, 1);
    st.desk = clamp((t - 2050) / 300, 0, 1);
    st.win = clamp((t - 2250) / 550, 0, 1);
    dispMat.emissiveIntensity = clamp((t - 1050) / 260, 0, 1);
    keyMat.emissiveIntensity = 0.42 * clamp((t - 1250) / 500, 0, 1);
    const after = st.phase + st.boot.toFixed(3) + st.desk.toFixed(3) + st.win.toFixed(3);
    if (before !== after) redrawScreen();
    if (wasOff && st.phase !== 'off' && mode === 'opening') window.dispatchEvent(new CustomEvent('ms:mac-boot'));
  }
  function applyOpen(t) {
    openT = t;
    lid.rotation.x = -lidAngle(t);
    setScreen(t);
    renderer.shadowMap.needsUpdate = true;
  }
  function redrawScreen() {
    screen.draw();
    screenTex.needsUpdate = true;
    dirty = true;
  }

  function open() {
    if (mode !== 'closed') return;
    mode = 'opening';
    t0 = now();
    start();
  }
  function finishOpen(withDemo) {
    applyOpen(OPEN_END);
    mode = 'rest';
    dirty = true;
    window.dispatchEvent(new CustomEvent('ms:mac-open'));
    if (withDemo && !userTook) startDemo();
    else window.dispatchEvent(new CustomEvent('ms:mac-demo-end'));
  }
  function skip() {
    if (mode === 'zoom') return;
    finishOpen(false);
  }

  /* ----- Le curseur de démonstration ----- */
  function placeCursor(X, Y, hand) {
    const u = X / CW, v = 1 - Y / CH;
    cursor.position.set((u - 0.5) * DISP_W + 0.31, -0.04, DISP_C + (v - 0.5) * DISP_H - 0.31);
    cursor.visible = true;
    const map = hand ? parts.handTex : parts.arrowTex;
    if (cursor.material.map !== map) { cursor.material.map = map; cursor.material.needsUpdate = true; }
    dirty = true;
  }
  function startDemo() {
    const a = screen.centerOf('tab', 1), b = screen.centerOf('tab', 2);
    const keys = [[0, 1560, 930], [850, a.x, a.y + 4], [1650, a.x + 6, a.y + 2], [2350, b.x, b.y + 4], [2700, b.x, b.y + 4]];
    demo = { t0: now() + 250, keys };
    start();
  }
  function stepDemo() {
    const t = now() - demo.t0;
    if (t < 0) return;
    const k = demo.keys;
    let i = 0;
    while (i < k.length - 2 && t > k[i + 1][0]) i++;
    const [ta, xa, ya] = k[i], [tb, xb, yb] = k[i + 1];
    const e = inOut(clamp((t - ta) / (tb - ta), 0, 1));
    const X = lerp(xa, xb, e), Y = lerp(ya, yb, e);
    const hit = screen.hitTest(X, Y);
    placeCursor(X, Y, hit && hit.kind !== 'window');
    if (screen.setHover(hit)) redrawScreen();
    if (t > k[k.length - 1][0]) {
      demo = null;
      window.dispatchEvent(new CustomEvent('ms:mac-demo-end'));
    }
  }
  function stopDemo() {
    if (!demo) return;
    demo = null;
    window.dispatchEvent(new CustomEvent('ms:mac-demo-end'));
  }

  /* ----- Plonger dans l’écran ----- */
  function go(target) {
    if (zoom || mode === 'closed') return false;
    if (mode === 'opening') finishOpen(false);
    stopDemo();
    const id = typeof target === 'number' ? TABS[target].target : target;
    const tabIndex = TABS.findIndex((t) => t.target === id);
    if (tabIndex >= 0 && screen.state.tab !== tabIndex) { screen.state.tab = tabIndex; redrawScreen(); }
    cursor.visible = false;
    const z = zoom = { t0: now(), dur: mobile ? 950 : 1150, to: screenPose(), target: id };
    mode = 'zoom';
    window.dispatchEvent(new CustomEvent('ms:mac-zoom', { detail: { target: id } }));
    start();
    // filet de sécurité : si l’onglet ne dessine plus (arrière-plan), la navigation a lieu quand même
    setTimeout(() => {
      if (zoom !== z || z.done) return;
      z.done = true;
      window.dispatchEvent(new CustomEvent('ms:mac-go', { detail: { target: id } }));
    }, z.dur + 700);
    return true;
  }
  // Position (en pixels de la fenêtre) du haut de l’écran : pour placer l’invitation au-dessus
  function anchor() {
    if (mode === 'closed') return null;
    applyCamera();
    mac.updateMatrixWorld(true);
    const u = (CONTENT.x + CONTENT.w / 2) / CW, v = 1 - 72 / CH;
    const p = new THREE.Vector3((u - 0.5) * DISP_W, -0.018, DISP_C + (v - 0.5) * DISP_H).applyMatrix4(lid.matrixWorld).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
  }
  function home() {
    zoom = null;
    mode = 'rest';
    dispMat.envMapIntensity = 0.5;
    parts.sheen.material.opacity = 0.075;
    if (screen.state.flat) { screen.state.flat = false; redrawScreen(); }
    dirty = true;
  }
  // Remonter du site vers le Mac : la caméra part de la page plein écran et recule jusqu’au portable
  function emerge() {
    if (zoom) return false;
    if (mode === 'closed' || mode === 'opening') { applyOpen(OPEN_END); mode = 'rest'; }
    stopDemo();
    cursor.visible = false;
    screen.setHover(null);
    screen.state.tab = 0;
    const z = zoom = { t0: now(), dur: mobile ? 1050 : 1350, to: screenPose(), back: true };
    mode = 'zoom';
    redrawScreen();
    render();
    start();
    setTimeout(() => { if (zoom === z) endBack(); }, z.dur + 700);
    return true;
  }
  function endBack() {
    home();
    window.dispatchEvent(new CustomEvent('ms:mac-emerged'));
  }
  // La première section du site, recopiée dans l’écran (exacte si la fenêtre est assez large)
  let exact = false;
  function refreshHome() {
    const sec = document.getElementById('promesse');
    const hdr = document.querySelector('[data-header]');
    const de = document.documentElement;
    const wide = de.clientWidth / de.clientHeight >= 1.2 && Math.abs(VH - de.clientHeight) < 2 && Math.abs(VW - de.clientWidth) < 2;
    let snap = null;
    if (sec && wide) { try { snap = snapshot(sec, hdr); } catch (e) { snap = null; } }
    exact = !!snap;
    screen.setHome(snap);
    redrawScreen();
    start();
  }
  // Image figée de la fenêtre (le voile de transition la reprend pendant que le site arrive)
  function freeze(ctx, w, h) {
    render();
    const r = canvas.getBoundingClientRect();
    if (!r.width) return false;
    const k = canvas.width / r.width;
    const de = document.documentElement;
    ctx.drawImage(canvas, -r.left * k, -r.top * k, de.clientWidth * k, de.clientHeight * k, 0, 0, w, h);
    return true;
  }
  function reset() {
    zoom = null;
    demo = null;
    mode = 'closed';
    openT = 0;
    lid.rotation.x = 0;
    cursor.visible = false;
    screen.state.phase = 'off';
    screen.state.boot = screen.state.desk = screen.state.win = 0;
    screen.state.tab = 0;
    screen.setHover(null);
    dispMat.emissiveIntensity = 0;
    keyMat.emissiveIntensity = 0;
    redrawScreen();
    renderer.shadowMap.needsUpdate = true;
    start();
  }

  /* ----- Souris et toucher sur l’écran ----- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function screenPoint(clientX, clientY) {
    if (mode !== 'rest' && mode !== 'opening') return null;
    if (screen.state.win < 1) return null;
    const r = canvas.getBoundingClientRect();
    // le décalage de cadrage (setViewOffset) est déjà dans la matrice de projection
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    applyCamera();
    mac.updateMatrixWorld(true);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(display, false)[0];
    if (!hit || !hit.uv) return null;
    return { X: hit.uv.x * CW, Y: (1 - hit.uv.y) * CH };
  }
  let overScreen = false;
  function onMove(e) {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen' || !e.pointerType) {
      pointer.tx = clamp(e.clientX / window.innerWidth * 2 - 1, -1, 1);
      pointer.ty = clamp(e.clientY / window.innerHeight * 2 - 1, -1, 1);
      start();
    }
    if (e.pointerType === 'touch') return;
    const p = screenPoint(e.clientX, e.clientY);
    if (!p) {
      if (overScreen) { overScreen = false; canvas.style.cursor = ''; if (screen.setHover(null)) redrawScreen(); }
      return;
    }
    if (!overScreen) { overScreen = true; userTook = true; stopDemo(); window.dispatchEvent(new CustomEvent('ms:mac-hover')); }
    const hit = screen.hitTest(p.X, p.Y);
    const clickable = !!screen.targetOf(hit);
    canvas.style.cursor = 'none';
    placeCursor(p.X, p.Y, clickable);
    if (screen.setHover(hit)) redrawScreen();
  }
  function onLeave() {
    pointer.tx = 0; pointer.ty = 0;
    if (overScreen) { overScreen = false; canvas.style.cursor = ''; if (screen.setHover(null)) redrawScreen(); }
  }
  function onClick(e) {
    const p = screenPoint(e.clientX, e.clientY);
    if (!p) return;
    const hit = screen.hitTest(p.X, p.Y);
    const target = screen.targetOf(hit);
    if (!target) return;
    userTook = true;
    stopDemo();
    if (screen.setHover(hit)) redrawScreen();
    // au doigt, on laisse voir l’onglet changer avant de plonger
    const touch = e.pointerType === 'touch' || (window.matchMedia && window.matchMedia('(hover: none)').matches);
    if (touch) { placeCursor(p.X, p.Y, true); setTimeout(() => go(target), 320); }
    else go(target);
  }
  container.addEventListener('pointermove', onMove, { passive: true });
  container.addEventListener('pointerleave', onLeave, { passive: true });
  container.addEventListener('click', onClick);
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || overScreen) return;
    pointer.tx = clamp(e.clientX / window.innerWidth * 2 - 1, -1, 1);
    pointer.ty = clamp(e.clientY / window.innerHeight * 2 - 1, -1, 1);
    if (visible) start();
  }, { passive: true });

  /* ----- Boucle ----- */
  let last = performance.now();
  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const tNow = performance.now();
    const dt = Math.min(0.05, (tNow - last) / 1000);
    last = tNow;
    let active = false;
    if (mode === 'opening') {
      const t = now() - t0;
      applyOpen(Math.min(t, OPEN_END));
      if (t >= OPEN_END) finishOpen(true);
      active = true;
    }
    if (demo) { stepDemo(); active = true; }
    if (zoom && zoom.back) {
      active = true;
      if (now() - zoom.t0 >= zoom.dur) endBack();
    } else if (zoom) {
      active = true;
      if (now() - zoom.t0 >= zoom.dur && !zoom.done) {
        zoom.done = true;
        window.dispatchEvent(new CustomEvent('ms:mac-go', { detail: { target: zoom.target } }));
      }
    }
    const k = Math.min(1, dt * 3);
    if (Math.abs(pointer.tx - pointer.x) > 1e-4 || Math.abs(pointer.ty - pointer.y) > 1e-4) {
      pointer.x += (pointer.tx - pointer.x) * k;
      pointer.y += (pointer.ty - pointer.y) * k;
      dirty = true;
      active = true;
    }
    if (!visible && !zoom) { if (!active) running = false; return; }
    if (!dirty && !active) { running = false; return; }
    dirty = false;
    render();
  }
  function render() {
    applyCamera();
    renderer.render(scene, camera);
    if (first) { first = false; if (opts.onFirstFrame) opts.onFirstFrame(); }
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) { dirty = true; start(); } }).observe(container);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dirty = true; start(); } });
  if ('ResizeObserver' in window) new ResizeObserver(() => { resize(); start(); }).observe(container);
  else window.addEventListener('resize', () => { resize(); start(); });
  resize();
  applyOpen(0);
  render();
  start();

  return {
    canvas,
    open,
    skip,
    go,
    home,
    emerge,
    freeze,
    refreshHome,
    get exact() { return exact; },
    reset,
    anchor,
    resize,
    pause: stop,
    resume: () => { dirty = true; start(); },
    get mode() { return mode; },
    get busy() { return !!zoom; },
    screen,
    // rendu fixe (outils : affiche, image de partage)
    hold(t) { mode = t >= OPEN_END ? 'rest' : t > 0 ? 'opening' : 'closed'; applyOpen(t); render(); },
    snapshot() { render(); return canvas.toDataURL('image/png'); },
    _debug: Object.assign(debug, {
      THREE, scene, camera, renderer, parts, view, REST, START, tableMat, props,
      setClock(fn) { clockFn = fn; },
      tick() { loop(); render(); return canvas.toDataURL('image/png'); },
      redraw: () => { dirty = true; start(); }
    })
  };
}

// Outils partagés avec les natures mortes des études de cas (_msdesign-src/stilllife.js)
export { THREE, rrect, crease, flatSlab, canvasTex, rr, loadImage, roomEnvironment, softShadow, tableMaterial, waitFonts };
