/* ─────────────────────────────────────────────────────────────
   Works out the walking route between every pair of tour stops.

     npm run tours:routes

   Reads   src/data/walkthroughTours.js   (the stops)
           public/assets/models/*.glb     (the flats)
   Writes  src/data/tourRoutes.json       (waypoints, used by GuidedTour)

   Re-run it whenever a stop is moved or added, or a flat model changes.

   How: the floor is cut into 10 cm cells. Two neighbouring cells are
   separated by a "tall" wall if a ray between them hits geometry just
   under eye height, or by a "low" wall if it only hits at waist height
   (the dollhouse-cut models have walls below eye level, and some doors are
   modelled shut). Cells with no floor under them are off limits. A* then
   finds the cheapest route: tall walls can't be crossed, low walls only at
   a heavy cost (so open doorways always win), and hugging walls costs
   extra. The route is then straightened into as few legs as possible.

     npm run tours:routes -- --debug    also writes a map per unit to
                                        tour-route-maps/ (gitignored):
                                        grey = low wall, white = tall wall,
                                        red = no floor, yellow = stops,
                                        coloured lines = routes
   ───────────────────────────────────────────────────────────── */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODEL = { '4bhk': 'flat.glb', '3bhk': 'flat_3bhk.glb', '2bhk': 'flat_2bhk.glb' };

const CELL        = 0.10;   // m
const LOW_HEIGHT  = 1.0;    // m — waist-height wall test
const TALL_BELOW  = 0.15;   // tall test sits this far under eye height
const LOW_PENALTY = 40;     // crossing a low wall costs as much as 4 m of walking
const MIN_CLEAR   = 2;      // straightened legs keep ≥ 20 cm from walls

// The tours file is plain ES-module source; load it without a bundler.
const toursSrc = readFileSync(join(ROOT, 'src/data/walkthroughTours.js'), 'utf8');
const { default: TOURS } = await import('data:text/javascript,' + encodeURIComponent(toursSrc));

THREE.Mesh.prototype.raycast = acceleratedRaycast;

async function loadModel(file) {
  const io  = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(join(ROOT, 'public/assets/models', file));
  const pos = [];
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      m.fromArray(node.getWorldMatrix());
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== 4) continue;               // triangles only
        const P = prim.getAttribute('POSITION').getArray();
        const I = prim.getIndices()?.getArray();
        const n = I ? I.length : P.length / 3;
        for (let k = 0; k < n; k++) {
          const idx = I ? I[k] : k;
          v.set(P[idx * 3], P[idx * 3 + 1], P[idx * 3 + 2]).applyMatrix4(m);
          pos.push(v.x, v.y, v.z);
        }
      }
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeBoundsTree = computeBoundsTree;
  geo.computeBoundsTree();
  geo.computeBoundingBox();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}

