import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';

/* ─── Constants ─────────────────────────────────────────── */
const GOLD   = '#c49a3c';
const GRID_W = 14;   // columns
const GRID_H = 10;   // rows
const CELL   = 46;   // px per cell (each cell = 0.5 m)

const ROOM_DEFS = [
  { id:'bedroom',  name:'Bedroom',     icon:'🛏️', bg:'rgba(60,42,20,0.92)',  brd:'#c49a3c', minW:2, minH:2 },
  { id:'living',   name:'Living Room', icon:'🛋️', bg:'rgba(22,44,22,0.92)',  brd:'#7baf7b', minW:3, minH:2 },
  { id:'kitchen',  name:'Kitchen',     icon:'🍳', bg:'rgba(44,22,46,0.92)',  brd:'#9b7baf', minW:2, minH:2 },
  { id:'bathroom', name:'Bathroom',    icon:'🚿', bg:'rgba(18,28,46,0.92)',  brd:'#7ba0bf', minW:1, minH:1 },
  { id:'balcony',  name:'Balcony',     icon:'🌿', bg:'rgba(16,36,16,0.92)',  brd:'#7baf7b', minW:2, minH:1 },
  { id:'study',    name:'Study',       icon:'📚', bg:'rgba(36,36,16,0.92)',  brd:'#afaf7b', minW:2, minH:2 },
  { id:'corridor', name:'Corridor',    icon:'🚪', bg:'rgba(20,20,20,0.92)',  brd:'#6b6b6b', minW:1, minH:1 },
];

const FDEFS = [
  /* bedroom */
  { id:'dbl_bed',   cat:'bedroom',  name:'Double Bed',    w:1.6, d:2.0, h:0.6,  color:'#4A3828' },
  { id:'sngl_bed',  cat:'bedroom',  name:'Single Bed',    w:0.9, d:2.0, h:0.6,  color:'#4A3828' },
  { id:'wardrobe',  cat:'bedroom',  name:'Wardrobe',      w:1.6, d:0.6, h:2.2,  color:'#3A2818' },
  { id:'dresser',   cat:'bedroom',  name:'Dresser',       w:1.0, d:0.5, h:1.1,  color:'#4A3828' },
  { id:'nightstand',cat:'bedroom',  name:'Nightstand',    w:0.5, d:0.45,h:0.65, color:'#4A3828' },
  /* living */
  { id:'sofa3',     cat:'living',   name:'3-Seat Sofa',   w:2.2, d:0.95,h:0.85, color:'#3A3A5A' },
  { id:'sofa2',     cat:'living',   name:'2-Seat Sofa',   w:1.6, d:0.9, h:0.85, color:'#3A3A5A' },
  { id:'armchair',  cat:'living',   name:'Arm Chair',     w:0.85,d:0.85,h:0.85, color:'#4A4A6A' },
  { id:'coffee',    cat:'living',   name:'Coffee Table',  w:1.2, d:0.6, h:0.45, color:'#2A2018' },
  { id:'tv_unit',   cat:'living',   name:'TV Unit',       w:2.0, d:0.45,h:0.55, color:'#201E18' },
  { id:'bookcase',  cat:'living',   name:'Bookcase',      w:0.9, d:0.35,h:2.0,  color:'#3A2A18' },
  /* kitchen */
  { id:'counter',   cat:'kitchen',  name:'Counter',       w:2.5, d:0.6, h:0.9,  color:'#5A5A5A' },
  { id:'island',    cat:'kitchen',  name:'Kitchen Island',w:1.6, d:0.8, h:0.9,  color:'#6A6A6A' },
  { id:'fridge',    cat:'kitchen',  name:'Refrigerator',  w:0.68,d:0.7, h:1.8,  color:'#8A8A8A' },
  { id:'dining_t',  cat:'kitchen',  name:'Dining Table',  w:1.2, d:0.8, h:0.75, color:'#4A3028' },
  { id:'dining_c',  cat:'kitchen',  name:'Dining Chair',  w:0.45,d:0.5, h:0.9,  color:'#3A2818' },
  /* bathroom */
  { id:'bathtub',   cat:'bathroom', name:'Bathtub',       w:1.7, d:0.8, h:0.55, color:'#4A7A8A' },
  { id:'toilet',    cat:'bathroom', name:'Toilet',        w:0.45,d:0.65,h:0.8,  color:'#9A9A9A' },
  { id:'sink',      cat:'bathroom', name:'Wash Basin',    w:0.55,d:0.45,h:0.85, color:'#9A9A9A' },
  { id:'shower',    cat:'bathroom', name:'Shower',        w:0.9, d:0.9, h:2.2,  color:'#4A7A8A' },
  /* common */
  { id:'plant_lg',  cat:'common',   name:'Plant (Large)', w:0.5, d:0.5, h:1.5,  color:'#2A5A2A' },
  { id:'plant_sm',  cat:'common',   name:'Plant (Small)', w:0.3, d:0.3, h:0.7,  color:'#2A5A2A' },
  { id:'f_lamp',    cat:'common',   name:'Floor Lamp',    w:0.3, d:0.3, h:1.6,  color:'#c49a3c' },
  { id:'rug',       cat:'common',   name:'Area Rug',      w:2.0, d:1.5, h:0.02, color:'#6A4A3A' },
];

