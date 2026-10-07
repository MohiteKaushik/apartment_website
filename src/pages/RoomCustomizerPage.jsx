import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Billboard, Text } from '@react-three/drei';
import { createXRStore, XR, XROrigin } from '@react-three/xr';
import * as THREE from 'three';

/* ─── XR store ──────────────────────────────────────────── */
const custXRStore = createXRStore({ emulate: false });

/* ─── Constants ─────────────────────────────────────────── */
const GOLD   = '#c49a3c';
const GRID_W = 24;
const GRID_H = 16;
const CELL   = 30;    // px per grid cell
const UNIT   = 0.6;   // metres per grid cell → grid = 14.4 m × 9.6 m

const WALL_H = 2.7, WALL_T = 0.12, DOOR_H = 2.1, SILL = 0.9, WIN_TOP = 2.2, RAIL_H = 1.0, CUT_H = 1.1;
const FLOOR_CLR = {
  bedroom:'#a98258', living:'#b8905f', kitchen:'#9a9a94', bathroom:'#8fa6af',
  balcony:'#7d8a74', study:'#a5804f', corridor:'#968c7e',
};
const WALL_CLR = '#e8e1d4';

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
  { id:'dbl_bed',    cat:'bedroom',  name:'Double Bed',    w:1.6, d:2.0, h:0.6,  color:'#4A3828' },
  { id:'sngl_bed',   cat:'bedroom',  name:'Single Bed',    w:0.9, d:2.0, h:0.6,  color:'#4A3828' },
  { id:'wardrobe',   cat:'bedroom',  name:'Wardrobe',      w:1.6, d:0.6, h:2.2,  color:'#3A2818' },
  { id:'dresser',    cat:'bedroom',  name:'Dresser',       w:1.0, d:0.5, h:1.1,  color:'#4A3828' },
  { id:'nightstand', cat:'bedroom',  name:'Nightstand',    w:0.5, d:0.45,h:0.65, color:'#4A3828' },
  /* living */
  { id:'sofa3',      cat:'living',   name:'3-Seat Sofa',   w:2.2, d:0.95,h:0.85, color:'#3A3A5A' },
  { id:'sofa2',      cat:'living',   name:'2-Seat Sofa',   w:1.6, d:0.9, h:0.85, color:'#3A3A5A' },
  { id:'armchair',   cat:'living',   name:'Arm Chair',     w:0.85,d:0.85,h:0.85, color:'#4A4A6A' },
  { id:'coffee',     cat:'living',   name:'Coffee Table',  w:1.2, d:0.6, h:0.45, color:'#2A2018' },
  { id:'tv_unit',    cat:'living',   name:'TV Unit',       w:2.0, d:0.45,h:0.55, color:'#201E18' },
  { id:'bookcase',   cat:'living',   name:'Bookcase',      w:0.9, d:0.35,h:2.0,  color:'#3A2A18' },
  /* kitchen */
  { id:'counter',    cat:'kitchen',  name:'Counter',       w:2.5, d:0.6, h:0.9,  color:'#5A5A5A' },
  { id:'island',     cat:'kitchen',  name:'Kitchen Island',w:1.6, d:0.8, h:0.9,  color:'#6A6A6A' },
  { id:'fridge',     cat:'kitchen',  name:'Refrigerator',  w:0.68,d:0.7, h:1.8,  color:'#8A8A8A' },
  { id:'dining_t',   cat:'kitchen',  name:'Dining Table',  w:1.2, d:0.8, h:0.75, color:'#4A3028' },
  { id:'dining_c',   cat:'kitchen',  name:'Dining Chair',  w:0.45,d:0.5, h:0.9,  color:'#3A2818' },
  /* bathroom */
  { id:'bathtub',    cat:'bathroom', name:'Bathtub',       w:1.7, d:0.8, h:0.55, color:'#4A7A8A' },
  { id:'toilet',     cat:'bathroom', name:'Toilet',        w:0.45,d:0.65,h:0.8,  color:'#9A9A9A' },
  { id:'sink',       cat:'bathroom', name:'Wash Basin',    w:0.55,d:0.45,h:0.85, color:'#9A9A9A' },
  { id:'shower',     cat:'bathroom', name:'Shower',        w:0.9, d:0.9, h:2.2,  color:'#4A7A8A' },
  /* study */
  { id:'desk',       cat:'study',    name:'Writing Desk',  w:1.4, d:0.65,h:0.75, color:'#3A2818' },
  { id:'desk_chair', cat:'study',    name:'Office Chair',  w:0.65,d:0.65,h:1.1,  color:'#2A2A2A' },
  /* common */
  { id:'plant_lg',   cat:'common',   name:'Plant (Large)', w:0.5, d:0.5, h:1.5,  color:'#2A5A2A' },
  { id:'plant_sm',   cat:'common',   name:'Plant (Small)', w:0.3, d:0.3, h:0.7,  color:'#2A5A2A' },
  { id:'f_lamp',     cat:'common',   name:'Floor Lamp',    w:0.3, d:0.3, h:1.6,  color:'#c49a3c' },
  { id:'rug',        cat:'common',   name:'Area Rug',      w:2.0, d:1.5, h:0.02, color:'#6A4A3A' },
];

const SUGGESTIONS = {
  bedroom:  ['dbl_bed','wardrobe','nightstand','dresser','plant_sm','rug'],
  living:   ['sofa3','coffee','tv_unit','bookcase','plant_lg','rug'],
  kitchen:  ['counter','island','fridge','dining_t','dining_c'],
  bathroom: ['toilet','sink','shower','bathtub'],
  balcony:  ['plant_lg','plant_sm','f_lamp'],
  study:    ['bookcase','desk','desk_chair','f_lamp','plant_sm'],
  corridor: ['plant_sm','f_lamp'],
};

const BHK_TEMPLATES = {
  '2BHK': {
    label:'2 BHK', sqft:'~850 sq.ft', icon:'🏠',
    rooms:[
      { typeId:'living',   x:0,  y:0,  w:10, h:6 },
      { typeId:'kitchen',  x:10, y:0,  w:8,  h:6 },
      { typeId:'corridor', x:0,  y:6,  w:18, h:2 },
      { typeId:'bedroom',  x:0,  y:8,  w:8,  h:6 },
      { typeId:'bedroom',  x:8,  y:8,  w:6,  h:6 },
      { typeId:'bathroom', x:14, y:8,  w:4,  h:3 },
      { typeId:'balcony',  x:14, y:11, w:4,  h:3 },
    ],
  },
  '3BHK': {
    label:'3 BHK', sqft:'~1200 sq.ft', icon:'🏡',
    rooms:[
      { typeId:'living',   x:0,  y:0,  w:10, h:6 },
      { typeId:'kitchen',  x:10, y:0,  w:6,  h:6 },
      { typeId:'study',    x:16, y:0,  w:4,  h:6 },
      { typeId:'corridor', x:0,  y:6,  w:20, h:2 },
      { typeId:'bedroom',  x:0,  y:8,  w:7,  h:6 },
      { typeId:'bedroom',  x:7,  y:8,  w:6,  h:6 },
      { typeId:'bedroom',  x:13, y:8,  w:4,  h:6 },
      { typeId:'bathroom', x:17, y:8,  w:3,  h:3 },
      { typeId:'balcony',  x:17, y:11, w:3,  h:3 },
    ],
  },
  '4BHK': {
    label:'4 BHK', sqft:'~1600 sq.ft', icon:'🏰',
    rooms:[
      { typeId:'living',   x:0,  y:0,  w:11, h:7 },
      { typeId:'kitchen',  x:11, y:0,  w:7,  h:7 },
      { typeId:'study',    x:18, y:0,  w:6,  h:4 },
      { typeId:'bathroom', x:18, y:4,  w:6,  h:3 },
      { typeId:'corridor', x:0,  y:7,  w:24, h:2 },
      { typeId:'bedroom',  x:0,  y:9,  w:6,  h:7 },
      { typeId:'bedroom',  x:6,  y:9,  w:6,  h:7 },
      { typeId:'bedroom',  x:12, y:9,  w:6,  h:7 },
      { typeId:'bedroom',  x:18, y:9,  w:6,  h:4 },
      { typeId:'bathroom', x:18, y:13, w:3,  h:3 },
      { typeId:'balcony',  x:21, y:13, w:3,  h:3 },
    ],
  },
};
Object.values(BHK_TEMPLATES).forEach(t => {
  const m2 = t.rooms.reduce((s, r) => s + r.w * r.h * UNIT * UNIT, 0);
  t.sqft = `~${Math.round(m2 * 10.764 / 10) * 10} sq.ft`;
});

const CAT_ICONS  = { all:'🏠', bedroom:'🛏️', living:'🛋️', kitchen:'🍳', bathroom:'🚿', study:'📚', common:'🌿' };
const CAT_ORDER  = ['all','bedroom','living','kitchen','bathroom','study','common'];

