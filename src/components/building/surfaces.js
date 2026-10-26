/* ── Procedural surface textures ─────────────────────────
   Small tileable canvases (no image downloads) for the customizer's
   house: oak planks, stone and ceramic tiles, outdoor decking, and a
   faint plaster grain for walls. Each is made once and shared; callers
   clone the texture to set their own repeat. */
import * as THREE from 'three';

const cache = new Map();

function canvas(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const noise = (g, size, alpha, n = 1800) => {
  for (let i = 0; i < n; i++) {
    const x = (i * 7919) % size, y = (i * 104729) % size;
    g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${alpha})`;
    g.fillRect(x, y, 2, 2);
  }
};

/* 1 m × 1 m of oak planks (4 planks across) */
function planks(base, dark) {
  return canvas(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const ph = s / 4;
    for (let r = 0; r < 4; r++) {
      const tone = ((r * 37) % 7) / 7;
      g.fillStyle = `rgba(0,0,0,${0.03 + tone * 0.08})`; g.fillRect(0, r * ph, s, ph);
      // grain
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(60,35,10,${0.05 + (k % 3) * 0.03})`; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, r * ph + (k + 0.5) * ph / 14 + Math.sin(k) * 2); g.lineTo(s, r * ph + (k + 0.5) * ph / 14 + Math.cos(k) * 2); g.stroke();
      }
      g.fillStyle = dark; g.fillRect(0, r * ph, s, 2);
      const joint = ((r * 97) % 5) * (s / 5);
      g.fillRect(joint, r * ph, 2, ph);
    }
    noise(g, s, 0.04);
  });
}

/* 1 m × 1 m of large stone tiles (2 across) */
function stone(base) {
  return canvas(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const n = 2, ts = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = `rgba(255,255,255,${((x * 3 + y * 5) % 4) * 0.025})`; g.fillRect(x * ts, y * ts, ts, ts);
    }
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, s); g.stroke(); g.beginPath(); g.moveTo(0, i * ts); g.lineTo(s, i * ts); g.stroke(); }
    noise(g, s, 0.05, 2600);
  });
}

/* 1 m × 1 m of small ceramic tiles (5 across) */
function ceramic(base, grout) {
  return canvas(256, (g, s) => {
    g.fillStyle = grout; g.fillRect(0, 0, s, s);
    const n = 5, ts = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = base; g.fillRect(x * ts + 2, y * ts + 2, ts - 4, ts - 4);
      g.fillStyle = `rgba(255,255,255,${((x * 7 + y * 3) % 5) * 0.03})`; g.fillRect(x * ts + 2, y * ts + 2, ts - 4, (ts - 4) / 2);
    }
  });
}

/* 1 m × 1 m of outdoor decking */
function decking(base) {
  return canvas(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const n = 7, ph = s / n;
    for (let r = 0; r < n; r++) {
      g.fillStyle = `rgba(0,0,0,${0.04 + ((r * 5) % 4) * 0.04})`; g.fillRect(0, r * ph, s, ph);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, r * ph, s, 3);
    }
    noise(g, s, 0.05);
  });
}

function plaster() {
  return canvas(256, (g, s) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    noise(g, s, 0.035, 5000);
  });
}

const MAKERS = {
  bedroom:  () => planks('#b58b5c', 'rgba(50,30,10,0.5)'),
  living:   () => planks('#c39a68', 'rgba(50,30,10,0.45)'),
  study:    () => planks('#a97f52', 'rgba(50,30,10,0.5)'),
  corridor: () => stone('#bdb4a6'),
  kitchen:  () => stone('#9e9a93'),
  bathroom: () => ceramic('#c3cfd6', '#8e9aa3'),
  balcony:  () => decking('#7f7a64'),
  plaster,
};

export function surfaceTexture(kind) {
  const key = MAKERS[kind] ? kind : 'living';
  if (!cache.has(key)) cache.set(key, MAKERS[key]());
  return cache.get(key);
}

/* A clone with its own repeat, for a surface w × d metres. */
export function surfaceFor(kind, w, d) {
  const t = surfaceTexture(kind).clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(1, w), Math.max(1, d));
  return t;
}
