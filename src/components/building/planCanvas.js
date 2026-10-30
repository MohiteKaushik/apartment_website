/* ── Drawing a home's plan on a canvas ───────────────────
   An architect's plan with a touch of render: textured floors (oak in
   the bedrooms, stone in the living band, mosaic in the baths), walls
   in poché with door swings and windows, furniture with soft shadows,
   and the room names. The result is the floor texture of that home on
   the 3D floor plate. Drawn with the corridor at the BOTTOM. */
import { planLayout, wallSegments } from './planLayout';

const C = {
  outerWall: '#2a292d', innerWall: '#48474d', line: '#5b544b',
  oak: '#c8a375', oakDark: '#b58e60', stone: '#d8d2c6', stoneDark: '#cfc8bb',
  kitchenTile: '#b8b1a5', bathTile: '#c9d2d8', balcony: '#b4ada0',
  wood: '#8a6a49', fabric: '#6d7482', linen: '#f3efe7', duvet: '#aebfcf', metal: '#8f8f93',
  glass: '#9ec4dc', label: 'rgba(38,33,28,0.72)', plant: '#6c8a5a',
};

function shadowed(g, fn, blur = 10, alpha = 0.32, dy = 4) {
  g.save();
  g.shadowColor = `rgba(0,0,0,${alpha})`; g.shadowBlur = blur; g.shadowOffsetY = dy;
  fn(); g.restore();
}
function rrect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y); g.lineTo(x + w - rr, y); g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr); g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr); g.quadraticCurveTo(x, y, x + rr, y); g.closePath();
}
function box(g, x, y, w, h, fill, r = 2, stroke = C.line, lw = 1.2) {
  rrect(g, x, y, w, h, r); g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

/* ── floors ── */
function planks(g, x, y, w, h, base, dark) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = base; g.fillRect(x, y, w, h);
  const ph = 26;
  for (let r = 0, i = 0; r < h + ph; r += ph, i++) {
    const tone = ((i * 7919) % 11) / 11;
    g.fillStyle = `rgba(0,0,0,${0.02 + tone * 0.07})`; g.fillRect(x, y + r, w, ph);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, y + r, w, 1.2);
    const off = ((i * 131) % 7) * (w / 7);
    for (let xx = off; xx < w; xx += w / 2.4) g.fillRect(x + xx, y + r, 1.2, ph);
  }
  g.restore();
}
function tiles(g, x, y, w, h, size, base, grout = 'rgba(0,0,0,0.1)') {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = base; g.fillRect(x, y, w, h);
  for (let yy = 0; yy < h; yy += size) for (let xx = 0; xx < w; xx += size) {
    const t = (((xx / size) * 31 + (yy / size) * 17) % 9) / 9;
    g.fillStyle = `rgba(255,255,255,${t * 0.07})`; g.fillRect(x + xx, y + yy, size, size);
  }
  g.strokeStyle = grout; g.lineWidth = 1;
  for (let xx = 0; xx <= w; xx += size) { g.beginPath(); g.moveTo(x + xx, y); g.lineTo(x + xx, y + h); g.stroke(); }
  for (let yy = 0; yy <= h; yy += size) { g.beginPath(); g.moveTo(x, y + yy); g.lineTo(x + w, y + yy); g.stroke(); }
  g.restore();
}
/* soft darkening along the walls, so the rooms read as rooms */
function ambient(g, x, y, w, h, strength = 0.22) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.shadowColor = `rgba(0,0,0,${strength})`; g.shadowBlur = Math.min(w, h) * 0.16;
  g.lineWidth = 40; g.strokeStyle = 'rgba(0,0,0,1)';
  g.strokeRect(x - 20, y - 20, w + 40, h + 40);
  g.restore();
}