/* ─── Utility ───────────────────────────────────────────── */
function lighten(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const c = v => Math.min(255, Math.max(0, v + Math.round(255 * amt)));
  return `#${[c((n>>16)&0xff), c((n>>8)&0xff), c(n&0xff)].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}
function overlaps(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
function applyTemplate(key) {
  const tpl = BHK_TEMPLATES[key];
  if (!tpl) return [];
  return tpl.rooms.map((r, i) => ({
    id: Date.now() + i,
    type: ROOM_DEFS.find(d => d.id === r.typeId) || ROOM_DEFS[0],
    x: r.x, y: r.y, w: r.w, h: r.h,
  }));
}
function saveLayoutData(rooms, furnitureMap) {
  const data = {
    version: 2,
    savedAt: new Date().toISOString(),
    rooms: rooms.map(r => ({ typeId: r.type.id, x:r.x, y:r.y, w:r.w, h:r.h })),
    furniture: rooms.map(r =>
      (furnitureMap[r.id] || []).map(it => ({ defId: it.def.id, pos: it.pos, rot: it.rot }))
    ),
  };
  try { localStorage.setItem('vayam_room_layout', JSON.stringify(data)); } catch(_) {}
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `vayam_layout_${Date.now()}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
function loadSavedLayout() {
  try {
    const raw = localStorage.getItem('vayam_room_layout');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const rooms = (data.rooms || []).map((r, i) => ({
      id: Date.now() + i,
      type: ROOM_DEFS.find(d => d.id === r.typeId) || ROOM_DEFS[0],
      x:r.x, y:r.y, w:r.w, h:r.h,
    }));
    const furnitureMap = {};
    if (data.version !== 2) return null;
    (data.furniture || []).forEach((items, idx) => {
      const room = rooms[idx];
      if (!room) return;
      furnitureMap[room.id] = (items || []).map(it => ({
        uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        def: FDEFS.find(f => f.id === it.defId) || FDEFS[0],
        pos: it.pos, rot: it.rot,
      }));
    });
    return { rooms, furnitureMap };
  } catch(_) { return null; }
}

/* ─── 3D furniture shapes (box-geometry only) ───────────── */
const Bx = ({ pos, size, clr, r=0.8, m=0.05 }) => (
  <mesh position={pos}>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={clr} roughness={r} metalness={m}/>
  </mesh>
);
function FurnitureShape({ def }) {
  const { id, w, d, h, color: c } = def;
  if (id==='dbl_bed'||id==='sngl_bed') return (
    <group>
      <Bx pos={[0,0.14,0]}         size={[w,0.28,d]}           clr="#3A2818"/>
      <Bx pos={[0,0.35,d*0.06]}    size={[w-0.08,0.14,d-0.35]} clr="#E0D8D0"/>
      <Bx pos={[0,0.58,-d/2+0.06]} size={[w,0.7,0.08]}         clr="#3A2010"/>
      {w>1.2?(<><Bx k="pa" pos={[-w*0.22,0.46,-d*0.5+0.42]} size={[w*0.33,0.1,0.30]} clr="#EEEAE4"/>
                  <Bx k="pb" pos={[ w*0.22,0.46,-d*0.5+0.42]} size={[w*0.33,0.1,0.30]} clr="#EEEAE4"/></>)
        : <Bx pos={[0,0.46,-d*0.5+0.42]} size={[w*0.55,0.1,0.30]} clr="#EEEAE4"/>}
    </group>
  );
  if (id==='wardrobe') return (
    <group>
      <Bx pos={[0,h/2,0]}               size={[w,h,d]}         clr="#3A2818"/>
      <Bx pos={[0.002,h/2,d/2+0.001]}   size={[0.012,h-0.04,0.004]} clr="#201008"/>
      <Bx k="ha" pos={[-w*0.14,h*0.5,d/2+0.02]} size={[0.018,0.1,0.018]} clr={GOLD} r={0.3} m={0.6}/>
      <Bx k="hb" pos={[ w*0.14,h*0.5,d/2+0.02]} size={[0.018,0.1,0.018]} clr={GOLD} r={0.3} m={0.6}/>
    </group>
  );
  if (id==='dresser'||id==='nightstand') return (
    <group>
      <Bx pos={[0,h-0.03,0]}     size={[w,0.05,d]}             clr={lighten(c,0.1)}/>
      <Bx pos={[0,(h-0.05)/2,0]} size={[w-0.02,h-0.05,d-0.02]} clr={c}/>
      {[0.28,0.55,0.82].map((yf,i)=>(
        <Bx key={i} pos={[0,h*yf,d/2+0.015]} size={[w*0.3,0.02,0.015]} clr={GOLD} r={0.3} m={0.5}/>
      ))}
    </group>
  );
  if (id==='sofa3'||id==='sofa2'||id==='armchair') return (
    <group>
      <Bx pos={[0,0.2,0]}            size={[w,0.2,d*0.65]}   clr={c}/>
      <Bx pos={[0,0.55,-d/2+0.1]}    size={[w,0.55,0.15]}    clr={lighten(c,0.05)}/>
      <Bx k="la" pos={[-(w/2-0.08),0.38,0]} size={[0.12,0.32,d*0.75]} clr={c}/>
      <Bx k="lb" pos={[ (w/2-0.08),0.38,0]} size={[0.12,0.32,d*0.75]} clr={c}/>
      {[[-w/2+0.1,-(d*0.6/2)+0.1],[w/2-0.1,-(d*0.6/2)+0.1],
        [-w/2+0.1, (d*0.6/2)-0.1],[w/2-0.1, (d*0.6/2)-0.1]].map(([lx,lz],i)=>(
        <Bx key={i} pos={[lx,0.06,lz]} size={[0.06,0.12,0.06]} clr="#2A1808"/>
      ))}
    </group>
  );
  if (id==='coffee'||id==='dining_t') return (
    <group>
      <Bx pos={[0,h-0.04,0]} size={[w,0.06,d]} clr={lighten(c,0.08)}/>
      {[[-w/2+0.08,-d/2+0.08],[w/2-0.08,-d/2+0.08],
        [-w/2+0.08, d/2-0.08],[w/2-0.08, d/2-0.08]].map(([lx,lz],i)=>(
        <Bx key={i} pos={[lx,(h-0.08)/2,lz]} size={[0.06,h-0.08,0.06]} clr={c}/>
      ))}
    </group>
  );
  if (id==='dining_c') return (
    <group>
      <Bx pos={[0,0.45,0]}         size={[w,0.06,d*0.7]}  clr={c}/>
      <Bx pos={[0,0.75,-d/2+0.05]} size={[w,0.55,0.06]}   clr={lighten(c,0.05)}/>
      {[[-w/2+0.05,-d*0.7/2+0.05],[w/2-0.05,-d*0.7/2+0.05],
        [-w/2+0.05, d*0.7/2-0.05],[w/2-0.05, d*0.7/2-0.05]].map(([lx,lz],i)=>(
        <Bx key={i} pos={[lx,0.22,lz]} size={[0.04,0.44,0.04]} clr="#2A1808"/>
      ))}
    </group>
  );
  if (id==='tv_unit') return (
    <group>
      <Bx pos={[0,h/2,0]}               size={[w,h,d]}              clr="#1A1810"/>
      <Bx k="da" pos={[-w*0.25,h/2,d/2+0.002]} size={[w*0.45,h*0.8,0.01]} clr="#242218"/>
      <Bx k="db" pos={[ w*0.25,h/2,d/2+0.002]} size={[w*0.45,h*0.8,0.01]} clr="#242218"/>
      {[[-w*0.04,h*0.5],[w*0.45,h*0.5]].map(([hx,hy],i)=>(
        <mesh key={i} position={[hx,hy,d/2+0.012]} castShadow>
          <sphereGeometry args={[0.016,8,8]}/><meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3}/>
        </mesh>
      ))}
    </group>
  );
  if (id==='bookcase') return (
    <group>
      <Bx pos={[0,h/2,0]} size={[w,h,d]} clr="#3A2818"/>
      {[0.25,0.5,0.75].map((yf,i)=><Bx key={i} pos={[0,h*yf,d/2-0.01]} size={[w-0.04,0.015,d-0.01]} clr="#4A3828"/>)}
      {[['#C42A2A',0.62],['#2A6AC4',0.76],['#3AC42A',0.89]].map(([col,yf],i)=>(
        <Bx key={i} pos={[(i-1)*w*0.26,h*yf,d/2+0.022]} size={[w*0.22,h*0.13,0.04]} clr={col}/>
      ))}
    </group>
  );
  if (id==='counter'||id==='island') return (
    <group>
      <Bx pos={[0,h-0.03,0]}    size={[w,0.06,d]}                clr="#7A7A7A" r={0.3} m={0.2}/>
      <Bx pos={[0,(h-0.06)/2,0]} size={[w-0.04,h-0.06,d-0.04]}  clr={c}/>
    </group>
  );
  if (id==='fridge') return (
    <group>
      <Bx pos={[0,h/2,0]}               size={[w,h,d]}           clr="#888888"/>
      <Bx k="ha" pos={[w*0.3,h*0.5, d/2+0.008]} size={[0.02,h*0.3, 0.008]} clr="#C8C8C8"/>
      <Bx k="hb" pos={[w*0.3,h*0.88,d/2+0.008]} size={[0.02,h*0.12,0.008]} clr="#C8C8C8"/>
    </group>
  );
  if (id==='bathtub') return (
    <group>
      <Bx pos={[0,0.25,0]} size={[w,0.5,d]}         clr="#D8ECF2" r={0.6} m={0.1}/>
      <Bx pos={[0,0.30,0]} size={[w-0.1,0.3,d-0.12]} clr={c}/>
    </group>
  );
  if (id==='toilet') return (
    <group>
      <Bx pos={[0,0.55,-d/2+0.15]} size={[0.35,0.3,0.17]} clr="#9A9A9A"/>
      <Bx pos={[0,0.28,d*0.1]}     size={[w,0.4,d*0.6]}   clr="#AAAAAA"/>
    </group>
  );
  if (id==='sink') return (
    <group>
      <Bx pos={[0,h-0.1,0]}  size={[w,0.18,d]}        clr="#AAAAAA"/>
      <Bx pos={[0,h*0.45,0]} size={[0.12,h*0.7,0.12]} clr="#999999"/>
      <Bx pos={[0,h,0]}      size={[0.22,0.04,0.04]}   clr={GOLD} r={0.3} m={0.5}/>
    </group>
  );
  if (id==='shower') return (
    <group>
      <Bx k="gwa" pos={[w/2-0.02,h/2,0]}  size={[0.04,h*0.8,d]}  clr="#8AB8C8" r={0.2} m={0.3}/>
      <Bx k="gwb" pos={[0,h/2,-d/2+0.02]} size={[w,h*0.8,0.04]}  clr="#8AB8C8" r={0.2} m={0.3}/>
      <Bx pos={[0,0.02,0]}         size={[w,0.04,d]}               clr="#8A8A8A"/>
      <Bx pos={[w*0.3,h*0.85,-d*0.3]} size={[0.12,0.04,0.12]}     clr="#C0C0C0" r={0.3} m={0.7}/>
    </group>
  );
  if (id==='desk') return (
    <group>
      <Bx pos={[0,h-0.03,0]} size={[w,0.06,d]} clr={lighten(c,0.08)}/>
      {[[-w/2+0.06,-d/2+0.06],[w/2-0.06,-d/2+0.06],
        [-w/2+0.06, d/2-0.06],[w/2-0.06, d/2-0.06]].map(([lx,lz],i)=>(
        <Bx key={i} pos={[lx,(h-0.08)/2,lz]} size={[0.05,h-0.08,0.05]} clr={c}/>
      ))}
    </group>
  );
  if (id==='desk_chair') return (
    <group>
      <Bx pos={[0,0.46,0]}         size={[w,0.08,d*0.7]}    clr={c}/>
      <Bx pos={[0,0.76,-d/2+0.05]} size={[w,0.6,0.08]}      clr={lighten(c,0.05)}/>
      <Bx k="la" pos={[-(w/2-0.06),0.6,0]} size={[0.06,0.2,d*0.5]} clr={c}/>
      <Bx k="lb" pos={[ (w/2-0.06),0.6,0]} size={[0.06,0.2,d*0.5]} clr={c}/>
      <Bx pos={[0,0.26,0]} size={[0.08,0.5,0.08]}   clr="#1A1A1A"/>
      <Bx pos={[0,0.05,0]} size={[0.55,0.05,0.55]}  clr="#1A1A1A"/>
    </group>
  );
  if (id==='plant_lg'||id==='plant_sm') {
    const s = id==='plant_lg' ? 1 : 0.55;
    return (
      <group>
        <Bx pos={[0,0.12*s,0]} size={[0.22*s,0.24*s,0.22*s]} clr="#8B4513"/>
        <Bx pos={[0,0.5*s,0]}  size={[0.04,0.5*s,0.04]}      clr="#4A7A2A"/>
        {[[0.15*s,0.70*s,0],[-0.15*s,0.65*s,0],[0,0.74*s,0.15*s],[0,0.67*s,-0.15*s]].map(([px,py,pz],i)=>(
          <Bx key={i} pos={[px,py,pz]} size={[0.2*s,0.04,0.28*s]} clr="#3A8A2A"/>
        ))}
      </group>
    );
  }
  if (id==='f_lamp') return (
    <group>
      <Bx pos={[0,0.05,0]}  size={[0.2,0.08,0.2]}  clr={GOLD} r={0.3} m={0.6}/>
      <Bx pos={[0,h*0.5,0]} size={[0.025,h,0.025]} clr={GOLD} r={0.3} m={0.6}/>
      <Bx pos={[0,h-0.1,0]} size={[0.35,0.3,0.35]} clr="#D4B870" r={0.7} m={0.05}/>
    </group>
  );
  if (id==='rug') return (
    <mesh position={[0,0.005,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
      <planeGeometry args={[w,d]}/><meshStandardMaterial color={c} roughness={0.95}/>
    </mesh>
  );
  return (
    <mesh position={[0,h/2,0]} castShadow>
      <boxGeometry args={[w,h,d]}/><meshStandardMaterial color={c} roughness={0.8} metalness={0.05}/>
    </mesh>
  );
}

/* ─── Placed furniture mesh ─────────────────────────────── */
function FurnitureMesh({ item, selected, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <group position={item.pos} rotation={[0,item.rot,0]}
      onClick={e=>{ e.stopPropagation(); onSelect(item.uid); }}
      onPointerOver={e=>{ e.stopPropagation(); setHov(true); }}
      onPointerOut={()=>setHov(false)}>
      {(selected||hov)&&(
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.006,0]}>
          <planeGeometry args={[item.def.w+0.14,item.def.d+0.14]}/>
          <meshBasicMaterial color={GOLD} transparent opacity={selected?0.22:0.1}/>
        </mesh>
      )}
      <FurnitureShape def={item.def}/>
    </group>
  );
}

