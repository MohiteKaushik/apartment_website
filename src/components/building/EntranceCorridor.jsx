import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/* ── The lift lobby outside every home ──────────────────
   The walk-through starts here, in front of the front door, so the
   visitor always knows where a home is entered from. The same corridor
   serves every unit; it is built far away from the flat model (at
   CORRIDOR.z) and the door is a cross-fade away from the entrance stop.

   Layout (metres): the visitor stands at (0, eye, CORRIDOR.z + 2.2)
   facing −z; the door is in the wall at z = CORRIDOR.z, 1.0 wide and
   2.1 high; the corridor is 2.6 wide, 2.75 high and runs 5 m back. */

export const CORRIDOR = { x: 0, z: 60, stand: 2.2, yaw: 0 };
const W = 2.6, H = 2.75, LEN = 5.0;
const DOOR_W = 1.0, DOOR_H = 2.1;

/* The same lobby for every unit, but the plate by the door shows the home */
export default function EntranceCorridor({ unitLabel, unitNumber, doorRef, lowWalls = false }) {
  const leaf = useRef(null);
  const open = useRef(0);
  const { x, z } = CORRIDOR;
  const h = lowWalls ? 1.25 : H;
  const dh = Math.min(DOOR_H, h - 0.05);

  useFrame((_, dt) => {
    const target = doorRef?.current?.target ?? 0;
    open.current += (target - open.current) * (1 - Math.exp(-dt * 4.5));
    if (doorRef?.current) doorRef.current.value = open.current;
    if (leaf.current) leaf.current.rotation.y = -open.current * (Math.PI * 0.55);   // swings inward
  });

  const mats = useMemo(() => ({
    wall:   new THREE.MeshStandardMaterial({ color: '#d9d2c6', roughness: 0.92 }),
    dado:   new THREE.MeshStandardMaterial({ color: '#8a7f70', roughness: 0.85 }),
    floor:  new THREE.MeshStandardMaterial({ color: '#2e2a28', roughness: 0.95 }),
    runner: new THREE.MeshStandardMaterial({ color: '#6b5331', roughness: 0.9 }),
    ceil:   new THREE.MeshStandardMaterial({ color: '#efeae0', roughness: 0.9 }),
    frame:  new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.6 }),
    door:   new THREE.MeshStandardMaterial({ color: '#3b2d23', roughness: 0.55, metalness: 0.05 }),
    brass:  new THREE.MeshStandardMaterial({ color: '#c49a3c', roughness: 0.3, metalness: 0.8 }),
    light:  new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffe4b5', emissiveIntensity: 2.2 }),
    beyond: new THREE.MeshBasicMaterial({ color: '#fff1d6' }),
  }), []);

  return (
    <group position={[x, 0, z]}>
      {/* floor, runner, ceiling */}
      <mesh position={[0, -0.01, LEN / 2]} rotation={[-Math.PI / 2, 0, 0]} material={mats.floor}><planeGeometry args={[W, LEN]} /></mesh>
      <mesh position={[0, 0.002, LEN / 2]} rotation={[-Math.PI / 2, 0, 0]} material={mats.runner}><planeGeometry args={[W * 0.42, LEN]} /></mesh>
      <mesh position={[0, h, LEN / 2]} rotation={[Math.PI / 2, 0, 0]} material={mats.ceil}><planeGeometry args={[W, LEN]} /></mesh>
      {/* side walls with a dado rail */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * W / 2, h / 2, LEN / 2]} rotation={[0, -s * Math.PI / 2, 0]} material={mats.wall}><planeGeometry args={[LEN, h]} /></mesh>
          <mesh position={[s * (W / 2 - 0.01), 0.9, LEN / 2]} rotation={[0, -s * Math.PI / 2, 0]} material={mats.dado}><planeGeometry args={[LEN, 0.04]} /></mesh>
        </group>
      ))}
      {/* back wall */}
      <mesh position={[0, h / 2, LEN]} rotation={[0, Math.PI, 0]} material={mats.wall}><planeGeometry args={[W, h]} /></mesh>
      {/* front wall around the door */}
      <mesh position={[-(W / 2 + DOOR_W / 2) / 2, h / 2, 0]} material={mats.wall}><planeGeometry args={[(W - DOOR_W) / 2, h]} /></mesh>
      <mesh position={[(W / 2 + DOOR_W / 2) / 2, h / 2, 0]} material={mats.wall}><planeGeometry args={[(W - DOOR_W) / 2, h]} /></mesh>
      <mesh position={[0, dh + (h - dh) / 2, 0]} material={mats.wall}><planeGeometry args={[DOOR_W, h - dh]} /></mesh>
      {/* door frame */}
      <mesh position={[-DOOR_W / 2 - 0.04, dh / 2, 0]} material={mats.frame}><boxGeometry args={[0.08, dh, 0.14]} /></mesh>
      <mesh position={[DOOR_W / 2 + 0.04, dh / 2, 0]} material={mats.frame}><boxGeometry args={[0.08, dh, 0.14]} /></mesh>
      <mesh position={[0, dh + 0.04, 0]} material={mats.frame}><boxGeometry args={[DOOR_W + 0.16, 0.08, 0.14]} /></mesh>
      {/* the door leaf, hinged on the left, swinging into the home */}
      <group ref={leaf} position={[-DOOR_W / 2, 0, 0]}>
        <mesh position={[DOOR_W / 2, dh / 2, 0]} material={mats.door}><boxGeometry args={[DOOR_W - 0.02, dh - 0.02, 0.05]} /></mesh>
        <mesh position={[DOOR_W / 2, dh / 2, 0.03]} material={mats.frame}><boxGeometry args={[DOOR_W * 0.6, dh * 0.6, 0.004]} /></mesh>
        <mesh position={[DOOR_W - 0.1, 1.02, 0.05]} material={mats.brass}><boxGeometry args={[0.03, 0.03, 0.06]} /></mesh>
        <mesh position={[DOOR_W - 0.16, 1.02, 0.08]} material={mats.brass}><boxGeometry args={[0.14, 0.022, 0.022]} /></mesh>
      </group>
      {/* warm light beyond the door, seen as it opens */}
      <mesh position={[0, dh / 2, -0.6]} material={mats.beyond}><planeGeometry args={[DOOR_W * 1.6, dh * 1.2]} /></mesh>
      {/* number plate beside the door */}
      <mesh position={[DOOR_W / 2 + 0.42, 1.55, 0.012]} material={mats.brass}><boxGeometry args={[0.3, 0.14, 0.012]} /></mesh>
      <Html position={[DOOR_W / 2 + 0.42, 1.55, 0.03]} center transform distanceFactor={1.6} zIndexRange={[12, 0]}
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap', textAlign: 'center' }}>
        <div style={{ color: '#1b1409', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 22, letterSpacing: '0.1em', lineHeight: 1 }}>{unitNumber}</div>
        <div style={{ color: '#3d2f14', fontFamily: 'Poppins, sans-serif', fontWeight: 500, fontSize: 9, letterSpacing: '0.3em', marginTop: 3 }}>{unitLabel}</div>
      </Html>
      {/* ceiling downlights */}
      {[0.8, 2.4, 4.0].map((d) => (
        <group key={d}>
          <mesh position={[0, h - 0.01, d]} rotation={[Math.PI / 2, 0, 0]} material={mats.light}><circleGeometry args={[0.09, 24]} /></mesh>
          <pointLight position={[0, h - 0.2, d]} intensity={d === 0.8 ? 2.6 : 1.6} distance={5} decay={1.8} color="#ffe6bf" />
        </group>
      ))}
      {/* a soft gold glow on the floor in front of the door */}
      <mesh position={[0, 0.004, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.55, 48]} />
        <meshBasicMaterial color="#e6cf93" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

