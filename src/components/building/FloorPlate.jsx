import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { TOWERS, footprint, floorBase } from '../../data/towerGeometry';
import FLATS from '../../data/flats';

/* ── The floor plate ─────────────────────────────────────
   A simple 3D plan of one storey, drawn at the real height and size of
   the chosen floor so it sits inside the cut-open tower:

        ┌──────────┬───────────────┐
        │ 01 3 BHK │   02 4 BHK    │
        ├────── corridor ──────────┤      lift beside 01 / 04
        │   [LIFT]  [STAIRS]       │      stairs beside 02 / 03
        ├──────────┼───────────────┤
        │ 04 2 BHK │   03 4 BHK    │
        └──────────┴───────────────┘

   Local x runs along the plate's long side, local z along the short one;
   the group is turned to match the tower. */

const GOLD = new THREE.Color('#c49a3c');
const SPLIT_U = -0.08;       // where the smaller homes end (fraction of length)
const CORR = 0.2;            // corridor half-width (fraction of width)
const WALL_H = 0.15, WALL_T = 0.028;

const unitRect = (id, L, W) => {
  const left = id === 'A' || id === 'D', top = id === 'A' || id === 'B';
  const u0 = left ? -0.5 : SPLIT_U, u1 = left ? SPLIT_U : 0.5;
  const v0 = top ? CORR : -0.5,     v1 = top ? 0.5 : -CORR;
  return { x: ((u0 + u1) / 2) * L, z: ((v0 + v1) / 2) * W, w: (u1 - u0) * L, d: (v1 - v0) * W };
};

function Wall({ x, z, w, d }) {
  return (
    <mesh position={[x, WALL_H / 2, z]} castShadow={false}>
      <boxGeometry args={[w, WALL_H, d]} />
      <meshStandardMaterial color="#f3efe6" roughness={0.85} />
    </mesh>
  );
}

const CREAM = new THREE.Color('#e7e1d4'), WARM = new THREE.Color('#e3c27a');

function Unit({ flat, rect, hot, onHover, onSelect }) {
  const mat = useRef(null);
  const lit = useRef(0);
  useFrame((_, dt) => {
    if (!mat.current) return;
    const k = 1 - Math.exp(-dt * 10);
    lit.current += ((hot ? 1 : 0) - lit.current) * k;
    mat.current.emissiveIntensity = 0.32 * lit.current;
    mat.current.color.copy(CREAM).lerp(WARM, lit.current);
  });
  return (
    <group>
      <mesh position={[rect.x, 0.012, rect.z]}
        onPointerOver={(e) => { e.stopPropagation(); onHover(flat.id); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); onSelect(flat); }}>
        <boxGeometry args={[rect.w - WALL_T, 0.024, rect.d - WALL_T]} />
        <meshStandardMaterial ref={mat} color="#e7e1d4" roughness={0.9} emissive={GOLD} emissiveIntensity={0} />
      </mesh>
      <Html position={[rect.x, 0.2, rect.z]} center zIndexRange={[12, 0]}
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, padding: '5px 10px', borderRadius: 999,
                      background: hot ? 'rgba(40,30,10,0.82)' : 'rgba(8,8,10,0.62)',
                      border: `1px solid ${hot ? 'rgba(196,154,60,0.8)' : 'rgba(255,255,255,0.14)'}`,
                      backdropFilter: 'blur(6px)', transition: 'background 0.25s, border-color 0.25s, transform 0.25s',
                      transform: hot ? 'scale(1.12)' : 'scale(1)' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, lineHeight: 1, color: hot ? '#e6cf93' : '#fff' }}>
            {flat.unit}
          </span>
          <span style={{ fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase',
                         color: hot ? '#c49a3c' : 'rgba(255,255,255,0.7)' }}>
            {flat.type}
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
    return [long * 0.96, short * 0.92];
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

  const coreW = W * 0.11 * 2;
  const lift = { x: -0.09 * L, w: 0.11 * L }, stairs = { x: 0.09 * L, w: 0.12 * L };
  const steps = 5;

  return (
    <group ref={group} position={[cx, y, cz]} rotation={[0, rotY, 0]}>
      {/* slab */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[L, 0.08, W]} />
        <meshStandardMaterial color="#d6cfc2" roughness={0.95} />
      </mesh>
      {/* corridor */}
      <mesh position={[0, 0.004, 0]}>
        <boxGeometry args={[L, 0.008, W * CORR * 2]} />
        <meshStandardMaterial color="#b4ada0" roughness={0.95} />
      </mesh>

      {/* homes */}
      {FLATS.map((f) => (
        <Unit key={f.id} flat={f} rect={unitRect(f.id, L, W)} hot={hoverFlat === f.id} onHover={onHover} onSelect={onSelect} />
      ))}

      {/* walls: perimeter, corridor sides, and the split between the homes */}
      <Wall x={0} z={-W / 2} w={L} d={WALL_T} />
      <Wall x={0} z={W / 2} w={L} d={WALL_T} />
      <Wall x={-L / 2} z={0} w={WALL_T} d={W} />
      <Wall x={L / 2} z={0} w={WALL_T} d={W} />
      <Wall x={0} z={-W * CORR} w={L} d={WALL_T} />
      <Wall x={0} z={W * CORR} w={L} d={WALL_T} />
      <Wall x={SPLIT_U * L} z={(0.5 + CORR) / 2 * W} w={WALL_T} d={(0.5 - CORR) * W} />
      <Wall x={SPLIT_U * L} z={-(0.5 + CORR) / 2 * W} w={WALL_T} d={(0.5 - CORR) * W} />

      {/* lift */}
      <mesh position={[lift.x, 0.11, 0]}>
        <boxGeometry args={[lift.w, 0.22, coreW]} />
        <meshStandardMaterial color="#2e2e34" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[lift.x, 0.12, coreW / 2 + 0.002]}>
        <boxGeometry args={[lift.w * 0.5, 0.17, 0.004]} />
        <meshStandardMaterial color="#c49a3c" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* stairs */}
      {Array.from({ length: steps }, (_, i) => (
        <mesh key={i} position={[stairs.x - stairs.w / 2 + (i + 0.5) * (stairs.w / steps), (0.2 * (i + 1)) / steps / 2, 0]}>
          <boxGeometry args={[stairs.w / steps, (0.2 * (i + 1)) / steps, coreW * 0.9]} />
          <meshStandardMaterial color="#8f877a" roughness={0.9} />
        </mesh>
      ))}
      <Html position={[lift.x, 0.3, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: 7, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.8)', background: 'rgba(8,8,10,0.6)', padding: '2px 6px', borderRadius: 999 }}>LIFT</div>
      </Html>
      <Html position={[stairs.x, 0.3, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: 7, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.8)', background: 'rgba(8,8,10,0.6)', padding: '2px 6px', borderRadius: 999 }}>STAIRS</div>
      </Html>
    </group>
  );
}