/* ─── Ghost preview ─────────────────────────────────────── */
function PlacementPreview({ def, posRef }) {
  const groupRef = useRef();
  useFrame(()=>{
    if (groupRef.current&&posRef.current)
      groupRef.current.position.set(posRef.current[0],0,posRef.current[2]);
  });
  return (
    <group ref={groupRef}>
      <mesh position={[0,def.h/2,0]}>
        <boxGeometry args={[def.w+0.06,def.h+0.06,def.d+0.06]}/>
        <meshBasicMaterial color={GOLD} transparent opacity={0.12}/>
      </mesh>
      <mesh position={[0,def.h/2,0]}>
        <boxGeometry args={[def.w,def.h,def.d]}/><meshBasicMaterial color={GOLD} wireframe/>
      </mesh>
    </group>
  );
}

/* ─── House geometry: walls, doors, windows built from the 2D layout ─── */
const PAIR_SCORE = {
  'bathroom+bedroom':5, 'bathroom+corridor':4, 'bathroom+living':3, 'bathroom+study':2,
  'bedroom+corridor':5, 'bedroom+living':4, 'balcony+bedroom':5, 'bedroom+study':1,
  'corridor+kitchen':4, 'kitchen+living':5, 'kitchen+study':1, 'balcony+kitchen':1,
  'balcony+living':5, 'balcony+study':2, 'corridor+living':4, 'corridor+study':4, 'living+study':4,
};
const NO_DOOR = new Set(['bathroom+kitchen','balcony+bathroom','bedroom+bedroom','bedroom+kitchen','bathroom+bathroom']);
const WALL_ITEMS = new Set(['dbl_bed','sngl_bed','wardrobe','dresser','nightstand','sofa3','sofa2',
  'tv_unit','bookcase','counter','fridge','toilet','sink','bathtub','desk']);
const noRay = () => null;
const stop  = e => e.stopPropagation();
const UP    = new THREE.Vector3(0, 1, 0);

function buildHouse(rooms) {
  if (!rooms.length) return null;
  const minX = Math.min(...rooms.map(r => r.x)), maxX = Math.max(...rooms.map(r => r.x + r.w));
  const minY = Math.min(...rooms.map(r => r.y)), maxY = Math.max(...rooms.map(r => r.y + r.h));
  const ox = (minX + maxX) / 2 * UNIT, oz = (minY + maxY) / 2 * UNIT;

  const groups = rooms.map(r => ({
    id: r.id, type: r.type.id, name: r.type.name,
    cx: (r.x + r.w / 2) * UNIT - ox, cz: (r.y + r.h / 2) * UNIT - oz,
    w: r.w * UNIT, d: r.h * UNIT,
  }));
  const byId = new Map(groups.map(g => [g.id, g]));

  /* unit edges: every 0.6 m piece of room boundary */
  const edges = new Map();
  const add = (o, line, i, room) => {
    const k = `${o}:${line}:${i}`;
    if (!edges.has(k)) edges.set(k, { o, line, i, rooms: [] });
    edges.get(k).rooms.push(room);
  };
  for (const r of rooms) {
    for (let i = r.x; i < r.x + r.w; i++) { add('h', r.y, i, r); add('h', r.y + r.h, i, r); }
    for (let j = r.y; j < r.y + r.h; j++) { add('v', r.x, j, r); add('v', r.x + r.w, j, r); }
  }

  /* runs = contiguous stretches of wall between the same pair of rooms (or room + outside) */
  const bucket = new Map();
  for (const e of edges.values()) {
    const k = `${e.o}:${e.line}:${e.rooms.map(r => r.id).sort().join('|')}`;
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k).push(e);
  }
  const runs = [];
  for (const list of bucket.values()) {
    list.sort((a, b) => a.i - b.i);
    let cur = null;
    for (const e of list) {
      if (cur && e.i === cur.start + cur.units.length) cur.units.push(e);
      else { cur = { o: e.o, line: e.line, start: e.i, rooms: e.rooms, units: [e] }; runs.push(cur); }
    }
  }

  let openN = 0;
  const cut = (run, kind, n, extra) => {
    const s = Math.floor((run.units.length - n) / 2);
    openN++;
    for (let k = 0; k < n; k++) Object.assign(run.units[s + k], { kind, openId: openN, ...extra });
    return s;
  };

  /* doors: connect every room into one walkable house, best-matching neighbours first */
  const parent = new Map(rooms.map(r => [r.id, r.id]));
  const find = x => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  const interior = runs.filter(r => r.rooms.length === 2 && r.units.length >= 2);
  for (const relaxed of [false, true]) {
    const cand = interior.map(run => {
      const k = [run.rooms[0].type.id, run.rooms[1].type.id].sort().join('+');
      const sc = NO_DOOR.has(k) ? (relaxed ? 0.5 : 0) : (PAIR_SCORE[k] ?? 1);
      return { run, sc };
    }).filter(c => c.sc > 0).sort((a, b) => b.sc - a.sc || b.run.units.length - a.run.units.length);
    for (const { run } of cand) {
      const a = find(run.rooms[0].id), b = find(run.rooms[1].id);
      if (a !== b) { parent.set(a, b); cut(run, 'door', 2); }
    }
  }

  /* main entrance on the living room's longest outside wall */
  const living = rooms.find(r => r.type.id === 'living') || rooms[0];
  const entryRun = runs
    .filter(r => r.rooms.length === 1 && r.rooms[0].id === living.id && r.units.length >= 2)
    .sort((a, b) => b.units.length - a.units.length)[0];
  if (entryRun) cut(entryRun, 'door', 2, { entry: true });

  /* windows on outside walls, glass railing on balconies */
  const winDefs = [];
  for (const run of runs.filter(r => r.rooms.length === 1)) {
    const room = run.rooms[0], t = room.type.id, len = run.units.length;
    if (run.units.some(u => u.kind)) continue;
    if (t === 'balcony') { run.units.forEach(u => { u.kind = 'rail'; }); continue; }
    const small = t === 'bathroom';
    if (t === 'corridor' || (len < 2 && !small)) continue;
    const n = small ? 1 : (len >= 4 ? Math.min(4, len - 2) : 2);
    const s = cut(run, 'win', n, { small });
    winDefs.push({ o: run.o, line: run.line, s0: run.start + s, n, small, room });
  }

  /* merge unit edges into drawable wall segments */
  const lines = new Map();
  for (const e of edges.values()) {
    if (!e.kind) e.kind = 'wall';
    const k = `${e.o}:${e.line}`;
    if (!lines.has(k)) lines.set(k, []);
    lines.get(k).push(e);
  }
  const segs = [], colliders = [];
  for (const list of lines.values()) {
    list.sort((a, b) => a.i - b.i);
    let cur = null;
    for (const e of list) {
      const sid = `${e.kind}:${e.openId ?? 0}`;
      if (cur && cur.sid === sid && e.i === cur.start + cur.len) cur.len++;
      else {
        cur = { sid, o: e.o, line: e.line, start: e.i, len: 1, kind: e.kind, small: !!e.small };
        segs.push(cur);
      }
    }
  }
  for (const s of segs) {
    const L = s.len * UNIT, mid = (s.start + s.len / 2) * UNIT;
    if (s.o === 'h') { s.x = mid - ox; s.z = s.line * UNIT - oz; }
    else             { s.x = s.line * UNIT - ox; s.z = mid - oz; }
    if (s.kind !== 'door') {
      colliders.push(s.o === 'h'
        ? { x: s.x, z: s.z, hx: L / 2 + WALL_T / 2, hz: WALL_T / 2 }
        : { x: s.x, z: s.z, hx: WALL_T / 2, hz: L / 2 + WALL_T / 2 });
    }
  }

  /* sunlight patches on the floor just inside each window */
  const patches = winDefs.map(w => {
    const mid = (w.s0 + w.n / 2) * UNIT, g = byId.get(w.room.id);
    if (w.o === 'h') {
      const x = mid - ox, z = w.line * UNIT - oz;
      return { x, z, nx: 0, nz: Math.sign(g.cz - z) || 1, len: w.n * UNIT, small: w.small };
    }
    const x = w.line * UNIT - ox, z = mid - oz;
    return { x, z, nx: Math.sign(g.cx - x) || 1, nz: 0, len: w.n * UNIT, small: w.small };
  });

  const livingG = byId.get(living.id);
  return {
    rooms: groups, byId, segs, colliders, patches,
    spawn: { x: livingG.cx, z: livingG.cz, id: living.id },
    span: Math.max((maxX - minX) * UNIT, (maxY - minY) * UNIT),
  };
}