/* ── Entrance marker inside the home ────────────────────
   A pulsing gold ring on the floor at the front door, with a floating
   label, so the entrance can always be found again from inside. */
export function EntranceMarker({ x, z, y = 0, label = 'Entrance' }) {
  const ring = useRef(null);
  const tag = useRef(null);
  useFrame(({ clock, camera }) => {
    if (!ring.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 2.2) * 0.06;
    ring.current.scale.set(s, s, s);
    ring.current.material.opacity = 0.45 + Math.sin(t * 2.2) * 0.2;
    // the label is for finding the door again from nearby, not from the lobby or across the home
    if (tag.current) {
      const d = Math.hypot(camera.position.x - x, camera.position.z - z);
      tag.current.style.opacity = d < 7 ? '1' : '0';
    }
  });
  return (
    <group position={[x, y, z]}>
      <mesh ref={ring} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.5, 48]} />
        <meshBasicMaterial color="#e6cf93" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 48]} />
        <meshBasicMaterial color="#c49a3c" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 1.6, 0]} intensity={1.2} distance={3.5} decay={1.8} color="#ffd98a" />
      <Html position={[0, 1.35, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <div ref={tag} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, transition: 'opacity 0.4s',
                      background: 'rgba(8,8,10,0.66)', border: '1px solid rgba(196,154,60,0.6)', backdropFilter: 'blur(8px)' }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#e6cf93', boxShadow: '0 0 10px #e6cf93' }} />
          <span style={{ color: '#e6cf93', fontFamily: 'Poppins, sans-serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase' }}>{label}</span>
        </div>
      </Html>
    </group>
  );
}