function routesFor(tour, mesh) {
  const box = mesh.geometry.boundingBox;
  const x0 = box.min.x - 0.3, z0 = box.min.z - 0.3;
  const NX = Math.ceil((box.max.x - x0 + 0.3) / CELL), NZ = Math.ceil((box.max.z - z0 + 0.3) / CELL);
  const floorY = tour.floorY || 0;
  const tallH  = floorY + tour.eyeHeight - TALL_BELOW;
  const lowH   = floorY + Math.min(LOW_HEIGHT, tour.eyeHeight - TALL_BELOW - 0.05);
  const cx = (i) => x0 + (i + 0.5) * CELL, cz = (j) => z0 + (j + 0.5) * CELL;
  const id = (i, j) => j * NX + i;

  const rc = new THREE.Raycaster(); rc.firstHitOnly = true;
  const o = new THREE.Vector3(), d = new THREE.Vector3();
  const hitAt = (h, ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    o.set(ax, h, az); d.set((bx - ax) / len, 0, (bz - az) / len);
    rc.set(o, d); rc.far = len;
    return rc.intersectObject(mesh).length > 0;
  };
  // 0 = open, 1 = low wall, 2 = tall wall — for the edge to the right (E) and below (S)
  const edge = (ax, az, bx, bz) =>
    (hitAt(tallH, ax, az, bx, bz) || hitAt(tallH, bx, bz, ax, az)) ? 2
      : (hitAt(lowH, ax, az, bx, bz) || hitAt(lowH, bx, bz, ax, az)) ? 1 : 0;

  const E = new Uint8Array(NX * NZ), S = new Uint8Array(NX * NZ), floor = new Uint8Array(NX * NZ);
  const down = new THREE.Vector3(0, -1, 0);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = id(i, j);
    if (i < NX - 1) E[k] = edge(cx(i), cz(j), cx(i + 1), cz(j));
    if (j < NZ - 1) S[k] = edge(cx(i), cz(j), cx(i), cz(j + 1));
    o.set(cx(i), floorY + 0.6, cz(j)); rc.set(o, down); rc.far = 0.8;
    floor[k] = rc.intersectObject(mesh).length > 0 ? 1 : 0;
  }
  const wallBetween = (i, j, di, dj) =>
    di === 1 ? E[id(i, j)] : di === -1 ? E[id(i - 1, j)] : dj === 1 ? S[id(i, j)] : S[id(i, j - 1)];

  // distance (in cells) to the nearest wall of either kind
  const D = new Int32Array(NX * NZ).fill(1e9), Q = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = id(i, j);
    if (E[k] || S[k] || (i > 0 && E[k - 1]) || (j > 0 && S[k - NX])) { D[k] = 0; Q.push(k); }
  }
  for (let h = 0; h < Q.length; h++) {
    const k = Q[h], i = k % NX, j = (k / NX) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
      const n = id(a, b);
      if (D[n] > D[k] + 1) { D[n] = D[k] + 1; Q.push(n); }
    }
  }

  const cellOf = (x, z) => [Math.floor((x - x0) / CELL), Math.floor((z - z0) / CELL)];

  function astar(a, b) {
    const [si, sj] = cellOf(a.x, a.z), [ti, tj] = cellOf(b.x, b.z);
    const G = new Float64Array(NX * NZ).fill(Infinity), P = new Int32Array(NX * NZ).fill(-1);
    const s = id(si, sj), t = id(ti, tj);
    G[s] = 0;
    const open = [[0, s]];                                // small grids: a plain list is fine
    while (open.length) {
      let bi = 0;
      for (let u = 1; u < open.length; u++) if (open[u][0] < open[bi][0]) bi = u;
      const [, k] = open.splice(bi, 1)[0];
      if (k === t) break;
      const i = k % NX, j = (k / NX) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a2 = i + di, b2 = j + dj;
        if (a2 < 0 || b2 < 0 || a2 >= NX || b2 >= NZ) continue;
        const n = id(a2, b2);
        if (!floor[n] && n !== t) continue;
        const w = wallBetween(i, j, di, dj);
        if (w === 2) continue;
        const near = D[n] >= 4 ? 0 : D[n] >= 2 ? (4 - D[n]) * 3 : 12;
        const g = G[k] + 1 + near + (w === 1 ? LOW_PENALTY : 0);
        if (g < G[n]) { G[n] = g; P[n] = k; open.push([g + Math.hypot(ti - a2, tj - b2), n]); }
      }
    }
    if (!isFinite(G[t])) return null;
    const path = [];
    for (let k = t; k !== -1; k = P[k]) path.unshift({ x: cx(k % NX), z: cz((k / NX) | 0) });
    return path;
  }

  // a straight leg is fine if it crosses no wall and keeps its distance from walls
  function clear(a, b) {
    const [ai, aj] = cellOf(a.x, a.z), [bi, bj] = cellOf(b.x, b.z);
    const need = Math.min(MIN_CLEAR, D[id(ai, aj)], D[id(bi, bj)]);
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.03);
    let pi = ai, pj = aj;
    for (let s = 1; s <= n; s++) {
      const [i, j] = cellOf(a.x + (b.x - a.x) * s / n, a.z + (b.z - a.z) * s / n);
      if (i === pi && j === pj) continue;
      if (i !== pi && j !== pj) {
        const viaX = wallBetween(pi, pj, i - pi, 0) || wallBetween(i, pj, 0, j - pj);
        const viaZ = wallBetween(pi, pj, 0, j - pj) || wallBetween(pi, j, i - pi, 0);
        if (viaX && viaZ) return false;
      } else if (wallBetween(pi, pj, i - pi, j - pj)) return false;
      if (!floor[id(i, j)] || D[id(i, j)] < need) return false;
      pi = i; pj = j;
    }
    return true;
  }
  function straighten(p) {
    const out = [p[0]];
    for (let k = 0; k < p.length - 1;) {
      let m = p.length - 1;
      while (m > k + 1 && !clear(p[k], p[m])) m--;
      out.push(p[m]); k = m;
    }
    return out;
  }

  const routes = {}, notes = [];
  for (const s of tour.stops) {
    const [i, j] = cellOf(s.x, s.z);
    if (floor[id(i, j)] && D[id(i, j)] >= 2) continue;
    // suggest the nearest reachable spot with floor and ≥ 30 cm clearance
    const seen = new Set([id(i, j)]), q = [[i, j]];
    let tip = '';
    for (let h = 0; h < q.length && h < 4000; h++) {
      const [a, b] = q[h];
      if (floor[id(a, b)] && D[id(a, b)] >= 3) { tip = ` — try x ${cx(a).toFixed(2)}, z ${cz(b).toFixed(2)}`; break; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a2 = a + di, b2 = b + dj;
        if (a2 < 0 || b2 < 0 || a2 >= NX || b2 >= NZ || seen.has(id(a2, b2)) || wallBetween(a, b, di, dj)) continue;
        seen.add(id(a2, b2)); q.push([a2, b2]);
      }
    }
    notes.push(`stop "${s.id}" is ${floor[id(i, j)] ? `only ${D[id(i, j)] * 10} cm from a wall` : 'not over the floor'}${tip}`);
  }
  for (const a of tour.stops) for (const b of tour.stops) {
    if (a === b) continue;
    const raw = astar(a, b);
    if (!raw) { notes.push(`no route ${a.id} -> ${b.id}`); continue; }
    const legs = straighten([{ x: a.x, z: a.z }, ...raw.slice(1, -1), { x: b.x, z: b.z }]);
    routes[`${a.id}>${b.id}`] = legs.slice(1, -1).map((p) => [+p.x.toFixed(2), +p.z.toFixed(2)]);
  }
  return { routes, notes, grid: { NX, NZ, x0, z0, E, S, floor } };
}