function blocked(colliders, x, z, r = 0.22) {
  for (const c of colliders) {
    if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true;
  }
  return false;
}

/* clamp a piece inside a room; wall pieces snap flush to the nearest wall, back to the wall */
function fitInRoom(g, def, lx, lz, rot, auto) {
  const GAP = 0.04, SNAP = 0.45;
  const hx = g.w / 2 - WALL_T / 2, hz = g.d / 2 - WALL_T / 2;
  let forceX = null, forceZ = null;
  if (auto && WALL_ITEMS.has(def.id)) {
    const dN = lz + hz - def.d / 2, dS = hz - lz - def.d / 2;
    const dW = lx + hx - def.d / 2, dE = hx - lx - def.d / 2;
    const m = Math.min(dN, dS, dW, dE);
    if (m < SNAP) {
      if (m === dN)      { rot = 0;             forceZ = -hz + def.d / 2 + GAP; }
      else if (m === dS) { rot = Math.PI;       forceZ =  hz - def.d / 2 - GAP; }
      else if (m === dW) { rot = Math.PI / 2;   forceX = -hx + def.d / 2 + GAP; }
      else               { rot = -Math.PI / 2;  forceX =  hx - def.d / 2 - GAP; }
    }
  }
  const swap = Math.abs(Math.sin(rot)) > 0.5;
  const ew = swap ? def.d : def.w, ed = swap ? def.w : def.d;
  const cl = (v, lo, hi) => (lo > hi ? 0 : Math.max(lo, Math.min(hi, v)));
  return {
    lx: forceX ?? cl(lx, -hx + ew / 2 + GAP, hx - ew / 2 - GAP),
    lz: forceZ ?? cl(lz, -hz + ed / 2 + GAP, hz - ed / 2 - GAP),
    rot,
  };
}

const WallSegment = React.memo(function WallSegment({ seg, cutaway }) {
  const L = seg.len * UNIT;
  const box = (y0, y1, w = L + WALL_T, t = WALL_T, clr = WALL_CLR, x = 0) => (
    <mesh position={[x, (y0 + y1) / 2, 0]}>
      <boxGeometry args={[w, y1 - y0, t]}/>
      <meshLambertMaterial color={clr}/>
    </mesh>
  );
  const frame = '#f3efe6', door = '#7a5a38';
  let body;
  if (cutaway) {
    body = seg.kind === 'door' ? box(0, 0.03, L, WALL_T, door) : box(0, CUT_H);
  } else if (seg.kind === 'wall') {
    body = box(0, WALL_H);
  } else if (seg.kind === 'door') {
    body = (<>
      {box(DOOR_H, WALL_H)}
      {box(0, DOOR_H, 0.06, WALL_T + 0.02, door, -L / 2)}
      {box(0, DOOR_H, 0.06, WALL_T + 0.02, door, L / 2)}
      {box(DOOR_H - 0.05, DOOR_H, L, WALL_T + 0.02, door)}
    </>);
  } else if (seg.kind === 'rail') {
    body = (<>
      <mesh position={[0, RAIL_H / 2, 0]}>
        <planeGeometry args={[L, RAIL_H]}/>
        <meshBasicMaterial color="#cfe8ff" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false}/>
      </mesh>
      {box(RAIL_H - 0.03, RAIL_H + 0.03, L + 0.02, 0.06, GOLD)}
    </>);
  } else {
    const sill = seg.small ? 1.4 : SILL, top = seg.small ? 2.1 : WIN_TOP;
    body = (<>
      {box(0, sill)}
      {box(top, WALL_H)}
      <mesh position={[0, (sill + top) / 2, 0]}>
        <planeGeometry args={[L, top - sill]}/>
        <meshBasicMaterial color="#d6ecff" transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false}/>
      </mesh>
      {box(sill, top, 0.05, WALL_T + 0.02, frame, -L / 2)}
      {box(sill, top, 0.05, WALL_T + 0.02, frame, L / 2)}
      {box(sill, top, 0.03, WALL_T + 0.02, frame, 0)}
    </>);
  }
  return (
    <group position={[seg.x, 0, seg.z]} rotation={[0, seg.o === 'h' ? 0 : Math.PI / 2, 0]}>{body}</group>
  );
});

function SafeText({ children, ...props }) {
  return (
    <Suspense fallback={null}>
      <Text anchorX="center" anchorY="middle" {...props}>{children}</Text>
    </Suspense>
  );
}

function ToolBtn({ x, label, color, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <group position={[x, 0, 0]}
      onClick={e => { e.stopPropagation(); onClick(); }}
      onPointerDown={stop}
      onPointerOver={() => setHov(true)} onPointerOut={() => setHov(false)}>
      <mesh><planeGeometry args={[0.3, 0.13]}/><meshBasicMaterial color={hov ? GOLD : color}/></mesh>
      <SafeText position={[0, 0, 0.005]} fontSize={0.055} color="#ffffff">{label}</SafeText>
    </group>
  );
}

function CatalogTile({ def, x, y, active, onPick }) {
  const [hov, setHov] = useState(false);
  const sc = 0.15 / Math.max(def.w, def.d, def.h);
  return (
    <group position={[x, y, 0]}
      onClick={e => { e.stopPropagation(); onPick(def); }}
      onPointerDown={stop}
      onPointerOver={() => setHov(true)} onPointerOut={() => setHov(false)}>
      <mesh>
        <planeGeometry args={[0.31, 0.31]}/>
        <meshBasicMaterial color={active ? '#5a4720' : hov ? '#3a2f1c' : '#1e1913'}/>
      </mesh>
      <group position={[0, 0.03, 0.06]} rotation={[0.35, -0.6, 0]}>
        <group scale={[sc, sc, sc]} position={[0, -def.h * sc / 2, 0]}>
          <FurnitureShape def={def}/>
        </group>
      </group>
      <SafeText position={[0, -0.125, 0.01]} fontSize={0.027} color="#e9e2d3" maxWidth={0.29}>{def.name}</SafeText>
    </group>
  );
}

const TAB_DEFS = [['sugg','This room'],['bedroom','Bedroom'],['living','Living'],['kitchen','Kitchen'],
                  ['bathroom','Bath'],['study','Study'],['common','Decor']];

/* Furniture menu that floats in front of you in VR (left X button toggles it) */
function VRPanel({ open, tick, roomType, roomName, heldDef, onPick }) {
  const grp = useRef();
  const needPlace = useRef(true);
  const [tab, setTab] = useState('sugg');
  const tv = useMemo(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3() }), []);
  useEffect(() => { needPlace.current = true; }, [tick]);
  useEffect(() => { setTab('sugg'); }, [roomType]);
  useFrame(({ gl }) => {
    if (!open || !needPlace.current || !grp.current || !gl.xr.isPresenting) return;
    const cam = gl.xr.getCamera();
    cam.getWorldPosition(tv.p);
    if (tv.p.y < 0.3) return;
    cam.getWorldDirection(tv.d); tv.d.y = 0;
    if (tv.d.lengthSq() < 1e-4) return;
    tv.d.normalize();
    grp.current.position.set(tv.p.x + tv.d.x * 1.15, tv.p.y - 0.12, tv.p.z + tv.d.z * 1.15);
    grp.current.rotation.set(0, Math.atan2(-tv.d.x, -tv.d.z), 0);
    needPlace.current = false;
  });
  if (!open) return null;

  const sugIds = SUGGESTIONS[roomType] || ['sofa3', 'dbl_bed', 'plant_lg'];
  const items = tab === 'sugg' ? FDEFS.filter(f => sugIds.includes(f.id)) : FDEFS.filter(f => f.cat === tab);
  const W = 1.4, H = 1.12;
  return (
    <group ref={grp}>
      <mesh position={[0, 0, -0.012]} onPointerDown={stop} onPointerMove={stop}>
        <planeGeometry args={[W + 0.03, H + 0.03]}/><meshBasicMaterial color={GOLD}/>
      </mesh>
      <mesh position={[0, 0, -0.006]} onPointerDown={stop} onPointerMove={stop}>
        <planeGeometry args={[W, H]}/><meshBasicMaterial color="#14110d"/>
      </mesh>
      <SafeText position={[0, H / 2 - 0.075, 0]} fontSize={0.05} color={GOLD}>
        {roomName ? `You are in: ${roomName}` : 'Pick furniture'}
      </SafeText>
      {TAB_DEFS.map(([key, label], i) => (
        <group key={key} position={[(i - 3) * 0.195, H / 2 - 0.175, 0]}
          onClick={e => { e.stopPropagation(); setTab(key); }} onPointerDown={stop}>
          <mesh><planeGeometry args={[0.185, 0.075]}/>
            <meshBasicMaterial color={tab === key ? '#5a4720' : '#241e16'}/></mesh>
          <SafeText position={[0, 0, 0.005]} fontSize={0.032} color={tab === key ? '#ffffff' : '#b9b1a0'}>{label}</SafeText>
        </group>
      ))}
      {items.map((f, i) => (
        <CatalogTile key={f.id} def={f}
          x={((i % 4) - 1.5) * 0.33} y={H / 2 - 0.46 - Math.floor(i / 4) * 0.33}
          active={heldDef?.id === f.id} onPick={onPick}/>
      ))}
      <SafeText position={[0, -H / 2 + 0.05, 0]} fontSize={0.025} color="#8f8878" maxWidth={1.3}>
        Trigger: place / select   Right stick: rotate   A: cancel   B: delete   Left X: menu
      </SafeText>
    </group>
  );
}

