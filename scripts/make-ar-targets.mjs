/* ─────────────────────────────────────────────────────────────
   Generates printable AR tracking artwork for Vayam.

     node scripts/make-ar-targets.mjs

   Writes public/ar/print/target-card.svg  (89 × 51 mm visiting-card back)
          public/ar/print/target-a5.svg    (148 × 210 mm pamphlet panel)

   Why a synthetic floor plan and not the logo: MindAR matches corner features.
   A wordmark on white gives it a few dozen; a plan drawing with partition
   walls, door swings, dimension chains and room labels gives it thousands,
   spread evenly across the whole surface. The layout is seeded, so it is
   asymmetric and non-repeating — both of which the tracker needs.
   ───────────────────────────────────────────────────────────── */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ar', 'print');

const INK = '#101010';
const GOLD = '#b08a30';

/** Deterministic PRNG so re-running produces the identical printable file. */
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const ROOMS = ['MASTER BED', 'BEDROOM 2', 'BEDROOM 3', 'LIVING', 'DINING',
  'KITCHEN', 'UTILITY', 'BALCONY', 'FOYER', 'BATH', 'W.I.C.', 'STUDY',
  'POWDER', 'PANTRY', 'DECK', 'LOBBY'];

/** Recursive binary subdivision — a plausible, irregular floor plate. */
function subdivide(x, y, w, h, depth, rand, out) {
  const minSide = 13;
  if (depth === 0 || (w < minSide * 2 && h < minSide * 2)) {
    out.push({ x, y, w, h });
    return;
  }
  const vertical = w > h ? rand() < 0.82 : rand() < 0.18;
  const t = 0.34 + rand() * 0.32;
  if (vertical) {
    const cut = Math.round(w * t);
    if (cut < minSide || w - cut < minSide) { out.push({ x, y, w, h }); return; }
    subdivide(x, y, cut, h, depth - 1, rand, out);
    subdivide(x + cut, y, w - cut, h, depth - 1, rand, out);
  } else {
    const cut = Math.round(h * t);
    if (cut < minSide || h - cut < minSide) { out.push({ x, y, w, h }); return; }
    subdivide(x, y, w, cut, depth - 1, rand, out);
    subdivide(x, y + cut, w, h - cut, depth - 1, rand, out);
  }
}

