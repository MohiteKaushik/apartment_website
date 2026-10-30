import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TOWERS, footprint, floorBase } from '../../data/towerGeometry';
import FLATS from '../../data/flats';
import { planLayout, wallSegments } from './planLayout';
import { drawPlan } from './planCanvas';
import { STATUS, statusOf } from '../../data/availability';

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

export const unitRect = (id, L, W) => {
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

/* The plan of one home as a texture (see planCanvas.js), one per type. */
const planCache = new Map();
function planTexture(type, aspect) {
  const key = `${type}:${aspect.toFixed(2)}`;
  if (planCache.has(key)) return planCache.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 1536; c.height = Math.round(1536 / aspect);
  drawPlan(c, type);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
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

function Unit({ flat, rect, hot, dimmed, status, shown, onHover, onSelect }) {
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
  const segs = useMemo(() => wallSegments(planLayout(flat.type)).filter((w) => w.kind !== 'outer'), [flat.type]);
  // plan coordinates → plate coordinates
  const px = (u) => x - w / 2 + u * w;
  const pz = (v) => z + dir * d * (0.5 - v);
  const wallRef = (i) => (m) => { wallMats.current[i] = m; };

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); onHover(flat.id); }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => { e.stopPropagation(); onSelect(flat); }}>
      <mesh position={[x, 0.012, z]}>
        <boxGeometry args={[w - WALL_T, 0.024, d - WALL_T]} />
        <meshStandardMaterial ref={floorMat} map={tex} color={WOOD_BASE} roughness={0.8} emissive={GOLD} emissiveIntensity={0} />
      </mesh>
      {/* low walls along the plan's lines, with the door openings left out */}
      {segs.map((sg, i) => {
        const horizontal = sg.v0 === sg.v1;
        const cx = (px(sg.u0) + px(sg.u1)) / 2, cz = (pz(sg.v0) + pz(sg.v1)) / 2;
        const len = horizontal ? Math.abs(px(sg.u1) - px(sg.u0)) : Math.abs(pz(sg.v1) - pz(sg.v0));
        return (
          <Box key={i} x={cx} z={cz} w={horizontal ? len + WALL_T * 0.8 : WALL_T * 0.8} h={INNER_H} d={horizontal ? WALL_T * 0.8 : len + WALL_T * 0.8}
            mat={<meshStandardMaterial ref={wallRef(i)} color={WALL} roughness={0.9} />} />
        );
      })}

      <Html position={[x, 0.26, z]} center zIndexRange={[12, 0]}
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap', textAlign: 'center',
                 opacity: !shown ? 0 : dimmed ? 0.45 : 1, transition: 'opacity 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, padding: '5px 11px', borderRadius: 999,
                      background: hot ? 'rgba(40,30,10,0.86)' : 'rgba(8,8,10,0.62)',
                      border: `1px solid ${hot ? 'rgba(196,154,60,0.85)' : 'rgba(255,255,255,0.14)'}`,
                      backdropFilter: 'blur(6px)', transition: 'background 0.25s, border-color 0.25s, transform 0.25s',
                      transform: hot ? 'scale(1.12)' : 'scale(1)' }}>
          <span style={{ alignSelf: 'center', width: 6, height: 6, borderRadius: 999, background: STATUS[status].colour, boxShadow: `0 0 6px ${STATUS[status].colour}` }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.02em', fontSize: 15, lineHeight: 1, color: hot ? '#e6cf93' : '#fff' }}>
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
        <Unit key={f.id} flat={f} rect={unitRect(f.id, L, W)} hot={hoverFlat === f.id} status={statusOf(towerId, floor, f.id)} shown={visible}
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
      <Html position={[lift.x, 0.32, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none', opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}>
        <div style={{ fontSize: 7, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.8)', background: 'rgba(8,8,10,0.6)', padding: '2px 6px', borderRadius: 999 }}>LIFT</div>
      </Html>
      <Html position={[stairs.x, 0.32, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none', opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}>
        <div style={{ fontSize: 7, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.8)', background: 'rgba(8,8,10,0.6)', padding: '2px 6px', borderRadius: 999 }}>STAIRS</div>
      </Html>
    </group>
  );
}