/* ─── Whole-house scene: walk inside, pick furniture, place it ─── */
function HouseScene({ rooms, furnitureMap, heldDef, moving, selectedUid, inXR,
                      onPlace, onMoveCommit, onSelect, onRotateItem, onDeleteItem, onStartMove,
                      onPickDef, onCancel, onCurrentRoom }) {
  const house = useMemo(() => buildHouse(rooms), [rooms]);
  const { camera, gl } = useThree();
  const originRef = useRef();
  const lightRef  = useRef();
  const ghostGrp  = useRef();
  const ghost     = useRef({ roomId: null, lx: 0, lz: 0, rot: 0, manual: false });
  const btnPrev   = useRef({});
  const latch     = useRef(0);
  const curRef    = useRef(null);
  const [curId, setCurId] = useState(null);
  const [panel, setPanel] = useState({ open: false, tick: 0 });
  const tmp = useMemo(() => ({
    head: new THREE.Vector3(), fwd: new THREE.Vector3(), rgt: new THREE.Vector3(),
  }), []);

  useEffect(() => {
    if (!house || inXR) return;
    camera.position.set(0, house.span * 0.85, house.span * 0.7);
    camera.lookAt(0, 0, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [house, inXR]);

  useEffect(() => custXRStore.subscribe(s => setPanel(p => {
    if (s.session) return p.open ? p : { open: true, tick: p.tick + 1 };
    return p.open ? { open: false, tick: p.tick } : p;
  })), []);

  useEffect(() => {
    ghost.current = { roomId: null, lx: 0, lz: 0, rot: moving ? moving.rot : 0, manual: !!moving };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldDef?.id, moving?.uid]);

  const fit = (g, lx, lz) => fitInRoom(g, heldDef, lx, lz, ghost.current.rot, !ghost.current.manual);
  const floorMove = g => e => {
    if (!heldDef) return;
    e.stopPropagation();
    ghost.current = { ...ghost.current, ...fit(g, e.point.x - g.cx, e.point.z - g.cz), roomId: g.id };
  };
  const floorDown = g => e => {
    if (!heldDef) return;
    e.stopPropagation();
    const f = fit(g, e.point.x - g.cx, e.point.z - g.cz);
    if (moving) onMoveCommit(moving.uid, g.id, [f.lx, 0, f.lz], f.rot);
    else onPlace(g.id, [f.lx, 0, f.lz], f.rot);
  };
  const rotateHeld = step => {
    const g = ghost.current, gr = house.byId.get(g.roomId);
    const rot = g.rot + step;
    ghost.current = { ...g, rot, manual: true, ...(gr ? fitInRoom(gr, heldDef, g.lx, g.lz, rot, false) : {}) };
  };

  useFrame((_, delta) => {
    if (!house) return;

    const lamp = house.byId.get(curRef.current ?? house.spawn.id);
    if (lamp && lightRef.current) lightRef.current.position.set(lamp.cx, WALL_H - 0.5, lamp.cz);

    const gg = ghostGrp.current;
    if (gg) {
      const g = ghost.current, gr = g.roomId != null ? house.byId.get(g.roomId) : null;
      if (heldDef && gr) {
        gg.visible = true;
        gg.position.set(gr.cx + g.lx, 0, gr.cz + g.lz);
        gg.rotation.y = g.rot;
      } else gg.visible = false;
    }

    const session = custXRStore.getState().session;
    if (!session || !originRef.current) return;
    const origin = originRef.current;
    const xrCam = gl.xr.getCamera();
    xrCam.getWorldPosition(tmp.head);
    xrCam.getWorldDirection(tmp.fwd); tmp.fwd.y = 0;
    if (tmp.fwd.lengthSq() > 1e-4) tmp.fwd.normalize();
    tmp.rgt.crossVectors(tmp.fwd, UP);

    let found = null;
    for (const g of house.rooms) {
      if (Math.abs(tmp.head.x - g.cx) <= g.w / 2 && Math.abs(tmp.head.z - g.cz) <= g.d / 2) { found = g.id; break; }
    }
    if (found != null && found !== curRef.current) { curRef.current = found; setCurId(found); onCurrentRoom(found); }

    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp) continue;
      const hand = src.handedness, n = gp.axes.length;
      const sx = n >= 4 ? gp.axes[2] : gp.axes[0];
      const sy = n >= 4 ? gp.axes[3] : gp.axes[1];

      if (hand === 'left') {
        const mx = Math.abs(sx) > 0.12 ? sx : 0, mz = Math.abs(sy) > 0.12 ? sy : 0;
        if (mx || mz) {
          const sp = 1.8 * delta;
          const dx = (tmp.fwd.x * -mz + tmp.rgt.x * mx) * sp;
          const dz = (tmp.fwd.z * -mz + tmp.rgt.z * mx) * sp;
          const stuck = blocked(house.colliders, tmp.head.x, tmp.head.z);
          if (stuck || !blocked(house.colliders, tmp.head.x + dx, tmp.head.z)) {
            origin.position.x += dx; tmp.head.x += dx;
          }
          if (stuck || !blocked(house.colliders, tmp.head.x, tmp.head.z + dz)) origin.position.z += dz;
        }
      } else if (hand === 'right') {
        const dir = sx > 0.7 ? 1 : sx < -0.7 ? -1 : 0;
        if (dir !== latch.current) {
          latch.current = dir;
          if (dir) {
            if (heldDef) rotateHeld(dir * Math.PI / 2);
            else if (selectedUid) onRotateItem(selectedUid, dir * Math.PI / 2);
            else {
              const a = -dir * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
              const ox = origin.position.x - tmp.head.x, oz = origin.position.z - tmp.head.z;
              origin.position.x = tmp.head.x + ox * c + oz * s;
              origin.position.z = tmp.head.z - ox * s + oz * c;
              origin.rotation.y += a;
            }
          }
        }
      }

      for (let i = 0; i < gp.buttons.length; i++) {
        const key = `${hand}_${i}`, now = gp.buttons[i].pressed;
        if (now && !btnPrev.current[key]) {
          if (hand === 'left' && i === 4) {
            setPanel(p => (p.open ? { open: false, tick: p.tick } : { open: true, tick: p.tick + 1 }));
          } else if (hand === 'right' && i === 4) onCancel();
          else if (hand === 'right' && i === 5 && selectedUid) onDeleteItem(selectedUid);
        }
        btnPrev.current[key] = now;
      }
    }
  });

  if (!house) return null;

  let selItem = null, selRoomId = null;
  if (selectedUid && !moving) {
    for (const g of house.rooms) {
      const it = (furnitureMap[g.id] || []).find(f => f.uid === selectedUid);
      if (it) { selItem = it; selRoomId = g.id; break; }
    }
  }
  const pickAndClose = d => { onPickDef(d); setPanel(p => ({ open: false, tick: p.tick })); };
  const cur = house.byId.get(curId);
  const cutaway = !inXR;

  return (
    <>
      <color attach="background" args={[inXR ? '#bcd6ee' : '#0c0a08']}/>
      <ambientLight intensity={1.5}/>
      <hemisphereLight args={['#dfeaff', '#8b7a62', 1.1]}/>
      <directionalLight position={[6, 12, 4]} intensity={1.2} color="#fff4e0"/>
      <pointLight ref={lightRef} intensity={10} distance={9} decay={1.6} color="#ffe6b8"/>

      <XROrigin ref={originRef} position={[house.spawn.x, 0, house.spawn.z]}/>

      {inXR && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} raycast={noRay}>
          <circleGeometry args={[80, 32]}/><meshLambertMaterial color="#7d9a68"/>
        </mesh>
      )}

      {house.rooms.map(g => (
        <group key={g.id} position={[g.cx, 0, g.cz]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerMove={floorMove(g)} onPointerDown={floorDown(g)}>
            <planeGeometry args={[g.w, g.d]}/>
            <meshLambertMaterial color={FLOOR_CLR[g.type] || '#999'}/>
          </mesh>
          {!inXR && (
            <SafeText position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.34}
              color="#ffffff" fillOpacity={0.35} raycast={noRay}>{g.name}</SafeText>
          )}
          {inXR && g.type !== 'balcony' && (
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]} raycast={noRay}>
              <planeGeometry args={[g.w, g.d]}/><meshLambertMaterial color="#f4efe6"/>
            </mesh>
          )}
          {inXR && g.type !== 'balcony' && (g.w * g.d > 20 ? [-0.25, 0.25] : [0]).map(k => (
            <mesh key={k} position={[k * g.w, WALL_H - 0.04, 0]} raycast={noRay}>
              <cylinderGeometry args={[0.26, 0.26, 0.05, 20]}/><meshBasicMaterial color="#fff0c8"/>
            </mesh>
          ))}
          {(furnitureMap[g.id] || []).map(item => (item.uid === moving?.uid ? null : (
            <FurnitureMesh key={item.uid} item={item} selected={item.uid === selectedUid}
              onSelect={heldDef ? () => {} : onSelect}/>
          )))}
          {selRoomId === g.id && selItem && (
            <group position={[selItem.pos[0], selItem.def.h + 0.45, selItem.pos[2]]}>
              <Billboard>
                <ToolBtn x={-0.33} label="Move"   color="#2c4a6b" onClick={() => onStartMove(selItem.uid)}/>
                <ToolBtn x={0}     label="Rotate" color="#3b5b34" onClick={() => onRotateItem(selItem.uid, Math.PI / 2)}/>
                <ToolBtn x={0.33}  label="Delete" color="#7a2f2f" onClick={() => onDeleteItem(selItem.uid)}/>
              </Billboard>
            </group>
          )}
        </group>
      ))}

      {house.segs.map(s => <WallSegment key={`${s.o}${s.line}_${s.start}_${s.sid}`} seg={s} cutaway={cutaway}/>)}

      {house.patches.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} raycast={noRay}
          position={[p.x + p.nx * (p.small ? 0.5 : 0.9), 0.012, p.z + p.nz * (p.small ? 0.5 : 0.9)]}>
          <planeGeometry args={[p.nz !== 0 ? p.len * 1.1 : 1.8, p.nz !== 0 ? 1.8 : p.len * 1.1]}/>
          <meshBasicMaterial color="#fff3d0" transparent opacity={0.09} depthWrite={false}
            blending={THREE.AdditiveBlending}/>
        </mesh>
      ))}

      <group ref={ghostGrp} visible={false}>
        {heldDef && (<>
          <mesh position={[0, heldDef.h / 2, 0]} raycast={noRay}>
            <boxGeometry args={[heldDef.w + 0.05, heldDef.h + 0.05, heldDef.d + 0.05]}/>
            <meshBasicMaterial color={GOLD} transparent opacity={0.18} depthWrite={false}/>
          </mesh>
          <mesh position={[0, heldDef.h / 2, 0]} raycast={noRay}>
            <boxGeometry args={[heldDef.w, heldDef.h, heldDef.d]}/>
            <meshBasicMaterial color={GOLD} wireframe/>
          </mesh>
        </>)}
      </group>

      {inXR && (
        <VRPanel open={panel.open} tick={panel.tick}
          roomType={cur?.type} roomName={cur?.name} heldDef={heldDef} onPick={pickAndClose}/>
      )}

      {!inXR && <OrbitControls enablePan minDistance={2} maxDistance={40} target={[0, 0, 0]}/>}
    </>
  );
}

