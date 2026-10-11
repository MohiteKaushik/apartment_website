import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TOWERS, footprint, floorBase } from '../../data/towerGeometry';
import FLATS from '../../data/flats';

/* ── The floor plate ─────────────────────────────────────
   A 3D plan of one storey, drawn at the real height and size of the
   chosen floor so it sits inside the cut-open tower:

        ┌──────────┬───────────────┐
        │ 01 3 BHK │   02 4 BHK    │
        ├────── corridor ──────────┤      lift beside 01 / 04
        │   [LIFT]  [STAIRS]       │      stairs beside 02 / 03
        ├──────────┼───────────────┤
        │ 04 2 BHK │   03 4 BHK    │
        └──────────┴───────────────┘

   Every home has a living band along the corridor and bedrooms along the
   outer wall, with a little furniture so it reads as a plan from above.
   Local x runs along the plate's long side, local z along the short one;
   the group is turned to match the tower. */

const SPLIT_U = -0.08;       // where the smaller homes end (fraction of length)
const CORR = 0.15;           // corridor half-width (fraction of width)
const WALL_T = 0.03;
const OUTER_H = 0.2, INNER_H = 0.12;

const WOOD_BASE = new THREE.Color('#ffffff');   // the plan texture carries the colour
const WOOD_DIM = new THREE.Color('#6e665c');
const WOOD_HOT = new THREE.Color('#ffd98a');
const WALL  = new THREE.Color('#f6f2ea');
const WALL_HOT = new THREE.Color('#f3dc9c');
const GOLD = new THREE.Color('#c49a3c');

const unitRect = (id, L, W) => {
  const left = id === 'A' || id === 'D', top = id === 'A' || id === 'B';
  const u0 = left ? -0.5 : SPLIT_U, u1 = left ? SPLIT_U : 0.5;
  const v0 = top ? CORR : -0.5,     v1 = top ? 0.5 : -CORR;
  return { x: ((u0 + u1) / 2) * L, z: ((v0 + v1) / 2) * W, w: (u1 - u0) * L, d: (v1 - v0) * W, top };
};

/* world position of a home's centre — the camera dives here when it is chosen */
export function unitWorld(towerId, floor, flatId) {
  const t = TOWERS[towerId];
  const fp = footprint(towerId, floor);
  const L = (t.long === 'x' ? fp[0] : fp[1]) * 0.95, W = (t.long === 'x' ? fp[1] : fp[0]) * 0.93;
  const r = unitRect(flatId, L, W);
  const [cx, cz] = t.centre;
  // group rotation: 0 for A (local x → world x), π/2 for B (local x → world −z, local z → world x)
  return t.long === 'x'
    ? [cx + r.x, floorBase(floor), cz + r.z]
    : [cx + r.z, floorBase(floor), cz - r.x];
}

/* ── The plan of one home, drawn on a canvas ────────────
   Lines for the rooms and simple shapes for the furniture, used as the
   floor texture of that home. `rooms` bedrooms sit along the outer wall;
   the living band with sofa, dining and kitchen runs along the corridor.
   Drawn with the corridor at the BOTTOM of the canvas. */