const CAT_ICONS = { all:'🏠', bedroom:'🛏️', living:'🛋️', kitchen:'🍳', bathroom:'🚿', common:'🌿' };
const CAT_ORDER = ['all','bedroom','living','kitchen','bathroom','common'];

/* ─── Utility ───────────────────────────────────────────── */
function lighten(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const c = v => Math.min(255, Math.max(0, v + Math.round(255 * amt)));
  return `#${[c((n>>16)&0xff), c((n>>8)&0xff), c(n&0xff)].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}

function overlaps(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

/* ─── Furniture 3D shapes ───────────────────────────────── */
/* Each case returns raw JSX — called as a function inside FurnitureMesh */
function FurnitureShape({ def }) {
  const { id, w, d, h, color: c } = def;

  /* Shorthand for a castShadow box mesh */
  const Bx = ({ pos, size, clr, r=0.8, m=0.05, k }) => (
    <mesh key={k} position={pos} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={clr} roughness={r} metalness={m} />
    </mesh>
  );

  if (id === 'dbl_bed' || id === 'sngl_bed') return (
    <group>
      <Bx pos={[0,0.14,0]}              size={[w,0.28,d]}             clr="#3A2818" />
      <Bx pos={[0,0.35,d*0.06]}         size={[w-0.08,0.14,d-0.35]}   clr="#E0D8D0" />
      <Bx pos={[0,0.58,-d/2+0.06]}      size={[w,0.7,0.08]}           clr="#3A2010" />
      {w > 1.2 ? (
        <>
          <Bx pos={[-w*0.22,0.46,-d*0.5+0.42]} size={[w*0.33,0.1,0.30]} clr="#EEEAE4" k="pa" />
          <Bx pos={[ w*0.22,0.46,-d*0.5+0.42]} size={[w*0.33,0.1,0.30]} clr="#EEEAE4" k="pb" />
        </>
      ) : (
        <Bx pos={[0,0.46,-d*0.5+0.42]} size={[w*0.55,0.1,0.30]} clr="#EEEAE4" />
      )}
    </group>
  );

  if (id === 'wardrobe') return (
    <group>
      <Bx pos={[0,h/2,0]}                    size={[w,h,d]}          clr="#3A2818" />
      <Bx pos={[0.002,h/2,d/2+0.001]}        size={[0.012,h-0.04,0.004]} clr="#201008" />
      <Bx pos={[-w*0.14,h*0.5,d/2+0.02]}     size={[0.018,0.1,0.018]} clr={GOLD} r={0.3} m={0.6} k="ha" />
      <Bx pos={[ w*0.14,h*0.5,d/2+0.02]}     size={[0.018,0.1,0.018]} clr={GOLD} r={0.3} m={0.6} k="hb" />
    </group>
  );

  if (id === 'dresser' || id === 'nightstand') return (
    <group>
      <Bx pos={[0,h-0.03,0]}        size={[w,0.05,d]}              clr={lighten(c,0.1)} />
      <Bx pos={[0,(h-0.05)/2,0]}    size={[w-0.02,h-0.05,d-0.02]} clr={c} />
      {[0.28,0.55,0.82].map((yf,i)=>(
        <Bx key={i} pos={[0,h*yf,d/2+0.015]} size={[w*0.3,0.02,0.015]} clr={GOLD} r={0.3} m={0.5} />
      ))}
    </group>
  );

  if (id === 'sofa3' || id === 'sofa2' || id === 'armchair') return (
    <group>
      <Bx pos={[0,0.2,0]}              size={[w,0.2,d*0.65]}  clr={c} />
      <Bx pos={[0,0.55,-d/2+0.1]}      size={[w,0.55,0.15]}   clr={lighten(c,0.05)} />
      <Bx pos={[-(w/2-0.08),0.38,0]}   size={[0.12,0.32,d*0.75]} clr={c} k="la" />
      <Bx pos={[ (w/2-0.08),0.38,0]}   size={[0.12,0.32,d*0.75]} clr={c} k="lb" />
      {[[-w/2+0.1,-(d*0.6/2)+0.1],[w/2-0.1,-(d*0.6/2)+0.1],
        [-w/2+0.1, (d*0.6/2)-0.1],[w/2-0.1, (d*0.6/2)-0.1]].map(([lx,lz],i)=>(
        <Bx key={i} pos={[lx,0.06,lz]} size={[0.06,0.12,0.06]} clr="#2A1808" />
      ))}
    </group>
  );

  if (id === 'coffee' || id === 'dining_t') return (
    <group>
      <Bx pos={[0,h-0.04,0]} size={[w,0.06,d]} clr={lighten(c,0.08)} />
      {[[-w/2+0.08,-d/2+0.08],[w/2-0.08,-d/2+0.08],
        [-w/2+0.08, d/2-0.08],[w/2-0.08, d/2-0.08]].map(([lx,lz],i)=>(
        <Bx key={i} pos={[lx,(h-0.08)/2,lz]} size={[0.06,h-0.08,0.06]} clr={c} />
      ))}
    </group>
  );

  if (id === 'dining_c') return (
    <group>
      <Bx pos={[0,0.45,0]}         size={[w,0.06,d*0.7]}   clr={c} />
      <Bx pos={[0,0.75,-d/2+0.05]} size={[w,0.55,0.06]}    clr={lighten(c,0.05)} />
      {[[-w/2+0.05,-d*0.7/2+0.05],[w/2-0.05,-d*0.7/2+0.05],
        [-w/2+0.05, d*0.7/2-0.05],[w/2-0.05, d*0.7/2-0.05]].map(([lx,lz],i)=>(
        <Bx key={i} pos={[lx,0.22,lz]} size={[0.04,0.44,0.04]} clr="#2A1808" />
      ))}
    </group>
  );

  if (id === 'tv_unit') return (
    <group>
      <Bx pos={[0,h/2,0]}              size={[w,h,d]}              clr="#1A1810" />
      <Bx pos={[-w*0.25,h/2,d/2+0.002]} size={[w*0.45,h*0.8,0.01]} clr="#242218" k="da" />
      <Bx pos={[ w*0.25,h/2,d/2+0.002]} size={[w*0.45,h*0.8,0.01]} clr="#242218" k="db" />
      {[[-w*0.04,h*0.5],[w*0.45,h*0.5]].map(([hx,hy],i)=>(
        <mesh key={i} position={[hx,hy,d/2+0.012]} castShadow>
          <sphereGeometry args={[0.016,8,8]}/>
          <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3}/>
        </mesh>
      ))}
    </group>
  );

  if (id === 'bookcase') return (
    <group>
      <Bx pos={[0,h/2,0]} size={[w,h,d]} clr="#3A2818" />
      {[0.25,0.5,0.75].map((yf,i)=>(
        <Bx key={i} pos={[0,h*yf,d/2-0.01]} size={[w-0.04,0.015,d-0.01]} clr="#4A3828" />
      ))}
      {[['#C42A2A',0.62],['#2A6AC4',0.76],['#3AC42A',0.89]].map(([col,yf],i)=>(
        <Bx key={i} pos={[(i-1)*w*0.26,h*yf,d/2+0.022]} size={[w*0.22,h*0.13,0.04]} clr={col} />
      ))}
    </group>
  );

  if (id === 'counter' || id === 'island') return (
    <group>
      <Bx pos={[0,h-0.03,0]}   size={[w,0.06,d]}                  clr="#7A7A7A" r={0.3} m={0.2} />
      <Bx pos={[0,(h-0.06)/2,0]} size={[w-0.04,h-0.06,d-0.04]}    clr={c} />
    </group>
  );

  if (id === 'fridge') return (
    <group>
      <Bx pos={[0,h/2,0]}                   size={[w,h,d]}         clr="#888888" />
      <Bx pos={[w*0.3,h*0.5, d/2+0.008]}    size={[0.02,h*0.3, 0.008]} clr="#C8C8C8" k="ha" />
      <Bx pos={[w*0.3,h*0.88,d/2+0.008]}    size={[0.02,h*0.12,0.008]} clr="#C8C8C8" k="hb" />
    </group>
  );

  if (id === 'bathtub') return (
    <group>
      <Bx pos={[0,0.25,0]} size={[w,0.5,d]}         clr="#D8ECF2" r={0.6} m={0.1} />
      <Bx pos={[0,0.30,0]} size={[w-0.1,0.3,d-0.12]} clr={c} />
    </group>
  );

  if (id === 'toilet') return (
    <group>
      <Bx pos={[0,0.55,-d/2+0.15]} size={[0.35,0.3,0.17]} clr="#9A9A9A" />
      <Bx pos={[0,0.28,d*0.1]}     size={[w,0.4,d*0.6]}   clr="#AAAAAA" />
    </group>
  );

  if (id === 'sink') return (
    <group>
      <Bx pos={[0,h-0.1,0]}  size={[w,0.18,d]}        clr="#AAAAAA" />
      <Bx pos={[0,h*0.45,0]} size={[0.12,h*0.7,0.12]} clr="#999999" />
      <Bx pos={[0,h,0]}      size={[0.22,0.04,0.04]}   clr={GOLD} r={0.3} m={0.5} />
    </group>
  );

  if (id === 'shower') return (
    <group>
      <Bx pos={[w/2-0.02,h/2,0]}  size={[0.04,h*0.8,d]}   clr="#8AB8C8" r={0.2} m={0.3} k="gwa" />
      <Bx pos={[0,h/2,-d/2+0.02]} size={[w,h*0.8,0.04]}   clr="#8AB8C8" r={0.2} m={0.3} k="gwb" />
      <Bx pos={[0,0.02,0]}         size={[w,0.04,d]}        clr="#8A8A8A" />
      <Bx pos={[w*0.3,h*0.85,-d*0.3]} size={[0.12,0.04,0.12]} clr="#C0C0C0" r={0.3} m={0.7} />
    </group>
  );

  if (id === 'plant_lg' || id === 'plant_sm') {
    const s = id === 'plant_lg' ? 1 : 0.55;
    return (
      <group>
        <Bx pos={[0,0.12*s,0]} size={[0.22*s,0.24*s,0.22*s]} clr="#8B4513" />
        <Bx pos={[0,0.5*s,0]}  size={[0.04,0.5*s,0.04]}      clr="#4A7A2A" />
        {[[0.15*s,0.70*s,0],[-0.15*s,0.65*s,0],[0,0.74*s,0.15*s],[0,0.67*s,-0.15*s]].map(([px,py,pz],i)=>(
          <Bx key={i} pos={[px,py,pz]} size={[0.2*s,0.04,0.28*s]} clr="#3A8A2A" />
        ))}
      </group>
    );
  }

  if (id === 'f_lamp') return (
    <group>
      <Bx pos={[0,0.05,0]}   size={[0.2,0.08,0.2]}  clr={GOLD} r={0.3} m={0.6} />
      <Bx pos={[0,h*0.5,0]}  size={[0.025,h,0.025]} clr={GOLD} r={0.3} m={0.6} />
      <Bx pos={[0,h-0.1,0]}  size={[0.35,0.3,0.35]} clr="#D4B870" r={0.7} m={0.05} />
    </group>
  );

  if (id === 'rug') return (
    <mesh position={[0,0.005,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={c} roughness={0.95} />
    </mesh>
  );

  return (
    <mesh position={[0,h/2,0]} castShadow>
      <boxGeometry args={[w,h,d]} />
      <meshStandardMaterial color={c} roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

/* ─── Placed furniture item ─────────────────────────────── */
function FurnitureMesh({ item, selected, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <group
      position={item.pos}
      rotation={[0, item.rot, 0]}
      onClick={e => { e.stopPropagation(); onSelect(item.uid); }}
      onPointerOver={e => { e.stopPropagation(); setHov(true); }}
      onPointerOut={() => setHov(false)}
    >
      {(selected || hov) && (
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.006,0]}>
          <planeGeometry args={[item.def.w+0.14, item.def.d+0.14]} />
          <meshBasicMaterial color={GOLD} transparent opacity={selected ? 0.22 : 0.1} />
        </mesh>
      )}
      <FurnitureShape def={item.def} />
    </group>
  );
}

/* ─── Ghost preview while placing ──────────────────────── */
function PlacementPreview({ def, posRef }) {
  const groupRef = useRef();
  useFrame(() => {
    if (groupRef.current && posRef.current) {
      groupRef.current.position.set(posRef.current[0], 0, posRef.current[2]);
    }
  });
  return (
    <group ref={groupRef}>
      <mesh position={[0, def.h/2, 0]}>
        <boxGeometry args={[def.w+0.06, def.h+0.06, def.d+0.06]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, def.h/2, 0]}>
        <boxGeometry args={[def.w, def.h, def.d]} />
        <meshBasicMaterial color={GOLD} wireframe />
      </mesh>
    </group>
  );
}

/* ─── 3D furnish scene ──────────────────────────────────── */
function FurnishScene({ room, furnitures, pendingDef, onPlace, onSelect, selectedUid }) {
  const { camera } = useThree();
  const previewPosRef = useRef([0, 0, 0]);
  const rW = room.w * 0.5;   // cells → metres
  const rD = room.h * 0.5;
  const wallH = 2.8;

  useEffect(() => {
    camera.position.set(rW * 0.9, rW * 1.1, rD * 1.5);
    camera.lookAt(0, 0.6, 0);
  }, [room.id, camera, rW, rD]); // eslint-disable-line

  const handleMove = useCallback(e => {
    if (!pendingDef) return;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    previewPosRef.current = [
      clamp(e.point.x, -rW/2 + pendingDef.w/2, rW/2 - pendingDef.w/2),
      0,
      clamp(e.point.z, -rD/2 + pendingDef.d/2, rD/2 - pendingDef.d/2),
    ];
  }, [pendingDef, rW, rD]);

  const handleClick = useCallback(e => {
    e.stopPropagation();
    if (pendingDef) {
      onPlace([...previewPosRef.current]);
    } else {
      onSelect(null);
    }
  }, [pendingDef, onPlace, onSelect]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[rW, wallH*1.8, rD]} intensity={1.4} castShadow />
      <pointLight position={[0, wallH*0.7, 0]} intensity={0.5} color="#FFD4A0" />

      {/* Floor — also the click/hover target */}
      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow
        onPointerMove={handleMove}
        onPointerDown={handleClick}
      >
        <planeGeometry args={[rW, rD]} />
        <meshStandardMaterial color="#13110E" roughness={0.92} />
      </mesh>

      {/* Subtle grid overlay */}
      <gridHelper
        args={[Math.max(rW,rD)*2, Math.max(rW,rD)*4, '#2A2418', '#1E1A12']}
        position={[0,0.002,0]}
      />

      {/* Back wall */}
      <mesh position={[0, wallH/2, -rD/2]} receiveShadow>
        <boxGeometry args={[rW+0.16, wallH, 0.08]} />
        <meshStandardMaterial color="#1C1814" roughness={0.95} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-rW/2, wallH/2, 0]}>
        <boxGeometry args={[0.08, wallH, rD]} />
        <meshStandardMaterial color="#1A1612" roughness={0.95} />
      </mesh>
      {/* Right wall */}
      <mesh position={[rW/2, wallH/2, 0]}>
        <boxGeometry args={[0.08, wallH, rD]} />
        <meshStandardMaterial color="#1C1814" roughness={0.95} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, wallH, 0]}>
        <boxGeometry args={[rW+0.16, 0.06, rD+0.16]} />
        <meshStandardMaterial color="#121010" />
      </mesh>
      {/* Gold skirting strip */}
      <mesh position={[0, 0.04, -rD/2+0.02]}>
        <boxGeometry args={[rW, 0.06, 0.02]} />
        <meshStandardMaterial color={GOLD} metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Placed furniture */}
      {furnitures.map(item => (
        <FurnitureMesh key={item.uid} item={item}
          selected={item.uid === selectedUid} onSelect={onSelect} />
      ))}

      {/* Placement ghost */}
      {pendingDef && <PlacementPreview def={pendingDef} posRef={previewPosRef} />}

      <OrbitControls enablePan minDistance={1} maxDistance={14} target={[0,0.5,0]} />
      <Environment preset="apartment" />
    </>
  );
}

/* ─── 2D Grid layout editor ─────────────────────────────── */
function GridLayout({ rooms, onAdd, onDelete, onSelectRoom, activeRoomId }) {
  const [selType,  setSelType]  = useState(ROOM_DEFS[0]);
  const [drawing,  setDrawing]  = useState(null);
  const gridRef = useRef();

  const getCell = useCallback(e => {
    const r = gridRef.current.getBoundingClientRect();
    return {
      col: Math.max(0, Math.min(GRID_W-1, Math.floor((e.clientX-r.left)/CELL))),
      row: Math.max(0, Math.min(GRID_H-1, Math.floor((e.clientY-r.top) /CELL))),
    };
  }, []);

  const onDown = useCallback(e => {
    if (e.button !== 0) return;
    const c = getCell(e);
    setDrawing({ type: selType, x0:c.col, y0:c.row, x1:c.col, y1:c.row });
  }, [selType, getCell]);

  const onMove = useCallback(e => {
    if (!drawing) return;
    const c = getCell(e);
    setDrawing(d => ({...d, x1:c.col, y1:c.row}));
  }, [drawing, getCell]);

  const onUp = useCallback(() => {
    if (!drawing) return;
    const x = Math.min(drawing.x0, drawing.x1);
    const y = Math.min(drawing.y0, drawing.y1);
    const w = Math.abs(drawing.x1-drawing.x0) + 1;
    const h = Math.abs(drawing.y1-drawing.y0) + 1;
    if (w >= drawing.type.minW && h >= drawing.type.minH) {
      const candidate = { id: Date.now(), type: drawing.type, x, y, w, h };
      if (!rooms.some(r => overlaps(candidate, r))) onAdd(candidate);
    }
    setDrawing(null);
  }, [drawing, rooms, onAdd]);

  const prev = drawing ? {
    x: Math.min(drawing.x0, drawing.x1), y: Math.min(drawing.y0, drawing.y1),
    w: Math.abs(drawing.x1-drawing.x0)+1, h: Math.abs(drawing.y1-drawing.y0)+1,
  } : null;

  return (
    <div style={{ display:'flex', gap:16, height:'100%', overflow:'hidden' }}>

      {/* Left palette */}
      <div style={{ width:158, flexShrink:0, display:'flex', flexDirection:'column', gap:4, overflowY:'auto' }}>
        <p style={{ color:'rgba(255,255,255,0.32)', fontSize:9, letterSpacing:'0.22em',
                    textTransform:'uppercase', marginBottom:2 }}>
          Room Type
        </p>
        {ROOM_DEFS.map(rt => (
          <div key={rt.id} onClick={() => setSelType(rt)}
            style={{
              padding:'7px 10px', borderRadius:7, cursor:'pointer',
              display:'flex', alignItems:'center', gap:8,
              background: selType.id===rt.id ? 'rgba(196,154,60,0.13)' : 'rgba(255,255,255,0.04)',
              border:`1px solid ${selType.id===rt.id ? 'rgba(196,154,60,0.44)' : 'rgba(255,255,255,0.07)'}`,
              transition:'all 0.16s',
            }}>
            <span style={{ fontSize:14 }}>{rt.icon}</span>
            <span style={{ fontSize:11.5, color: selType.id===rt.id ? '#c49a3c' : 'rgba(255,255,255,0.60)' }}>
              {rt.name}
            </span>
          </div>
        ))}

        {/* Room count summary */}
        <div style={{ marginTop:8, padding:'10px 10px', borderRadius:8,
                      background:'rgba(255,255,255,0.03)',
                      border:'1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ color:'rgba(255,255,255,0.32)', fontSize:9, letterSpacing:'0.2em',
                      textTransform:'uppercase', marginBottom:5 }}>Placed</p>
          {ROOM_DEFS.map(rt => {
            const n = rooms.filter(r => r.type.id===rt.id).length;
            if (!n) return null;
            return (
              <div key={rt.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ color:'rgba(255,255,255,0.44)', fontSize:10.5 }}>{rt.name}</span>
                <span style={{ color:'#c49a3c', fontSize:10.5, fontWeight:600 }}>×{n}</span>
              </div>
            );
          })}
          {rooms.length===0 && (
            <p style={{ color:'rgba(255,255,255,0.2)', fontSize:10.5, fontStyle:'italic' }}>
              Drag on the grid →
            </p>
          )}
        </div>
      </div>

      {/* Grid canvas */}
      <div style={{ flex:1, overflow:'auto' }}>
        <div ref={gridRef}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
          onMouseLeave={() => setDrawing(null)}
          style={{
            position:'relative',
            width: GRID_W * CELL, height: GRID_H * CELL,
            background:'rgba(255,255,255,0.026)',
            border:'1px solid rgba(255,255,255,0.08)', borderRadius:8,
            cursor:'crosshair', userSelect:'none', flexShrink:0,
          }}>

          {/* Grid lines */}
          {Array.from({length:GRID_H}).map((_,r) =>
            Array.from({length:GRID_W}).map((_,c) => (
              <div key={`${r}-${c}`} style={{
                position:'absolute', left:c*CELL, top:r*CELL, width:CELL, height:CELL,
                border:'1px solid rgba(255,255,255,0.045)', boxSizing:'border-box',
                pointerEvents:'none',
              }} />
            ))
          )}

          {/* Placed rooms */}
          {rooms.map(room => {
            const isSel = room.id === activeRoomId;
            return (
              <div key={room.id}
                onClick={() => onSelectRoom(room.id)}
                style={{
                  position:'absolute',
                  left: room.x*CELL + 2, top: room.y*CELL + 2,
                  width: room.w*CELL - 4, height: room.h*CELL - 4,
                  background: room.type.bg,
                  border:`2px solid ${isSel ? GOLD : room.type.brd}`,
                  boxShadow: isSel ? `0 0 0 2px ${GOLD}44` : 'none',
                  borderRadius:4, boxSizing:'border-box', zIndex:1, cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center',
                  justifyContent:'center', overflow:'hidden', transition:'border-color 0.2s',
                }}>
                <span style={{ fontSize: Math.min(20, room.w*CELL*0.28), lineHeight:1 }}>
                  {room.type.icon}
                </span>
                <span style={{
                  color: room.type.brd, fontWeight:600, textAlign:'center',
                  fontSize: Math.min(11, room.w*CELL*0.13), padding:'0 2px', lineHeight:1.2,
                }}>{room.type.name}</span>
                <span style={{ color:'rgba(255,255,255,0.32)', fontSize:8.5, marginTop:1 }}>
                  {(room.w*0.5).toFixed(1)}×{(room.h*0.5).toFixed(1)}m
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(room.id); }}
                  style={{
                    position:'absolute', top:2, right:2, width:14, height:14,
                    borderRadius:'50%', padding:0, cursor:'pointer', lineHeight:1,
                    background:'rgba(255,60,60,0.14)', border:'1px solid rgba(255,80,80,0.32)',
                    color:'rgba(255,120,120,0.85)', fontSize:7,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>✕</button>
              </div>
            );
          })}

          {/* Draw preview rectangle */}
          {prev && (
            <div style={{
              position:'absolute',
              left: prev.x*CELL, top: prev.y*CELL, width: prev.w*CELL, height: prev.h*CELL,
              background: selType.bg.replace('0.92','0.45'),
              border: `2px dashed ${selType.brd}`,
              borderRadius:4, boxSizing:'border-box', pointerEvents:'none', zIndex:2,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <span style={{ fontSize:22 }}>{selType.icon}</span>
            </div>
          )}
        </div>

        <p style={{ color:'rgba(255,255,255,0.2)', fontSize:9.5, marginTop:5, letterSpacing:'0.1em' }}>
          Each cell = 0.5 m  ·  Grid = {GRID_W*0.5} m × {GRID_H*0.5} m  ·  Click a placed room to furnish it
        </p>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function RoomCustomizerPage({ onBack }) {
  const [rooms,        setRooms]        = useState([]);
  const [phase,        setPhase]        = useState('layout');   // 'layout' | 'furnish'
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [furnitureMap, setFurnitureMap] = useState({});         // roomId → [{uid,def,pos,rot}]
  const [pendingDef,   setPendingDef]   = useState(null);       // furniture awaiting placement
  const [selectedUid,  setSelectedUid]  = useState(null);       // clicked placed furniture
  const [fCat,         setFCat]         = useState('all');

  const activeRoom       = rooms.find(r => r.id === activeRoomId);
  const activeFurnitures = activeRoomId ? (furnitureMap[activeRoomId] || []) : [];
  const visibleDefs      = FDEFS.filter(f => fCat === 'all' || f.cat === fCat);

  /* Keyboard shortcuts in furnish phase */
  useEffect(() => {
    if (phase !== 'furnish') return;
    const onKey = e => {
      if ((e.key === 'r' || e.key === 'R') && selectedUid && activeRoomId) {
        setFurnitureMap(prev => {
          const arr = [...(prev[activeRoomId]||[])];
          const i = arr.findIndex(f => f.uid === selectedUid);
          if (i < 0) return prev;
          arr[i] = { ...arr[i], rot: arr[i].rot + Math.PI/2 };
          return { ...prev, [activeRoomId]: arr };
        });
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedUid && activeRoomId) {
        setFurnitureMap(prev => ({
          ...prev,
          [activeRoomId]: (prev[activeRoomId]||[]).filter(f => f.uid !== selectedUid),
        }));
        setSelectedUid(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, selectedUid, activeRoomId]);

  const handleAddRoom    = useCallback(r => setRooms(rs => [...rs, r]), []);
  const handleDeleteRoom = useCallback(id => {
    setRooms(rs => rs.filter(r => r.id !== id));
    setFurnitureMap(p => { const n={...p}; delete n[id]; return n; });
    if (activeRoomId === id) { setActiveRoomId(null); setPhase('layout'); }
  }, [activeRoomId]);

  const handleSelectRoom = useCallback(id => {
    setActiveRoomId(id);
    setPhase('furnish');
    setPendingDef(null);
    setSelectedUid(null);
  }, []);

  const handlePlace = useCallback(pos => {
    if (!pendingDef || !activeRoomId) return;
    setFurnitureMap(prev => ({
      ...prev,
      [activeRoomId]: [
        ...(prev[activeRoomId]||[]),
        { uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`, def: pendingDef, pos, rot: 0 },
      ],
    }));
    setPendingDef(null);
  }, [pendingDef, activeRoomId]);

  return (
    <motion.div className="absolute inset-0 flex flex-col"
      style={{ background:'#070608' }}
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      transition={{ duration:0.3 }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-7 py-3 border-b"
        style={{ borderColor:'rgba(255,255,255,0.07)',
                 background:'rgba(0,0,0,0.86)', backdropFilter:'blur(20px)' }}>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={phase==='furnish' ? () => { setPhase('layout'); setPendingDef(null); } : onBack}
            className="text-white/40 hover:text-[#c49a3c] transition-colors"
            style={{ fontSize:20 }} whileHover={{ x:-3 }} whileTap={{ scale:0.9 }}>
            ←
          </motion.button>
          <div>
            <p className="text-[#c49a3c] text-[9px] tracking-[0.4em] uppercase">Room Customizer</p>
            <h2 className="text-white font-light text-sm sm:text-base tracking-wide">
              {phase === 'layout'
                ? 'Design Your Floor Plan'
                : activeRoom
                  ? `Furnish · ${activeRoom.type.name} (${(activeRoom.w*0.5).toFixed(1)} m × ${(activeRoom.h*0.5).toFixed(1)} m)`
                  : 'Furnish Rooms'}
            </h2>
          </div>
        </div>

        {/* Phase pills */}
        <div className="hidden sm:flex items-center gap-2">
          {[['layout','1. Layout'],['furnish','2. Furnish']].map(([p, lbl]) => (
            <div key={p} style={{
              padding:'5px 14px', borderRadius:20, fontSize:10.5,
              letterSpacing:'0.14em', textTransform:'uppercase', fontWeight:500,
              background: phase===p ? 'rgba(196,154,60,0.17)' : 'rgba(255,255,255,0.04)',
              border:`1px solid ${phase===p ? 'rgba(196,154,60,0.48)' : 'rgba(255,255,255,0.07)'}`,
              color: phase===p ? '#c49a3c' : 'rgba(255,255,255,0.28)',
            }}>{lbl}</div>
          ))}
        </div>

        {/* Shortcut hint */}
        {phase==='furnish' && (
          <p className="hidden md:block text-[10px] tracking-wide"
            style={{ color:'rgba(255,255,255,0.26)' }}>
            {pendingDef
              ? `Placing "${pendingDef.name}" — click the floor`
              : selectedUid
                ? 'R = rotate 90°  ·  Del = remove'
                : 'Select from left panel, then click floor'}
          </p>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {phase === 'layout' ? (
          <div className="flex-1 p-4 overflow-hidden">
            <GridLayout
              rooms={rooms}
              onAdd={handleAddRoom}
              onDelete={handleDeleteRoom}
              onSelectRoom={handleSelectRoom}
              activeRoomId={activeRoomId}
            />
          </div>
        ) : (
          <>
            {/* Furniture catalog sidebar */}
            <div className="flex-shrink-0 flex flex-col border-r overflow-hidden"
              style={{ width:198, borderColor:'rgba(255,255,255,0.07)',
                       background:'rgba(0,0,0,0.62)' }}>

              {/* Room selector */}
              <div className="p-3 border-b" style={{ borderColor:'rgba(255,255,255,0.07)' }}>
                <p style={{ color:'rgba(255,255,255,0.28)', fontSize:9,
                            letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:5 }}>
                  Room
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {rooms.map(r => (
                    <button key={r.id}
                      onClick={() => { setActiveRoomId(r.id); setPendingDef(null); setSelectedUid(null); }}
                      style={{
                        padding:'4px 8px', borderRadius:5, fontSize:10, cursor:'pointer',
                        background: r.id===activeRoomId ? 'rgba(196,154,60,0.17)' : 'rgba(255,255,255,0.05)',
                        border:`1px solid ${r.id===activeRoomId ? 'rgba(196,154,60,0.44)' : 'rgba(255,255,255,0.08)'}`,
                        color: r.id===activeRoomId ? '#c49a3c' : 'rgba(255,255,255,0.48)',
                      }}>
                      {r.type.icon} {r.type.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category filter */}
              <div className="px-2 pt-2 flex flex-wrap gap-1">
                {CAT_ORDER.map(cat => (
                  <button key={cat} onClick={() => setFCat(cat)}
                    style={{
                      padding:'3px 7px', borderRadius:12, fontSize:9.5, cursor:'pointer',
                      letterSpacing:'0.08em', textTransform:'capitalize',
                      background: fCat===cat ? 'rgba(196,154,60,0.17)' : 'transparent',
                      border:`1px solid ${fCat===cat ? 'rgba(196,154,60,0.4)' : 'rgba(255,255,255,0.07)'}`,
                      color: fCat===cat ? '#c49a3c' : 'rgba(255,255,255,0.36)',
                    }}>
                    {CAT_ICONS[cat]} {cat}
                  </button>
                ))}
              </div>

              {/* Furniture list */}
              <div className="flex-1 overflow-y-auto p-2"
                style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {visibleDefs.map(f => {
                  const active = pendingDef?.id === f.id;
                  return (
                    <motion.button key={f.id}
                      onClick={() => setPendingDef(active ? null : f)}
                      whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
                      style={{
                        padding:'8px 10px', borderRadius:7, textAlign:'left', cursor:'pointer',
                        background: active ? 'rgba(196,154,60,0.18)' : 'rgba(255,255,255,0.04)',
                        border:`1px solid ${active ? 'rgba(196,154,60,0.55)' : 'rgba(255,255,255,0.07)'}`,
                        display:'flex', alignItems:'center', gap:8,
                      }}>
                      <div style={{
                        width:10, height:10, borderRadius:2, flexShrink:0,
                        background: f.color, border:'1px solid rgba(255,255,255,0.14)',
                      }}/>
                      <div>
                        <p style={{
                          color: active ? '#c49a3c' : 'rgba(255,255,255,0.70)',
                          fontSize:11.5, fontWeight: active ? 600 : 400,
                        }}>{f.name}</p>
                        <p style={{ color:'rgba(255,255,255,0.28)', fontSize:9.5 }}>
                          {f.w}m × {f.d}m
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* 3D canvas */}
            <div className="flex-1 relative">
              {activeRoom ? (
                <Canvas shadows camera={{ fov:55, position:[5,5,7] }}
                  dpr={Math.min(window.devicePixelRatio, 1.5)}>
                  <FurnishScene
                    room={activeRoom}
                    furnitures={activeFurnitures}
                    pendingDef={pendingDef}
                    onPlace={handlePlace}
                    onSelect={setSelectedUid}
                    selectedUid={selectedUid}
                  />
                </Canvas>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p style={{ color:'rgba(255,255,255,0.28)', fontSize:14 }}>
                    Select a room from the left panel
                  </p>
                </div>
              )}

              {/* Back to layout button */}
              <motion.button
                onClick={() => { setPhase('layout'); setPendingDef(null); }}
                className="absolute top-4 right-4 z-10 flex items-center gap-2 text-xs tracking-widest uppercase rounded-full"
                style={{
                  padding:'8px 16px', backdropFilter:'blur(12px)',
                  background:'rgba(0,0,0,0.72)', border:'1px solid rgba(255,255,255,0.11)',
                  color:'rgba(255,255,255,0.46)',
                }}
                whileHover={{ scale:1.03 }} whileTap={{ scale:0.96 }}>
                ← Edit Layout
              </motion.button>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom bar (layout phase, rooms exist) ── */}
      {phase === 'layout' && rooms.length > 0 && (
        <motion.div
          className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor:'rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.72)' }}
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}>
          <p style={{ color:'rgba(255,255,255,0.38)', fontSize:11 }}>
            {rooms.length} room{rooms.length>1?'s':''} placed — click any room on the grid to furnish it
          </p>
          <motion.button
            onClick={() => { setActiveRoomId(rooms[0].id); setPhase('furnish'); }}
            whileHover={{ scale:1.03 }} whileTap={{ scale:0.96 }}
            style={{
              padding:'9px 22px', borderRadius:24, fontSize:11,
              letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:500,
              background:'rgba(196,154,60,0.17)', border:'1px solid rgba(196,154,60,0.48)',
              color:'#c49a3c', cursor:'pointer',
            }}>
            Furnish Rooms →
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