/* ─── 3D furnish scene ──────────────────────────────────── */
function FurnishScene({ room, furnitures, pendingDef, onPlace, onSelect, selectedUid }) {
  const { camera } = useThree();
  const previewPosRef = useRef([0,0,0]);
  const rW = room.w * UNIT;
  const rD = room.h * UNIT;
  const wallH = 2.8;

  useEffect(()=>{
    camera.position.set(rW*0.9, rW*1.1, rD*1.5);
    camera.lookAt(0,0.6,0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  const handleMove = useCallback(e=>{
    if (!pendingDef) return;
    const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    previewPosRef.current=[
      cl(e.point.x,-rW/2+pendingDef.w/2, rW/2-pendingDef.w/2),0,
      cl(e.point.z,-rD/2+pendingDef.d/2, rD/2-pendingDef.d/2),
    ];
  },[pendingDef,rW,rD]);

  const handleClick = useCallback(e=>{
    e.stopPropagation();
    if (pendingDef) onPlace([...previewPosRef.current]);
    else onSelect(null);
  },[pendingDef,onPlace,onSelect]);

  return (
    <>
      <ambientLight intensity={0.6}/>
      <directionalLight position={[rW,wallH*1.8,rD]} intensity={1.4} castShadow/>
      <pointLight position={[0,wallH*0.7,0]} intensity={0.5} color="#FFD4A0"/>

      {/* Floor */}
      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow
        onPointerMove={handleMove} onPointerDown={handleClick}>
        <planeGeometry args={[rW,rD]}/><meshStandardMaterial color="#13110E" roughness={0.92}/>
      </mesh>
      <gridHelper args={[Math.max(rW,rD)*2,Math.max(rW,rD)*4,'#2A2418','#1E1A12']} position={[0,0.002,0]}/>

      {/* Walls */}
      <mesh position={[0,wallH/2,-rD/2]} receiveShadow>
        <boxGeometry args={[rW+0.16,wallH,0.08]}/><meshStandardMaterial color="#1C1814" roughness={0.95}/>
      </mesh>
      <mesh position={[-rW/2,wallH/2,0]}>
        <boxGeometry args={[0.08,wallH,rD]}/><meshStandardMaterial color="#1A1612" roughness={0.95}/>
      </mesh>
      <mesh position={[rW/2,wallH/2,0]}>
        <boxGeometry args={[0.08,wallH,rD]}/><meshStandardMaterial color="#1C1814" roughness={0.95}/>
      </mesh>
      {/* Gold skirting */}
      <mesh position={[0,0.04,-rD/2+0.02]}>
        <boxGeometry args={[rW,0.06,0.02]}/><meshStandardMaterial color={GOLD} metalness={0.4} roughness={0.6}/>
      </mesh>

      {/* Furniture */}
      {furnitures.map(item=>(
        <FurnitureMesh key={item.uid} item={item} selected={item.uid===selectedUid} onSelect={onSelect}/>
      ))}
      {pendingDef&&<PlacementPreview def={pendingDef} posRef={previewPosRef}/>}

      <OrbitControls enablePan minDistance={1} maxDistance={14} target={[0,0.5,0]}/>
      <Environment preset="apartment"/>
    </>
  );
}

/* ─── 2D grid editor ─────────────────────────────────────── */
function GridLayout({ rooms, onAdd, onDelete, onSelectRoom, activeRoomId, onApplyTemplate }) {
  const [selType,  setSelType]  = useState(ROOM_DEFS[0]);
  const [drawing,  setDrawing]  = useState(null);
  const gridRef = useRef();

  const getCell = useCallback(e=>{
    const r=gridRef.current.getBoundingClientRect();
    return {
      col:Math.max(0,Math.min(GRID_W-1,Math.floor((e.clientX-r.left)/CELL))),
      row:Math.max(0,Math.min(GRID_H-1,Math.floor((e.clientY-r.top)/CELL))),
    };
  },[]);
  const onDown = useCallback(e=>{
    if(e.button!==0) return;
    const c=getCell(e);
    setDrawing({type:selType,x0:c.col,y0:c.row,x1:c.col,y1:c.row});
  },[selType,getCell]);
  const onMove = useCallback(e=>{
    if(!drawing) return;
    const c=getCell(e);
    setDrawing(d=>({...d,x1:c.col,y1:c.row}));
  },[drawing,getCell]);
  const onUp = useCallback(()=>{
    if(!drawing) return;
    const x=Math.min(drawing.x0,drawing.x1), y=Math.min(drawing.y0,drawing.y1);
    const w=Math.abs(drawing.x1-drawing.x0)+1, h=Math.abs(drawing.y1-drawing.y0)+1;
    if(w>=drawing.type.minW&&h>=drawing.type.minH){
      const c={id:Date.now(),type:drawing.type,x,y,w,h};
      if(!rooms.some(r=>overlaps(c,r))) onAdd(c);
    }
    setDrawing(null);
  },[drawing,rooms,onAdd]);

  const prev=drawing?{
    x:Math.min(drawing.x0,drawing.x1),y:Math.min(drawing.y0,drawing.y1),
    w:Math.abs(drawing.x1-drawing.x0)+1,h:Math.abs(drawing.y1-drawing.y0)+1
  }:null;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12,height:'100%',overflow:'hidden'}}>
      {/* Template row */}
      <div>
        <p style={{color:'rgba(255,255,255,0.28)',fontSize:9,letterSpacing:'0.22em',
                   textTransform:'uppercase',marginBottom:6}}>Start from template</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {Object.entries(BHK_TEMPLATES).map(([key,tpl])=>(
            <motion.button key={key} onClick={()=>onApplyTemplate(key)}
              whileHover={{scale:1.04}} whileTap={{scale:0.96}}
              style={{
                padding:'8px 14px',borderRadius:8,cursor:'pointer',
                background:'rgba(196,154,60,0.1)',
                border:'1px solid rgba(196,154,60,0.32)',display:'flex',
                flexDirection:'column',alignItems:'center',gap:2,
              }}>
              <span style={{fontSize:18}}>{tpl.icon}</span>
              <span style={{color:'#c49a3c',fontSize:11.5,fontWeight:600}}>{tpl.label}</span>
              <span style={{color:'rgba(255,255,255,0.32)',fontSize:9}}>{tpl.sqft}</span>
            </motion.button>
          ))}
          {rooms.length>0&&(
            <motion.button onClick={()=>onApplyTemplate(null)}
              whileHover={{scale:1.04}} whileTap={{scale:0.96}}
              style={{
                padding:'8px 14px',borderRadius:8,cursor:'pointer',
                background:'rgba(255,60,60,0.08)',
                border:'1px solid rgba(255,80,80,0.2)',
                display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              }}>
              <span style={{fontSize:16}}>🗑️</span>
              <span style={{color:'rgba(255,100,100,0.8)',fontSize:10.5}}>Clear All</span>
            </motion.button>
          )}
        </div>
      </div>

      <div style={{display:'flex',gap:12,flex:1,overflow:'hidden'}}>
        {/* Palette */}
        <div style={{width:150,flexShrink:0,display:'flex',flexDirection:'column',gap:3,overflowY:'auto'}}>
          <p style={{color:'rgba(255,255,255,0.28)',fontSize:9,letterSpacing:'0.22em',
                     textTransform:'uppercase',marginBottom:2}}>Room Type</p>
          {ROOM_DEFS.map(rt=>(
            <div key={rt.id} onClick={()=>setSelType(rt)}
              style={{
                padding:'7px 10px',borderRadius:7,cursor:'pointer',display:'flex',alignItems:'center',gap:7,
                background:selType.id===rt.id?'rgba(196,154,60,0.13)':'rgba(255,255,255,0.04)',
                border:`1px solid ${selType.id===rt.id?'rgba(196,154,60,0.44)':'rgba(255,255,255,0.07)'}`,
                transition:'all 0.16s',
              }}>
              <span style={{fontSize:13}}>{rt.icon}</span>
              <span style={{fontSize:11,color:selType.id===rt.id?'#c49a3c':'rgba(255,255,255,0.58)'}}>{rt.name}</span>
            </div>
          ))}
          <div style={{marginTop:8,padding:'8px 10px',borderRadius:8,
                       background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
            <p style={{color:'rgba(255,255,255,0.28)',fontSize:9,letterSpacing:'0.2em',
                       textTransform:'uppercase',marginBottom:4}}>Placed</p>
            {ROOM_DEFS.map(rt=>{
              const n=rooms.filter(r=>r.type.id===rt.id).length;
              if(!n) return null;
              return (
                <div key={rt.id} style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{color:'rgba(255,255,255,0.42)',fontSize:10}}>{rt.name}</span>
                  <span style={{color:'#c49a3c',fontSize:10,fontWeight:600}}>×{n}</span>
                </div>
              );
            })}
            {rooms.length===0&&<p style={{color:'rgba(255,255,255,0.18)',fontSize:10,fontStyle:'italic'}}>Drag on grid →</p>}
          </div>
        </div>

        {/* Grid */}
        <div style={{flex:1,overflow:'auto'}}>
          <div ref={gridRef}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
            onMouseLeave={()=>setDrawing(null)}
            style={{
              position:'relative',width:GRID_W*CELL,height:GRID_H*CELL,
              background:'rgba(255,255,255,0.025)',
              border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,
              cursor:'crosshair',userSelect:'none',flexShrink:0,
            }}>
            {Array.from({length:GRID_H}).map((_,r)=>
              Array.from({length:GRID_W}).map((_,c)=>(
                <div key={`${r}-${c}`} style={{
                  position:'absolute',left:c*CELL,top:r*CELL,width:CELL,height:CELL,
                  border:'1px solid rgba(255,255,255,0.04)',boxSizing:'border-box',pointerEvents:'none',
                }}/>
              ))
            )}
            {rooms.map(room=>{
              const isSel=room.id===activeRoomId;
              return (
                <div key={room.id} onClick={()=>onSelectRoom(room.id)}
                  style={{
                    position:'absolute',left:room.x*CELL+2,top:room.y*CELL+2,
                    width:room.w*CELL-4,height:room.h*CELL-4,
                    background:room.type.bg,
                    border:`2px solid ${isSel?GOLD:room.type.brd}`,
                    boxShadow:isSel?`0 0 0 2px ${GOLD}44`:'none',
                    borderRadius:4,boxSizing:'border-box',zIndex:1,cursor:'pointer',
                    display:'flex',flexDirection:'column',alignItems:'center',
                    justifyContent:'center',overflow:'hidden',transition:'border-color 0.2s',
                  }}>
                  <span style={{fontSize:Math.min(18,room.w*CELL*0.28),lineHeight:1}}>{room.type.icon}</span>
                  <span style={{
                    color:room.type.brd,fontWeight:600,textAlign:'center',
                    fontSize:Math.min(10,room.w*CELL*0.13),padding:'0 2px',lineHeight:1.2,
                  }}>{room.type.name}</span>
                  <span style={{color:'rgba(255,255,255,0.3)',fontSize:8,marginTop:1}}>
                    {(room.w*UNIT).toFixed(1)}×{(room.h*UNIT).toFixed(1)}m
                  </span>
                  <button onClick={e=>{e.stopPropagation();onDelete(room.id);}}
                    style={{
                      position:'absolute',top:2,right:2,width:13,height:13,borderRadius:'50%',
                      padding:0,cursor:'pointer',lineHeight:1,
                      background:'rgba(255,60,60,0.14)',border:'1px solid rgba(255,80,80,0.3)',
                      color:'rgba(255,120,120,0.85)',fontSize:6,
                      display:'flex',alignItems:'center',justifyContent:'center',
                    }}>✕</button>
                </div>
              );
            })}
            {prev&&(
              <div style={{
                position:'absolute',left:prev.x*CELL,top:prev.y*CELL,
                width:prev.w*CELL,height:prev.h*CELL,
                background:selType.bg.replace('0.92','0.44'),
                border:`2px dashed ${selType.brd}`,
                borderRadius:4,boxSizing:'border-box',pointerEvents:'none',zIndex:2,
                display:'flex',alignItems:'center',justifyContent:'center',
              }}>
                <span style={{fontSize:20}}>{selType.icon}</span>
              </div>
            )}
          </div>
          <p style={{color:'rgba(255,255,255,0.18)',fontSize:9,marginTop:4,letterSpacing:'0.1em'}}>
            Each cell = {UNIT} m  ·  Grid = {(GRID_W*UNIT).toFixed(1)} m × {(GRID_H*UNIT).toFixed(1)} m  ·  Click a room to furnish it
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function RoomCustomizerPage({ onBack }) {
  const [rooms,        setRooms]        = useState([]);
  const [phase,        setPhase]        = useState('layout');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [furnitureMap, setFurnitureMap] = useState({});
  const [pendingDef,   setPendingDef]   = useState(null);
  const [selectedUid,  setSelectedUid]  = useState(null);
  const [fCat,         setFCat]         = useState('all');
  const [inXR,         setInXR]         = useState(false);
  const [viewMode,     setViewMode]     = useState('room');
  const [moveUid,      setMoveUid]      = useState(null);
  const [toast,        setToast]        = useState(null);
  const [hasSaved,     setHasSaved]     = useState(()=>!!localStorage.getItem('vayam_room_layout'));

  const activeRoom       = rooms.find(r=>r.id===activeRoomId);
  const activeFurnitures = activeRoomId?(furnitureMap[activeRoomId]||[]):[];
  const suggIds          = SUGGESTIONS[activeRoom?.type?.id]||[];
  const suggestedDefs    = FDEFS.filter(f=>suggIds.includes(f.id));
  const visibleDefs      = FDEFS.filter(f=>fCat==='all'||f.cat===fCat);

  const movingItem = moveUid
    ? Object.values(furnitureMap).flat().find(f=>f.uid===moveUid) || null
    : null;
  const heldDef = movingItem ? movingItem.def : pendingDef;

  /* XR session subscription: entering VR switches to the walk-in house */
  useEffect(()=>custXRStore.subscribe(s=>{
    const on=!!s.session;
    setInXR(on);
    if(on) setViewMode('house');
  }),[]);

  const rotateItem = useCallback((uid,delta)=>{
    setFurnitureMap(prev=>Object.fromEntries(
      Object.entries(prev).map(([rid,arr])=>[
        rid, arr.map(f=>f.uid===uid?{...f,rot:f.rot+delta}:f),
      ])
    ));
  },[]);
  const deleteItem = useCallback(uid=>{
    setFurnitureMap(prev=>{
      const next={};
      for(const [rid,arr] of Object.entries(prev)) next[rid]=arr.filter(f=>f.uid!==uid);
      return next;
    });
    setSelectedUid(s=>s===uid?null:s);
    setMoveUid(m=>m===uid?null:m);
  },[]);
  const cancelAction = useCallback(()=>{
    setPendingDef(null); setMoveUid(null); setSelectedUid(null);
  },[]);

  /* Keyboard shortcuts */
  useEffect(()=>{
    if(phase!=='furnish') return;
    const h=e=>{
      if((e.key==='r'||e.key==='R')&&selectedUid) rotateItem(selectedUid,Math.PI/2);
      if((e.key==='Delete'||e.key==='Backspace')&&selectedUid) deleteItem(selectedUid);
      if(e.key==='Escape') cancelAction();
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[phase,selectedUid,rotateItem,deleteItem,cancelAction]);

  /* Toast auto-dismiss */
  useEffect(()=>{
    if(!toast) return;
    const t=setTimeout(()=>setToast(null),2800);
    return ()=>clearTimeout(t);
  },[toast]);

  const handleAddRoom    = useCallback(r=>setRooms(rs=>[...rs,r]),[]);
  const handleDeleteRoom = useCallback(id=>{
    setRooms(rs=>rs.filter(r=>r.id!==id));
    setFurnitureMap(p=>{const n={...p};delete n[id];return n;});
    if(activeRoomId===id){setActiveRoomId(null);setPhase('layout');}
  },[activeRoomId]);
  const handleSelectRoom = useCallback(id=>{
    setActiveRoomId(id); setPhase('furnish'); setPendingDef(null); setSelectedUid(null);
  },[]);
  const handlePlace = useCallback(pos=>{
    if(!pendingDef||!activeRoomId) return;
    setFurnitureMap(prev=>({
      ...prev,[activeRoomId]:[
        ...(prev[activeRoomId]||[]),
        {uid:`${Date.now()}-${Math.random().toString(36).slice(2)}`,def:pendingDef,pos,rot:0},
      ],
    }));
    setPendingDef(null);
  },[pendingDef,activeRoomId]);
  const handleApplyTemplate = useCallback(key=>{
    if(!key){setRooms([]);setFurnitureMap({});setActiveRoomId(null);return;}
    const newRooms=applyTemplate(key);
    setRooms(newRooms); setFurnitureMap({});
    setActiveRoomId(null); setPhase('layout');
  },[]);
  const handleSave = useCallback(()=>{
    try{saveLayoutData(rooms,furnitureMap);setToast('saved');setHasSaved(true);}
    catch(e){setToast('error');}
  },[rooms,furnitureMap]);
  const handleLoad = useCallback(()=>{
    const data=loadSavedLayout();
    if(!data){setToast('error');return;}
    setRooms(data.rooms); setFurnitureMap(data.furnitureMap);
    setPhase('layout'); setActiveRoomId(null);
  },[]);
  const handlePlaceAt = useCallback((roomId,pos,rot)=>{
    if(!pendingDef) return;
    setFurnitureMap(prev=>({
      ...prev,[roomId]:[
        ...(prev[roomId]||[]),
        {uid:`${Date.now()}-${Math.random().toString(36).slice(2)}`,def:pendingDef,pos,rot},
      ],
    }));
    setPendingDef(null);
  },[pendingDef]);
  const handleMoveCommit = useCallback((uid,roomId,pos,rot)=>{
    setFurnitureMap(prev=>{
      const item=Object.values(prev).flat().find(f=>f.uid===uid);
      if(!item) return prev;
      const next=Object.fromEntries(
        Object.entries(prev).map(([rid,arr])=>[rid,arr.filter(f=>f.uid!==uid)])
      );
      next[roomId]=[...(next[roomId]||[]),{...item,pos,rot}];
      return next;
    });
    setMoveUid(null);
  },[]);
  const handleStartMove = useCallback(uid=>{ setPendingDef(null); setMoveUid(uid); },[]);
  const handlePickDef   = useCallback(d=>{ setMoveUid(null); setSelectedUid(null); setPendingDef(d); },[]);
  const handleCurrentRoom = useCallback(id=>setActiveRoomId(id),[]);

  const handleEnterVR = async()=>{
    if(!window.isSecureContext){
      alert('VR needs a secure (https) page. Open the deployed https site in the Meta Quest Browser.');
      return;
    }
    if(!navigator.xr){
      alert('This browser has no WebXR. Open the page in the Meta Quest Browser on your headset, then tap Enter VR.');
      return;
    }
    try{ await custXRStore.enterVR(); }
    catch(e){ alert(`Could not start VR: ${e?.message||e}`); }
  };

  const hintText = viewMode==='house'
    ? (heldDef
        ? `${movingItem?'Moving':'Placing'} "${heldDef.name}" — click a floor to drop it · Esc cancels`
        : selectedUid
          ? 'Use Move / Rotate / Delete above the piece · Esc deselects'
          : 'Pick furniture, then click any room floor. Click a piece to edit it.')
    : pendingDef
      ? `Placing "${pendingDef.name}" — click floor to place`
      : selectedUid
        ? 'R = rotate 90°  ·  Del = remove  ·  Click floor to deselect'
        : 'Pick furniture from the left panel, then click the floor';

  return (
    <motion.div className="absolute inset-0 flex flex-col" style={{background:'#070608'}}
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.3}}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-7 py-3 border-b"
        style={{borderColor:'rgba(255,255,255,0.07)',background:'rgba(0,0,0,0.86)',backdropFilter:'blur(20px)'}}>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={phase==='furnish'?()=>{setPhase('layout');setPendingDef(null);}:onBack}
            className="text-white/40 hover:text-[#c49a3c] transition-colors"
            style={{fontSize:20}} whileHover={{x:-3}} whileTap={{scale:0.9}}>←</motion.button>
          <div>
            <p className="text-[#c49a3c] text-[9px] tracking-[0.4em] uppercase">Room Customizer</p>
            <h2 className="text-white font-light text-sm sm:text-base tracking-wide">
              {phase==='layout'
                ? 'Design Your Floor Plan'
                : activeRoom
                  ? `Furnish · ${activeRoom.type.icon} ${activeRoom.type.name} (${(activeRoom.w*UNIT).toFixed(1)} m × ${(activeRoom.h*UNIT).toFixed(1)} m)`
                  : 'Furnish Rooms'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            {[['layout','1. Layout'],['furnish','2. Furnish']].map(([p,lbl])=>(
              <div key={p} style={{
                padding:'5px 12px',borderRadius:20,fontSize:10,letterSpacing:'0.14em',
                textTransform:'uppercase',fontWeight:500,
                background:phase===p?'rgba(196,154,60,0.17)':'rgba(255,255,255,0.04)',
                border:`1px solid ${phase===p?'rgba(196,154,60,0.48)':'rgba(255,255,255,0.07)'}`,
                color:phase===p?'#c49a3c':'rgba(255,255,255,0.28)',
              }}>{lbl}</div>
            ))}
          </div>

          {phase==='furnish'&&!inXR&&(
            <div style={{display:'flex',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.14)'}}>
              {[['room','Room'],['house','Whole house']].map(([m,lbl])=>(
                <button key={m} onClick={()=>{setViewMode(m);cancelAction();}}
                  style={{
                    padding:'6px 12px',fontSize:10,letterSpacing:'0.12em',textTransform:'uppercase',cursor:'pointer',
                    background:viewMode===m?'rgba(196,154,60,0.22)':'rgba(255,255,255,0.04)',
                    color:viewMode===m?'#c49a3c':'rgba(255,255,255,0.5)',border:'none',
                  }}>{lbl}</button>
              ))}
            </div>
          )}

          {phase==='furnish'&&(
            <motion.button
              onClick={inXR?()=>custXRStore.getState().session?.end():handleEnterVR}
              whileHover={{scale:1.04}} whileTap={{scale:0.94}}
              style={{
                padding:'6px 14px',borderRadius:20,fontSize:10,letterSpacing:'0.14em',
                textTransform:'uppercase',fontWeight:500,cursor:'pointer',
                background:inXR?'rgba(196,154,60,0.22)':'rgba(255,255,255,0.06)',
                border:`1px solid ${inXR?'rgba(196,154,60,0.6)':'rgba(255,255,255,0.14)'}`,
                color:inXR?'#c49a3c':'rgba(255,255,255,0.55)',
              }}>
              {inXR?'Exit VR':'🥽 Enter VR'}
            </motion.button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {phase==='layout' ? (
          <div className="flex-1 p-4 overflow-auto">
            <GridLayout
              rooms={rooms} onAdd={handleAddRoom} onDelete={handleDeleteRoom}
              onSelectRoom={handleSelectRoom} activeRoomId={activeRoomId}
              onApplyTemplate={handleApplyTemplate}/>
          </div>
        ) : (
          <>
            {/* Furniture sidebar */}
            <div className="flex-shrink-0 flex flex-col border-r overflow-hidden"
              style={{width:204,borderColor:'rgba(255,255,255,0.07)',background:'rgba(0,0,0,0.62)'}}>

              {/* Room selector */}
              <div className="p-3 border-b" style={{borderColor:'rgba(255,255,255,0.07)'}}>
                <p style={{color:'rgba(255,255,255,0.28)',fontSize:9,letterSpacing:'0.2em',
                           textTransform:'uppercase',marginBottom:5}}>Room</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {rooms.map(r=>(
                    <button key={r.id}
                      onClick={()=>{setActiveRoomId(r.id);cancelAction();}}
                      style={{
                        padding:'4px 8px',borderRadius:5,fontSize:9.5,cursor:'pointer',
                        background:r.id===activeRoomId?'rgba(196,154,60,0.17)':'rgba(255,255,255,0.05)',
                        border:`1px solid ${r.id===activeRoomId?'rgba(196,154,60,0.44)':'rgba(255,255,255,0.08)'}`,
                        color:r.id===activeRoomId?'#c49a3c':'rgba(255,255,255,0.46)',
                      }}>{r.type.icon} {r.type.name}</button>
                  ))}
                </div>
              </div>

              {/* Smart suggestions */}
              {suggestedDefs.length>0&&(
                <div className="p-3 border-b" style={{borderColor:'rgba(255,255,255,0.07)'}}>
                  <p style={{color:'rgba(196,154,60,0.7)',fontSize:9,letterSpacing:'0.2em',
                             textTransform:'uppercase',marginBottom:5}}>
                    💡 Suggested for {activeRoom?.type?.name}
                  </p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {suggestedDefs.map(f=>{
                      const active=pendingDef?.id===f.id;
                      return (
                        <button key={f.id} onClick={()=>handlePickDef(active?null:f)}
                          style={{
                            padding:'4px 8px',borderRadius:5,fontSize:9.5,cursor:'pointer',
                            display:'flex',alignItems:'center',gap:4,
                            background:active?'rgba(196,154,60,0.2)':'rgba(255,255,255,0.05)',
                            border:`1px solid ${active?'rgba(196,154,60,0.55)':'rgba(255,255,255,0.08)'}`,
                            color:active?'#c49a3c':'rgba(255,255,255,0.55)',
                          }}>
                          <div style={{width:7,height:7,borderRadius:1,background:f.color,flexShrink:0}}/>
                          {f.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category filter */}
              <div className="px-2 pt-2 flex flex-wrap gap-1">
                {CAT_ORDER.map(cat=>(
                  <button key={cat} onClick={()=>setFCat(cat)}
                    style={{
                      padding:'3px 6px',borderRadius:10,fontSize:9,cursor:'pointer',
                      letterSpacing:'0.08em',textTransform:'capitalize',
                      background:fCat===cat?'rgba(196,154,60,0.17)':'transparent',
                      border:`1px solid ${fCat===cat?'rgba(196,154,60,0.4)':'rgba(255,255,255,0.07)'}`,
                      color:fCat===cat?'#c49a3c':'rgba(255,255,255,0.34)',
                    }}>{CAT_ICONS[cat]} {cat}</button>
                ))}
              </div>

              {/* Full catalog */}
              <div className="flex-1 overflow-y-auto p-2"
                style={{display:'flex',flexDirection:'column',gap:2}}>
                {visibleDefs.map(f=>{
                  const active=pendingDef?.id===f.id;
                  return (
                    <motion.button key={f.id} onClick={()=>handlePickDef(active?null:f)}
                      whileHover={{scale:1.02}} whileTap={{scale:0.97}}
                      style={{
                        padding:'7px 9px',borderRadius:7,textAlign:'left',cursor:'pointer',
                        background:active?'rgba(196,154,60,0.18)':'rgba(255,255,255,0.04)',
                        border:`1px solid ${active?'rgba(196,154,60,0.55)':'rgba(255,255,255,0.07)'}`,
                        display:'flex',alignItems:'center',gap:7,
                      }}>
                      <div style={{width:9,height:9,borderRadius:2,flexShrink:0,
                                   background:f.color,border:'1px solid rgba(255,255,255,0.13)'}}/>
                      <div>
                        <p style={{color:active?'#c49a3c':'rgba(255,255,255,0.68)',
                                   fontSize:11,fontWeight:active?600:400}}>{f.name}</p>
                        <p style={{color:'rgba(255,255,255,0.26)',fontSize:9}}>{f.w}m × {f.d}m</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Hint */}
              <div className="p-2 border-t" style={{borderColor:'rgba(255,255,255,0.07)'}}>
                {inXR ? (
                  <p style={{color:'rgba(196,154,60,0.7)',fontSize:9,lineHeight:1.5}}>
                    VR active · Left stick walk · Right stick turn / rotate · Left X furniture menu
                  </p>
                ) : (
                  <p style={{color:'rgba(255,255,255,0.22)',fontSize:9,lineHeight:1.5}}>{hintText}</p>
                )}
              </div>
            </div>

            {/* 3D canvas */}
            <div className="flex-1 relative">
              {(viewMode==='house'||activeRoom)?(
                <Canvas shadows={viewMode!=='house'} camera={{fov:viewMode==='house'?50:55,position:[5,5,7]}}
                  dpr={Math.min(window.devicePixelRatio,1.5)}>
                  <XR store={custXRStore}>
                    <Suspense fallback={null}>
                      {viewMode==='house' ? (
                        <HouseScene
                          rooms={rooms} furnitureMap={furnitureMap}
                          heldDef={heldDef} moving={movingItem} selectedUid={selectedUid} inXR={inXR}
                          onPlace={handlePlaceAt} onMoveCommit={handleMoveCommit}
                          onSelect={setSelectedUid} onRotateItem={rotateItem}
                          onDeleteItem={deleteItem} onStartMove={handleStartMove}
                          onPickDef={handlePickDef} onCancel={cancelAction}
                          onCurrentRoom={handleCurrentRoom}
                        />
                      ) : (
                        <FurnishScene
                          room={activeRoom} furnitures={activeFurnitures}
                          pendingDef={pendingDef} onPlace={handlePlace}
                          onSelect={setSelectedUid} selectedUid={selectedUid}
                        />
                      )}
                    </Suspense>
                  </XR>
                </Canvas>
              ):(
                <div className="flex items-center justify-center h-full">
                  <p style={{color:'rgba(255,255,255,0.28)',fontSize:14}}>Select a room from the left panel</p>
                </div>
              )}

              <motion.button
                onClick={()=>{setPhase('layout');setPendingDef(null);}}
                className="absolute top-4 right-4 z-10 flex items-center gap-2 text-xs tracking-widest uppercase rounded-full"
                style={{
                  padding:'8px 16px',backdropFilter:'blur(12px)',
                  background:'rgba(0,0,0,0.72)',border:'1px solid rgba(255,255,255,0.11)',
                  color:'rgba(255,255,255,0.46)',
                }}
                whileHover={{scale:1.03}} whileTap={{scale:0.96}}>← Edit Layout</motion.button>
            </div>
          </>
        )}
      </div>

      {/* Bottom bar */}
      <AnimatePresence>
        {rooms.length>0&&(
          <motion.div
            className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-t"
            style={{borderColor:'rgba(255,255,255,0.07)',background:'rgba(0,0,0,0.72)'}}
            initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}}>
            <div className="flex items-center gap-3">
              <p style={{color:'rgba(255,255,255,0.35)',fontSize:11}}>
                {rooms.length} room{rooms.length>1?'s':''} · {activeFurnitures.length} piece{activeFurnitures.length!==1?'s':''} in selected room
              </p>
              {hasSaved&&(
                <button onClick={handleLoad}
                  style={{
                    padding:'5px 10px',borderRadius:6,fontSize:10,cursor:'pointer',
                    background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',
                    color:'rgba(255,255,255,0.42)',letterSpacing:'0.12em',textTransform:'uppercase',
                  }}>↑ Load Saved</button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {phase==='layout'&&(
                <motion.button
                  onClick={()=>{setActiveRoomId(rooms[0].id);setPhase('furnish');}}
                  whileHover={{scale:1.03}} whileTap={{scale:0.96}}
                  style={{
                    padding:'9px 18px',borderRadius:24,fontSize:10,letterSpacing:'0.18em',
                    textTransform:'uppercase',fontWeight:500,
                    background:'rgba(196,154,60,0.17)',border:'1px solid rgba(196,154,60,0.48)',
                    color:'#c49a3c',cursor:'pointer',
                  }}>Furnish Rooms →</motion.button>
              )}
              <motion.button onClick={handleSave}
                whileHover={{scale:1.03}} whileTap={{scale:0.96}}
                style={{
                  padding:'9px 18px',borderRadius:24,fontSize:10,letterSpacing:'0.18em',
                  textTransform:'uppercase',fontWeight:500,
                  background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.14)',
                  color:'rgba(255,255,255,0.55)',cursor:'pointer',
                }}>💾 Save Layout</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast&&(
          <motion.div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm"
            style={{
              background:toast==='saved'?'rgba(30,60,20,0.96)':'rgba(60,20,20,0.96)',
              border:`1px solid ${toast==='saved'?'rgba(100,200,60,0.4)':'rgba(200,60,60,0.4)'}`,
              color:toast==='saved'?'#90e060':'#e06060',
              backdropFilter:'blur(20px)',
            }}
            initial={{opacity:0,y:8,scale:0.96}} animate={{opacity:1,y:0,scale:1}}
            exit={{opacity:0,y:6,scale:0.97}}>
            {toast==='saved'?'✓ Layout saved & downloaded':'✕ Save failed — check browser permissions'}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