const planCache = new Map();
function planTexture(type, aspect) {
  const key = `${type}:${aspect.toFixed(2)}`;
  if (planCache.has(key)) return planCache.get(key);
  if (typeof document === 'undefined') return null;
  const Wd = 1024, Hd = Math.round(1024 / aspect);
  const c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
  const g = c.getContext('2d');
  const rooms = type.startsWith('2') ? 2 : 3;
  const line = '#6b5a45', fill = '#efe8dc', wood = '#cfae84', tile = '#dcd6cc';
  const lw = Math.max(3, Wd / 260);

  // floors: wood in the rooms, tile in the living band
  g.fillStyle = wood; g.fillRect(0, 0, Wd, Hd);
  for (let i = 0; i < Hd; i += Hd / 18) { g.fillStyle = 'rgba(0,0,0,0.045)'; g.fillRect(0, i, Wd, Hd / 36); }
  const livY = Hd * 0.54;                       // top of the living band
  g.fillStyle = tile; g.fillRect(0, livY, Wd, Hd - livY);
  g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1;
  for (let x = 0; x < Wd; x += Wd / 16) { g.beginPath(); g.moveTo(x, livY); g.lineTo(x, Hd); g.stroke(); }
  for (let y = livY; y < Hd; y += Wd / 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(Wd, y); g.stroke(); }

  const rect = (x, y, w, h, f = fill) => { g.fillStyle = f; g.fillRect(x, y, w, h); g.strokeStyle = line; g.lineWidth = lw * 0.7; g.strokeRect(x, y, w, h); };
  const door = (x, y, r, a0, a1) => { g.strokeStyle = line; g.lineWidth = lw * 0.6; g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke(); };

  // bedrooms along the top
  const rw = Wd / rooms, bedH = livY;
  for (let i = 0; i < rooms; i++) {
    const x0 = i * rw;
    // bed against the outer wall
    const bw = rw * 0.42, bh = bedH * 0.46;
    rect(x0 + rw * 0.12, bedH * 0.08, bw, bh, '#f1ece3');
    rect(x0 + rw * 0.12, bedH * 0.08, bw, bh * 0.2, '#e0d8ca');       // pillows
    g.fillStyle = '#9bb3c5'; g.fillRect(x0 + rw * 0.12 + lw, bedH * 0.08 + bh * 0.22, bw - 2 * lw, bh * 0.72);  // cover
    // wardrobe
    rect(x0 + rw * 0.62, bedH * 0.08, rw * 0.3, bedH * 0.12, '#cfc6b8');
    // bathroom pocket by the corridor side
    g.fillStyle = '#d7dde2'; g.fillRect(x0 + rw * 0.62, bedH * 0.6, rw * 0.3, bedH * 0.36);
    g.strokeStyle = line; g.lineWidth = lw * 0.7; g.strokeRect(x0 + rw * 0.62, bedH * 0.6, rw * 0.3, bedH * 0.36);
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x0 + rw * 0.72, bedH * 0.8, rw * 0.045, bedH * 0.07, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // door from the living band
    door(x0 + rw * 0.4, livY, rw * 0.14, Math.PI, Math.PI * 1.5);
    if (i > 0) { g.strokeStyle = line; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0, livY); g.stroke(); }
  }
  // living / bedrooms wall
  g.strokeStyle = line; g.lineWidth = lw; g.beginPath(); g.moveTo(0, livY); g.lineTo(Wd, livY); g.stroke();

  // living band: kitchen counter (left), dining (middle), sofa + tv (right)
  const lh = Hd - livY;
  rect(lw, livY + lh * 0.08, Wd * 0.2, lh * 0.16, '#cfc6b8');                      // counter
  rect(lw, livY + lh * 0.08, Wd * 0.05, lh * 0.7, '#cfc6b8');
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(Wd * 0.4, livY + lh * 0.5, Wd * 0.055, lh * 0.22, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = line; g.lineWidth = lw * 0.7; g.stroke();   // dining table
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.fillStyle = '#e4ddd0'; g.beginPath(); g.arc(Wd * 0.4 + Math.cos(a) * Wd * 0.08, livY + lh * 0.5 + Math.sin(a) * lh * 0.32, Wd * 0.012, 0, Math.PI * 2); g.fill(); g.stroke(); }
  rect(Wd * 0.62, livY + lh * 0.3, Wd * 0.26, lh * 0.2, '#b9b3ab');              // sofa
  rect(Wd * 0.62, livY + lh * 0.3, Wd * 0.05, lh * 0.5, '#b9b3ab');
  rect(Wd * 0.64, livY + lh * 0.82, Wd * 0.22, lh * 0.06, '#8c8780');             // tv unit
  // front door from the corridor
  door(Wd * 0.5, Hd, Wd * 0.06, Math.PI, Math.PI * 2);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  planCache.set(key, t);
  return t;
}

function Box({ x, z, w, h, d, color, y = 0, mat, ...rest }) {
  return (
    <mesh position={[x, y + h / 2, z]} {...rest}>
      <boxGeometry args={[w, h, d]} />
      {mat || <meshStandardMaterial color={color} roughness={0.9} />}
    </mesh>
  );
}