function build({ wmm, hmm, seed, depth, label }) {
  const rand = rng(seed);
  const W = 1000;                            // internal units
  const H = Math.round(W * hmm / wmm);
  const pad = Math.round(W * 0.055);
  const plan = { x: pad, y: pad + H * 0.06, w: W - pad * 2, h: H - pad * 2 - H * 0.14 };

  const cells = [];
  subdivide(plan.x, plan.y, plan.w, plan.h, depth, rand, cells);

  const p = [];
  const push = (s) => p.push(s);

  push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);

  // Corner registration marks — also strong, unambiguous features.
  const m = Math.round(W * 0.028), off = Math.round(W * 0.018);
  for (const [cx, cy, sx, sy] of [[off, off, 1, 1], [W - off, off, -1, 1],
                                  [off, H - off, 1, -1], [W - off, H - off, -1, -1]]) {
    push(`<path d="M${cx} ${cy + sy * m}V${cy}H${cx + sx * m}" fill="none" stroke="${INK}" stroke-width="4"/>`);
  }

  // Header band
  push(`<text x="${pad}" y="${Math.round(H * 0.055)}" font-family="Georgia,serif" font-size="${Math.round(W * 0.046)}" letter-spacing="${W * 0.014}" fill="${INK}">VAYAM</text>`);
  push(`<text x="${W - pad}" y="${Math.round(H * 0.052)}" text-anchor="end" font-family="Helvetica,Arial,sans-serif" font-size="${Math.round(W * 0.019)}" letter-spacing="${W * 0.004}" fill="${GOLD}">${label}</text>`);
  push(`<line x1="${pad}" y1="${Math.round(H * 0.066)}" x2="${W - pad}" y2="${Math.round(H * 0.066)}" stroke="${INK}" stroke-width="2"/>`);

  // Rooms
  const fs = Math.round(W * 0.0155);
  // Rough advance width for Helvetica caps, used to keep labels inside walls.
  const textW = (str, size, tracking = 1) => str.length * (size * 0.62 + tracking);

  cells.forEach((c, i) => {
    const inset = 3;
    const ix = c.x + inset, iy = c.y + inset;
    const iw = c.w - inset * 2, ih = c.h - inset * 2;
    const clip = `c${i}`;

    push(`<clipPath id="${clip}"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}"/></clipPath>`);
    push(`<g clip-path="url(#${clip})">`);

    // Hatched service areas
    if (rand() < 0.3) {
      const lines = [];
      for (let d = -ih; d < iw; d += 9) lines.push(`M${ix + d} ${iy}l${ih} ${ih}`);
      push(`<path d="${lines.join('')}" stroke="${INK}" stroke-width="0.9" opacity="0.5" fill="none"/>`);
    }

    // Floor tile grid
    if (rand() < 0.4) {
      const g = 16, gl = [];
      for (let gx = ix + g; gx < ix + iw; gx += g) gl.push(`M${gx} ${iy}v${ih}`);
      for (let gy = iy + g; gy < iy + ih; gy += g) gl.push(`M${ix} ${gy}h${iw}`);
      push(`<path d="${gl.join('')}" stroke="${INK}" stroke-width="0.55" opacity="0.32" fill="none"/>`);
    }

    // Door swing, kept inside the room it belongs to
    if (iw > 34 && ih > 34) {
      const r = Math.min(iw, ih) * 0.3;
      const dx = ix + 6 + rand() * Math.max(1, iw - r - 12);
      const dy = iy + ih - 2;
      push(`<path d="M${dx} ${dy}v${-r}a${r} ${r} 0 0 1 ${r} ${r}z" fill="none" stroke="${INK}" stroke-width="1.6"/>`);
    }
    push(`</g>`);

    push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="none" stroke="${INK}" stroke-width="${rand() < 0.3 ? 5 : 3}"/>`);

    // Label + area, only when they genuinely fit between the walls
    const name = ROOMS[(i * 7 + seed) % ROOMS.length];
    let size = fs;
    while (size > fs * 0.62 && textW(name, size) > iw - 10) size -= 0.5;
    if (textW(name, size) <= iw - 10 && ih > size * 2.2) {
      const cy = iy + ih / 2;
      const twoLine = ih > size * 3.4;
      push(`<text x="${ix + iw / 2}" y="${twoLine ? cy : cy + size * 0.35}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${size.toFixed(1)}" letter-spacing="1" fill="${INK}">${name}</text>`);
      if (twoLine) {
        const area = Math.round(iw * ih / 260) * 5;
        push(`<text x="${ix + iw / 2}" y="${cy + size * 1.35}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${(size * 0.82).toFixed(1)}" fill="${INK}" opacity="0.62">${area} SQ.FT</text>`);
      }
    }
  });

  // Dimension chain across the top of the plate
  const dimY = plan.y - 14;
  let cx = plan.x;
  const stops = [0.19, 0.37, 0.62, 0.81, 1];
  push(`<line x1="${plan.x}" y1="${dimY}" x2="${plan.x + plan.w}" y2="${dimY}" stroke="${INK}" stroke-width="1.2"/>`);
  for (const s of stops) {
    const xEnd = plan.x + plan.w * s;
    push(`<path d="M${xEnd} ${dimY - 7}v14" stroke="${INK}" stroke-width="1.6"/>`);
    push(`<text x="${(cx + xEnd) / 2}" y="${dimY - 10}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${fs * 0.85}" fill="${INK}">${(((xEnd - cx) / plan.w) * 14.2).toFixed(2)}</text>`);
    cx = xEnd;
  }

  // North arrow + scale bar + footer text
  const fy = H - Math.round(H * 0.045);
  push(`<g transform="translate(${pad + 14} ${fy - 16})"><path d="M0 14L7 -12L14 14L7 7z" fill="${INK}"/><text x="7" y="26" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="${fs * 0.9}" fill="${INK}">N</text></g>`);
  const sbx = pad + 70;
  for (let i = 0; i < 6; i++) {
    push(`<rect x="${sbx + i * 22}" y="${fy - 6}" width="22" height="7" fill="${i % 2 ? '#ffffff' : INK}" stroke="${INK}" stroke-width="1"/>`);
  }
  push(`<text x="${sbx}" y="${fy + 16}" font-family="Helvetica,Arial,sans-serif" font-size="${fs * 0.8}" fill="${INK}">0    2    4    6 m</text>`);
  push(`<text x="${W - pad}" y="${fy}" text-anchor="end" font-family="Helvetica,Arial,sans-serif" font-size="${fs * 0.95}" letter-spacing="2" fill="${GOLD}">SCAN THIS SIDE · VAYAM RESIDENCES</text>`);
  push(`<text x="${W - pad}" y="${fy + 17}" text-anchor="end" font-family="Helvetica,Arial,sans-serif" font-size="${fs * 0.78}" fill="${INK}" opacity="0.6">TYPICAL FLOOR PLATE · NOT TO SCALE · REV ${seed}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${wmm}mm" height="${hmm}mm" viewBox="0 0 ${W} ${H}">
${p.join('\n')}
</svg>
`;
}

mkdirSync(OUT, { recursive: true });

const jobs = [
  { file: 'target-card.svg', wmm: 89,  hmm: 51,  seed: 7,  depth: 4, label: 'VISITING CARD · REVERSE' },
  { file: 'target-a5.svg',   wmm: 148, hmm: 210, seed: 23, depth: 5, label: 'PAMPHLET PANEL A5' },
];

for (const j of jobs) {
  const svg = build(j);
  writeFileSync(join(OUT, j.file), svg);
  console.log(`wrote print/${j.file}  (${j.wmm} × ${j.hmm} mm, ${(svg.length / 1024).toFixed(0)} KB)`);
}

console.log('\nNext: open /ar/compile.html, drop these in, save vayam.mind to public/ar/targets/');
