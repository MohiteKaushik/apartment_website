import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { createXRStore, XR } from '@react-three/xr';

/* ─── XR store ──────────────────────────────────────────── */
const custXRStore = createXRStore({ emulate: false });

/* ─── Constants ─────────────────────────────────────────── */
const GOLD   = '#c49a3c';
const GRID_W = 20;
const GRID_H = 14;
const CELL   = 36;   // px; each cell = 0.5 m → grid = 10 m × 7 m

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
      { typeId:'living',   x:0,  y:0,  w:10, h:7 },
      { typeId:'kitchen',  x:10, y:0,  w:10, h:7 },
      { typeId:'bedroom',  x:0,  y:7,  w:9,  h:7 },
      { typeId:'bedroom',  x:9,  y:7,  w:7,  h:7 },
      { typeId:'bathroom', x:16, y:7,  w:4,  h:4 },
      { typeId:'balcony',  x:16, y:11, w:4,  h:3 },
    ],
  },
  '3BHK': {
    label:'3 BHK', sqft:'~1200 sq.ft', icon:'🏡',
    rooms:[
      { typeId:'living',   x:0,  y:0,  w:10, h:7 },
      { typeId:'kitchen',  x:10, y:0,  w:6,  h:7 },
      { typeId:'study',    x:16, y:0,  w:4,  h:5 },
      { typeId:'bathroom', x:16, y:5,  w:4,  h:2 },
      { typeId:'bedroom',  x:0,  y:7,  w:7,  h:7 },
      { typeId:'bedroom',  x:7,  y:7,  w:6,  h:7 },
      { typeId:'bedroom',  x:13, y:7,  w:4,  h:7 },
      { typeId:'bathroom', x:17, y:7,  w:3,  h:4 },
      { typeId:'balcony',  x:17, y:11, w:3,  h:3 },
    ],
  },
  '4BHK': {
    label:'4 BHK', sqft:'~1600 sq.ft', icon:'🏰',
    rooms:[
      { typeId:'living',   x:0,  y:0,  w:10, h:7 },
      { typeId:'kitchen',  x:10, y:0,  w:6,  h:5 },
      { typeId:'study',    x:16, y:0,  w:4,  h:4 },
      { typeId:'corridor', x:10, y:5,  w:6,  h:2 },
      { typeId:'bathroom', x:16, y:4,  w:4,  h:3 },
      { typeId:'bedroom',  x:0,  y:7,  w:5,  h:7 },
      { typeId:'bedroom',  x:5,  y:7,  w:5,  h:7 },
      { typeId:'bedroom',  x:10, y:7,  w:5,  h:7 },
      { typeId:'bedroom',  x:15, y:7,  w:3,  h:7 },
      { typeId:'bathroom', x:18, y:7,  w:2,  h:4 },
      { typeId:'balcony',  x:18, y:11, w:2,  h:3 },
    ],
  },
};

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
    version: 1,
    savedAt: new Date().toISOString(),
    rooms: rooms.map(r => ({ typeId: r.type.id, x:r.x, y:r.y, w:r.w, h:r.h })),
    furniture: Object.fromEntries(
      Object.entries(furnitureMap).map(([rid, items]) => [
        rid,
        items.map(it => ({ defId: it.def.id, pos: it.pos, rot: it.rot })),
      ])
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
    const roomEntries = Object.entries(data.furniture || {});
    roomEntries.forEach(([_rid, items], idx) => {
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
function FurnitureShape({ def }) {
  const { id, w, d, h, color: c } = def;
  const Bx = ({ pos, size, clr, r=0.8, m=0.05, k }) => (
    <mesh key={k} position={pos} castShadow>
      <boxGeometry args={size}/>
      <meshStandardMaterial color={clr} roughness={r} metalness={m}/>
    </mesh>
  );
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

/* ─── VR thumbstick → 90° rotation ─────────────────────── */
function XRThumbstickHandler({ selectedUid, activeRoomId, setFurnitureMap }) {
  const lastAxRef = useRef(0);
  useFrame(()=>{
    if (!selectedUid||!activeRoomId) return;
    const gpads = navigator.getGamepads?.()??[];
    for (const gp of gpads) {
      if (!gp) continue;
      const ax = gp.axes[2]??0;
      const prev = lastAxRef.current;
      const rotate = (delta) => setFurnitureMap(m=>{
        const arr=[...(m[activeRoomId]??[])];
        const i=arr.findIndex(f=>f.uid===selectedUid);
        if(i<0) return m;
        const na=[...arr]; na[i]={...arr[i],rot:arr[i].rot+delta};
        return {...m,[activeRoomId]:na};
      });
      if (ax>0.7&&prev<=0.7)  rotate( Math.PI/2);
      if (ax<-0.7&&prev>=-0.7) rotate(-Math.PI/2);
      lastAxRef.current = ax;
    }
  });
  return null;
}

/* ─── VR floating furniture catalog ─────────────────────── */
function VRFurnitureCatalog({ defs, pendingDef, onSelect, rW }) {
  const COLS = 3, SPACING = 0.28;
  return (
    <group position={[rW/2+0.9, 1.5, 0]} rotation={[0,-Math.PI/2, 0]}>
      <mesh position={[(COLS-1)*SPACING/2, -Math.ceil(defs.length/COLS)*SPACING/2+SPACING/2, -0.02]}>
        <boxGeometry args={[COLS*SPACING+0.22, Math.ceil(defs.length/COLS)*SPACING+0.18, 0.02]}/>
        <meshBasicMaterial color="#0E0C0A" transparent opacity={0.9}/>
      </mesh>
      <mesh position={[(COLS-1)*SPACING/2, SPACING*0.55, -0.005]}>
        <boxGeometry args={[COLS*SPACING+0.24, 0.015, 0.005]}/>
        <meshBasicMaterial color={GOLD}/>
      </mesh>
      {defs.slice(0,12).map((f,i)=>{
        const col=i%COLS, row=Math.floor(i/COLS);
        const active=pendingDef?.id===f.id;
        const sc=Math.min(0.1/Math.max(f.w,f.d,f.h), 1);
        return (
          <group key={f.id}
            position={[col*SPACING, -row*SPACING, 0]}
            onClick={e=>{ e.stopPropagation(); onSelect(active?null:f); }}>
            <mesh position={[0,0,-0.008]}>
              <planeGeometry args={[SPACING*0.88,SPACING*0.88]}/>
              <meshBasicMaterial color={active?'#2A2010':'#181410'} transparent opacity={0.95}/>
            </mesh>
            {active&&(
              <mesh position={[0,0,-0.006]}>
                <planeGeometry args={[SPACING*0.92,SPACING*0.92]}/>
                <meshBasicMaterial color={GOLD} transparent opacity={0.18}/>
              </mesh>
            )}
            <group scale={[sc,sc,sc]} position={[0,(-f.h*sc)/2+0.02,0.01]}>
              <FurnitureShape def={f}/>
            </group>
            <mesh position={[SPACING*0.34,-SPACING*0.34,0.005]}>
              <planeGeometry args={[0.04,0.04]}/>
              <meshBasicMaterial color={f.color}/>
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ─── Gate: renders children only when XR session is active */
function OnlyInXR({ children }) {
  const [active, setActive] = useState(false);
  useEffect(()=> custXRStore.subscribe(s=>setActive(!!s.session)), []);
  return active ? <>{children}</> : null;
}

/* ─── 3D furnish scene ──────────────────────────────────── */
function FurnishScene({ room, furnitures, pendingDef, onPlace, onSelect, selectedUid,
                        setFurnitureMap, visibleDefs, onSelectDef }) {
  const { camera } = useThree();
  const previewPosRef = useRef([0,0,0]);
  const rW = room.w * 0.5;
  const rD = room.h * 0.5;
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
      <mesh position={[0,wallH,0]}>
        <boxGeometry args={[rW+0.16,0.06,rD+0.16]}/><meshStandardMaterial color="#121010"/>
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

      {/* VR-only: floating catalog + thumbstick handler */}
      <OnlyInXR>
        <VRFurnitureCatalog defs={visibleDefs} pendingDef={pendingDef} onSelect={onSelectDef} rW={rW}/>
        <XRThumbstickHandler selectedUid={selectedUid} activeRoomId={room.id} setFurnitureMap={setFurnitureMap}/>
      </OnlyInXR>

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
                    {(room.w*0.5).toFixed(1)}×{(room.h*0.5).toFixed(1)}m
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
            Each cell = 0.5 m  ·  Grid = {GRID_W*0.5} m × {GRID_H*0.5} m  ·  Click a room to furnish it
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
  const [toast,        setToast]        = useState(null);
  const [hasSaved,     setHasSaved]     = useState(()=>!!localStorage.getItem('vayam_room_layout'));

  const activeRoom       = rooms.find(r=>r.id===activeRoomId);
  const activeFurnitures = activeRoomId?(furnitureMap[activeRoomId]||[]):[];
  const suggIds          = SUGGESTIONS[activeRoom?.type?.id]||[];
  const suggestedDefs    = FDEFS.filter(f=>suggIds.includes(f.id));
  const visibleDefs      = FDEFS.filter(f=>fCat==='all'||f.cat===fCat);

  /* XR session subscription */
  useEffect(()=>{
    const unsub = custXRStore.subscribe(s=>setInXR(!!s.session));
    return unsub;
  },[]);

  /* Keyboard shortcuts */
  useEffect(()=>{
    if(phase!=='furnish') return;
    const h=e=>{
      if((e.key==='r'||e.key==='R')&&selectedUid&&activeRoomId){
        setFurnitureMap(prev=>{
          const arr=[...(prev[activeRoomId]||[])];
          const i=arr.findIndex(f=>f.uid===selectedUid);
          if(i<0) return prev;
          const na=[...arr]; na[i]={...arr[i],rot:arr[i].rot+Math.PI/2};
          return {...prev,[activeRoomId]:na};
        });
      }
      if((e.key==='Delete'||e.key==='Backspace')&&selectedUid&&activeRoomId){
        setFurnitureMap(prev=>({...prev,[activeRoomId]:(prev[activeRoomId]||[]).filter(f=>f.uid!==selectedUid)}));
        setSelectedUid(null);
      }
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[phase,selectedUid,activeRoomId]);

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
  const handleEnterVR = async()=>{
    try{ await custXRStore.getState().enterXR('immersive-vr'); }
    catch(e){ alert('VR not supported on this device. Use a VR headset or WebXR-enabled browser.'); }
  };

  const hintText = pendingDef
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
                  ? `Furnish · ${activeRoom.type.icon} ${activeRoom.type.name} (${(activeRoom.w*0.5).toFixed(1)} m × ${(activeRoom.h*0.5).toFixed(1)} m)`
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
                      onClick={()=>{setActiveRoomId(r.id);setPendingDef(null);setSelectedUid(null);}}
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
                        <button key={f.id} onClick={()=>setPendingDef(active?null:f)}
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
                    <motion.button key={f.id} onClick={()=>setPendingDef(active?null:f)}
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
                    VR active · Right stick rotates · Use floating catalog in headset
                  </p>
                ) : (
                  <p style={{color:'rgba(255,255,255,0.22)',fontSize:9,lineHeight:1.5}}>{hintText}</p>
                )}
              </div>
            </div>

            {/* 3D canvas */}
            <div className="flex-1 relative">
              {activeRoom?(
                <Canvas shadows camera={{fov:55,position:[5,5,7]}}
                  dpr={Math.min(window.devicePixelRatio,1.5)}>
                  <XR store={custXRStore}>
                    <Suspense fallback={null}>
                      <FurnishScene
                        room={activeRoom} furnitures={activeFurnitures}
                        pendingDef={pendingDef} onPlace={handlePlace}
                        onSelect={setSelectedUid} selectedUid={selectedUid}
                        setFurnitureMap={setFurnitureMap}
                        visibleDefs={visibleDefs} onSelectDef={setPendingDef}
                      />
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