function Unit({ flat, rect, hot, dimmed, onHover, onSelect }) {
  const floorMat = useRef(null), wallMats = useRef([]);
  const lit = useRef(0), dim = useRef(0);
  const { x, z, w, d, top } = rect;
  const tex = useMemo(() => {
    const t = planTexture(flat.type, w / d);
    if (!t) return null;
    // the plan is drawn with the corridor at the bottom; the top homes'
    // corridor is at smaller z, which is the top of the box's uv space
    const tt = t.clone(); tt.needsUpdate = true;
    tt.wrapT = THREE.RepeatWrapping;
    if (!top) { tt.repeat.set(1, -1); }
    return tt;
  }, [flat.type, w, d, top]);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 9);
    lit.current += ((hot ? 1 : 0) - lit.current) * k;
    dim.current += ((dimmed ? 1 : 0) - dim.current) * k;
    if (floorMat.current) {
      floorMat.current.color.copy(WOOD_BASE).lerp(WOOD_DIM, dim.current * 0.6).lerp(WOOD_HOT, lit.current * 0.6);
      floorMat.current.emissiveIntensity = 0.16 * lit.current;
    }
    wallMats.current.forEach((m) => { if (m) m.color.copy(WALL).lerp(WALL_HOT, lit.current); });
  });

  const dir = top ? 1 : -1;                     // +1: outer wall is at +z
  const outer = z + (dir * d) / 2;
  const living = d * 0.46;
  const bedD = d - living;
  const bedZ = outer - (dir * bedD) / 2;
  const rooms = flat.type.startsWith('2') ? 2 : 3;
  const roomW = w / rooms;
  const wallRef = (i) => (m) => { wallMats.current[i] = m; };
  let wi = 0;

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); onHover(flat.id); }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => { e.stopPropagation(); onSelect(flat); }}>
      <mesh position={[x, 0.012, z]}>
        <boxGeometry args={[w - WALL_T, 0.024, d - WALL_T]} />
        <meshStandardMaterial ref={floorMat} map={tex} color={WOOD_BASE} roughness={0.8} emissive={GOLD} emissiveIntensity={0} />
      </mesh>
      {/* low walls along the plan's lines: living / bedrooms and between bedrooms */}
      <Box x={x} z={outer - dir * bedD} w={w - WALL_T} h={INNER_H} d={WALL_T * 0.8}
        mat={<meshStandardMaterial ref={wallRef(wi++)} color={WALL} roughness={0.9} />} />
      {Array.from({ length: rooms - 1 }, (_, i) => (
        <Box key={i} x={x - w / 2 + roomW * (i + 1)} z={bedZ} w={WALL_T * 0.8} h={INNER_H} d={bedD}
          mat={<meshStandardMaterial ref={wallRef(wi++)} color={WALL} roughness={0.9} />} />
      ))}

      <Html position={[x, 0.26, z]} center zIndexRange={[12, 0]}
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap', textAlign: 'center',
                 opacity: dimmed ? 0.45 : 1, transition: 'opacity 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, padding: '5px 11px', borderRadius: 999,
                      background: hot ? 'rgba(40,30,10,0.86)' : 'rgba(8,8,10,0.62)',
                      border: `1px solid ${hot ? 'rgba(196,154,60,0.85)' : 'rgba(255,255,255,0.14)'}`,
                      backdropFilter: 'blur(6px)', transition: 'background 0.25s, border-color 0.25s, transform 0.25s',
                      transform: hot ? 'scale(1.12)' : 'scale(1)' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, lineHeight: 1, color: hot ? '#e6cf93' : '#fff' }}>
            {flat.unit}
          </span>
          <span style={{ fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: hot ? '#c49a3c' : 'rgba(255,255,255,0.7)' }}>
            {flat.type}{hot ? ` · ${flat.area}` : ''}
          </span>
        </div>
      </Html>
    </group>
  );
}