/* ── furniture ── */
function bed(g, x, y, w, h, master) {
  shadowed(g, () => box(g, x, y, w, h, C.linen, 6));
  box(g, x, y, w, h * 0.12, '#5e4c3c', 3, null);                                   // headboard
  box(g, x + w * 0.08, y + h * 0.16, w * 0.38, h * 0.16, '#ffffff', 4);            // pillows
  box(g, x + w * 0.54, y + h * 0.16, w * 0.38, h * 0.16, '#ffffff', 4);
  box(g, x + 3, y + h * 0.4, w - 6, h * 0.58, C.duvet, 4, null);
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x + 3, y + h * 0.5); g.lineTo(x + w - 3, y + h * 0.5); g.stroke();
  // nightstands with lamps
  const ns = Math.min(w * 0.18, h * 0.24);
  [x - ns - 6, x + w + 6].forEach((nx) => {
    shadowed(g, () => box(g, nx, y + 4, ns, ns, '#cfc6b8', 3), 6, 0.25, 2);
    g.fillStyle = master ? '#e6cf93' : '#eee7da'; g.beginPath(); g.arc(nx + ns / 2, y + 4 + ns / 2, ns * 0.26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.line; g.lineWidth = 1; g.stroke();
  });
}
function wardrobe(g, x, y, w, h) {
  shadowed(g, () => box(g, x, y, w, h, '#cdc4b5', 2), 6, 0.25, 2);
  g.strokeStyle = C.line; g.lineWidth = 1;
  const doors = Math.max(2, Math.round(w / 48));
  for (let i = 1; i < doors; i++) { g.beginPath(); g.moveTo(x + (w / doors) * i, y); g.lineTo(x + (w / doors) * i, y + h); g.stroke(); }
  g.fillStyle = C.metal;
  for (let i = 0; i < doors; i++) g.fillRect(x + (w / doors) * (i + 0.5) - 1, y + h * 0.4, 2, h * 0.2);
}
function bath(g, x, y, w, h) {
  // shower (top-left), WC (right), basin (bottom)
  const s = Math.min(w * 0.46, h * 0.5);
  g.setLineDash([5, 4]); box(g, x + 8, y + 8, s, s, 'rgba(255,255,255,0.35)', 3, C.line, 1.2); g.setLineDash([]);
  g.fillStyle = C.metal; g.beginPath(); g.arc(x + 8 + s / 2, y + 8 + s / 2, 4, 0, Math.PI * 2); g.fill();
  shadowed(g, () => {
    box(g, x + w - 30, y + 10, 20, 14, '#ffffff', 3);                              // tank
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x + w - 20, y + 36, 10, 14, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.line; g.lineWidth = 1.2; g.stroke();
    box(g, x + 10, y + h - 26, w * 0.5, 18, '#ffffff', 4);                          // basin
    g.beginPath(); g.ellipse(x + 10 + w * 0.25, y + h - 17, w * 0.14, 6, 0, 0, Math.PI * 2); g.stroke();
  }, 6, 0.22, 2);
}
function kitchen(g, x, y, w, h) {
  const d = Math.min(w * 0.3, 42);
  shadowed(g, () => {
    box(g, x, y, w, d, '#9c968d', 2);                 // top run with hob
    box(g, x, y, d, h * 0.75, '#9c968d', 2);          // left run with sink
    box(g, x + w - d * 1.2, y + d + 6, d * 1.2, d * 1.2, '#7c7a7c', 3);   // fridge
  }, 8, 0.28, 3);
  g.strokeStyle = C.line; g.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + w * 0.45 + (i % 2) * 18, y + d * 0.35 + Math.floor(i / 2) * 16, 6, 0, Math.PI * 2); g.stroke(); }
  box(g, x + 7, y + d + 12, d - 14, d * 1.1, '#e4e0d8', 5);                        // sink
  g.beginPath(); g.moveTo(x + d / 2, y + d + 10); g.lineTo(x + d / 2, y + d + 2); g.stroke();
}
function dining(g, x, y, w, h) {
  const tw = Math.min(w * 0.5, 140), th = Math.min(h * 0.36, 70);
  const cx = x + w / 2, cy = y + h * 0.5;
  const chair = (px, py) => { g.fillStyle = '#e8e2d8'; rrect(g, px - 11, py - 11, 22, 22, 6); g.fill(); g.strokeStyle = C.line; g.lineWidth = 1; g.stroke(); };
  for (let i = 0; i < 3; i++) { chair(cx - tw / 2 + tw * (0.2 + i * 0.3), cy - th / 2 - 16); chair(cx - tw / 2 + tw * (0.2 + i * 0.3), cy + th / 2 + 16); }
  shadowed(g, () => box(g, cx - tw / 2, cy - th / 2, tw, th, C.wood, 8), 10, 0.32, 4);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.strokeRect(cx - tw / 2 + 8, cy - th / 2 + 8, tw - 16, th - 16);
  // a pendant light over the table
  g.fillStyle = '#e6cf93'; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
}
function living(g, x, y, w, h) {
  const rw = w * 0.62, rh = h * 0.6, rx = x + w * 0.1, ry = y + h * 0.2;
  box(g, rx, ry, rw, rh, '#b9afa1', 2, 'rgba(0,0,0,0.2)', 1);                    // rug
  g.strokeStyle = 'rgba(0,0,0,0.15)'; g.strokeRect(rx + 8, ry + 8, rw - 16, rh - 16);
  const sd = Math.min(rh * 0.3, 40);
  shadowed(g, () => {
    box(g, rx - 6, ry + rh - sd + 6, rw * 0.78, sd, C.fabric, 8);                 // sofa, bottom
    box(g, rx - 6, ry + 10, sd, rh - sd + 4, C.fabric, 8);                        // sofa, side
  }, 10, 0.32, 4);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(rx - 6 + (rw * 0.78 / 4) * i, ry + rh - sd + 8); g.lineTo(rx - 6 + (rw * 0.78 / 4) * i, ry + rh + 4); g.stroke(); }
  shadowed(g, () => box(g, rx + rw * 0.36, ry + rh * 0.36, rw * 0.3, rh * 0.22, C.wood, 6), 8, 0.3, 3);   // coffee table
  shadowed(g, () => box(g, x + w - 26, y + h * 0.18, 16, h * 0.5, '#5a5756', 2), 6, 0.25, 2);             // tv unit
  g.fillStyle = '#1e1e22'; g.fillRect(x + w - 22, y + h * 0.26, 4, h * 0.34);
  g.fillStyle = C.plant; g.beginPath(); g.arc(x + w - 24, y + h - 24, 13, 0, Math.PI * 2); g.fill();        // plant
  g.fillStyle = '#4f6b42'; g.beginPath(); g.arc(x + w - 28, y + h - 28, 6, 0, Math.PI * 2); g.fill();
}
function foyer(g, x, y, w, h) {
  box(g, x + 8, y + 8, 14, h * 0.55, '#cdc4b5', 2);                                 // shoe cabinet
  box(g, x + w * 0.3, y + h - 22, w * 0.4, 12, 'rgba(90,70,50,0.35)', 2, null);    // mat
}
function balcony(g, x, y, w, h) {
  g.fillStyle = C.plant;
  [[x + 16, y + h / 2], [x + w - 16, y + h / 2]].forEach(([px, py]) => { g.beginPath(); g.arc(px, py, Math.min(h * 0.32, 11), 0, Math.PI * 2); g.fill(); });
  const cs = Math.min(h * 0.5, 16);
  box(g, x + w * 0.45 - cs - 10, y + h / 2 - cs / 2, cs, cs, '#e8e2d8', 4);
  box(g, x + w * 0.45 + 10, y + h / 2 - cs / 2, cs, cs, '#e8e2d8', 4);
  box(g, x + w * 0.45 - 6, y + h / 2 - cs * 0.3, 12, cs * 0.6, C.wood, 3);
}

