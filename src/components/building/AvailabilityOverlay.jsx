import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TOWERS, footprint, floorBase, FLOORS, PITCH } from '../../data/towerGeometry';
import FLATS from '../../data/flats';
import { unitRect } from './FloorPlate';
import { STATUS, statusOf } from '../../data/availability';

/* ── Availability on the tower ───────────────────────────
   In the floor view every home on the chosen tower is drawn as a
   translucent block in its status colour, just outside the glass, so the
   whole building reads as a sales chart: what is still free, what is
   reserved, what has gone. One instanced mesh holds all 160 blocks; the
   hovered floor's blocks come forward and the rest step back with the
   facade. Pointing at a block lights that floor, clicking goes to it. */

const SKIN = 1.035;           // blocks sit a little outside the facade
const GAP = 0.94;             // gaps between the blocks, so the floors read as rows
const COLOURS = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, new THREE.Color(v.colour)]));
const tmp = new THREE.Object3D();
const tmpC = new THREE.Color();
const FILL = 0.2, EDGE = 0.85;
/* the 12 edges of a unit box, as pairs of corners */
const BOX_EDGES = (() => {
  const c = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) c.push([x, y, z]);
  const e = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const d = c[i].filter((v, k) => v !== c[j][k]).length;
    if (d === 1) e.push([c[i], c[j]]);
  }
  return e;
})();

export default function AvailabilityOverlay({ towerId, stateRef, enabled, onHover, onSelect, touch }) {
  const mesh = useRef(null);
  const mat = useRef(null);
  const lines = useRef(null), lineMat = useRef(null);
  const gl = useThree((st) => st.gl);
  const applied = useRef({ hover: undefined, enabled: undefined });
  const fade = useRef(0);

  /* one block per home per floor: its transform and status */
  const cells = useMemo(() => {
    const t = TOWERS[towerId];
    const [cx, cz] = t.centre;
    const out = [];
    for (let f = 1; f <= FLOORS; f++) {
      const fp = footprint(towerId, f);
      const L = (t.long === 'x' ? fp[0] : fp[1]) * SKIN, W = (t.long === 'x' ? fp[1] : fp[0]) * SKIN;
      const y = floorBase(f) + PITCH / 2;
      FLATS.forEach((flat) => {
        const r = unitRect(flat.id, L, W);
        // local plate coords → world (the plate group is turned π/2 for tower B)
        const pos = t.long === 'x' ? [cx + r.x, y, cz + r.z] : [cx + r.z, y, cz - r.x];
        const size = t.long === 'x' ? [r.w * GAP, PITCH * 0.78, r.d * GAP] : [r.d * GAP, PITCH * 0.78, r.w * GAP];
        out.push({ floor: f, pos, size, status: statusOf(towerId, f, flat.id) });
      });
    }
    return out;
  }, [towerId]);

  /* a crisp outline round every block, so the chart reads over the glass */
  const edgeGeom = useMemo(() => {
    const pos = new Float32Array(cells.length * 24 * 3);
    cells.forEach((c, i) => {
      BOX_EDGES.forEach((seg, k) => {
        seg.forEach((corner, m) => {
          const o = (i * 24 + k * 2 + m) * 3;
          pos[o] = c.pos[0] + corner[0] * c.size[0];
          pos[o + 1] = c.pos[1] + corner[1] * c.size[1];
          pos[o + 2] = c.pos[2] + corner[2] * c.size[2];
        });
      });
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cells.length * 24 * 3), 3));
    return g;
  }, [cells]);
  useEffect(() => () => edgeGeom.dispose(), [edgeGeom]);

  /* a pointer that leaves the canvas altogether (onto the panel) lets go of the floor */
  useEffect(() => {
    if (touch) return undefined;
    const el = gl.domElement;
    const leave = () => { if (fade.current >= 0.5) onHover?.(null); };
    el.addEventListener('pointerleave', leave);
    return () => el.removeEventListener('pointerleave', leave);
  }, [gl, touch, onHover]);

  /* lay the instances out once per tower */
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    cells.forEach((c, i) => {
      tmp.position.set(...c.pos);
      tmp.scale.set(...c.size);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    applied.current.hover = undefined;
  }, [cells]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m || !mat.current) return;
    const s = stateRef.current || {};
    const on = enabled && s.view === 'floor' && s.towerId === towerId;

    fade.current += ((on ? 1 : 0) - fade.current) * (1 - Math.exp(-dt * 5));
    mat.current.opacity = FILL * fade.current;
    m.visible = fade.current > 0.01;
    if (lineMat.current) lineMat.current.opacity = EDGE * fade.current;
    if (lines.current) lines.current.visible = m.visible;

    // recolour only when the hovered floor changes
    const hover = s.hoverFloor || null;
    if (applied.current.hover !== hover) {
      const col = edgeGeom.getAttribute('color');
      cells.forEach((c, i) => {
        tmpC.copy(COLOURS[c.status]);
        if (hover) tmpC.multiplyScalar(c.floor === hover ? 1.6 : 0.4);
        m.setColorAt(i, tmpC);
        for (let k = 0; k < 24; k++) col.setXYZ(i * 24 + k, tmpC.r, tmpC.g, tmpC.b);
      });
      m.instanceColor.needsUpdate = true;
      col.needsUpdate = true;
      applied.current.hover = hover;
    }
  });

  const floorAt = (e) => (e.instanceId == null ? null : cells[e.instanceId]?.floor ?? null);

  return (
    <>
    <lineSegments ref={lines} geometry={edgeGeom} frustumCulled={false} renderOrder={6}>
      <lineBasicMaterial ref={lineMat} vertexColors transparent opacity={0} depthWrite={false} toneMapped={false} />
    </lineSegments>
    <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]} frustumCulled={false} renderOrder={5}
      onPointerMove={(e) => { if (fade.current < 0.5) return; e.stopPropagation(); const f = floorAt(e); if (f && !touch) onHover?.(f); }}
      onPointerOut={(e) => {
        // r3f treats every block as its own hover target, so sliding from one
        // block to the next fires an "out" for the old block; only a pointer
        // that has really left the blocks clears the floor
        if (touch || fade.current < 0.5) return;
        if (e.intersections?.some((h) => h.object === mesh.current)) return;
        onHover?.(null);
      }}
      onClick={(e) => {
        if (fade.current < 0.5) return;
        e.stopPropagation();
        const f = floorAt(e);
        if (!f) return;
        const isTouch = touch || e.nativeEvent?.pointerType === 'touch';
        if (isTouch && (stateRef.current?.hoverFloor !== f)) onHover?.(f); else onSelect?.(f);
      }}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial ref={mat} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </instancedMesh>
    </>
  );
}