export default function FloorPlate({ towerId, floor, visible, hoverFlat, onHover, onSelect }) {
  const group = useRef(null);
  const show = useRef(0);
  const [L, W] = useMemo(() => {
    const fp = footprint(towerId, floor);
    const t = TOWERS[towerId];
    const long = t.long === 'x' ? fp[0] : fp[1], short = t.long === 'x' ? fp[1] : fp[0];
    return [long * 0.95, short * 0.93];
  }, [towerId, floor]);
  const [cx, cz] = TOWERS[towerId].centre;
  const y = floorBase(floor) + 0.02;
  const rotY = TOWERS[towerId].long === 'x' ? 0 : Math.PI / 2;

  useEffect(() => { show.current = 0; }, [towerId, floor]);
  useFrame((_, dt) => {
    if (!group.current) return;
    const k = 1 - Math.exp(-dt * 5);
    show.current += ((visible ? 1 : 0) - show.current) * k;
    const s = Math.max(0.001, show.current);
    group.current.scale.set(s, s, s);
    group.current.visible = show.current > 0.01;
  });

  const coreD = W * CORR * 2 * 0.72;
  const lift = { x: -0.09 * L, w: 0.1 * L }, stairs = { x: 0.08 * L, w: 0.12 * L };
  const steps = 6;
  const unitDepth = (0.5 - CORR) * W;

  return (
    <group ref={group} position={[cx, y, cz]} rotation={[0, rotY, 0]}>
      {/* slab + corridor */}
      <Box x={0} z={0} w={L} h={0.08} d={W} y={-0.08} color="#d8d2c6" />
      <Box x={0} z={0} w={L} h={0.008} d={W * CORR * 2} color="#b9b3aa" />
      {/* a thin runner down the corridor */}
      <Box x={0} z={0} w={L * 0.94} h={0.003} d={W * CORR * 0.55} y={0.008} color="#a39c92" />

      {FLATS.map((f) => (
        <Unit key={f.id} flat={f} rect={unitRect(f.id, L, W)} hot={hoverFlat === f.id}
          dimmed={!!hoverFlat && hoverFlat !== f.id} onHover={onHover} onSelect={onSelect} />
      ))}

      {/* outer walls, corridor walls, and the party walls between the homes */}
      <Box x={0} z={-W / 2} w={L} h={OUTER_H} d={WALL_T} color={WALL} />
      <Box x={0} z={W / 2} w={L} h={OUTER_H} d={WALL_T} color={WALL} />
      <Box x={-L / 2} z={0} w={WALL_T} h={OUTER_H} d={W} color={WALL} />
      <Box x={L / 2} z={0} w={WALL_T} h={OUTER_H} d={W} color={WALL} />
      <Box x={0} z={-W * CORR} w={L} h={INNER_H} d={WALL_T} color={WALL} />
      <Box x={0} z={W * CORR} w={L} h={INNER_H} d={WALL_T} color={WALL} />
      <Box x={SPLIT_U * L} z={(0.5 + CORR) / 2 * W} w={WALL_T} h={INNER_H} d={unitDepth} color={WALL} />
      <Box x={SPLIT_U * L} z={-(0.5 + CORR) / 2 * W} w={WALL_T} h={INNER_H} d={unitDepth} color={WALL} />

      {/* lift (with gold doors) and stairs */}
      <Box x={lift.x} z={0} w={lift.w} h={0.24} d={coreD} mat={<meshStandardMaterial color="#2a2a30" roughness={0.45} metalness={0.35} />} />
      <Box x={lift.x} z={coreD / 2 + 0.003} w={lift.w * 0.5} h={0.18} d={0.005} y={0.02} mat={<meshStandardMaterial color="#c49a3c" roughness={0.3} metalness={0.7} />} />
      <Box x={lift.x} z={-coreD / 2 - 0.003} w={lift.w * 0.5} h={0.18} d={0.005} y={0.02} mat={<meshStandardMaterial color="#c49a3c" roughness={0.3} metalness={0.7} />} />
      {Array.from({ length: steps }, (_, i) => (
        <Box key={i} x={stairs.x - stairs.w / 2 + (i + 0.5) * (stairs.w / steps)} z={0}
          w={stairs.w / steps} h={(0.22 * (i + 1)) / steps} d={coreD * 0.9} color="#8f877a" />
      ))}
      <Html position={[lift.x, 0.32, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: 7, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.8)', background: 'rgba(8,8,10,0.6)', padding: '2px 6px', borderRadius: 999 }}>LIFT</div>
      </Html>
      <Html position={[stairs.x, 0.32, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: 7, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.8)', background: 'rgba(8,8,10,0.6)', padding: '2px 6px', borderRadius: 999 }}>STAIRS</div>
      </Html>
    </group>
  );
}