export function drawPlan(c, type, { labels = true } = {}) {
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const X = (u) => u * W, Y = (v) => v * H;
  const L = planLayout(type);
  const OUT = Math.round(W / 96), IN = Math.round(W / 170);   // wall thickness

  g.fillStyle = C.stone; g.fillRect(0, 0, W, H);

  // floors
  L.rooms.forEach((r) => {
    const x = X(r.u0), y = Y(r.v0), w = X(r.u1) - x, h = Y(r.v1) - y;
    if (r.type === 'bed') planks(g, x, y, w, h, C.oak, C.oakDark);
    else if (r.type === 'bath') tiles(g, x, y, w, h, Math.max(10, W / 110), C.bathTile, 'rgba(255,255,255,0.35)');
    else if (r.type === 'kitchen') tiles(g, x, y, w, h, W / 26, C.kitchenTile);
    else if (r.type === 'balcony') tiles(g, x, y, w, h, W / 40, C.balcony);
    else tiles(g, x, y, w, h, W / 14, r.type === 'foyer' ? C.stoneDark : C.stone);
  });
  L.rooms.filter((r) => r.type !== 'bath').forEach((r) => ambient(g, X(r.u0), Y(r.v0), X(r.u1) - X(r.u0), Y(r.v1) - Y(r.v0), r.type === 'bed' ? 0.26 : 0.18));

  // furniture
  L.rooms.forEach((r) => {
    const x = X(r.u0), y = Y(r.v0), w = X(r.u1) - x, h = Y(r.v1) - y;
    const pad = IN + 6;
    if (r.type === 'bed') {
      const wardW = Math.min(w * 0.2, 60), bx0 = x + pad + wardW + 24;
      const bathX = X(r.bath.u0);
      const avail = bathX - bx0 - 16;
      const bw = Math.min(avail * 0.62, 150), bh = Math.min(h * 0.52, bw * 1.25);
      wardrobe(g, x + pad, y + pad, wardW, h * 0.55);
      bed(g, bx0 + (avail - bw) / 2, y + pad + 2, bw, bh, r.label.startsWith('Master'));
    } else if (r.type === 'bath') bath(g, x + IN / 2, y + IN / 2, w - IN, h - IN);
    else if (r.type === 'kitchen') kitchen(g, x + pad, y + pad, w - pad * 2, h - pad * 2);
    else if (r.type === 'dining') dining(g, x, y, w, h);
    else if (r.type === 'living') living(g, x + pad, y + pad, w - pad * 2, h - pad * 2);
    else if (r.type === 'foyer') foyer(g, x, y, w, h);
    else if (r.type === 'balcony') balcony(g, x, y, w, h);
  });

  // walls (door openings already cut out)
  g.lineCap = 'butt';
  wallSegments(L).forEach((s) => {
    g.strokeStyle = s.kind === 'outer' ? C.outerWall : C.innerWall;
    g.lineWidth = s.kind === 'outer' ? OUT : IN;
    g.beginPath(); g.moveTo(X(s.u0), Y(s.v0)); g.lineTo(X(s.u1), Y(s.v1)); g.stroke();
  });
  // windows: a glazed strip inside the outer wall
  L.windows.forEach((win) => {
    const x0 = X(win.u0), x1 = X(win.u1), y = Y(win.v);
    const t = win.v === 0 ? OUT : IN;
    g.fillStyle = win.glass ? C.glass : '#dfe8ee'; g.fillRect(x0, y - t / 2, x1 - x0, t);
    g.strokeStyle = win.glass ? '#5f93b3' : C.outerWall; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.strokeStyle = C.outerWall; g.lineWidth = 1; g.strokeRect(x0, y - t / 2, x1 - x0, t);
  });
  // balcony railing: glass line at the outer edge
  L.rooms.filter((r) => r.type === 'balcony').forEach((r) => {
    g.strokeStyle = C.glass; g.lineWidth = 3; g.beginPath(); g.moveTo(X(r.u0) + OUT, OUT / 2); g.lineTo(X(r.u1) - OUT, OUT / 2); g.stroke();
  });
  // doors: leaf + swing
  L.doors.forEach((d) => {
    const size = d.axis === 'u' ? X(d.size) : Y(d.size);
    const cx = X(d.u), cy = Y(d.v);
    g.strokeStyle = C.line; g.lineWidth = d.front ? 2.2 : 1.4;
    if (d.axis === 'u') {
      const hx = cx - size / 2, dir = d.into === 'up' ? -1 : 1;
      g.beginPath(); g.moveTo(hx, cy); g.lineTo(hx, cy + dir * size); g.stroke();
      g.beginPath(); g.arc(hx, cy, size, dir < 0 ? -Math.PI / 2 : 0, dir < 0 ? 0 : Math.PI / 2); g.stroke();
    } else {
      const hy = cy - size / 2;
      g.beginPath(); g.moveTo(cx, hy); g.lineTo(cx + size, hy); g.stroke();
      g.beginPath(); g.arc(cx, hy, size, 0, Math.PI / 2); g.stroke();
    }
  });
  // front door marker
  const fd = L.doors.find((d) => d.front);
  if (fd) { g.fillStyle = '#c49a3c'; g.beginPath(); g.arc(X(fd.u), Y(fd.v), OUT * 0.5, 0, Math.PI * 2); g.fill(); }

  // room names
  if (!labels) return;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  L.rooms.filter((r) => r.label).forEach((r) => {
    const x = (X(r.u0) + X(r.u1)) / 2;
    const y = r.type === 'bed' ? Y(r.v1) - 22 : r.type === 'bath' ? Y(r.v0) + 12 : r.type === 'balcony' ? Y(r.v1) - 9 : Y(r.v1) - 18;
    const size = r.type === 'bath' || r.type === 'balcony' ? 9 : 12;
    g.font = `500 ${size}px Poppins, system-ui, sans-serif`;
    const label = r.label.toUpperCase().split('').join(String.fromCharCode(8202));
    const tw = g.measureText(label).width;
    if (r.type !== 'bath') { g.fillStyle = 'rgba(255,252,246,0.55)'; rrect(g, x - tw / 2 - 7, y - size * 0.75, tw + 14, size * 1.5, size * 0.75); g.fill(); }
    g.fillStyle = C.label; g.fillText(label, Math.max(x, X(r.u0) + tw / 2 + 4), y);
  });
}

/* ── A small picture of the plan for the home cards ──────
   Drawn once per type at 2:1 and kept as a data URL. */
const thumbs = new Map();
export function planThumbnail(type, w = 480, h = 240) {
  const key = `${type}:${w}x${h}`;
  if (thumbs.has(key)) return thumbs.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawPlan(c, type, { labels: false });
  const url = c.toDataURL('image/png');
  thumbs.set(key, url);
  return url;
}