/* ── optional debug map (tiny PNG writer, no dependencies) ── */
function writePng(file, w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
  });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

function drawMap(file, tour, g, routes) {
  const PX = 4, W = g.NX * PX, H = g.NZ * PX, img = Buffer.alloc(W * H * 3, 24);
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; };
  const rect = (x, y, w, h, c) => { for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) put(x + a, y + b, c); };
  for (let j = 0; j < g.NZ; j++) for (let i = 0; i < g.NX; i++) {
    const k = j * g.NX + i;
    if (!g.floor[k]) rect(i * PX, j * PX, PX, PX, [70, 20, 20]);
    const col = (w) => (w === 2 ? [255, 255, 255] : [120, 120, 120]);
    if (g.E[k]) rect((i + 1) * PX - 1, j * PX, 2, PX, col(g.E[k]));
    if (g.S[k]) rect(i * PX, (j + 1) * PX - 1, PX, 2, col(g.S[k]));
  }
  const X = (x) => Math.round((x - g.x0) / CELL * PX), Z = (z) => Math.round((z - g.z0) / CELL * PX);
  const line = (a, b, c) => { const n = Math.max(Math.abs(X(b.x) - X(a.x)), Math.abs(Z(b.z) - Z(a.z)), 1);
    for (let s = 0; s <= n; s++) rect(Math.round(X(a.x) + (X(b.x) - X(a.x)) * s / n), Math.round(Z(a.z) + (Z(b.z) - Z(a.z)) * s / n), 2, 2, c); };
  const palette = [[79, 195, 247], [255, 183, 77], [129, 199, 132], [229, 115, 115], [186, 104, 200], [77, 182, 172], [240, 98, 146], [161, 136, 127], [255, 241, 118]];
  for (const [key, mid] of Object.entries(routes)) {
    const [a, b] = key.split('>').map((sid) => tour.stops.find((s) => s.id === sid));
    const pts = [a, ...mid.map(([x, z]) => ({ x, z })), b];
    const c = palette[tour.stops.indexOf(a) % palette.length];
    for (let k = 1; k < pts.length; k++) line(pts[k - 1], pts[k], c);
  }
  for (const s of tour.stops) { rect(X(s.x) - 4, Z(s.z) - 4, 9, 9, [255, 230, 0]);
    line(s, { x: s.x - Math.sin(s.yaw) * 0.6, z: s.z - Math.cos(s.yaw) * 0.6 }, [255, 230, 0]); }
  writePng(file, W, H, img);
}

const DEBUG = process.argv.includes('--debug');
const out = {};
for (const [key, tour] of Object.entries(TOURS)) {
  const t0 = Date.now();
  const mesh = await loadModel(MODEL[key]);
  const { routes, notes, grid } = routesFor(tour, mesh);
  if (DEBUG) {
    mkdirSync(join(ROOT, 'tour-route-maps'), { recursive: true });
    drawMap(join(ROOT, 'tour-route-maps', `${key}.png`), tour, grid, routes);
  }
  out[key] = routes;
  const pts = Object.values(routes).reduce((n, r) => n + r.length, 0);
  console.log(`${key}: ${Object.keys(routes).length} routes, ${pts} waypoints (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  notes.forEach((n) => console.log(`   ! ${n}`));
}
writeFileSync(join(ROOT, 'src/data/tourRoutes.json'), JSON.stringify(out) + '\n');
console.log('wrote src/data/tourRoutes.json');
